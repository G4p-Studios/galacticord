const googleTTS = require('google-tts-api');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn, exec, execSync } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { Readable } = require('stream');
const textToSpeech = require('@google-cloud/text-to-speech');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Google Cloud TTS Client with API Key from .env
const gCloudClient = new textToSpeech.TextToSpeechClient({
    apiKey: process.env.GOOGLE_CLOUD_API_KEY
});

// Initialize Gemini AI for TTS
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });

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
            // STAR Protocol: {"user": 4, "request": ["Voice: Text"]}
            const payload = {
                user: 4, // Updated to revision 4 as required by server
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

/**
 * Normalizes any audio stream to s16le stereo 48k PCM for Discord.
 */
function normalizeStream(stream) {
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);
    stream.pipe(ffmpeg.stdin);
    return ffmpeg.stdout;
}

async function getAudioStream(text, provider, voiceKey) {
    const cleanProvider = ultimateClean(provider).toLowerCase();
    const cleanVoiceKey = ultimateClean(voiceKey);
    const sanitizedText = text.replace(/\s+/g, ' ').trim();

    console.log(`[TTS Provider] Requesting stream. Provider: ${cleanProvider}, Voice: ${cleanVoiceKey}, Text: "${sanitizedText.substring(0, 50)}..."`);

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
            return normalizeStream(response.data);

        } else if (cleanProvider === 'google-cloud') {
            console.log(`[Google Cloud TTS] Provider: ${cleanProvider}, Voice: ${cleanVoiceKey}`);
            
            let voice = cleanVoiceKey || 'en-US-Neural2-A';
            
            // Handle legacy short names / fallback mappings
            if (voice === 'studio') voice = 'en-US-Studio-O';
            if (voice === 'sulafat') voice = 'en-US-Chirp3-HD-Sulafat';
            if (voice === 'achernar') voice = 'en-US-Chirp3-HD-Achernar';
            
            const namedChirps = ['aoede', 'charon', 'fenrir', 'kore', 'leda', 'orus', 'puck', 'zephyr'];
            if (namedChirps.includes(voice.toLowerCase())) {
                voice = `en-US-Chirp3-HD-${voice.charAt(0).toUpperCase() + voice.slice(1).toLowerCase()}`;
            }

            // Dynamically determine language code
            let langCode = 'en-US';
            const localeMatch = voice.match(/^([a-z]{2}-[A-Z]{2})/);
            if (localeMatch) langCode = localeMatch[1];

            console.log(`[Google Cloud TTS] Synthesizing PCM with voice: ${voice} (${langCode})...`);
            const request = {
                input: { text: sanitizedText },
                voice: { name: voice, languageCode: langCode },
                audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 48000 },
            };
            
            const [response] = await gCloudClient.synthesizeSpeech(request);
            console.log(`[Google Cloud TTS] Synthesis successful. Audio size: ${response.audioContent.length} bytes`);

            // For Buffer input, we spawn specifically
            const ffmpeg = spawn('ffmpeg', [
                '-i', 'pipe:0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                'pipe:1'
            ]);
            ffmpeg.stdin.write(response.audioContent);
            ffmpeg.stdin.end();
            return ffmpeg.stdout;

        } else if (cleanProvider === 'gemini') {
            console.log(`[Gemini TTS] Synthesizing... Voice: ${cleanVoiceKey}`);
            
            // Allow voiceKey to be just "Aoede" or "gemini-Aoede"
            let voiceName = cleanVoiceKey.includes('-') ? cleanVoiceKey.split('-')[1] : cleanVoiceKey;
            if (!['Aoede', 'Charon', 'Fenrir', 'Kore', 'Leda', 'Orus', 'Puck', 'Zephyr'].includes(voiceName)) {
                voiceName = 'Aoede'; // Default
            }

            const result = await geminiModel.generateContent({
                contents: [{ parts: [{ text: sanitizedText }] }],
                generationConfig: {
                    responseMimeType: "audio/wav",
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName
                            }
                        }
                    }
                }
            });

            const audioPart = result.response.candidates[0].content.parts.find(p => p.inlineData);
            if (!audioPart) throw new Error("Gemini TTS did not return audio data.");

            const buffer = Buffer.from(audioPart.inlineData.data, 'base64');
            console.log(`[Gemini TTS] Success. Audio size: ${buffer.length} bytes`);

            const ffmpeg = spawn('ffmpeg', [
                '-i', 'pipe:0',
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                'pipe:1'
            ]);
            ffmpeg.stdin.write(buffer);
            ffmpeg.stdin.end();
            return ffmpeg.stdout;

        } else if (cleanProvider === 'piper') {
            const piperPath = resolvePath('piper');
            let v = cleanVoiceKey.endsWith('.onnx') ? cleanVoiceKey : 'models/en_US-amy-medium.onnx';
            const modelPath = path.isAbsolute(v) ? v : path.resolve(__dirname, '..', v);
            
            const piperProcess = spawn(piperPath, ['--model', modelPath, '--output_file', '-']);
            if (piperProcess.stdin) {
                piperProcess.stdin.write(sanitizedText + '\n');
                piperProcess.stdin.end();
            }
            return normalizeStream(piperProcess.stdout);

        } else if (cleanProvider === 'espeak') {
            const espeakPath = resolvePath('espeak-ng');
            const voice = cleanVoiceKey || 'en-us';
            const safeText = sanitizedText.replace(/"/g, '\"');
            const command = `printf "${safeText}" | "${espeakPath}" -v ${voice} --stdout`;
            
            const child = exec(command, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 });
            return normalizeStream(child.stdout);

        } else if (cleanProvider === 'rhvoice') {
            const rhvoicePath = resolvePath('RHVoice-test');
            const voice = cleanVoiceKey || 'alan';
            const safeText = sanitizedText.replace(/"/g, '\"');
            const command = `printf "${safeText}" | "${rhvoicePath}" -p ${voice} -o -`;

            const child = exec(command, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 });
            return normalizeStream(child.stdout);

        } else if (cleanProvider === 'star') {
            let config = {};
            try { config = JSON.parse(voiceKey); } catch (e) { throw new Error("STAR configuration invalid."); }
            if (!config.url) throw new Error("No STAR URL configured.");

            let effectiveVoice = config.voice;
            if (!effectiveVoice || effectiveVoice === 'onnx' || effectiveVoice === 'undefined') effectiveVoice = 'default';

            const starStream = await getStarAudioStream(sanitizedText, config.url, effectiveVoice);
            return normalizeStream(starStream);
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
        console.log(`[AudioResource] Stream received, creating resource...`);
        return createAudioResource(stream, { inputType: StreamType.Raw, inlineVolume: true });
    } catch (error) {
        console.error(`[AudioResource] Error: ${error.message}`);
        throw error;
    }
}

module.exports = { init, getEdgeVoices, getAudioResource, getAudioStream };
