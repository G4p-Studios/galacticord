const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild || message.author?.bot) return;

        const embed = new EmbedBuilder()
            .setTitle('Message Deleted')
            .setColor(0xFF0000)
            .addFields(
                { name: 'Author', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: false },
                { name: 'Channel', value: `${message.channel} (${message.channel.id})`, inline: false },
                { name: 'Content', value: message.content || 'No text content (possibly an embed/image/attachment)' }
            )
            .setTimestamp();

        await sendLog(message.guild, embed);
    },
};