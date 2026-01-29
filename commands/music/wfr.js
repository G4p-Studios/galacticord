const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { setBackground } = require('../../utils/audioQueue');
const path = require('path');

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

            // Point to the local radio.m3u file in the project root
            const radioUrl = path.join(__dirname, '../../radio.m3u');
            
            // This function sets the background stream.
            // It plays immediately if no TTS is queued.
            // If TTS comes in later, it interrupts this, plays TTS, then resumes this.
            setBackground(interaction.guild.id, radioUrl, connection);

            await interaction.editReply('📻 Playing **World of Fun Radio** from local playlist! (TTS messages will pause the music)');

        } catch (error) {
            console.error(error);
            await interaction.editReply('Failed to join voice channel or play radio.');
        }
    },
};
