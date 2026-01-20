const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '../data/server_config.json');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        if (!message.guild) return;
        
        let config = {};
        try {
            if (fs.existsSync(configFile)) {
                config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
        } catch (e) {}

        const logChannelId = config[message.guild.id]?.logChannel;
        if (!logChannelId) return;

        const logChannel = message.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const embed = new EmbedBuilder()
            .setTitle('Message Deleted')
            .setColor(0xFF0000)
            .addFields(
                { name: 'Author', value: message.author ? message.author.tag : 'Unknown', inline: true },
                { name: 'Channel', value: message.channel.name, inline: true },
                { name: 'Content', value: message.content || 'No text content (possibly an embed/image)' }
            )
            .setTimestamp();

        logChannel.send({ embeds: [embed] });
    },
};