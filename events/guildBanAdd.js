const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendModLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        const entry = await fetchLatestAuditLog(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        const executor = entry ? entry.executor.tag : 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle('Member Banned')
            .setColor(0xFF0000)
            .setDescription(`${ban.user.tag} (${ban.user.id}) was banned.`)
            .setThumbnail(ban.user.displayAvatarURL())
            .addFields(
                { name: 'Moderator', value: executor, inline: true },
                { name: 'Reason', value: ban.reason || 'No reason provided', inline: true }
            )
            .setTimestamp();

        await sendModLog(ban.guild, embed);
    },
};
