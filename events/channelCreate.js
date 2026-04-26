const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        if (!channel.guild) return;

        const entry = await fetchLatestAuditLog(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
        const executor = entry ? entry.executor.tag : 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle('Channel Created')
            .setColor(0x2ECC71)
            .addFields(
                { name: 'Name', value: `${channel}`, inline: true },
                { name: 'Created By', value: executor, inline: true }
            )
            .setTimestamp();

        await sendLog(channel.guild, embed);
    },
};
