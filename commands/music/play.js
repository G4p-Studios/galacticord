const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState, getVoiceConnection, StreamType, AudioPlayerStatus } = require('@discordjs/voice');
const { ensureYtDlp, binaryPath } = require('../../utils/ytDlpHelper');
const { spawn } = require('child_process');
const axios = require('axios');

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

        let queue = interaction.client.queues.get(interaction.guild.id);

        try {
            await ensureYtDlp();

            let videoUrl = query;
            let videoTitle = "Unknown Song";

            // Resolve Query
            if (!query.startsWith('http')) {
                if (!apiKey) return interaction.editReply('Searching requires a YOUTUBE_API_KEY in the .env file.');
                const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=1&type=video`;
                const response = await axios.get(searchUrl);
                if (response.data.items.length === 0) return interaction.editReply('No results found.');
                const item = response.data.items[0];
                videoUrl = `https://www.youtube.com/watch?v=${item.id.videoId}`;
                videoTitle = item.snippet.title;
            } else if (apiKey) {
                const videoId = query.split('v=')[1]?.split('&')[0];
                if (videoId) {
                    const infoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
                    const infoRes = await axios.get(infoUrl);
                    if (infoRes.data.items.length > 0) videoTitle = infoRes.data.items[0].snippet.title;
                }
            }

            const song = { title: videoTitle, url: videoUrl };

            if (!queue) {
                const connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });

                queue = {
                    connection,
                    player: createAudioPlayer(),
                    songs: [],
                    textChannel: interaction.channel,
                };

                interaction.client.queues.set(interaction.guild.id, queue);
                queue.connection.subscribe(queue.player);

                queue.player.on(AudioPlayerStatus.Idle, () => {
                    queue.songs.shift();
                    playNext(interaction.guild.id, interaction.client);
                });

                queue.player.on('error', error => {
                    console.error(`[AudioPlayer Error]`, error.message);
                    queue.textChannel.send(`❌ Error playing **${queue.songs[0]?.title}**: ${error.message}`);
                    queue.songs.shift();
                    playNext(interaction.guild.id, interaction.client);
                });
            }

            queue.songs.push(song);

            if (queue.player.state.status === AudioPlayerStatus.Playing) {
                return interaction.editReply(`Queued: **${videoTitle}**`);
            } else {
                playNext(interaction.guild.id, interaction.client);
                return interaction.editReply(`Now playing: **${videoTitle}**`);
            }

        } catch (error) {
            console.error('[Music Command Error]', error);
            await interaction.editReply(`Failed to play music: ${error.message}`);
        }
    },
};

async function playNext(guildId, client) {
    const queue = client.queues.get(guildId);
    if (!queue || queue.songs.length === 0) {
        // Optional: Disconnect after some time of inactivity
        return;
    }

    const song = queue.songs[0];
    
    try {
        const args = [
            song.url,
            '-o', '-',
            '-f', 'bestaudio/best',
            '--no-playlist',
            '--force-ipv4',
            '--no-check-certificates',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '--referer', 'https://www.youtube.com/'
        ];

        console.log(`[Music Debug] Spawning yt-dlp for: ${song.title}`);
        const child = spawn(binaryPath, args);

        child.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('ERROR')) {
                console.error(`[yt-dlp Error] ${msg}`);
            }
        });

        child.on('error', (err) => {
            console.error('[yt-dlp Process Error]', err);
        });

        const resource = createAudioResource(child.stdout, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });

        queue.player.play(resource);
        
        if (queue.songs.length > 1) {
            queue.textChannel.send(`🎶 Now playing: **${song.title}**`);
        }
    } catch (error) {
        console.error('Error in playNext:', error);
        queue.textChannel.send(`❌ Failed to play next song: ${error.message}`);
    }
}

