const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser();
const socialsFile = path.join(__dirname, '../data/socials.json');

async function checkSocials(client) {
    if (!fs.existsSync(socialsFile)) return;
    
    let subscriptions = [];
    try {
        subscriptions = JSON.parse(fs.readFileSync(socialsFile, 'utf8'));
    } catch (e) {
        console.error("Error reading socials.json", e);
        return;
    }

    let updated = false;

    for (const sub of subscriptions) {
        try {
            const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${sub.youtubeChannelId}`);
            
            if (feed.items.length > 0) {
                const latestVideo = feed.items[0];
                
                if (latestVideo.id !== sub.lastVideoId) {
                    // New video found!
                    sub.lastVideoId = latestVideo.id;
                    updated = true;

                    const channel = client.channels.cache.get(sub.discordChannelId);
                    if (channel) {
                        await channel.send(`**${feed.title}** just uploaded a new video!\n${latestVideo.link}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Error checking channel ${sub.youtubeChannelId}:`, error.message);
        }
    }

    if (updated) {
        fs.writeFileSync(socialsFile, JSON.stringify(subscriptions, null, 2));
    }
}

module.exports = { checkSocials };
