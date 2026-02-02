const { createAudioPlayer, AudioPlayerStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

// Global Map to store queues and players per guild
const guildQueues = new Map();
// Cooldown map to prevent spamming restarts
const lastRestart = new Map();

/**
 * Creates an audio resource for a radio stream.
 * Uses ffmpeg to convert to PCM s16le for maximum stability.
 */
function createRadioResource(input) {
    let resourceUrl = input;

    // Check if input is a local file (like radio.m3u)
    if (fs.existsSync(input)) {
        console.log(`[AudioQueue] Reading M3U file: ${input}`);
        try {
            const content = fs.readFileSync(input, 'utf8');
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                // Find first line that is a URL
                if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('http')) {
                    resourceUrl = trimmed;
                    break;
                }
            }
        } catch (e) {
            console.error(`[AudioQueue Error] Failed to read M3U: ${e.message}`);
        }
    }

    console.log(`[AudioQueue] Opening stream: ${resourceUrl}`);

    // Use ffmpeg to ensure stable streaming
    // Added a more common browser User-Agent and connection flags
    const ffmpeg = spawn('ffmpeg', [
        '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n',
        '-i', resourceUrl,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    ffmpeg.stderr.on('data', (data) => {
        // Log EVERYTHING so we can see why it dies
        console.error(`[FFmpeg Raw] ${data.toString().trim()}`);
    });

    ffmpeg.on('error', (err) => {
        console.error(`[FFmpeg Error] ${err.message}`);
    });

    // We use StreamType.Raw because we are outputting raw s16le PCM 48k Stereo
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
                console.log(`[AudioQueue] Playing next TTS from queue.`);
                const nextResource = currentData.queue.shift();
                currentData.isPlayingTTS = true;
                player.play(nextResource);
            } else {
                // No more TTS. Resume background if available.
                currentData.isPlayingTTS = false;
                if (currentData.backgroundUrl) {
                    const now = Date.now();
                    const lastTime = lastRestart.get(guildId) || 0;
                    
                    // 5 second cooldown to prevent restart loops
                    if (now - lastTime < 5000) {
                        console.log(`[AudioQueue] Background stream ended too quickly. Waiting for cooldown...`);
                        setTimeout(() => {
                            if (currentData.backgroundUrl && !currentData.isPlayingTTS) {
                                console.log(`[AudioQueue] Resuming background stream after cooldown.`);
                                lastRestart.set(guildId, Date.now());
                                player.play(createRadioResource(currentData.backgroundUrl));
                            }
                        }, 5000);
                    } else {
                        console.log(`[AudioQueue] Queue empty. Resuming background stream.`);
                        lastRestart.set(guildId, now);
                        player.play(createRadioResource(currentData.backgroundUrl));
                    }
                }
            }
        });

        player.on('error', error => {
            console.error(`[AudioQueue Error] Player error:`, error.message);
        });
    }
    return guildQueues.get(guildId);
}

function setBackground(guildId, url, connection) {
    const guildData = initGuildData(guildId);
    guildData.backgroundUrl = url;
    connection.subscribe(guildData.player);

    if (!guildData.isPlayingTTS) {
        console.log(`[AudioQueue] Starting background radio.`);
        lastRestart.set(guildId, Date.now());
        guildData.player.play(createRadioResource(url));
    }
}

function addToQueue(guildId, resource, connection) {
    const guildData = initGuildData(guildId);
    connection.subscribe(guildData.player);

    if (guildData.isPlayingTTS) {
        guildData.queue.push(resource);
        console.log(`[AudioQueue] TTS added to queue.`);
    } else {
        console.log(`[AudioQueue] Interrupting for TTS.`);
        guildData.isPlayingTTS = true;
        guildData.player.play(resource);
    }
}

module.exports = { addToQueue, setBackground };
