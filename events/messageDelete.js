const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild) return;
        
        const logChannelId = process.env.LOG_CHANNEL_ID;
        if (!logChannelId) return;

        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('Message Deleted')
            .setColor(0xFF0000)
            .addFields(
                { name: 'Author', value: message.author ? message.author.tag : 'Unknown', inline: true },
                { name: 'Channel', value: message.channel.name, inline: true },
                { name: 'Content', value: message.content || 'No text content (possibly an embed/image)' }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};
