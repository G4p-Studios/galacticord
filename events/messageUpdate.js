const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // Only log text changes

        const embed = new EmbedBuilder()
            .setTitle('Message Edited')
            .setColor(0xFFFF00)
            .setURL(newMessage.url)
            .addFields(
                { name: 'Author', value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: false },
                { name: 'Channel', value: `${newMessage.channel} (${newMessage.channel.id})`, inline: false },
                { name: 'Before', value: oldMessage.content || '*No text content*' },
                { name: 'After', value: newMessage.content || '*No text content*' }
            )
            .setTimestamp();

        await sendLog(newMessage.guild, embed);
    },
};
