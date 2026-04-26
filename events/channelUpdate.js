const { Events, EmbedBuilder, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        if (!newChannel.guild) return;

        const embed = new EmbedBuilder()
            .setTitle('Channel Updated')
            .setColor(0x3498DB)
            .setDescription(`Channel: ${newChannel} (${newChannel.name})`)
            .setTimestamp();

        let changed = false;

        // 1. Name Change
        if (oldChannel.name !== newChannel.name) {
            embed.addFields({ name: 'Name Change', value: `**Old:** ${oldChannel.name}\n**New:** ${newChannel.name}` });
            changed = true;
        }

        // 2. Topic Change
        if (oldChannel.topic !== newChannel.topic) {
            embed.addFields({ name: 'Topic Change', value: `**Old:** ${oldChannel.topic || 'None'}\n**New:** ${newChannel.topic || 'None'}` });
            changed = true;
        }

        // 3. Permission Overwrites
        if (!oldChannel.permissionOverwrites.cache.equals(newChannel.permissionOverwrites.cache)) {
            changed = true;
            
            // Diff the overwrites
            const oldOverwrites = oldChannel.permissionOverwrites.cache;
            const newOverwrites = newChannel.permissionOverwrites.cache;

            const diffStrings = [];

            // Check for added or updated overwrites
            newOverwrites.forEach((newPerms, id) => {
                const oldPerms = oldOverwrites.get(id);
                const target = newChannel.guild.roles.cache.get(id) || newChannel.guild.members.cache.get(id) || { name: 'Unknown Target' };
                const targetName = target.name || (target.user ? target.user.tag : 'Unknown');

                if (!oldPerms) {
                    diffStrings.push(`➕ **Added Overwrite for ${targetName}**`);
                } else if (!oldPerms.allow.equals(newPerms.allow) || !oldPerms.deny.equals(newPerms.deny)) {
                    diffStrings.push(`🔄 **Updated Overwrite for ${targetName}**`);
                    
                    // Detail the specific bit changes
                    const addedAllow = newPerms.allow.remove(oldPerms.allow);
                    const removedAllow = oldPerms.allow.remove(newPerms.allow);
                    const addedDeny = newPerms.deny.remove(oldPerms.deny);
                    const removedDeny = oldPerms.deny.remove(newPerms.deny);

                    if (addedAllow.bitfield !== 0n) diffStrings.push(`   - Allowed: ${addedAllow.toArray().join(', ')}`);
                    if (removedAllow.bitfield !== 0n) diffStrings.push(`   - No longer allowed: ${removedAllow.toArray().join(', ')}`);
                    if (addedDeny.bitfield !== 0n) diffStrings.push(`   - Denied: ${addedDeny.toArray().join(', ')}`);
                    if (removedDeny.bitfield !== 0n) diffStrings.push(`   - No longer denied: ${removedDeny.toArray().join(', ')}`);
                }
            });

            // Check for removed overwrites
            oldOverwrites.forEach((oldPerms, id) => {
                if (!newOverwrites.has(id)) {
                    const target = newChannel.guild.roles.cache.get(id) || newChannel.guild.members.cache.get(id) || { name: 'Unknown' };
                    const targetName = target.name || (target.user ? target.user.tag : 'Unknown');
                    diffStrings.push(`➖ **Removed Overwrite for ${targetName}**`);
                }
            });

            if (diffStrings.length > 0) {
                embed.addFields({ name: 'Permission Changes', value: diffStrings.join('\n').substring(0, 1024) });
            } else {
                embed.addFields({ name: 'Permissions', value: 'Overwrites were modified (internal structure change).' });
            }
        }

        if (changed) {
            // Check multiple event types for permissions
            const entry = await fetchLatestAuditLog(newChannel.guild, [
                AuditLogEvent.ChannelUpdate,
                AuditLogEvent.ChannelOverwriteCreate,
                AuditLogEvent.ChannelOverwriteUpdate,
                AuditLogEvent.ChannelOverwriteDelete
            ], newChannel.id);
            
            const executor = entry ? entry.executor.tag : 'Unknown / System';
            embed.addFields({ name: 'Updated By', value: executor });
            
            await sendLog(newChannel.guild, embed);
        }
    },
};
