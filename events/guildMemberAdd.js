const { Events, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const logChannelId = process.env.LOG_CHANNEL_ID;
        if (!logChannelId) return;

        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('Member Joined')
            .setColor(0x00FF00)
            .setDescription(`${member.user.tag} has joined the server.`)
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};
