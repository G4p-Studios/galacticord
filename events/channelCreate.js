const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        if (!channel.guild) return;

        const embed = new EmbedBuilder()
            .setTitle('Channel Created')
            .setColor(0x2ECC71)
            .addFields(
                { name: 'Name', value: channel.name, inline: true },
                { name: 'Type', value: channel.type.toString(), inline: true },
                { name: 'ID', value: channel.id, inline: true }
            )
            .setTimestamp();

        await sendLog(channel.guild, embed);
    },
};
