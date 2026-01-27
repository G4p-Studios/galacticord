const googleTTS = require('google-tts-api');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn, exec, execSync } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { Readable } = require('stream');

async function init() {} 
function getEdgeVoices() { return []; }

/**
 * Aggressively normalizes strings to standard ASCII hyphens.
 */
function ultimateClean(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[‐‑‒–—―−⁃]/g, '-').trim();
}

function resolvePath(command) {
    const cmd = ultimateClean(command);
    try {
        const fullPath = execSync(`which ${cmd}`).toString().trim();
        return ultimateClean(fullPath);
    } catch (e) {
        const searchPaths = ['/usr/bin', '/usr/local/bin', '/usr/sbin', '/bin'];
        for (const dir of searchPaths) {
            const p = path.join(dir, cmd);
            if (fs.existsSync(p)) return p;
        }
        return cmd; 
    }
}

async function getStarAudioStream(text, url, voice) {
    return new Promise((resolve, reject) => {
        const wsUrl = url.replace(/^http/, 'ws');
        const ws = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
            ws.terminate();
            reject(new Error("STAR WebSocket timed out (10s)"));
        }, 10000);

        ws.on('open', () => {
            console.log(`[STAR Debug] Connected to ${wsUrl}. Requesting voice: ${voice}`);
            const payload = {
                user: 0,
                request: [`${voice}: ${text}`]
            };
            ws.send(JSON.stringify(payload));
        });

        ws.on('message', (data, isBinary) => {
            if (isBinary) {
                clearTimeout(timeout);
                try {
                    // Protocol: 2 byte little-endian length + metadata/ID + audio
                    const idLen = data.readUInt16LE(0);
                    const audioData = data.subarray(2 + idLen);
                    
                    console.log(`[STAR Debug] Received audio binary: ${audioData.length} bytes`);
                    resolve(Readable.from(audioData));
                    ws.close();
                } catch (e) {
                    reject(new Error(`Failed to parse STAR audio packet: ${e.message}`));
                    ws.close();
                }
            } else {
                const textMsg = data.toString();
                console.log(`[STAR Debug] Server sent text: "${textMsg}"`);
                // Check if the text message looks like an error
                if (textMsg.toLowerCase().includes('error') || textMsg.toLowerCase().includes('not found')) {
                    clearTimeout(timeout);
                    reject(new Error(`STAR Server Error: ${textMsg}`));
                    ws.close();
                }
            }
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            reject(new Error(`STAR WebSocket Error: ${err.message}`));
        });

        ws.on('close', () => {
            clearTimeout(timeout);
        });
    });
}

async function getAudioStream(text, provider, voiceKey) {
    const cleanProvider = ultimateClean(provider).toLowerCase();
    const cleanVoiceKey = ultimateClean(voiceKey);
    const sanitizedText = text.replace(/\s+/g, ' ').trim();

    try {
        if (cleanProvider === 'google') {
            const voiceOptions = require('./voiceConstants');
            const voiceConfig = voiceOptions[cleanVoiceKey] || voiceOptions['en-US'];
            const url = googleTTS.getAudioUrl(text.substring(0, 2000), {
                lang: voiceConfig.lang || 'en',
                slow: false,
                host: voiceConfig.host || 'https://translate.google.com',
            });
            const response = await axios.get(url, { responseType: 'stream' });
            return response.data;

        } else if (cleanProvider === 'piper') {
            const piperPath = resolvePath('piper');
            let v = cleanVoiceKey.endsWith('.onnx') ? cleanVoiceKey : 'models/en_US-amy-medium.onnx';
            const modelPath = path.isAbsolute(v) ? v : path.resolve(__dirname, '..', v);
            
            const piperProcess = spawn(piperPath, ['--model', modelPath, '--output_file', '-']);
            if (piperProcess.stdin) {
                piperProcess.stdin.write(sanitizedText + '\n');
                piperProcess.stdin.end();
            }
            return piperProcess.stdout;

        } else if (cleanProvider === 'espeak') {
            const espeakPath = resolvePath('espeak-ng');
            const voice = cleanVoiceKey || 'en-us';
            
            // USE EXEC for maximum compatibility on restrictive systems
            const safeText = sanitizedText.replace(/"/g, '\"');
            const command = `printf "${safeText}" | "${espeakPath}" -v ${voice} --stdout`;
            
            console.log(`[eSpeak] Executing: ${command}`);

            return new Promise((resolve, reject) => {
                const child = exec(command, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[eSpeak Error] ${error.message}`);
                        return reject(error);
                    }
                    if (stderr && stderr.length > 0) {
                        console.error(`[eSpeak Stderr] ${stderr.toString()}`);
                    }
                    resolve(Readable.from(stdout));
                });
            });

        } else if (cleanProvider === 'rhvoice') {
            const rhvoicePath = resolvePath('RHVoice-test');
            const voice = cleanVoiceKey || 'alan';
            
            const safeText = sanitizedText.replace(/"/g, '\"');
            const command = `printf "${safeText}" | "${rhvoicePath}" -p ${voice} -o -`;

            return new Promise((resolve, reject) => {
                const child = exec(command, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`[RHVoice Error] ${error.message}`);
                        return reject(error);
                    }
                    resolve(Readable.from(stdout));
                });
            });

        } else if (cleanProvider === 'star') {
            let config = {};
            try {
                config = JSON.parse(voiceKey);
            } catch (e) {
                throw new Error("STAR configuration invalid. Please set URL with /set star_url");
            }
            
            if (!config.url) throw new Error("No STAR URL configured.");

            // Fallback for 'onnx' bug or empty voice
            let effectiveVoice = config.voice;
            if (!effectiveVoice || effectiveVoice === 'onnx' || effectiveVoice === 'undefined') {
                effectiveVoice = 'default';
                console.log(`[STAR Debug] Invalid voice detected. Falling back to 'default'.`);
            }

            return await getStarAudioStream(sanitizedText, config.url, effectiveVoice);
        }

        throw new Error("Unknown provider");
    } catch (error) {
        console.error(`[TTS Provider] ${error.message}`);
        throw error;
    }
}

async function getAudioResource(text, provider, voiceKey) {
    try {
        const stream = await getAudioStream(text, provider, voiceKey);
        return createAudioResource(stream, { inputType: StreamType.Arbitrary, inlineVolume: true });
    } catch (error) {
        console.error(`[AudioResource] ${error.message}`);
        throw error;
    }
}

module.exports = { init, getEdgeVoices, getAudioResource, getAudioStream };
