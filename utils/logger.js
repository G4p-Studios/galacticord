const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '../data/server_config.json');

async function sendLog(guild, embed) {
    if (!guild) return;

    let config = {};
    try {
        if (fs.existsSync(configFile)) {
            config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        }
    } catch (e) {
        console.error('[Logger] Error reading config:', e);
    }

    const logChannelId = config[guild.id]?.logChannel;
    if (!logChannelId) return;

    const logChannel = guild.channels.cache.get(logChannelId);
    if (!logChannel) {
        // Try to fetch it if it's not in cache
        try {
            const fetchedChannel = await guild.channels.fetch(logChannelId);
            if (fetchedChannel) {
                fetchedChannel.send({ embeds: [embed] });
            }
        } catch (e) {
            // console.error('[Logger] Error fetching log channel:', e);
        }
        return;
    }

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (e) {
        console.error('[Logger] Error sending log:', e);
    }
}

module.exports = { sendLog };
