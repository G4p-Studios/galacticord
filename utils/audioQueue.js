const { createAudioPlayer, AudioPlayerStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');

// Global Map to store queues and players per guild
const guildQueues = new Map();

/**
 * Creates an audio resource for a radio stream.
 * Handles direct URLs and local .m3u playlist files.
 */
function createRadioResource(input) {
    console.log(`[AudioQueue] Creating radio stream from: ${input}`);
    
    let resourceUrl = input;

    // Check if input is a local file
    if (fs.existsSync(input)) {
        try {
            const content = fs.readFileSync(input, 'utf8');
            // Find the first line that isn't a comment (#) and looks like a URL
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('http')) {
                    console.log(`[AudioQueue] Extracted URL from M3U: ${trimmed}`);
                    resourceUrl = trimmed;
                    break;
                }
            }
        } catch (e) {
            console.error(`[AudioQueue Error] Failed to read M3U file: ${e.message}`);
        }
    }

    // Direct stream creation - much more stable for HTTP MP3 streams
    return createAudioResource(resourceUrl, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true
    });
}

function setBackground(guildId, url, connection) {
    let guildData = guildQueues.get(guildId);
    
    if (!guildData) {
        const player = createAudioPlayer();
        guildData = { player, queue: [], backgroundUrl: null };
        guildQueues.set(guildId, guildData);

        player.on(AudioPlayerStatus.Idle, () => {
            const currentData = guildQueues.get(guildId);
            if (currentData && currentData.queue.length > 0) {
                const nextResource = currentData.queue.shift();
                player.play(nextResource);
            } else if (currentData && currentData.backgroundUrl) {
                console.log(`[AudioQueue] Queue empty. Resuming background stream: ${currentData.backgroundUrl}`);
                const bgResource = createRadioResource(currentData.backgroundUrl);
                player.play(bgResource);
            }
        });

        player.on('error', error => {
            console.error(`[AudioQueue Error] Player error for Guild ${guildId}:`, error.message);
        });
    }

    guildData.backgroundUrl = url;
    connection.subscribe(guildData.player);

    // If currently idle or playing another background stream, play immediately
    // If playing TTS (queue not empty), wait for it to finish
    if (guildData.queue.length === 0) {
        console.log(`[AudioQueue] Starting background stream immediately.`);
        const bgResource = createRadioResource(url);
        guildData.player.play(bgResource);
    }
}

function addToQueue(guildId, resource, connection) {
    if (!guildQueues.has(guildId)) {
        const player = createAudioPlayer();
        guildQueues.set(guildId, {
            player: player,
            queue: [],
            backgroundUrl: null
        });

        player.on(AudioPlayerStatus.Idle, () => {
            const guildData = guildQueues.get(guildId);
            if (guildData && guildData.queue.length > 0) {
                const nextResource = guildData.queue.shift();
                player.play(nextResource);
            } else if (guildData && guildData.backgroundUrl) {
                console.log(`[AudioQueue] Queue empty. Resuming background stream: ${guildData.backgroundUrl}`);
                const bgResource = createRadioResource(guildData.backgroundUrl);
                player.play(bgResource);
            }
        });

        player.on('error', error => {
            console.error(`[AudioQueue Error] Player error for Guild ${guildId}:`, error.message);
        });
    }

    const guildData = guildQueues.get(guildId);
    connection.subscribe(guildData.player);

    // TTS Priority Logic:
    // If player is IDLE or playing BACKGROUND (empty queue), play TTS immediately (interrupt background)
    // If player is playing ANOTHER TTS (queue has items), add to queue
    
    if (guildData.queue.length === 0) {
        console.log(`[AudioQueue] Interrupting/Starting immediate playback for TTS.`);
        guildData.player.play(resource);
        // Note: If background was playing, it stops automatically when we play() something else.
        // The Idle event will eventually fire after this TTS is done to resume background.
    } else {
        guildData.queue.push(resource);
        console.log(`[AudioQueue] Added to queue for Guild ${guildId}. Current queue size: ${guildData.queue.length}`);
    }
}

module.exports = { addToQueue, setBackground };
