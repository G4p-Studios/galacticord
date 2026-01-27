const { Events } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { getAudioResource } = require('../utils/ttsProvider');
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

        let textToSpeak = "";
        const displayName = newState.member.displayName;

        // 1. Join/Leave/Switch Logic
        if (!wasInChannel && isInChannel) {
            textToSpeak = `${displayName} has joined the channel.`;
        } else if (wasInChannel && !isInChannel) {
            textToSpeak = `${displayName} has left the channel.`;
        } 
        // 2. Mute/Unmute Logic (Only if they are in the channel)
        else if (isInChannel && oldState.selfMute !== newState.selfMute) {
            textToSpeak = `${displayName} is now ${newState.selfMute ? "muted" : "unmuted"}.`;
        }
        else if (isInChannel && oldState.serverMute !== newState.serverMute) {
            textToSpeak = `${displayName} was ${newState.serverMute ? "server muted" : "server unmuted"}.`;
        }
        // 3. Deafen/Undeafen Logic
        else if (isInChannel && oldState.selfDeaf !== newState.selfDeaf) {
            textToSpeak = `${displayName} is now ${newState.selfDeaf ? "deafened" : "undeafened"}.`;
        }
        else if (isInChannel && oldState.serverDeaf !== newState.serverDeaf) {
            textToSpeak = `${displayName} was ${newState.serverDeaf ? "server deafened" : "server undeafened"}.`;
        }
        // 4. Streaming Logic
        else if (isInChannel && oldState.streaming !== newState.streaming) {
            textToSpeak = `${displayName} ${newState.streaming ? "started streaming" : "stopped streaming"}.`;
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
                const starUrl = serverSetting?.starUrl;
                voiceKey = JSON.stringify({
                    url: starUrl,
                    voice: voiceKey
                });
            }

            console.log(`[VoiceEvent] ${textToSpeak}`);
            const resource = await getAudioResource(textToSpeak, mode, voiceKey);
            addToQueue(guildId, resource, connection);

        } catch (error) {
            console.error('[VoiceStateUpdate] Error:', error);
        }
    },
};
