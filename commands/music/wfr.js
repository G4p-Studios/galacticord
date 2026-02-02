const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { setBackground } = require('../../utils/audioQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wfr')
        .setDescription('Play World of Fun Radio (Interrupted by TTS messages)'),
    async execute(interaction) {
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.reply('You must be in a voice channel to use this command.');
        }

        try {
            await interaction.deferReply();

            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            // Use direct URL as requested
            const radioUrl = 'https://beats.seedy.cc:9005/listen/wfr/radio.mp3';
            
            // This function sets the background stream.
            setBackground(interaction.guild.id, radioUrl, connection);

            await interaction.editReply('📻 Playing **World of Fun Radio**! (TTS messages will pause the music)');

        } catch (error) {
            console.error(error);
            await interaction.editReply('Failed to join voice channel or play radio.');
        }
    },
};
