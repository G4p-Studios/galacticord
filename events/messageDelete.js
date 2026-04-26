const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog, verboseLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        console.log(`[EVENT] MessageDelete triggered for ID: ${message.id} in #${message.channel.name}`);
        verboseLog(message.guild, `Message delete event received for ID: ${message.id} in ${message.channel.name}`);
        if (!message.guild || message.author?.bot) return;

        const embed = new EmbedBuilder()
            .setTitle('Message Deleted')
            .setColor(0xFF0000)
            .addFields(
                { name: 'Author', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown', inline: true },
                { name: 'Channel', value: `${message.channel}`, inline: true },
                { name: 'Content', value: message.content ? (message.content.substring(0, 1024)) : 'No text content (possibly an embed/attachment)' }
            )
            .setTimestamp();

        // Check if it was deleted by a moderator
        // For MESSAGE_DELETE, targetId is the author of the message
        const entry = await fetchLatestAuditLog(message.guild, AuditLogEvent.MessageDelete, message.author?.id);
        
        // Ensure the audit log entry matches the channel where the message was deleted
        if (entry && entry.extra.channel.id === message.channel.id) {
            embed.addFields({ name: 'Deleted By', value: entry.executor.tag });
        } else {
            embed.addFields({ name: 'Deleted By', value: 'Author / Unknown' });
        }

        await sendLog(message.guild, embed);
    },
};