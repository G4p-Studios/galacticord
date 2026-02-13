const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.RoleUpdate,
    async execute(oldRole, newRole) {
        const embed = new EmbedBuilder()
            .setTitle('Role Updated')
            .setColor(0x3498DB)
            .setTimestamp();

        let changed = false;

        if (oldRole.name !== newRole.name) {
            embed.addFields({ name: 'Name Change', value: `**Old:** ${oldRole.name}
**New:** ${newRole.name}` });
            changed = true;
        }

        if (oldRole.color !== newRole.color) {
            embed.addFields({ name: 'Color Change', value: `**Old:** ${oldRole.hexColor}
**New:** ${newRole.hexColor}` });
            changed = true;
        }

        if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
            embed.addFields({ name: 'Permissions Change', value: 'Role permissions were updated.' });
            changed = true;
        }

        if (changed) {
            await sendLog(newRole.guild, embed);
        }
    },
};
