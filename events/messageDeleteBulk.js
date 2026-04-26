const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.MessageBulkDelete,
    async execute(messages) {
        const firstMsg = messages.first();
        if (!firstMsg || !firstMsg.guild) return;

        const guild = firstMsg.guild;
        const channel = firstMsg.channel;

        const embed = new EmbedBuilder()
            .setTitle('Messages Purged (Bulk Delete)')
            .setColor(0xFF0000)
            .setDescription(`**${messages.size}** messages were deleted in ${channel}.`)
            .setTimestamp();

        // Attempt to find the moderator who purged
        const entry = await fetchLatestAuditLog(guild, AuditLogEvent.MessageBulkDelete, channel.id);
        const executor = entry ? entry.executor.tag : 'Unknown / Bot';
        
        embed.addFields({ name: 'Purged By', value: executor });

        // Optional: Count per author if cached
        const authors = {};
        messages.forEach(msg => {
            if (msg.author) {
                authors[msg.author.tag] = (authors[msg.author.tag] || 0) + 1;
            }
        });

        if (Object.keys(authors).length > 0) {
            const authorList = Object.entries(authors)
                .map(([tag, count]) => `• **${tag}**: ${count} messages`)
                .join('\n');
            embed.addFields({ name: 'Affected Users', value: authorList.substring(0, 1024) });
        }

        await sendLog(guild, embed);
    },
};
