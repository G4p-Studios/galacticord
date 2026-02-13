const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '../data/server_config.json');

async function sendLog(guild, embed) {
    await _sendToChannel(guild, embed, 'logChannel');
}

async function sendModLog(guild, embed) {
    // Try modLog first, fallback to logChannel
    await _sendToChannel(guild, embed, 'modLog') || await _sendToChannel(guild, embed, 'logChannel');
}

async function _sendToChannel(guild, embed, configKey) {
    if (!guild) return false;

    let config = {};
    try {
        if (fs.existsSync(configFile)) {
            config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        }
    } catch (e) {
        console.error(`[Logger] Error reading config:`, e);
    }

    const channelId = config[guild.id]?.[configKey];
    if (!channelId) return false;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) {
        try {
            const fetchedChannel = await guild.channels.fetch(channelId);
            if (fetchedChannel) {
                await fetchedChannel.send({ embeds: [embed] });
                return true;
            }
        } catch (e) {}
        return false;
    }

    try {
        await channel.send({ embeds: [embed] });
        return true;
    } catch (e) {
        console.error(`[Logger] Error sending log to ${configKey}:`, e);
        return false;
    }
}

module.exports = { sendLog, sendModLog };
