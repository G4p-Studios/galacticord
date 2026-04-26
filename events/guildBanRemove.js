const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendModLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.GuildBanRemove,
    async execute(ban) {
        const entry = await fetchLatestAuditLog(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
        const executor = entry ? entry.executor.tag : 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle('Member Unbanned')
            .setColor(0x00FF00)
            .setDescription(`${ban.user.tag} (${ban.user.id}) was unbanned.`)
            .setThumbnail(ban.user.displayAvatarURL())
            .addFields({ name: 'Moderator', value: executor })
            .setTimestamp();

        await sendModLog(ban.guild, embed);
    },
};
