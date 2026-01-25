const { createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');

// Global Map to store queues and players per guild
const guildQueues = new Map();

function addToQueue(guildId, resource, connection) {
    if (!guildQueues.has(guildId)) {
        const player = createAudioPlayer();
        guildQueues.set(guildId, {
            player: player,
            queue: []
        });

        player.on(AudioPlayerStatus.Idle, () => {
            const guildData = guildQueues.get(guildId);
            if (guildData && guildData.queue.length > 0) {
                const nextResource = guildData.queue.shift();
                player.play(nextResource);
            }
        });

        player.on('error', error => {
            console.error(`[Player Error Guild ${guildId}] Details:`, error.message);
        });
    }

    const guildData = guildQueues.get(guildId);
    connection.subscribe(guildData.player);

    if (guildData.player.state.status === AudioPlayerStatus.Idle) {
        guildData.player.play(resource);
        console.log(`[AudioQueue] Playing immediately for Guild ${guildId}`);
    } else {
        guildData.queue.push(resource);
        console.log(`[AudioQueue] Added to queue for Guild ${guildId}. Queue length: ${guildData.queue.length}`);
    }
}

module.exports = { addToQueue };
