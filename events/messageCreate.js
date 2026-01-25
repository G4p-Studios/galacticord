const { Events } = require('discord.js');
const { getVoiceConnection, joinVoiceChannel, createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { getAudioResource } = require('../utils/ttsProvider');

const settingsFile = path.join(__dirname, '../data/tts_settings.json');
const configFile = path.join(__dirname, '../data/server_config.json');

// Global Map to store queues and players per guild
const guildQueues = new Map();

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // We keep this one for basic entry check
        // console.log(`[MessageCreate Debug] Received message from ${message.author.tag} in #${message.channel.name}`);
        
        if (!message.guild) return;

        // Prefix command handling (Only for non-bots)
        const prefix = 'mal!';
        if (!message.author.bot && message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (commandName === 'ping') {
                const start = Date.now();
                const sent = await message.reply('Pinging...');
                const end = Date.now();
                const latency = end - start;
                return sent.edit(`Pong! Latency: ${latency}ms (API Latency: ${Math.round(message.client.ws.ping)}ms)`);
            }
        }

        // Load Server Config
        let config = {};
        try {
            if (fs.existsSync(configFile)) {
                config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
        } catch (e) {
             // If config is broken, we can't proceed.
             return console.error(`[FATAL] Could not parse server_config.json: ${e.message}`);
        }

        const serverConfig = config[message.guild.id] || {};

        // Bot Ignore Logic
        const ignoreBots = serverConfig.ignoreBots !== false; // Default to true if not set
        if (message.author.bot && ignoreBots) {
            return; // Silently ignore
        }

        const ttsChannelId = serverConfig.ttsChannel;
        const autoJoin = serverConfig.autoJoin || false;
        
        // Check if message is in TTS Channel OR in the user's current Voice Chat
        const isTTSChannel = ttsChannelId && message.channel.id === ttsChannelId;
        const isVoiceChat = message.member?.voice?.channel && message.channel.id === message.member.voice.channel.id;

        if (!isTTSChannel && !isVoiceChat) return; 

        let connection = getVoiceConnection(message.guild.id);

        // If the sender is a bot, they won't be in a VC. 
        // We should check if we are already in a VC, or if there's someone else we can join.
        let targetChannel = message.member?.voice?.channel;

        if (message.author.bot && !targetChannel) {
            // If we're already connected, just use that.
            if (connection) {
                // Stay where we are
            } else {
                // If not connected, we can't really "follow" a bot. 
                // We'll skip unless we are already there or have a specific channel to join.
                return;
            }
        } else if (!targetChannel) {
            // Non-bot but not in VC
            return;
        }

        // If not connected, only join if autoJoin is enabled
        if (!connection && targetChannel) {
            if (autoJoin) {
                try {
                    connection = joinVoiceChannel({
                        channelId: targetChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });
                    
                    connection.on('stateChange', (oldState, newState) => {
                        console.log(`[VoiceConnection AutoJoin] State changed from ${oldState.status} to ${newState.status}`);
                    });
        
                    connection.on('error', (error) => {
                        console.error(`[VoiceConnection AutoJoin Error] ${error.message}`);
                    });
                } catch (error) {
                    console.error("Failed to auto-join VC:", error);
                    return;
                }
            } else {
                return;
            }
        }

        try {
            // Determine Settings
            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(settingsFile)) {
                    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
                }
            } catch (e) {
                console.error(`[MessageCreate Debug] Error reading TTS settings file: ${e.message}`);
            }

            const userSetting = settings.users[message.author.id];
            const serverSetting = settings.servers[message.guild.id];

            const getProp = (setting, prop) => {
                if (!setting) return null;
                if (typeof setting === 'string' && prop === 'voice') return setting;
                if (typeof setting === 'object') return setting[prop];
                return null;
            };

            const userMode = getProp(userSetting, 'mode');
            const serverMode = getProp(serverSetting, 'mode');
            const mode = userMode || serverMode || 'piper';

            const userVoice = getProp(userSetting, 'voice');
            const serverVoice = getProp(serverSetting, 'voice');
            
            let defaultVoice = 'en-US';
            if (mode === 'piper') defaultVoice = 'models/en_US-amy-medium.onnx';

            const voiceKey = userVoice || serverVoice || defaultVoice;

            // Clean content of mentions
            let cleanContent = message.content;
            
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

            // Get Resource from Provider
            const textToSpeak = `${message.member?.displayName || message.author.username} said: ${cleanContent}`;
            const resource = await getAudioResource(textToSpeak, mode, voiceKey);

            // --- Queue Implementation ---
            if (!guildQueues.has(message.guild.id)) {
                const player = createAudioPlayer();
                guildQueues.set(message.guild.id, {
                    player: player,
                    queue: []
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    const guildData = guildQueues.get(message.guild.id);
                    if (guildData && guildData.queue.length > 0) {
                        const nextResource = guildData.queue.shift();
                        player.play(nextResource);
                    }
                });

                player.on('error', error => {
                    console.error(`[Player Error Guild ${message.guild.id}] Details:`, error.message);
                });
            }

            const guildData = guildQueues.get(message.guild.id);
            connection.subscribe(guildData.player);

            if (guildData.player.state.status === AudioPlayerStatus.Idle) {
                guildData.player.play(resource);
            } else {
                guildData.queue.push(resource);
            }

        } catch (error) {
            console.error('[MessageCreate Debug] Uncaught TTS Error:', error);
        }
    },
};
