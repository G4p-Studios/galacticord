const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const play = require('play-dl');

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
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            let stream;
            let type;

            if (query.startsWith('https')) {
                const yt_info = await play.video_info(query);
                stream = await play.stream_from_info(yt_info);
            } else {
                const yt_info = await play.search(query, { limit: 1 });
                if (yt_info.length === 0) return interaction.editReply('No results found.');
                stream = await play.stream(yt_info[0].url);
            }

            const resource = createAudioResource(stream.stream, { inputType: stream.type });
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            player.on(AudioPlayerStatus.Idle, () => {
                // simple auto-disconnect on finish for now
                // connection.destroy(); 
            });

            await interaction.editReply(`Now playing: **${query}**`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('Failed to play music. Make sure ffmpeg is installed.');
        }
    },
};
