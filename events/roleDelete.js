const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.RoleDelete,
    async execute(role) {
        const embed = new EmbedBuilder()
            .setTitle('Role Deleted')
            .setColor(0xE74C3C)
            .addFields(
                { name: 'Name', value: role.name, inline: true },
                { name: 'ID', value: role.id, inline: true }
            )
            .setTimestamp();

        await sendLog(role.guild, embed);
    },
};
