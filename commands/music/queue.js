const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),
    async execute(interaction) {
        const queue = interaction.client.queues.get(interaction.guild.id);

        if (!queue || queue.songs.length === 0) {
            return interaction.reply('The queue is empty.');
        }

        const lines = queue.songs.map((song, i) => {
            const prefix = i === 0 ? '▶️' : `**${i}.**`;
            return `${prefix} ${song.title}`;
        });

        const embed = {
            color: 0x5865f2,
            title: '🎶 Music Queue',
            description: lines.join('\n'),
            footer: { text: `${queue.songs.length} song${queue.songs.length === 1 ? '' : 's'} in queue` },
        };

        await interaction.reply({ embeds: [embed] });
    },
};
