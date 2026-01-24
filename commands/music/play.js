const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState, getVoiceConnection, StreamType } = require('@discordjs/voice');
const { ensureYtDlp, binaryPath } = require('../../utils/ytDlpHelper');
const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube')
        .addStringOption(option => option.setName('query').setDescription('URL or search term').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        const query = interaction.options.getString('query');
        const channel = interaction.member.voice.channel;
        const apiKey = process.env.YOUTUBE_API_KEY;

        if (!channel) {
            return interaction.editReply('You must be in a voice channel to use this command.');
        }

        try {
            await ensureYtDlp();

            let connection = getVoiceConnection(interaction.guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
            }

            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

            let videoUrl = query;
            let videoTitle = "Unknown Song";

            // If it's not a link, use YouTube API to search
            if (!query.startsWith('http')) {
                if (!apiKey) {
                    return interaction.editReply('Searching requires a YOUTUBE_API_KEY in the .env file.');
                }

                console.log(`[Music Debug] API Search for: ${query}`);
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=1&type=video`;
                const response = await axios.get(searchUrl);

                if (response.data.items.length === 0) {
                    return interaction.editReply('No results found.');
                }

                const item = response.data.items[0];
                videoUrl = `https://www.youtube.com/watch?v=${item.id.videoId}`;
                videoTitle = item.snippet.title;
            } else {
                // If it IS a link, try to get the title via API (optional but cleaner)
                if (apiKey) {
                    const videoId = query.split('v=')[1]?.split('&')[0];
                    if (videoId) {
                        const infoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
                        const infoRes = await axios.get(infoUrl);
                        if (infoRes.data.items.length > 0) {
                            videoTitle = infoRes.data.items[0].snippet.title;
                        }
                    }
                }
            }

            console.log(`[Music Debug] Streaming: ${videoTitle} (${videoUrl})`);

            // Use the "Stealth" arguments for yt-dlp extraction
            const args = [
                videoUrl,
                '-o', '-',
                '-f', 'bestaudio/best',
                '--no-playlist',
                '--force-ipv4',
                '--no-check-certificates',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                '--referer', 'https://www.youtube.com/'
            ];

            const child = spawn(binaryPath, args);

            const resource = createAudioResource(child.stdout, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });
            
            const player = createAudioPlayer();
            player.play(resource);
            connection.subscribe(player);

            player.on('stateChange', (oldState, newState) => {
                console.log(`[Player Debug] State: ${oldState.status} -> ${newState.status}`);
            });

            player.on('error', error => {
                console.error(`[AudioPlayer Error]`, error.message);
            });

            await interaction.editReply(`Now playing: **${videoTitle}**`);

        } catch (error) {
            console.error('[Music Command Error]', error);
            await interaction.editReply(`Failed to play music: ${error.message}`);
        }
    },
};
