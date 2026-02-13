const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.RoleCreate,
    async execute(role) {
        const embed = new EmbedBuilder()
            .setTitle('Role Created')
            .setColor(0x2ECC71)
            .addFields(
                { name: 'Name', value: role.name, inline: true },
                { name: 'ID', value: role.id, inline: true }
            )
            .setTimestamp();

        await sendLog(role.guild, embed);
    },
};
