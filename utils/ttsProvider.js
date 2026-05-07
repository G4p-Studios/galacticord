const googleTTS = require('google-tts-api');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn, exec, execSync } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const { Readable, PassThrough } = require('stream');
const textToSpeech = require('@google-cloud/text-to-speech');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PollyClient, SynthesizeSpeechCommand, DescribeVoicesCommand } = require("@aws-sdk/client-polly");

// Initialize Clients
const gCloudClient = new textToSpeech.TextToSpeechClient({
    apiKey: process.env.GOOGLE_CLOUD_API_KEY
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });

async function init() {
    try {
        if (process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            console.log("[Amazon Polly] Dynamically fetching complete voice list from AWS...");
            const pollyClient = new PollyClient({
                region: process.env.AWS_REGION,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
                }
            });
            
            let voices = [];
            let nextToken = undefined;
            do {
                const command = new DescribeVoicesCommand({ NextToken: nextToken });
                const response = await pollyClient.send(command);
                voices = voices.concat(response.Voices || []);
                nextToken = response.NextToken;
            } while (nextToken);

            if (voices.length > 0) {
                const voiceOptions = require('./voiceConstants');
                for (const key in voiceOptions) {
                    if (voiceOptions[key] && voiceOptions[key].polly) delete voiceOptions[key];
                }
                
                for (const voice of voices) {
                    if (!voice.SupportedEngines) continue;
                    for (const engine of voice.SupportedEngines) {
                        const key = `polly-${engine}-${voice.Id}`;
                        voiceOptions[key] = {
                            label: `Amazon Polly - ${voice.Id} (${engine.charAt(0).toUpperCase() + engine.slice(1)}, ${voice.Gender})`,
                            polly: true, engine, voiceId: voice.Id
                        };
                    }
                }
                console.log(`[Amazon Polly] Dynamically cached ${voices.length} voices.`);
            }
        }
    } catch (e) {
        console.error("[Amazon Polly] Failed to fetch voices dynamically:", e.message);
    }
}

function getEdgeVoices() { return []; }

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

/**
 * Normalizes any audio stream/buffer to s16le stereo 48k PCM for Discord.
 */
function normalizeToPcm(input, extraInputArgs = []) {
    const outputStream = new PassThrough();
    outputStream.on('error', () => {});

    const ffmpeg = spawn('ffmpeg', [
        ...extraInputArgs,
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    // Error handling to prevent crashes
    ffmpeg.stdin.on('error', (e) => console.log(`[FFmpeg stdin] Error: ${e.message}`));
    ffmpeg.stdout.on('error', (e) => console.log(`[FFmpeg stdout] Error: ${e.message}`));
    ffmpeg.on('error', (e) => console.error(`[FFmpeg Process] Failed to start: ${e.message}`));

    // Monitor for actual data production
    let hasProducedData = false;
    ffmpeg.stdout.on('data', (chunk) => {
        if (!hasProducedData) {
            console.log(`[FFmpeg] First audio chunk produced (${chunk.length} bytes)`);
            hasProducedData = true;
        }
        outputStream.write(chunk);
    });

    ffmpeg.stdout.on('end', () => {
        console.log(`[FFmpeg] Stream ended.`);
        outputStream.end();
    });

    // Capture stderr for debugging
    let lastError = '';
    ffmpeg.stderr.on('data', (data) => {
        lastError = data.toString().trim();
        if (lastError.includes('Error') || lastError.includes('Invalid')) {
            console.log(`[FFmpeg Debug] ${lastError}`);
        }
    });

    if (Buffer.isBuffer(input)) {
        ffmpeg.stdin.write(input);
        ffmpeg.stdin.end();
    } else if (input && typeof input.pipe === 'function') {
        input.pipe(ffmpeg.stdin);
        input.on('error', (e) => {
            console.error(`[Input Stream Error] ${e.message}`);
            ffmpeg.stdin.end();
        });
        input.on('end', () => ffmpeg.stdin.end());
    }

    return outputStream;
}

async function getStarAudioStream(text, url, voice) {
    const output = new PassThrough();
    output.on('error', () => {}); 

    const wsUrl = url.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl);
    
    let isFinished = false;

    const timeout = setTimeout(() => {
        if (!isFinished) {
            console.log(`[STAR] Closing connection due to timeout.`);
            ws.terminate();
            output.end();
        }
    }, 15000);

    ws.on('open', () => {
        console.log(`[STAR WS] Connected to ${wsUrl}. Requesting: ${voice}`);
        ws.send(JSON.stringify({ user: 4, request: [`${voice}: ${text}`] }));
    });

    ws.on('message', (data, isBinary) => {
        if (isBinary) {
            try {
                // Header: 2 bytes length + metadata string
                const idLen = data.readUInt16LE(0);
                const audioData = data.subarray(2 + idLen);
                if (output.writable) output.write(audioData);
            } catch (e) { console.error(`[STAR Debug] Packet Error: ${e.message}`); }
        } else {
            const msg = data.toString();
            // End markers
            if (msg.includes('"status"') || msg.includes('"done"') || msg.includes('"abort":true')) {
                console.log(`[STAR WS] Server finished sending.`);
                isFinished = true;
                output.end();
                ws.close();
            }
        }
    });

    ws.on('error', (err) => { 
        console.error(`[STAR WS Error] ${err.message}`);
        output.end(); 
    });

    ws.on('close', () => {
        clearTimeout(timeout);
        output.end();
    });

    return output;
}

async function getAudioStream(text, provider, voiceKey) {
    const cleanProvider = ultimateClean(provider).toLowerCase();
    const cleanVoiceKey = ultimateClean(voiceKey);
    const sanitizedText = text.replace(/\s+/g, ' ').trim();

    // SSML Detection
    const ssmlTags = ['<speak', '<prosody', '<break', '<say-as', '<phoneme', '<emphasis', '<p>', '<s>', '<sub', '<mark', '<audio'];
    const isSSML = ssmlTags.some(tag => sanitizedText.toLowerCase().includes(tag));
    let finalText = sanitizedText;
    if (isSSML && !finalText.toLowerCase().trim().startsWith('<speak>')) {
        finalText = `<speak>${finalText}</speak>`;
    }

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
            return normalizeToPcm(response.data);

        } else if (cleanProvider === 'google-cloud') {
            let voice = cleanVoiceKey || 'en-US-Neural2-A';
            if (voice === 'studio') voice = 'en-US-Studio-O';
            if (voice === 'sulafat') voice = 'en-US-Chirp3-HD-Sulafat';
            if (voice === 'achernar') voice = 'en-US-Chirp3-HD-Achernar';
            const namedChirps = ['aoede', 'charon', 'fenrir', 'kore', 'leda', 'orus', 'puck', 'zephyr'];
            if (namedChirps.includes(voice.toLowerCase())) {
                voice = `en-US-Chirp3-HD-${voice.charAt(0).toUpperCase() + voice.slice(1).toLowerCase()}`;
            }

            let langCode = 'en-US';
            const localeMatch = voice.match(/^([a-z]{2}-[A-Z]{2})/);
            if (localeMatch) langCode = localeMatch[1];

            const [response] = await gCloudClient.synthesizeSpeech({
                input: isSSML ? { ssml: finalText } : { text: sanitizedText },
                voice: { name: voice, languageCode: langCode },
                audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 48000 },
            });
            return normalizeToPcm(response.audioContent, ['-f', 's16le', '-ar', '48000', '-ac', '1']);

        } else if (cleanProvider === 'polly') {
            const pollyClient = new PollyClient({ region: process.env.AWS_REGION || "us-east-1" });
            const voiceOptions = require('./voiceConstants');
            const voiceConfig = voiceOptions[cleanVoiceKey] || voiceOptions['polly-neural-Matthew'];

            const response = await pollyClient.send(new SynthesizeSpeechCommand({
                Engine: voiceConfig.engine || 'neural',
                Text: isSSML ? finalText.substring(0, 3000) : sanitizedText.substring(0, 3000),
                TextType: isSSML ? "ssml" : "text",
                OutputFormat: "mp3",
                VoiceId: voiceConfig.voiceId || "Matthew",
                SampleRate: "24000"
            }));
            
            const audioArray = await response.AudioStream.transformToByteArray();
            return normalizeToPcm(Buffer.from(audioArray));

        } else if (cleanProvider === 'gemini') {
            let voiceName = cleanVoiceKey.includes('-') && !cleanVoiceKey.startsWith('en-') ? cleanVoiceKey.split('-')[1] : cleanVoiceKey;
            const result = await geminiModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: sanitizedText }] }],
                generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } }
            });

            const audioPart = result.response.candidates[0].content.parts.find(p => p.inlineData && p.inlineData.mimeType.startsWith("audio/"));
            const buffer = Buffer.from(audioPart.inlineData.data, 'base64');
            return normalizeToPcm(buffer);

        } else if (cleanProvider === 'piper') {
            const modelPath = path.isAbsolute(cleanVoiceKey) ? cleanVoiceKey : path.resolve(__dirname, '..', cleanVoiceKey);
            const piper = spawn(resolvePath('piper'), ['--model', modelPath, '--output_file', '-']);
            piper.stdin.write(sanitizedText + '\n');
            piper.stdin.end();
            return normalizeToPcm(piper.stdout);

        } else if (cleanProvider === 'espeak') {
            const child = exec(`printf "${sanitizedText.replace(/"/g, '\"')}" | "${resolvePath('espeak-ng')}" -v ${cleanVoiceKey || 'en-us'} --stdout`, { encoding: 'buffer' });
            return normalizeToPcm(child.stdout);

        } else if (cleanProvider === 'rhvoice') {
            const child = exec(`printf "${sanitizedText.replace(/"/g, '\"')}" | "${resolvePath('RHVoice-test')}" -p ${cleanVoiceKey || 'alan'} -o -`, { encoding: 'buffer' });
            return normalizeToPcm(child.stdout);

        } else if (cleanProvider === 'star') {
            let url = "https://speech.seedy.cc";
            let voice = "default";
            try {
                const config = JSON.parse(voiceKey);
                url = config.url;
                voice = config.voice || 'default';
            } catch (e) {}

            const starStream = await getStarAudioStream(sanitizedText, url, voice);
            return normalizeToPcm(starStream);
        }
        throw new Error("Unknown provider");
    } catch (e) { console.error(`[TTS Provider] Error in ${cleanProvider}: ${e.message}`); throw e; }
}

async function getAudioResource(text, provider, voiceKey) {
    try {
        const stream = await getAudioStream(text, provider, voiceKey);
        return createAudioResource(stream, { inputType: StreamType.Raw, inlineVolume: true });
    } catch (error) { console.error(`[AudioResource] Error: ${error.message}`); throw error; }
}

module.exports = { init, getEdgeVoices, getAudioResource, getAudioStream };
