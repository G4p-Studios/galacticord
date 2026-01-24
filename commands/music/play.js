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

            // Check for cookies and setup common arguments
            // Use process.cwd() to ensure we find the data folder regardless of where the bot is started
            const cookiesPath = path.resolve(process.cwd(), 'data', 'cookies.txt');
            
            // Explicitly tell yt-dlp to use the current Node.js binary as the runtime
            const commonArgs = ['--js-runtimes', `node:${process.execPath}`];
            
            if (fs.existsSync(cookiesPath)) {
                console.log(`[Music Debug] SUCCESS: Found cookies.txt at: ${cookiesPath}`);
                commonArgs.push('--cookies', cookiesPath);
            } else {
                console.log(`[Music Debug] WARNING: No cookies.txt found at: ${cookiesPath}`);
                console.log(`[Music Debug] Please ensure your file is at: galacticord/data/cookies.txt`);
            }

            // Get Video Metadata first using the wrapper
            let videoUrl = query;
            let videoTitle = "Unknown Song";

            if (!query.startsWith('http')) {
                console.log(`[Music Debug] Searching for: ${query}`);
                const metadata = await ytDlp.execPromise([
                    `ytsearch1:${query}`,
                    '--dump-json',
                    '--no-playlist',
                    ...commonArgs
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
                    ...commonArgs
                ]);
                const info = JSON.parse(metadata);
                videoTitle = info.title;
                videoUrl = info.webpage_url;
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
