const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');
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
            // Setup Connection
            let connection = getVoiceConnection(interaction.guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: channel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
            }

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            } catch (e) {
                return interaction.editReply('Failed to connect to voice channel.');
            }

            // Load cookies into play-dl globally
            const cookiesPath = path.resolve(process.cwd(), 'data', 'cookies.txt');
            if (fs.existsSync(cookiesPath)) {
                try {
                    const cookieData = fs.readFileSync(cookiesPath, 'utf8');
                    // Parse Netscape cookies.txt to standard cookie string
                    const cookieString = cookieData
                        .split('\n')
                        .filter(line => line.trim() && !line.startsWith('#'))
                        .map(line => {
                            const parts = line.split('\t');
                            if (parts.length >= 7) {
                                return `${parts[5]}=${parts[6].trim()}`;
                            }
                            return null;
                        })
                        .filter(Boolean)
                        .join('; ');

                    await play.setToken({
                        youtube: {
                            cookie: cookieString
                        }
                    });
                    console.log(`[Music Debug] Cookies parsed and loaded into play-dl.`);
                } catch (cookieErr) {
                    console.error(`[Music Debug] Error loading cookies:`, cookieErr.message);
                }
            }

            // Search and Stream using play-dl
            let videoUrl;
            let videoTitle;

            if (query.startsWith('http')) {
                const videoInfo = await play.video_info(query);
                videoUrl = videoInfo.url;
                videoTitle = videoInfo.title;
            } else {
                const searchResults = await play.search(query, { limit: 1 });
                if (searchResults.length === 0) return interaction.editReply('No results found.');
                videoUrl = searchResults[0].url;
                videoTitle = searchResults[0].title;
            }

            if (!videoUrl) {
                videoUrl = query.startsWith('http') ? query : null;
            }

            console.log(`[Music Debug] Streaming: ${videoTitle || videoUrl}`);

            // Get stream with VPS-friendly options
            const stream = await play.stream(videoUrl, {
                quality: 0,
                discordPlayerCompatibility: true
            });

            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
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

            await interaction.editReply(`Now playing: **${videoTitle || 'YouTube Audio'}**`);

        } catch (error) {
            console.error('[Music Command Error]', error);
            await interaction.editReply(`Failed to play music: ${error.message}`);
        }
    },
};
