const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.RoleDelete,
    async execute(role) {
        const entry = await fetchLatestAuditLog(role.guild, AuditLogEvent.RoleDelete, role.id);
        const executor = entry ? entry.executor.tag : 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle('Role Deleted')
            .setColor(0xE74C3C)
            .addFields(
                { name: 'Name', value: role.name, inline: true },
                { name: 'Deleted By', value: executor, inline: true }
            )
            .setTimestamp();

        await sendLog(role.guild, embed);
    },
};
