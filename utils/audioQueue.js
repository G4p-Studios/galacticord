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

/**
 * Creates an audio resource from a sound file, optionally seeking to a position.
 */
function createSoundFileResource(filePath, seekSeconds) {
    const args = [];
    if (seekSeconds > 0) args.push('-ss', String(seekSeconds));
    args.push('-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

    const ffmpeg = spawn('ffmpeg', args);
    ffmpeg.stderr.on('data', () => {});
    ffmpeg.on('error', (err) => console.error(`[SoundFile FFmpeg] ${err.message}`));

    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw });
}

/**
 * Creates a mixed audio resource: TTS overlaid on a ducked sound file.
 * Uses sidechaincompress so the sound file automatically ducks when TTS is present
 * and smoothly returns to full volume when TTS ends. Output lasts as long as the
 * longest input (the sound file), so no stop/start is needed.
 */
function createMixedResource(filePath, seekSeconds, ttsStream) {
    const ffmpeg = spawn('ffmpeg', [
        // Input 0: TTS (raw s16le PCM from stdin)
        '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0',
        // Input 1: Sound file from seek position
        '-ss', String(seekSeconds), '-i', filePath,
        // Pad TTS with silence so the filter chain lives for the full sound file.
        // sidechaincompress ducks sound file while TTS is present, then smoothly releases.
        '-filter_complex',
        '[0:a]apad[ttspad];[ttspad]asplit=2[tts][sc];[1:a][sc]sidechaincompress=threshold=0.01:ratio=6:attack=50:release=500[ducked];[tts][ducked]amix=inputs=2:duration=shortest:normalize=0',
        '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'
    ]);

    ttsStream.pipe(ffmpeg.stdin);
    ttsStream.on('error', () => ffmpeg.stdin.end());
    ffmpeg.stderr.on('data', () => {});
    ffmpeg.on('error', (err) => console.error(`[Mix FFmpeg] ${err.message}`));

    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw });
}

function initGuildData(guildId) {
    if (!guildQueues.has(guildId)) {
        const player = createAudioPlayer();
        const guildData = {
            player,
            queue: [],
            backgroundUrl: null,
            resumeCallback: null,
            isPlayingTTS: false,
            isPlayingSoundFile: false,
            soundFilePath: null,
            soundFileElapsed: 0,
            soundFilePlaybackStart: 0
        };
        guildQueues.set(guildId, guildData);

        player.on(AudioPlayerStatus.Idle, () => {
            const currentData = guildQueues.get(guildId);
            if (!currentData) return;

            if (currentData.isPlayingSoundFile) {
                // Sound file finished (either alone or via a duration=longest mix)
                console.log(`[AudioQueue] Sound file finished.`);
                currentData.isPlayingSoundFile = false;
                if (currentData.soundFilePath) {
                    fs.unlink(currentData.soundFilePath, () => {});
                    currentData.soundFilePath = null;
                }
                // Fall through to normal queue/background processing
            }

            // If we have more TTS messages, play the next one
            if (currentData.queue.length > 0) {
                console.log(`[AudioQueue] Playing next TTS from queue.`);
                const nextStream = currentData.queue.shift();
                currentData.isPlayingTTS = true;
                player.play(createAudioResource(nextStream, { inputType: StreamType.Raw }));
            } else {
                // No more TTS. Resume background if available.
                currentData.isPlayingTTS = false;

                // Start a pending sound file if one was queued during TTS
                if (currentData.isPlayingSoundFile && currentData.soundFilePath) {
                    console.log(`[AudioQueue] TTS done, starting pending sound file.`);
                    currentData.soundFilePlaybackStart = Date.now();
                    player.play(createSoundFileResource(currentData.soundFilePath, 0));
                    return;
                }

                if (currentData.resumeCallback) {
                    console.log(`[AudioQueue] Executing resume callback for music.`);
                    currentData.resumeCallback();
                } else if (currentData.backgroundUrl) {
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

function addToQueue(guildId, ttsStream, connection) {
    const guildData = initGuildData(guildId);
    connection.subscribe(guildData.player);

    if (guildData.isPlayingSoundFile) {
        // Sound file active — mix TTS over it with ducking
        console.log(`[AudioQueue] Mixing TTS with sound file.`);
        guildData.soundFileElapsed += (Date.now() - guildData.soundFilePlaybackStart) / 1000;
        guildData.soundFilePlaybackStart = Date.now();
        guildData.isPlayingTTS = true;
        const mixed = createMixedResource(guildData.soundFilePath, guildData.soundFileElapsed, ttsStream);
        guildData.player.play(mixed);
    } else if (guildData.isPlayingTTS) {
        guildData.queue.push(ttsStream);
        console.log(`[AudioQueue] TTS added to queue.`);
    } else {
        console.log(`[AudioQueue] Interrupting for TTS.`);
        guildData.isPlayingTTS = true;
        const resource = createAudioResource(ttsStream, { inputType: StreamType.Raw });
        guildData.player.play(resource);
    }
}

function playSoundFile(guildId, filePath, connection) {
    const guildData = initGuildData(guildId);
    connection.subscribe(guildData.player);

    // Clean up any previous sound file
    if (guildData.soundFilePath) {
        fs.unlink(guildData.soundFilePath, () => {});
    }

    guildData.soundFilePath = filePath;
    guildData.soundFileElapsed = 0;
    guildData.soundFilePlaybackStart = Date.now();
    guildData.isPlayingSoundFile = true;

    if (guildData.isPlayingTTS) {
        // TTS is active — sound file will start when TTS finishes
        console.log(`[AudioQueue] Sound file queued, will mix when TTS finishes.`);
        return;
    }

    console.log(`[AudioQueue] Playing sound file.`);
    guildData.player.play(createSoundFileResource(filePath, 0));
}

function setMusicResume(guildId, callback) {
    const guildData = initGuildData(guildId);
    guildData.resumeCallback = callback;
}

function getPlayer(guildId) {
    const guildData = initGuildData(guildId);
    return guildData.player;
}

module.exports = { addToQueue, playSoundFile, setBackground, stopBackground, setMusicResume, getPlayer };
