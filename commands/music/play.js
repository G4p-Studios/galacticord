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

            // Load cookies and authorize play-dl
            const cookiesPath = path.resolve(process.cwd(), 'data', 'cookies.txt');
            if (fs.existsSync(cookiesPath)) {
                try {
                    const cookieData = fs.readFileSync(cookiesPath, 'utf8');
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

                    if (cookieString) {
                        await play.setToken({
                            youtube: {
                                cookie: cookieString
                            }
                        });
                        console.log(`[Music Debug] Cookies loaded into play-dl.`);
                    }
                } catch (cookieErr) {
                    console.error(`[Music Debug] Cookie loading error:`, cookieErr.message);
                }
            }
            
            // Refresh authorization to ensure fresh tokens
            try {
                await play.authorization();
            } catch (authErr) {
                console.log(`[Music Debug] Auth refresh warning: ${authErr.message}`);
            }

            // Search and Stream using play-dl
            let videoUrl;
            let videoTitle;

            if (query.startsWith('http')) {
                videoUrl = query; // Use the query directly as the URL if it's a link
                try {
                    const videoInfo = await play.video_info(query);
                    // play-dl sometimes puts details inside video_details
                    videoTitle = videoInfo.video_details?.title || videoInfo.title || "YouTube Video";
                    console.log(`[Music Debug] Fetched info for direct link. Title: ${videoTitle}`);
                } catch (e) {
                    console.log(`[Music Debug] Could not fetch metadata, using URL directly. Error: ${e.message}`);
                    videoTitle = "YouTube Video";
                }
            } else {
                console.log(`[Music Debug] Searching for: ${query}`);
                const searchResults = await play.search(query, { limit: 1 });
                if (!searchResults || searchResults.length === 0) {
                    return interaction.editReply('No results found for your search.');
                }
                const firstResult = searchResults[0];
                videoUrl = firstResult.url;
                videoTitle = firstResult.title;
                console.log(`[Music Debug] Search found: ${videoTitle} (${videoUrl})`);
            }

            if (!videoUrl || videoUrl === 'undefined') {
                throw new Error("Could not determine a valid video URL.");
            }

            console.log(`[Music Debug] Final decision - Title: ${videoTitle}, URL: ${videoUrl}`);

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
