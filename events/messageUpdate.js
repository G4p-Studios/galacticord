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
            .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL() })
            .setURL(newMessage.url)
            .addFields(
                { name: 'Channel', value: `${newMessage.channel}`, inline: true },
                { name: 'Author ID', value: newMessage.author.id, inline: true },
                { name: 'Before', value: oldMessage.content ? oldMessage.content.substring(0, 1024) : '*No text*' },
                { name: 'After', value: newMessage.content ? newMessage.content.substring(0, 1024) : '*No text*' }
            )
            .setTimestamp();

        await sendLog(newMessage.guild, embed);
    },
};
