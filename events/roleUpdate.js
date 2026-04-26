const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.RoleUpdate,
    async execute(oldRole, newRole) {
        const embed = new EmbedBuilder()
            .setTitle('Role Updated')
            .setColor(newRole.color || 0x3498DB)
            .setDescription(`Role: ${newRole} (${newRole.name})`)
            .setTimestamp();

        let changed = false;

        // 1. Name Change
        if (oldRole.name !== newRole.name) {
            embed.addFields({ name: 'Name Change', value: `**Old:** ${oldRole.name}\n**New:** ${newRole.name}` });
            changed = true;
        }

        // 2. Color Change
        if (oldRole.color !== newRole.color) {
            embed.addFields({ name: 'Color Change', value: `**Old:** ${oldRole.hexColor}\n**New:** ${newRole.hexColor}` });
            changed = true;
        }

        // 3. Permissions Change
        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            embed.addFields({ name: 'Permissions Change', value: 'Role permissions were updated.' });
            changed = true;
        }

        if (changed) {
            const entry = await fetchLatestAuditLog(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
            const executor = entry ? entry.executor.tag : 'Unknown';
            embed.addFields({ name: 'Updated By', value: executor });

            await sendLog(newRole.guild, embed);
        }
    },
};
