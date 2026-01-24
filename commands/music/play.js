const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { ensureYtDlp, binaryPath } = require('../../utils/ytDlpHelper');
const { spawn } = require('child_process');
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

        if (!channel) {
            return interaction.editReply('You must be in a voice channel to use this command.');
        }

        try {
            const ytDlp = await ensureYtDlp();

            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            // Check for cookies
            const cookiesPath = path.join(__dirname, '../../data/cookies.txt');
            const cookieArgs = fs.existsSync(cookiesPath) ? ['--cookies', cookiesPath] : [];

            // Get Video Metadata first using the wrapper (it handles JSON parsing well)
            let videoUrl = query;
            let videoTitle = "Unknown Song";

            // If it's not a link, search first
            if (!query.startsWith('http')) {
                console.log(`[Music Debug] Searching for: ${query}`);
                const metadata = await ytDlp.execPromise([
                    `ytsearch1:${query}`,
                    '--dump-json',
                    '--no-playlist',
                    ...cookieArgs
                ]);
                
                const info = JSON.parse(metadata);
                videoUrl = info.webpage_url;
                videoTitle = info.title;
            } else {
                console.log(`[Music Debug] Fetching metadata for: ${query}`);
                const metadata = await ytDlp.execPromise([
                    query,
                    '--dump-json',
                    '--no-playlist',
                    ...cookieArgs
                ]);
                const info = JSON.parse(metadata);
                videoTitle = info.title;
                videoUrl = info.webpage_url; // Normalized URL
            }

            console.log(`[Music Debug] Playing: ${videoTitle} (${videoUrl})`);

            // Spawn the process natively to get the raw stdout stream
            const args = [
                videoUrl,
                '-o', '-',
                '-f', 'bestaudio',
                '--no-playlist',
                '--retry', '3',
                ...cookieArgs
            ];

            const child = spawn(binaryPath, args);

            const resource = createAudioResource(child.stdout);
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            player.on('error', error => {
                console.error(`[AudioPlayer Error]`, error);
                interaction.followUp({ content: 'Playback error occurred.', ephemeral: true });
            });
            
            child.on('error', error => {
                console.error(`[yt-dlp Process Error]`, error);
            });

            child.stderr.on('data', data => {
                // Uncomment to see yt-dlp internal logs
                // console.log(`[yt-dlp stderr] ${data}`);
            });

            await interaction.editReply(`Now playing: **${videoTitle}**`);

        } catch (error) {
            console.error('[Music Command Error]', error);
            await interaction.editReply(`Failed to play music: ${error.message}`);
        }
    },
};
