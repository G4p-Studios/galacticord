const { Events } = require('discord.js');
const { getVoiceConnection, joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { getAudioResource, getAudioStream } = require('../utils/ttsProvider');
const { addToQueue } = require('../utils/audioQueue');
const axios = require('axios');
const cheerio = require('cheerio');

const settingsFile = path.join(__dirname, '../data/tts_settings.json');
const configFile = path.join(__dirname, '../data/server_config.json');

/**
 * Enhanced Link Metadata Extractor
 * Designed for accessibility and descriptive TTS.
 */
async function getLinkDescription(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');

        // 1. YouTube Specialized Handling
        if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
            try {
                // Use YouTube's official oEmbed API for reliable titles without scraping blocks
                const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const response = await axios.get(oEmbedUrl, { timeout: 3000 });
                if (response.data && response.data.title) {
                    return `a YouTube video titled ${response.data.title}`;
                }
            } catch (e) {
                // Fallback to basic scraping if oEmbed fails
                try {
                    const response = await axios.get(url, { timeout: 2000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const $ = cheerio.load(response.data);
                    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
                    if (title) return `a YouTube video titled ${title}`;
                } catch (err) {}
            }
            return `a YouTube video`;
        }

        // 2. Twitter / X Specialized Handling
        if (domain.includes('twitter.com') || domain.includes('x.com')) {
            try {
                // We use fixup URLs for better metadata if possible
                const fixupUrl = url.replace('twitter.com', 'fxtwitter.com').replace('x.com', 'fixupx.com');
                const response = await axios.get(fixupUrl, { timeout: 3000 });
                const $ = cheerio.load(response.data);
                const desc = $('meta[property="og:description"]').attr('content');
                const author = $('meta[property="og:title"]').attr('content');
                if (author && desc) return `a post by ${author} saying: ${desc}`;
                if (desc) return `a post saying: ${desc}`;
            } catch (e) {}
            return `a post on ${domain.split('.')[0]}`;
        }

        // 3. Generic Meta Scraping
        try {
            const response = await axios.get(url, { 
                timeout: 3000, 
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Galacticord/1.0' } 
            });
            const $ = cheerio.load(response.data);
            
            const ogTitle = $('meta[property="og:title"]').attr('content');
            const ogSite = $('meta[property="og:site_name"]').attr('content');
            const metaDesc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content');

            if (ogTitle && ogSite) return `${ogTitle} on ${ogSite}`;
            if (ogTitle) return `${ogTitle} on ${domain}`;
            if (metaDesc) return `a website about ${metaDesc.substring(0, 60)}...`;
        } catch (e) {}

        return `a link to ${domain}`;
    } catch (e) {
        return "a link";
    }
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (!message.guild) return;

        try {
            // Load Server Config
            let config = {};
            try {
                if (fs.existsSync(configFile)) {
                    config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                }
            } catch (e) {}

            const serverConfig = config[message.guild.id] || {};
            const ttsChannelId = serverConfig.ttsChannel;
            const ignoreBots = serverConfig.ignoreBots !== undefined ? serverConfig.ignoreBots : true;

            // Basic filters
            if (ignoreBots && message.author.bot) return;
            if (ttsChannelId && message.channel.id !== ttsChannelId) return;
            if (message.content.startsWith('!')) return; // Ignore prefixed commands

            // Check if user is in a voice channel
            const voiceChannel = message.member?.voice.channel;
            if (!voiceChannel) return;

            // Handle Auto-Join
            let connection = getVoiceConnection(message.guild.id);
            if (!connection) {
                const autoJoinEnabled = serverConfig.autoJoin !== undefined ? serverConfig.autoJoin : true;
                if (!autoJoinEnabled) return;

                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    daveEncryption: true,
                });
            }

            // Load Settings (Provider/Voice)
            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(settingsFile)) {
                    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
                }
            } catch (e) {}

            const userSetting = settings.users[message.author.id];
            const serverSetting = settings.servers[message.guild.id];

            const mode = userSetting?.mode || serverSetting?.mode || 'piper';
            let voiceKey = userSetting?.voice || serverSetting?.voice;

            if (!voiceKey) {
                voiceKey = mode === 'piper' ? 'models/en_US-amy-medium.onnx' : 'en-US';
            }

            if (mode === 'star') {
                const defaultStarUrl = 'https://speech.seedy.cc';
                const starUrl = userSetting?.starUrl || serverSetting?.starUrl || defaultStarUrl;
                voiceKey = JSON.stringify({
                    url: starUrl,
                    voice: voiceKey
                });
            }

            let cleanContent = message.content;

            // --- Enhanced Link Preview Logic ---
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = cleanContent.match(urlRegex);

            if (urls) {
                for (const url of urls) {
                    // Try to get a high-quality description first
                    const description = await getLinkDescription(url);
                    cleanContent = cleanContent.replace(url, description);
                }
            }

            // Replace user mentions <@ID> or <@!ID>
            const userMentionRegex = /<@!?(\d+)>/g;
            let match;
            while ((match = userMentionRegex.exec(cleanContent)) !== null) {
                const userId = match[1];
                const member = message.guild.members.cache.get(userId);
                const replacement = member ? member.displayName : "someone";
                cleanContent = cleanContent.replace(match[0], replacement);
            }

            // Replace channel mentions <#ID>
            const channelMentionRegex = /<#(\d+)>/g;
            while ((match = channelMentionRegex.exec(cleanContent)) !== null) {
                const channelId = match[1];
                const channel = message.guild.channels.cache.get(channelId);
                const replacement = channel ? channel.name : "a channel";
                cleanContent = cleanContent.replace(match[0], replacement);
            }

            // Final text safety check
            if (!cleanContent.trim()) return;

            const ttsPrefix = message.member.displayName;
            const fullText = `${ttsPrefix} says: ${cleanContent}`;

            const stream = await getAudioStream(fullText, mode, voiceKey);

            // Add to the shared queue
            addToQueue(message.guild.id, stream, connection);

        } catch (error) {
            console.error('[MessageCreate Debug] Uncaught TTS Error:', error);
        }
    },
};
