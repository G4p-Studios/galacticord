const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildBanRemove,
    async execute(ban) {
        const embed = new EmbedBuilder()
            .setTitle('Member Unbanned')
            .setColor(0x00FF00)
            .setDescription(`${ban.user.tag} (${ban.user.id}) was unbanned.`)
            .setThumbnail(ban.user.displayAvatarURL())
            .setTimestamp();

        await sendLog(ban.guild, embed);
    },
};
