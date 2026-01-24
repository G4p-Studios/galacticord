const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus, entersState, getVoiceConnection } = require('@discordjs/voice');
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

            let connection = getVoiceConnection(interaction.guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
            }

            // Wait for connection to be ready
            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            } catch (e) {
                console.error('[Music] Connection failed to reach Ready state:', e.message);
                return interaction.editReply('Failed to connect to voice channel.');
            }

            // Setup common arguments for yt-dlp
            const cookiesPath = path.resolve(process.cwd(), 'data', 'cookies.txt');
            const cachePath = path.resolve(process.cwd(), 'data', '.cache');
            
            if (!fs.existsSync(cachePath)) fs.mkdirSync(cachePath, { recursive: true });

            const commonArgs = [
                '--js-runtimes', `node:${process.execPath}`,
                '--cache-dir', cachePath,
                '--no-check-certificates',
                '--no-warnings',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            ];
            
            if (fs.existsSync(cookiesPath)) {
                commonArgs.push('--cookies', cookiesPath);
            }

            // Get Video Metadata
            let videoUrl = query;
            let videoTitle = "Unknown Song";

            try {
                if (!query.startsWith('http')) {
                    const metadata = await ytDlp.execPromise([
                        `ytsearch1:${query}`,
                        '--dump-json',
                        '--flat-playlist',
                        ...commonArgs
                    ]);
                    const info = JSON.parse(metadata);
                    const firstEntry = info.entries ? info.entries[0] : info;
                    videoUrl = firstEntry.url || firstEntry.webpage_url;
                    videoTitle = firstEntry.title;
                } else {
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
                if (query.startsWith('http')) videoUrl = query;
                else throw err;
            }

            console.log(`[Music Debug] Streaming: ${videoTitle}`);

            const args = [
                videoUrl,
                '-o', '-',
                '-f', 'bestaudio',
                '--no-playlist',
                ...commonArgs
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
            
            child.on('error', error => {
                console.error(`[yt-dlp Process Error]`, error);
            });

            child.stderr.on('data', data => {
                console.log(`[yt-dlp stderr] ${data}`);
            });

            await interaction.editReply(`Now playing: **${videoTitle}**`);

        } catch (error) {
            console.error('[Music Command Error]', error);
            await interaction.editReply(`Failed to play music: ${error.message}`);
        }
    },
};
