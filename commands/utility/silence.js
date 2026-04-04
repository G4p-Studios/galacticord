const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { silenceAll } = require('../../utils/audioQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('silence')
        .setDescription('Stop all audio (TTS, music, radio) immediately — bot stays in channel'),
    async execute(interaction) {
        const connection = getVoiceConnection(interaction.guild.id);
        if (!connection) {
            await interaction.reply('I am not in a voice channel.');
            return;
        }

        silenceAll(interaction.guild.id);
        interaction.client.queues?.delete(interaction.guild.id);
        await interaction.reply('All audio stopped.');
    },
};
