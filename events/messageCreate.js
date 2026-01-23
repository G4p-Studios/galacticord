const { Events } = require('discord.js');
const { getVoiceConnection, joinVoiceChannel, createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { getAudioResource } = require('../utils/ttsProvider');

const settingsFile = path.join(__dirname, '../data/tts_settings.json');
const configFile = path.join(__dirname, '../data/server_config.json');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // We keep this one for basic entry check
        // console.log(`[MessageCreate Debug] Received message from ${message.author.tag} in #${message.channel.name}`);
        
        if (!message.guild || message.author.bot) return;

        // Prefix command handling
        const prefix = 'mal!';
        if (message.content.startsWith(prefix)) {
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
        if (!message.member?.voice?.channel) return;

        let connection = getVoiceConnection(message.guild.id);

        // If not connected, only join if autoJoin is enabled
        if (!connection) {
            if (autoJoin) {
                try {
                    connection = joinVoiceChannel({
                        channelId: message.member.voice.channel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
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
            console.log(`[MessageCreate Debug] User settings: ${JSON.stringify(userSetting)}, Server settings: ${JSON.stringify(serverSetting)}`);

            const getProp = (setting, prop) => {
                if (!setting) return null;
                if (typeof setting === 'string' && prop === 'voice') return setting;
                if (typeof setting === 'object') return setting[prop];
                return null;
            };

            const userMode = getProp(userSetting, 'mode');
            const serverMode = getProp(serverSetting, 'mode');
            const mode = userMode || serverMode || 'google';

            const userVoice = getProp(userSetting, 'voice');
            const serverVoice = getProp(serverSetting, 'voice');
            const voiceKey = userVoice || serverVoice || (mode === 'google' ? 'en-US' : 'en-US-AriaNeural');
            console.log(`[MessageCreate Debug] Determined Mode: ${mode}, VoiceKey: ${voiceKey}`);

            // Get Resource from Provider
            console.log(`[MessageCreate Debug] Requesting audio resource for text: "${message.content}"`);
            const resource = await getAudioResource(message.content, mode, voiceKey);
            console.log(`[MessageCreate Debug] Audio resource obtained.`);

            // Create a new player for each message for stability
            const player = createAudioPlayer();
            connection.subscribe(player);
            
            player.on('error', error => {
                console.error(`[Player Error] Details:`, error.message);
                if (error.message.includes("Edge TTS")) {
                    message.reply({
                        content: "⚠️ **Microsoft Edge TTS failed.** This service can be unreliable. Please try again later or switch to the Google provider with `/set mode provider:Google Translate`."
                    }).catch(console.error);
                }
            });

            player.on('stateChange', (oldState, newState) => {
                // Optional: log state changes for further debugging if needed
                // console.log(`[Player State] ${oldState.status} -> ${newState.status}`);
            });

            player.play(resource);
            console.log(`[MessageCreate Debug] Playing audio resource.`);

        } catch (error) {
            console.error('[MessageCreate Debug] Uncaught TTS Error:', error);
        }
    },
};
