const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        const embed = new EmbedBuilder()
            .setTitle('Member Updated')
            .setColor(0x3498DB)
            .setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() })
            .setTimestamp();

        let changed = false;

        // Nickname change
        if (oldMember.nickname !== newMember.nickname) {
            embed.addFields(
                { name: 'Nickname Change', value: `**Old:** ${oldMember.nickname || 'None'}
**New:** ${newMember.nickname || 'None'}` }
            );
            changed = true;
        }

        // Role changes
        const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
        const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

        if (addedRoles.size > 0) {
            embed.addFields({ name: 'Roles Added', value: addedRoles.map(r => r.name).join(', ') });
            changed = true;
        }
        if (removedRoles.size > 0) {
            embed.addFields({ name: 'Roles Removed', value: removedRoles.map(r => r.name).join(', ') });
            changed = true;
        }

        // Timeout changes
        if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
            const isTimedOut = newMember.communicationDisabledUntilTimestamp !== null && newMember.communicationDisabledUntilTimestamp > Date.now();
            if (isTimedOut) {
                const expiration = Math.floor(newMember.communicationDisabledUntilTimestamp / 1000);
                embed.setTitle('Member Timed Out')
                     .setColor(0xE67E22)
                     .addFields({ name: 'Expires', value: `<t:${expiration}:R>` });
            } else if (oldMember.communicationDisabledUntilTimestamp !== null) {
                embed.setTitle('Member Timeout Removed')
                     .setColor(0x2ECC71);
            }
            changed = true;
        }

        if (changed) {
            await sendLog(newMember.guild, embed);
        }
    },
};
