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

    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw, inlineVolume: true });
}

/**
 * Creates an audio resource from a local sound file.
 */
function createSoundFileResource(filePath) {
    const ffmpeg = spawn('ffmpeg', [
        '-i', filePath,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdout.on('error', () => {});
    ffmpeg.on('error', () => {});

    return createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw, inlineVolume: true });
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
            soundFilePath: null
        };
        guildQueues.set(guildId, guildData);

        player.on(AudioPlayerStatus.Idle, () => {
            const currentData = guildQueues.get(guildId);
            if (!currentData) return;

            const wasPlayingTTS = currentData.isPlayingTTS;

            if (currentData.isPlayingSoundFile) {
                currentData.isPlayingSoundFile = false;
                if (currentData.soundFilePath) {
                    fs.unlink(currentData.soundFilePath, () => {});
                    currentData.soundFilePath = null;
                }
            }

            if (currentData.queue.length > 0) {
                const nextResource = currentData.queue.shift();
                currentData.isPlayingTTS = true;
                player.play(nextResource);
            } else {
                currentData.isPlayingTTS = false;
                if (currentData.resumeCallback) {
                    currentData.resumeCallback();
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

        player.on('error', error => console.error(`[AudioQueue Error] ${guildId}:`, error.message));
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

function addToQueue(guildId, stream, connection) {
    const guildData = initGuildData(guildId);
    connection.subscribe(guildData.player);

    const resource = createAudioResource(stream, { inputType: StreamType.Raw, inlineVolume: true });

    if (guildData.isPlayingTTS || guildData.isPlayingSoundFile) {
        guildData.queue.push(resource);
        console.log(`[AudioQueue] TTS added to queue.`);
    } else {
        console.log(`[AudioQueue] Interrupting for TTS.`);
        guildData.isPlayingTTS = true;
        guildData.player.play(resource);
    }
}

function playSoundFile(guildId, filePath, connection) {
    const guildData = initGuildData(guildId);
    connection.subscribe(guildData.player);

    if (guildData.soundFilePath) fs.unlink(guildData.soundFilePath, () => {});
    guildData.soundFilePath = filePath;
    guildData.isPlayingSoundFile = true;

    if (guildData.isPlayingTTS) return;
    guildData.player.play(createSoundFileResource(filePath));
}

function silenceAll(guildId) {
    const guildData = guildQueues.get(guildId);
    if (!guildData) return;
    guildData.backgroundUrl = null;
    guildData.resumeCallback = null;
    guildData.queue = [];
    guildData.isPlayingTTS = false;
    if (guildData.isPlayingSoundFile && guildData.soundFilePath) fs.unlink(guildData.soundFilePath, () => {});
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

function getQueueLength(guildId) {
    const data = guildQueues.get(guildId);
    return data ? data.queue.length : 0;
}

function isGuildPlayingTTS(guildId) {
    const data = guildQueues.get(guildId);
    return data ? data.isPlayingTTS : false;
}

module.exports = { addToQueue, playSoundFile, setBackground, stopBackground, silenceAll, setMusicResume, getPlayer, getQueueLength, isGuildPlayingTTS };
