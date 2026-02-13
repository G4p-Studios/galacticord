const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        const embed = new EmbedBuilder()
            .setTitle('Member Banned')
            .setColor(0xFF0000)
            .setDescription(`${ban.user.tag} (${ban.user.id}) was banned.`)
            .setThumbnail(ban.user.displayAvatarURL())
            .addFields({ name: 'Reason', value: ban.reason || 'No reason provided' })
            .setTimestamp();

        await sendLog(ban.guild, embed);
    },
};
