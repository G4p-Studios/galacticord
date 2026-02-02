const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { stopBackground } = require('../../utils/audioQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop music/radio and leave the voice channel'),
    async execute(interaction) {
        const connection = getVoiceConnection(interaction.guild.id);
        
        // Stop background radio logic
        stopBackground(interaction.guild.id);
        
        interaction.client.queues.delete(interaction.guild.id);

        if (connection) {
            connection.destroy();
            await interaction.reply('Stopped playing and left the voice channel.');
        } else {
            await interaction.reply('I am not in a voice channel.');
        }
    },
};
