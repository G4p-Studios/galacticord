const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '../data/server_config.json');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        let config = {};
        try {
            if (fs.existsSync(configFile)) {
                config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
        } catch (e) {}

        const logChannelId = config[member.guild.id]?.logChannel;
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