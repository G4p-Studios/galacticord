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
 */
async function getLinkDescription(url) {
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');

        if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
            try {
                const oEmbedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const response = await axios.get(oEmbedUrl, { timeout: 3000 });
                if (response.data && response.data.title) {
                    return `a YouTube video titled ${response.data.title}`;
                }
            } catch (e) {
                try {
                    const response = await axios.get(url, { timeout: 2000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const $ = cheerio.load(response.data);
                    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
                    if (title) return `a YouTube video titled ${title}`;
                } catch (err) {}
            }
            return `a YouTube video`;
        }

        if (domain.includes('twitter.com') || domain.includes('x.com')) {
            try {
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

        try {
            const response = await axios.get(url, { timeout: 3000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            const $ = cheerio.load(response.data);
            const ogTitle = $('meta[property="og:title"]').attr('content');
            const ogSite = $('meta[property="og:site_name"]').attr('content');
            if (ogTitle && ogSite) return `${ogTitle} on ${ogSite}`;
            if (ogTitle) return `${ogTitle} on ${domain}`;
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
            // 1. Load Config
            let config = {};
            try { if (fs.existsSync(configFile)) config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch (e) {}

            const serverConfig = config[message.guild.id] || {};
            const ttsChannelId = serverConfig.ttsChannel;
            const ignoreBots = serverConfig.ignoreBots !== undefined ? serverConfig.ignoreBots : true;

            // 2. Logic Filters
            // Don't speak own messages ever to prevent loops
            if (message.author.id === message.client.user.id) return;
            
            // Speak other bot messages only if ignoreBots is false
            if (message.author.bot && ignoreBots) return;
            
            // Only process in the designated TTS channel
            if (ttsChannelId && message.channel.id !== ttsChannelId) return;
            
            // Ignore prefixed commands
            if (message.content.startsWith('!')) return;

            // 3. Voice Connection Logic
            let connection = getVoiceConnection(message.guild.id);
            const userVC = message.member?.voice.channel;

            if (!connection) {
                // If bot is not in a VC, it can only join if the sender IS in a VC
                if (!userVC) return;

                const autoJoinEnabled = serverConfig.autoJoin !== undefined ? serverConfig.autoJoin : true;
                if (!autoJoinEnabled) return;

                connection = joinVoiceChannel({
                    channelId: userVC.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    daveEncryption: true,
                });
            }
            // If connection exists, we continue regardless of whether the user is in the VC or not

            // 4. Load Settings
            let settings = { users: {}, servers: {} };
            try { if (fs.existsSync(settingsFile)) settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); } catch (e) {}

            const userSetting = settings.users[message.author.id];
            const serverSetting = settings.servers[message.guild.id];
            const mode = userSetting?.mode || serverSetting?.mode || 'piper';
            let voiceKey = userSetting?.voice || serverSetting?.voice;

            if (!voiceKey) {
                voiceKey = mode === 'piper' ? 'models/en_US-amy-medium.onnx' : 'en-US';
            }

            if (mode === 'star') {
                const starUrl = userSetting?.starUrl || serverSetting?.starUrl || 'https://speech.seedy.cc';
                voiceKey = JSON.stringify({ url: starUrl, voice: voiceKey });
            }

            // 5. Content Cleaning
            let cleanContent = message.content;

            // Link Previews
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = cleanContent.match(urlRegex);
            if (urls) {
                for (const url of urls) {
                    const description = await getLinkDescription(url);
                    cleanContent = cleanContent.replace(url, description);
                }
            }

            // Mentions
            cleanContent = cleanContent.replace(/<@!?(\d+)>/g, (m, id) => {
                const mem = message.guild.members.cache.get(id);
                return mem ? mem.displayName : "someone";
            });
            cleanContent = cleanContent.replace(/<#(\d+)>/g, (m, id) => {
                const chan = message.guild.channels.cache.get(id);
                return chan ? chan.name : "a channel";
            });

            if (!cleanContent.trim()) return;

            const ttsPrefix = message.member?.displayName || message.author.username;
            const fullText = `${ttsPrefix} says: ${cleanContent}`;

            // 6. Generate and Queue
            const stream = await getAudioStream(fullText, mode, voiceKey);
            addToQueue(message.guild.id, stream, connection);

        } catch (error) {
            console.error('[MessageCreate Debug] TTS Error:', error);
        }
    },
};
