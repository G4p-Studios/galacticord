const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.GuildUpdate,
    async execute(oldGuild, newGuild) {
        const embed = new EmbedBuilder()
            .setTitle('Server Settings Updated')
            .setColor(0x3498DB)
            .setThumbnail(newGuild.iconURL())
            .setTimestamp();

        let changed = false;

        // 1. Name Change
        if (oldGuild.name !== newGuild.name) {
            embed.addFields({ name: 'Name Change', value: `**Old:** ${oldGuild.name}\n**New:** ${newGuild.name}` });
            changed = true;
        }

        // 2. Icon Change
        if (oldGuild.icon !== newGuild.icon) {
            embed.addFields({ name: 'Icon Change', value: 'Server icon was updated.' });
            changed = true;
        }

        // 3. Ownership Change
        if (oldGuild.ownerId !== newGuild.ownerId) {
            embed.addFields({ name: 'Ownership Change', value: `**Old Owner ID:** ${oldGuild.ownerId}\n**New Owner ID:** ${newGuild.ownerId}` });
            changed = true;
        }

        // 4. Verification Level
        if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
             embed.addFields({ name: 'Verification Level', value: `Updated to ${newGuild.verificationLevel}` });
             changed = true;
        }

        if (changed) {
            const entry = await fetchLatestAuditLog(newGuild, AuditLogEvent.GuildUpdate);
            const executor = entry ? entry.executor.tag : 'Unknown';
            embed.addFields({ name: 'Updated By', value: executor });

            await sendLog(newGuild, embed);
        }
    },
};
