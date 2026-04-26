const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog, sendModLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const entry = await fetchLatestAuditLog(member.guild, AuditLogEvent.MemberKick, member.id);
        const executor = entry ? entry.executor.tag : null;

        const embed = new EmbedBuilder()
            .setTitle(executor ? 'Member Kicked' : 'Member Left')
            .setColor(executor ? 0xE74C3C : 0x95A5A6)
            .setDescription(`${member.user.tag} (${member.user.id}) ${executor ? 'was kicked' : 'has left the server'}.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        if (executor) {
            embed.addFields(
                { name: 'Moderator', value: executor, inline: true },
                { name: 'Reason', value: entry.reason || 'No reason provided', inline: true }
            );
            await sendModLog(member.guild, embed);
        } else {
            await sendLog(member.guild, embed);
        }
    },
};
