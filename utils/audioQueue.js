const { createAudioPlayer, AudioPlayerStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const { spawn } = require('child_process');

// Global Map to store queues and players per guild
const guildQueues = new Map();

/**
 * Creates an audio resource for a radio stream.
 * Uses ffmpeg to convert to PCM s16le for maximum stability.
 */
function createRadioResource(input) {
    let resourceUrl = input;

    // Check if input is a local file
    if (fs.existsSync(input)) {
        try {
            const content = fs.readFileSync(input, 'utf8');
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

    console.log(`[AudioQueue] Creating radio stream from: ${resourceUrl}`);

    // Use ffmpeg to ensure stable streaming
    const ffmpeg = spawn('ffmpeg', [
        '-re',
        '-i', resourceUrl,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    ffmpeg.on('error', (err) => {
        console.error(`[FFmpeg Error] Failed to spawn ffmpeg: ${err.message}`);
    });

    ffmpeg.on('close', (code) => {
        if (code !== 0 && code !== null) console.log(`[FFmpeg] Process exited with code ${code}`);
    });

    return createAudioResource(ffmpeg.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true
    });
}

function initGuildData(guildId) {
    if (!guildQueues.has(guildId)) {
        const player = createAudioPlayer();
        const guildData = { 
            player, 
            queue: [], 
            backgroundUrl: null,
            isPlayingTTS: false 
        };
        guildQueues.set(guildId, guildData);

        player.on(AudioPlayerStatus.Idle, () => {
            const currentData = guildQueues.get(guildId);
            if (!currentData) return;

            // If we have more TTS messages, play the next one
            if (currentData.queue.length > 0) {
                console.log(`[AudioQueue] Playing next TTS message from queue.`);
                const nextResource = currentData.queue.shift();
                currentData.isPlayingTTS = true;
                player.play(nextResource);
            } else {
                // No more TTS. Resume background if available.
                currentData.isPlayingTTS = false;
                if (currentData.backgroundUrl) {
                    console.log(`[AudioQueue] Queue empty. Resuming background stream.`);
                    const bgResource = createRadioResource(currentData.backgroundUrl);
                    player.play(bgResource);
                }
            }
        });

        player.on('error', error => {
            console.error(`[AudioQueue Error] Player error for Guild ${guildId}:`, error.message);
            // On error, try to move to next item
            const currentData = guildQueues.get(guildId);
            if (currentData && currentData.queue.length > 0) {
                currentData.queue.shift(); // Remove broken item
                // Idle event will trigger next play
            }
        });
    }
    return guildQueues.get(guildId);
}

function setBackground(guildId, url, connection) {
    const guildData = initGuildData(guildId);
    guildData.backgroundUrl = url;
    connection.subscribe(guildData.player);

    // Only start background if NOT currently playing a TTS message
    if (!guildData.isPlayingTTS) {
        console.log(`[AudioQueue] Starting background stream.`);
        const bgResource = createRadioResource(url);
        guildData.player.play(bgResource);
    }
}

function addToQueue(guildId, resource, connection) {
    const guildData = initGuildData(guildId);
    connection.subscribe(guildData.player);

    // If currently playing a TTS message, add to queue
    if (guildData.isPlayingTTS) {
        guildData.queue.push(resource);
        console.log(`[AudioQueue] Added to queue. Size: ${guildData.queue.length}`);
    } else {
        // If Idle OR playing Background, interrupt and play TTS immediately
        console.log(`[AudioQueue] Interrupting for TTS playback.`);
        guildData.isPlayingTTS = true;
        guildData.player.play(resource);
    }
}

module.exports = { addToQueue, setBackground };