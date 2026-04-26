const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.RoleCreate,
    async execute(role) {
        const entry = await fetchLatestAuditLog(role.guild, AuditLogEvent.RoleCreate, role.id);
        const executor = entry ? entry.executor.tag : 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle('Role Created')
            .setColor(0x2ECC71)
            .addFields(
                { name: 'Name', value: role.name, inline: true },
                { name: 'Created By', value: executor, inline: true }
            )
            .setTimestamp();

        await sendLog(role.guild, embed);
    },
};
