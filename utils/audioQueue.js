const { createAudioPlayer, AudioPlayerStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn } = require('child_process');

// Global Map to store queues and players per guild
const guildQueues = new Map();

/**
 * Creates an audio resource for a radio stream URL (ffmpeg).
 */
function createRadioResource(url) {
    console.log(`[AudioQueue] Creating radio stream from: ${url}`);
    
    const ffmpeg = spawn('ffmpeg', [
        '-re',
        '-i', url,
        '-ac', '2',
        '-f', 'mp3',
        'pipe:1'
    ], {
        stdio: ['ignore', 'pipe', 'pipe'] // Ignore stdin, pipe stdout/stderr
    });
    
    ffmpeg.stderr.on('data', (data) => {
        // Uncomment for detailed ffmpeg logs
        // console.error(`[FFmpeg Log] ${data.toString()}`);
    });

    ffmpeg.on('error', (err) => {
        console.error(`[FFmpeg Error] Failed to spawn ffmpeg: ${err.message}`);
    });

    ffmpeg.on('close', (code) => {
        if (code !== 0) console.log(`[FFmpeg] Process exited with code ${code}`);
    });
    
    return createAudioResource(ffmpeg.stdout, {
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
