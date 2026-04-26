const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog, sendModLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        const embed = new EmbedBuilder()
            .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
            .setTimestamp();

        let changed = false;
        let isModerationAction = false;

        // 1. Nickname change
        if (oldMember.nickname !== newMember.nickname) {
            const entry = await fetchLatestAuditLog(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            const executor = entry ? entry.executor.tag : 'Unknown / Self';

            embed.setTitle('Nickname Changed')
                 .setColor(0x3498DB)
                 .addFields(
                    { name: 'Old Nickname', value: oldMember.nickname || 'None', inline: true },
                    { name: 'New Nickname', value: newMember.nickname || 'None', inline: true },
                    { name: 'Changed By', value: executor, inline: false }
                 );
            changed = true;
        }

        // 2. Role changes
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

        if (addedRoles.size > 0 || removedRoles.size > 0) {
            let entry = await fetchLatestAuditLog(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
            
            // Fallback for some bots/integrations that might trigger a general member update
            if (!entry) {
                entry = await fetchLatestAuditLog(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            }

            const executor = entry ? entry.executor.tag : 'Unknown';

            embed.setTitle('Roles Updated')
                 .setColor(0x3498DB)
                 .addFields({ name: 'Updated By', value: executor });

            if (addedRoles.size > 0) {
                embed.addFields({ name: 'Added Roles', value: addedRoles.map(r => r.name).join(', ') });
            }
            if (removedRoles.size > 0) {
                embed.addFields({ name: 'Removed Roles', value: removedRoles.map(r => r.name).join(', ') });
            }
            changed = true;
        }

        // 3. Timeout changes
        if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
            const entry = await fetchLatestAuditLog(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
            const executor = entry ? entry.executor.tag : 'Unknown';

            const isTimedOut = newMember.communicationDisabledUntilTimestamp !== null && newMember.communicationDisabledUntilTimestamp > Date.now();
            if (isTimedOut) {
                const expiration = Math.floor(newMember.communicationDisabledUntilTimestamp / 1000);
                embed.setTitle('Member Timed Out')
                     .setColor(0xE67E22)
                     .setDescription(`${newMember.user.tag} was timed out until <t:${expiration}:f>`)
                     .addFields({ name: 'Moderator', value: executor });
            } else if (oldMember.communicationDisabledUntilTimestamp !== null) {
                embed.setTitle('Member Timeout Removed')
                     .setColor(0x2ECC71)
                     .setDescription(`Timeout removed for ${newMember.user.tag}`)
                     .addFields({ name: 'Moderator', value: executor });
            }
            changed = true;
            isModerationAction = true;
        }

        if (changed) {
            if (isModerationAction) {
                await sendModLog(newMember.guild, embed);
            } else {
                await sendLog(newMember.guild, embed);
            }
        }
    },
};
