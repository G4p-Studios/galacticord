const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        if (!channel.guild) return;

        const entry = await fetchLatestAuditLog(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        const executor = entry ? entry.executor.tag : 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle('Channel Deleted')
            .setColor(0xE74C3C)
            .addFields(
                { name: 'Name', value: channel.name, inline: true },
                { name: 'Deleted By', value: executor, inline: true }
            )
            .setTimestamp();

        await sendLog(channel.guild, embed);
    },
};
