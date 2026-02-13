const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.InviteCreate,
    async execute(invite) {
        const embed = new EmbedBuilder()
            .setTitle('Invite Created')
            .setColor(0x2ECC71)
            .addFields(
                { name: 'Code', value: invite.code, inline: true },
                { name: 'Channel', value: invite.channel?.name || 'Unknown', inline: true },
                { name: 'Inviter', value: invite.inviter?.tag || 'Unknown', inline: true },
                { name: 'Expires', value: invite.expiresAt ? invite.expiresAt.toLocaleString() : 'Never', inline: true },
                { name: 'Max Uses', value: invite.maxUses === 0 ? 'Infinite' : invite.maxUses.toString(), inline: true }
            )
            .setTimestamp();

        await sendLog(invite.guild, embed);
    },
};
