const { Events } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { getAudioStream } = require('../utils/ttsProvider');
const { addToQueue } = require('../utils/audioQueue');

const settingsFile = path.join(__dirname, '../data/tts_settings.json');
const configFile = path.join(__dirname, '../data/server_config.json');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        // Ignore bot's own state updates
        if (newState.member.user.id === newState.client.user.id) return;

        const guildId = newState.guild.id;
        const connection = getVoiceConnection(guildId);

        // Only announce if the bot is currently connected to a channel
        if (!connection) return;
        const botChannelId = connection.joinConfig.channelId;

        // Determine if the event is relevant to the bot's channel
        const wasInChannel = oldState.channelId === botChannelId;
        const isInChannel = newState.channelId === botChannelId;

        if (!wasInChannel && !isInChannel) return;

        // Load Server Config for Toggles
        let config = {};
        try {
            if (fs.existsSync(configFile)) {
                config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
        } catch (e) {}

        const eventToggles = config[guildId]?.voiceEvents || {
            joinLeave: true,
            mute: true,
            deafen: true,
            streaming: true
        };

        let textToSpeak = "";
        const displayName = newState.member.displayName;

        // 1. Join/Leave/Switch Logic
        if (eventToggles.joinLeave) {
            if (!wasInChannel && isInChannel) {
                textToSpeak = `${displayName} has joined the channel.`;
            } else if (wasInChannel && !isInChannel) {
                textToSpeak = `${displayName} has left the channel.`;
            }
        }

        // 2. Mute/Unmute Logic
        if (!textToSpeak && eventToggles.mute && isInChannel) {
            if (oldState.selfMute !== newState.selfMute) {
                textToSpeak = `${displayName} is now ${newState.selfMute ? "muted" : "unmuted"}.`;
            }
            else if (oldState.serverMute !== newState.serverMute) {
                textToSpeak = `${displayName} was ${newState.serverMute ? "server muted" : "server unmuted"}.`;
            }
        }

        // 3. Deafen/Undeafen Logic
        if (!textToSpeak && eventToggles.deafen && isInChannel) {
            if (oldState.selfDeaf !== newState.selfDeaf) {
                textToSpeak = `${displayName} is now ${newState.selfDeaf ? "deafened" : "undeafened"}.`;
            }
            else if (oldState.serverDeaf !== newState.serverDeaf) {
                textToSpeak = `${displayName} was ${newState.serverDeaf ? "server deafened" : "server undeafened"}.`;
            }
        }

        // 4. Streaming Logic
        if (!textToSpeak && eventToggles.streaming && isInChannel) {
            if (oldState.streaming !== newState.streaming) {
                textToSpeak = `${displayName} ${newState.streaming ? "started streaming" : "stopped streaming"}.`;
            }
        }

        if (!textToSpeak) return;

        try {
            // Load Settings
            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(settingsFile)) {
                    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
                }
            } catch (e) {}

            const serverSetting = settings.servers[guildId];
            const mode = serverSetting?.mode || 'piper';
            
            let defaultVoice = 'en-US';
            if (mode === 'piper') defaultVoice = 'models/en_US-amy-medium.onnx';
            
            let voiceKey = serverSetting?.voice || defaultVoice;

            if (mode === 'star') {
                const defaultStarUrl = 'https://speech.seedy.cc';
                const starUrl = serverSetting?.starUrl || defaultStarUrl;
                voiceKey = JSON.stringify({
                    url: starUrl,
                    voice: voiceKey
                });
            }

            console.log(`[VoiceEvent] ${textToSpeak}`);
            const stream = await getAudioStream(textToSpeak, mode, voiceKey);
            addToQueue(guildId, stream, connection);

        } catch (error) {
            console.error('[VoiceStateUpdate] Error:', error);
        }
    },
};
