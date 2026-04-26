const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const member = newState.member || oldState.member;
        if (!member) return;

        const embed = new EmbedBuilder()
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTimestamp();

        let log = false;

        // 1. Join/Leave/Move
        if (!oldState.channelId && newState.channelId) {
            embed.setTitle('Joined Voice Channel')
                 .setColor(0x2ECC71)
                 .setDescription(`${member.user.tag} joined ${newState.channel}`);
            log = true;
        }
        else if (oldState.channelId && !newState.channelId) {
            embed.setTitle('Left Voice Channel')
                 .setColor(0xE74C3C)
                 .setDescription(`${member.user.tag} left ${oldState.channel}`);
            log = true;
        }
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            embed.setTitle('Moved Voice Channel')
                 .setColor(0x3498DB)
                 .setDescription(`${member.user.tag} moved from ${oldState.channel} to ${newState.channel}`);
            log = true;
        }

        // 2. Server Mute/Deafen (Moderation)
        if (oldState.serverMute !== newState.serverMute) {
            const entry = await fetchLatestAuditLog(newState.guild, AuditLogEvent.MemberUpdate, member.id);
            const executor = entry ? entry.executor.tag : 'Unknown';
            
            embed.setTitle(newState.serverMute ? 'Member Server Muted' : 'Member Server Unmuted')
                 .setColor(newState.serverMute ? 0xE67E22 : 0x2ECC71)
                 .setDescription(`${member.user.tag} was ${newState.serverMute ? 'muted' : 'unmuted'} in voice by **${executor}**.`);
            log = true;
        }

        if (oldState.serverDeaf !== newState.serverDeaf) {
            const entry = await fetchLatestAuditLog(newState.guild, AuditLogEvent.MemberUpdate, member.id);
            const executor = entry ? entry.executor.tag : 'Unknown';

            embed.setTitle(newState.serverDeaf ? 'Member Server Deafened' : 'Member Server Undeafened')
                 .setColor(newState.serverDeaf ? 0xE67E22 : 0x2ECC71)
                 .setDescription(`${member.user.tag} was ${newState.serverDeaf ? 'deafened' : 'undeafened'} in voice by **${executor}**.`);
            log = true;
        }

        // 3. Self Mute/Deafen (Optional, but "all that jazz")
        if (oldState.selfMute !== newState.selfMute) {
            embed.setTitle(newState.selfMute ? 'Member Self Muted' : 'Member Self Unmuted')
                 .setColor(0x95A5A6)
                 .setDescription(`${member.user.tag} ${newState.selfMute ? 'muted' : 'unmuted'} themselves.`);
            log = true;
        }
        if (oldState.selfDeaf !== newState.selfDeaf) {
            embed.setTitle(newState.selfDeaf ? 'Member Self Deafened' : 'Member Self Undeafened')
                 .setColor(0x95A5A6)
                 .setDescription(`${member.user.tag} ${newState.selfDeaf ? 'deafened' : 'undeafened'} themselves.`);
            log = true;
        }

        if (log) {
            await sendLog(newState.guild, embed);
        }
    },
};
