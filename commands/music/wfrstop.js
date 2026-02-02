const { SlashCommandBuilder } = require('discord.js');
const { stopBackground } = require('../../utils/audioQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wfrstop')
        .setDescription('Stop World of Fun Radio immediately (bot stays in channel)'),
    async execute(interaction) {
        stopBackground(interaction.guild.id);
        await interaction.reply('✅ **World of Fun Radio** has been stopped.');
    },
};
