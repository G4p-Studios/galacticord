const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        // We ignore bot's own voice state updates for logging usually, 
        // but maybe the user wants to see when the bot joins/leaves.
        // Let's log everything for now as requested "all that good jazz".
        
        const member = newState.member || oldState.member;
        if (!member) return;

        const embed = new EmbedBuilder()
            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
            .setTimestamp();

        let log = false;

        // Join
        if (!oldState.channelId && newState.channelId) {
            embed.setTitle('Joined Voice Channel')
                 .setColor(0x2ECC71)
                 .setDescription(`${member.user.tag} joined ${newState.channel}`);
            log = true;
        }
        // Leave
        else if (oldState.channelId && !newState.channelId) {
            embed.setTitle('Left Voice Channel')
                 .setColor(0xE74C3C)
                 .setDescription(`${member.user.tag} left ${oldState.channel}`);
            log = true;
        }
        // Move
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            embed.setTitle('Moved Voice Channel')
                 .setColor(0x3498DB)
                 .setDescription(`${member.user.tag} moved from ${oldState.channel} to ${newState.channel}`);
            log = true;
        }

        if (log) {
            await sendLog(newState.guild, embed);
        }
    },
};
