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

            // Setup common arguments for yt-dlp
            const cookiesPath = path.resolve(process.cwd(), 'data', 'cookies.txt');
            const cachePath = path.resolve(process.cwd(), 'data', '.cache');
            
            if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath, { recursive: true });

            // Using absolute Node path and removing restrictive extractor-args to fix "format not available"
            const commonArgs = [
                '--js-runtimes', `node:${process.execPath}`,
                '--cache-dir', cachePath,
                '--no-check-certificates',
                '--no-warnings',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            ];
            
            if (fs.existsSync(cookiesPath)) {
                console.log(`[Music Debug] SUCCESS: Found cookies.txt at: ${cookiesPath}`);
                commonArgs.push('--cookies', cookiesPath);
            } else {
                console.log(`[Music Debug] WARNING: No cookies.txt found at: ${cookiesPath}`);
            }

            // Get Video Metadata
            let videoUrl = query;
            let videoTitle = "Unknown Song";

            try {
                if (!query.startsWith('http')) {
                    console.log(`[Music Debug] Searching: ${query}`);
                    const metadata = await ytDlp.execPromise([
                        `ytsearch1:${query}`,
                        '--dump-json',
                        '--flat-playlist',
                        ...commonArgs
                    ]);
                    const info = JSON.parse(metadata);
                    // Search results are often in an 'entries' array
                    const firstEntry = info.entries ? info.entries[0] : info;
                    videoUrl = firstEntry.url || firstEntry.webpage_url;
                    videoTitle = firstEntry.title;
                } else {
                    console.log(`[Music Debug] Metadata fetch: ${query}`);
                    const metadata = await ytDlp.execPromise([
                        query,
                        '--dump-json',
                        '--no-playlist',
                        ...commonArgs
                    ]);
                    const info = JSON.parse(metadata);
                    videoTitle = info.title;
                    videoUrl = info.webpage_url;
                }
            } catch (err) {
                console.error("[Music Debug] yt-dlp Metadata Error:", err.message);
                // Last ditch effort: if JSON dump fails, just use the query as the URL
                if (query.startsWith('http')) {
                    videoUrl = query;
                } else {
                    throw err;
                }
            }

            console.log(`[Music Debug] Playing: ${videoTitle} (${videoUrl})`);

            // Spawn the process natively
            const args = [
                videoUrl,
                '-o', '-',
                '-f', 'bestaudio',
                '--no-playlist',
                '--retry', '3',
                ...commonArgs
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
