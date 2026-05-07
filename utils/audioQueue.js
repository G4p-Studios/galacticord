const { createAudioPlayer, AudioPlayerStatus, createAudioResource, StreamType } = require('@discordjs/voice');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const serverConfigFile = path.join(__dirname, '../data/server_config.json');

// Global Map to store queues and players per guild
const guildQueues = new Map();
// Cooldown map to prevent spamming restarts
const lastRestart = new Map();

/**
 * Creates an audio resource for a radio stream.
 */
function createRadioResource(resourceUrl) {
    const curl = spawn('curl', [
        '-L', '-k',
        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Galacticord/1.0',
        resourceUrl
    ]);

    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-map_metadata', '-1',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    curl.stdout.pipe(ffmpeg.stdin);
    
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdout.on('error', () => {});
    curl.stdout.on('error', () => {});
    curl.on('error', () => {});
    ffmpeg.on('error', () => {});

    curl.on('close', () => ffmpeg.stdin.end());

    return createAudioResource(ffmpeg.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true
    });
}

function createSoundFileResource(filePath, seekSeconds) {
    const args = [];
    if (seekSeconds > 0) args.push('-ss', String(seekSeconds));
    args.push('-i', filePath, '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

    const ffmpeg = spawn('ffmpeg', args);
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdout.on('error', () => {});
    ffmpeg.on('error', () => {});

    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw });
}

function createMixedResource(filePath, seekSeconds, ttsStream, duckVolume) {
    const vol = duckVolume ?? 0.3;
    const ffmpeg = spawn('ffmpeg', [
        '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0',
        '-ss', String(seekSeconds), '-i', filePath,
        '-filter_complex', `[1:a]volume=${vol}[ducked];[0:a][ducked]amix=inputs=2:duration=longest:normalize=0`,
        '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1'
    ]);

    ttsStream.pipe(ffmpeg.stdin);
    ttsStream.on('error', () => ffmpeg.stdin.end());
    
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdout.on('error', () => {});
    ffmpeg.on('error', () => {});

    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw });
}

function initGuildData(guildId) {
    if (!guildQueues.has(guildId)) {
        console.log(`[AudioQueue] Initializing player for guild ${guildId}`);
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
            soundFilePlaybackStart: 0,
            watchdog: null
        };
        guildQueues.set(guildId, guildData);

        player.on(AudioPlayerStatus.Idle, () => {
            const currentData = guildQueues.get(guildId);
            if (!currentData) return;

            // Clear any active watchdog
            if (currentData.watchdog) {
                clearTimeout(currentData.watchdog);
                currentData.watchdog = null;
            }

            const wasPlayingTTS = currentData.isPlayingTTS;

            if (currentData.isPlayingSoundFile) {
                currentData.isPlayingSoundFile = false;
                if (currentData.soundFilePath) {
                    fs.unlink(currentData.soundFilePath, () => {});
                    currentData.soundFilePath = null;
                }
            }

            if (currentData.queue.length > 0) {
                console.log(`[AudioQueue] Playing next TTS for ${guildId} (${currentData.queue.length} left)`);
                const nextItem = currentData.queue.shift();
                currentData.isPlayingTTS = true;
                
                // Watchdog: If nothing happens for 15s, skip
                currentData.watchdog = setTimeout(() => {
                    console.log(`[AudioQueue] Watchdog triggered for ${guildId}. Skipping stuck TTS.`);
                    player.stop();
                }, 15000);

                player.play(createAudioResource(nextItem, { inputType: StreamType.Raw }));
            } else {
                currentData.isPlayingTTS = false;

                if (currentData.isPlayingSoundFile && currentData.soundFilePath) {
                    currentData.soundFilePlaybackStart = Date.now();
                    player.play(createSoundFileResource(currentData.soundFilePath, 0));
                    return;
                }

                if (currentData.resumeCallback) {
                    currentData.resumeCallback(wasPlayingTTS);
                } else if (currentData.backgroundUrl) {
                    const now = Date.now();
                    const lastTime = lastRestart.get(guildId) || 0;
                    if (now - lastTime < 60000) {
                        setTimeout(() => {
                            if (currentData.backgroundUrl && !currentData.isPlayingTTS) {
                                lastRestart.set(guildId, Date.now());
                                player.play(createRadioResource(currentData.backgroundUrl));
                            }
                        }, 60000);
                    } else {
                        lastRestart.set(guildId, now);
                        player.play(createRadioResource(currentData.backgroundUrl));
                    }
                }
            }
        });

        player.on(AudioPlayerStatus.Playing, () => {
            console.log(`[AudioQueue] Player is now PLAYING in ${guildId}`);
        });

        player.on('error', error => {
            console.error(`[AudioQueue Error] ${guildId}:`, error.message);
            player.stop();
        });
    }
    return guildQueues.get(guildId);
}

function setBackground(guildId, url, connection) {
    const guildData = initGuildData(guildId);
    guildData.backgroundUrl = url;
    connection.subscribe(guildData.player);

    if (!guildData.isPlayingTTS) {
        lastRestart.set(guildId, Date.now());
        guildData.player.play(createRadioResource(url));
    }
}

function stopBackground(guildId) {
    const guildData = guildQueues.get(guildId);
    if (guildData) {
        guildData.backgroundUrl = null;
        if (!guildData.isPlayingTTS) guildData.player.stop();
    }
}

function addToQueue(guildId, ttsStream, connection) {
    const guildData = initGuildData(guildId);
    connection.subscribe(guildData.player);

    ttsStream.on('error', (e) => console.error(`[AudioQueue] TTS Stream Error: ${e.message}`));

    if (guildData.isPlayingSoundFile) {
        guildData.soundFileElapsed += (Date.now() - guildData.soundFilePlaybackStart) / 1000;
        guildData.soundFilePlaybackStart = Date.now();
        guildData.isPlayingTTS = true;
        let duckVolume = 0.3;
        try {
            const config = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8'));
            if (config[guildId]?.duckingVolume !== undefined) duckVolume = config[guildId].duckingVolume;
        } catch (e) {}
        
        if (guildData.watchdog) clearTimeout(guildData.watchdog);
        guildData.watchdog = setTimeout(() => {
            console.log(`[AudioQueue] Watchdog triggered for ${guildId} (Mixed).`);
            guildData.player.stop();
        }, 15000);

        guildData.player.play(createMixedResource(guildData.soundFilePath, guildData.soundFileElapsed, ttsStream, duckVolume));
    } else if (guildData.isPlayingTTS) {
        guildData.queue.push(ttsStream);
        console.log(`[AudioQueue] TTS added to queue (Guild: ${guildId}, Pos: ${guildData.queue.length}).`);
    } else {
        console.log(`[AudioQueue] Interrupting for immediate TTS in ${guildId}`);
        guildData.isPlayingTTS = true;
        
        if (guildData.watchdog) clearTimeout(guildData.watchdog);
        guildData.watchdog = setTimeout(() => {
            console.log(`[AudioQueue] Watchdog triggered for ${guildId} (Immediate).`);
            guildData.player.stop();
        }, 15000);

        guildData.player.play(createAudioResource(ttsStream, { inputType: StreamType.Raw }));
    }
}

function playSoundFile(guildId, filePath, connection) {
    const guildData = initGuildData(guildId);
    connection.subscribe(guildData.player);
    if (guildData.soundFilePath) fs.unlink(guildData.soundFilePath, () => {});
    guildData.soundFilePath = filePath;
    guildData.soundFileElapsed = 0;
    guildData.soundFilePlaybackStart = Date.now();
    guildData.isPlayingSoundFile = true;
    if (guildData.isPlayingTTS) return;
    guildData.player.play(createSoundFileResource(filePath, 0));
}

function silenceAll(guildId) {
    const guildData = guildQueues.get(guildId);
    if (!guildData) return;
    guildData.backgroundUrl = null;
    guildData.resumeCallback = null;
    for (const stream of guildData.queue) { stream.destroy(); }
    guildData.queue.length = 0;
    guildData.isPlayingTTS = false;
    if (guildData.isPlayingSoundFile && guildData.soundFilePath) { fs.unlink(guildData.soundFilePath, () => {}); }
    guildData.isPlayingSoundFile = false;
    guildData.soundFilePath = null;
    guildData.player.stop();
}

function setMusicResume(guildId, callback) {
    const guildData = initGuildData(guildId);
    guildData.resumeCallback = callback;
}

function getPlayer(guildId) {
    const guildData = initGuildData(guildId);
    return guildData.player;
}

function isGuildPlayingTTS(guildId) {
    const data = guildQueues.get(guildId);
    return data ? data.isPlayingTTS : false;
}

module.exports = { addToQueue, playSoundFile, setBackground, stopBackground, silenceAll, setMusicResume, getPlayer, isGuildPlayingTTS };
