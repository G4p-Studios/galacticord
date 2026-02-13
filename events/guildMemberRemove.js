const { Events, EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const embed = new EmbedBuilder()
            .setTitle('Member Left')
            .setColor(0xFF0000)
            .setDescription(`${member.user.tag} (${member.user.id}) has left the server.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await sendLog(member.guild, embed);
    },
};
