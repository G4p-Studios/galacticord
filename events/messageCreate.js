const { Events } = require('discord.js');
const { getVoiceConnection, joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const googleTTS = require('google-tts-api');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        if (!message.member || !message.member.voice.channel) return; // User must be in VC

        const ttsChannelId = process.env.TTS_CHANNEL_ID;
        const isTTSChannel = ttsChannelId && message.channel.id === ttsChannelId;
        const isVoiceChat = message.channel.id === message.member.voice.channel.id;

        if (!isTTSChannel && !isVoiceChat) return;

        try {
            // Get text to speech URL
            const url = googleTTS.getAudioUrl(message.content, {
                lang: 'en',
                slow: false,
                host: 'https://translate.google.com',
            });

            let connection = getVoiceConnection(message.guild.id);
            
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: message.member.voice.channel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });
            }

            const resource = createAudioResource(url);
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

        } catch (error) {
            console.error('TTS Error:', error);
        }
    },
};
