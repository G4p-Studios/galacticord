const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.InviteDelete,
    async execute(invite) {
        const embed = new EmbedBuilder()
            .setTitle('Invite Deleted')
            .setColor(0xE74C3C)
            .addFields(
                { name: 'Code', value: invite.code, inline: true },
                { name: 'Channel', value: invite.channel?.name || 'Unknown', inline: true }
            )
            .setTimestamp();

        await sendLog(invite.guild, embed);
    },
};
