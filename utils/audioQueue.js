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
 * Uses curl -> ffmpeg pipe for maximum stability on Linux.
 */
function createRadioResource(resourceUrl) {
    console.log(`[AudioQueue] Opening stream via curl|ffmpeg: ${resourceUrl}`);

    // Spawn Curl to handle the network connection
    const curl = spawn('curl', [
        '-L', // Follow redirects
        '-k', // Insecure (skip cert check if needed)
        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        resourceUrl
    ]);

    // Spawn FFmpeg to handle decoding from stdin (pipe:0)
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-map_metadata', '-1',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    // Pipe curl output to ffmpeg input
    curl.stdout.pipe(ffmpeg.stdin);

    curl.stderr.on('data', (d) => {
        // console.log(`[Curl] ${d.toString()}`); // debug if needed
    });
    
    curl.on('error', (err) => console.error(`[Curl Error] ${err.message}`));
    curl.on('close', (code) => {
        if (code !== 0) console.error(`[Curl] Exited with code ${code}`);
        // If curl dies, close ffmpeg input to finish the stream
        ffmpeg.stdin.end();
    });

    ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('Error') || msg.includes('failed') || msg.includes('Invalid')) {
            console.error(`[FFmpeg Raw] ${msg}`);
        }
    });

    ffmpeg.on('error', (err) => {
        console.error(`[FFmpeg Error] ${err.message}`);
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
                    
                    // 60 second cooldown as requested
                    if (now - lastTime < 60000) {
                        console.log(`[AudioQueue] Stream ended. Waiting 60s cooldown before reconnecting...`);
                        setTimeout(() => {
                            if (currentData.backgroundUrl && !currentData.isPlayingTTS) {
                                console.log(`[AudioQueue] Resuming background stream.`);
                                lastRestart.set(guildId, Date.now());
                                player.play(createRadioResource(currentData.backgroundUrl));
                            }
                        }, 60000);
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

function stopBackground(guildId) {
    const guildData = guildQueues.get(guildId);
    if (guildData) {
        console.log(`[AudioQueue] Stopping background radio.`);
        guildData.backgroundUrl = null;
        // If currently playing the radio (not TTS), stop immediately
        if (!guildData.isPlayingTTS) {
            guildData.player.stop();
        }
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

module.exports = { addToQueue, setBackground, stopBackground };
