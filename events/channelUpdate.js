const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        if (!newChannel.guild) return;

        const embed = new EmbedBuilder()
            .setTitle('Channel Updated')
            .setColor(0x3498DB)
            .setDescription(`Channel: ${newChannel}`)
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
            embed.addFields({ name: 'Permissions', value: 'Channel permissions/overwrites were updated.' });
            changed = true;
        }

        if (changed) {
            const entry = await fetchLatestAuditLog(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);
            const executor = entry ? entry.executor.tag : 'Unknown';
            embed.addFields({ name: 'Updated By', value: executor });
            
            await sendLog(newChannel.guild, embed);
        }
    },
};
