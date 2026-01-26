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

        player.on(AudioPlayerStatus.Playing, () => {
            console.log(`[AudioQueue] Player is now PLAYING for Guild ${guildId}`);
        });

        player.on('stateChange', (oldState, newState) => {
            console.log(`[AudioQueue Debug] State change: ${oldState.status} -> ${newState.status}`);
        });

        player.on('error', error => {
            console.error(`[AudioQueue Error] Player error for Guild ${guildId}:`, error.message);
            if (error.resource) {
                console.error(`[AudioQueue Error] Resource was specifically mentioned in error.`);
            }
        });
    }

    const guildData = guildQueues.get(guildId);
    connection.subscribe(guildData.player);

    if (guildData.player.state.status === AudioPlayerStatus.Idle) {
        console.log(`[AudioQueue] Starting immediate playback for Guild ${guildId}`);
        guildData.player.play(resource);
    } else {
        guildData.queue.push(resource);
        console.log(`[AudioQueue] Added to queue for Guild ${guildId}. Current queue size: ${guildData.queue.length}`);
    }
}

module.exports = { addToQueue };
