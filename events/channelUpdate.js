const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.ChannelUpdate,
    async execute(oldChannel, newChannel) {
        if (!newChannel.guild) return;

        const embed = new EmbedBuilder()
            .setTitle('Channel Updated')
            .setColor(0x3498DB)
            .setTimestamp();

        let changed = false;

        if (oldChannel.name !== newChannel.name) {
            embed.addFields({ name: 'Name Change', value: `**Old:** ${oldChannel.name}
**New:** ${newChannel.name}` });
            changed = true;
        }

        if (oldChannel.topic !== newChannel.topic) {
            embed.addFields({ name: 'Topic Change', value: `**Old:** ${oldChannel.topic || 'None'}
**New:** ${newChannel.topic || 'None'}` });
            changed = true;
        }

        if (changed) {
            await sendLog(newChannel.guild, embed);
        }
    },
};
