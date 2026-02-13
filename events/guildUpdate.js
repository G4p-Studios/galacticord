const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildUpdate,
    async execute(oldGuild, newGuild) {
        const embed = new EmbedBuilder()
            .setTitle('Server Updated')
            .setColor(0x3498DB)
            .setTimestamp();

        let changed = false;

        if (oldGuild.name !== newGuild.name) {
            embed.addFields({ name: 'Name Change', value: `**Old:** ${oldGuild.name}
**New:** ${newGuild.name}` });
            changed = true;
        }

        if (oldGuild.icon !== newGuild.icon) {
            embed.addFields({ name: 'Icon Change', value: 'Server icon was updated.' });
            embed.setThumbnail(newGuild.iconURL());
            changed = true;
        }

        if (oldGuild.ownerId !== newGuild.ownerId) {
            embed.addFields({ name: 'Ownership Change', value: `**Old Owner ID:** ${oldGuild.ownerId}
**New Owner ID:** ${newGuild.ownerId}` });
            changed = true;
        }

        if (changed) {
            await sendLog(newGuild, embed);
        }
    },
};
