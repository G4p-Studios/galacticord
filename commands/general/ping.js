const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with bot latency.'),
    async execute(interaction) {
        const start = Date.now();
        const sent = await interaction.reply({ content: 'Pinging...', fetchResponse: true });
        const end = Date.now();
        const latency = end - start;
        await interaction.editReply(`Pong! Latency: ${latency}ms (API Latency: ${Math.round(interaction.client.ws.ping)}ms)`);
    },
};
