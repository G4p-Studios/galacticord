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

            // Check for cookies
            const cookiesPath = path.resolve(process.cwd(), 'data', 'cookies.txt');
            if (fs.existsSync(cookiesPath)) {
                console.log(`[Music Debug] Using cookies from: ${cookiesPath}`);
                // play-dl can use cookies from a file
                // Note: some versions of play-dl require authorization() call for cookies
            }

            // Search and Stream using play-dl (it handles VPS issues better)
            let videoInfo;
            if (query.startsWith('http')) {
                videoInfo = await play.video_info(query);
            } else {
                const searchResults = await play.search(query, { limit: 1 });
                if (searchResults.length === 0) return interaction.editReply('No results found.');
                videoInfo = searchResults[0];
            }

            console.log(`[Music Debug] Streaming: ${videoInfo.title || videoInfo.url}`);

            // Get stream with VPS-friendly options
            const stream = await play.stream(videoInfo.url, {
                quality: 0, // 0 is best audio
                discordPlayerCompatibility: true,
                // We pass cookies if they exist
                ...(fs.existsSync(cookiesPath) ? { cookies: cookiesPath } : {})
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

            await interaction.editReply(`Now playing: **${videoInfo.title || 'YouTube Audio'}**`);

        } catch (error) {
            console.error('[Music Command Error]', error);
            await interaction.editReply(`Failed to play music: ${error.message}`);
        }
    },
};
