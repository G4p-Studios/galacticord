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
        // Ignore bot's own state updates (don't announce "I have joined")
        if (newState.member.user.id === newState.client.user.id) return;

        // Check if user joined a channel (or switched to one)
        if (!newState.channelId) return; // User left voice
        if (oldState.channelId === newState.channelId) return; // State update but not a channel switch (e.g. mute toggle)

        const guildId = newState.guild.id;
        const connection = getVoiceConnection(guildId);

        // Only announce if the bot is currently connected to the SAME channel
        if (!connection || connection.joinConfig.channelId !== newState.channelId) return;

        try {
            // Load Server Config for settings
            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(settingsFile)) {
                    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
                }
            } catch (e) {
                console.error(`[VoiceStateUpdate] Error reading settings: ${e.message}`);
            }

            // Use Server Settings or Default (Piper)
            const serverSetting = settings.servers[guildId];
            const mode = serverSetting?.mode || 'piper';
            
            // Determine voice
            let defaultVoice = 'en-US';
            if (mode === 'piper') defaultVoice = 'models/en_US-amy-medium.onnx';
            
            const voiceKey = serverSetting?.voice || defaultVoice;

            // Generate Announcement Text
            const displayName = newState.member.displayName;
            const textToSpeak = `${displayName} has joined the channel.`;

            console.log(`[VoiceJoin] Announcing: "${textToSpeak}"`);
            
            // Get Audio
            const resource = await getAudioResource(textToSpeak, mode, voiceKey);

            // Add to Queue
            addToQueue(guildId, resource, connection);

        } catch (error) {
            console.error('[VoiceStateUpdate] Error announcing join:', error);
        }
    },
};
