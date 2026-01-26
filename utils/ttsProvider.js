const googleTTS = require('google-tts-api');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn, execSync } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

async function init() {}

function getEdgeVoices() {
    return [];
}

/**
 * Normalizes all variations of dashes/hyphens to a standard ASCII hyphen.
 */
function normalizeDashes(str) {
    if (typeof str !== 'string') return str;
    // Replace ALL Unicode dash/hyphen variations with standard ASCII hyphen (-)
    return str.replace(/[‐-―]/g, '-').replace(/—/g, '-').replace(/–/g, '-');
}

/**
 * Resolves the absolute path of a command.
 */
function resolvePath(command) {
    const cmd = normalizeDashes(command);
    try {
        const fullPath = execSync(`which ${cmd}`).toString().trim();
        return normalizeDashes(fullPath);
    } catch (e) {
        const searchPaths = ['/usr/bin', '/usr/local/bin', '/usr/sbin', '/bin'];
        for (const dir of searchPaths) {
            const p = path.join(dir, cmd);
            if (fs.existsSync(p)) return normalizeDashes(p);
        }
        return cmd; 
    }
}

async function getAudioStream(text, provider, voiceKey) {
    // Aggressively clean all inputs
    const cleanVoiceKey = normalizeDashes(voiceKey);
    const sanitizedText = text.replace(/\s+/g, ' ').trim();

    try {
        if (provider === 'google') {
            const voiceOptions = require('./voiceConstants');
            const voiceConfig = voiceOptions[cleanVoiceKey] || voiceOptions['en-US'];
            const textToProcess = text.substring(0, 2000);

            const url = googleTTS.getAudioUrl(textToProcess, {
                lang: voiceConfig.lang || 'en',
                slow: false,
                host: voiceConfig.host || 'https://translate.google.com',
            });
            const response = await axios.get(url, { responseType: 'stream' });
            return response.data;

        } else if (provider === 'piper') {
            const piperPath = resolvePath('piper');
            const botRoot = path.resolve(__dirname, '..');
            
            let v = (typeof cleanVoiceKey === 'string') ? cleanVoiceKey.trim() : 'models/en_US-amy-medium.onnx';
            if (!v.endsWith('.onnx')) v = 'models/en_US-amy-medium.onnx';

            const modelPath = path.isAbsolute(v) ? v : path.resolve(botRoot, v);
            if (!fs.existsSync(modelPath)) throw new Error(`Piper model not found: ${modelPath}`);

            const piperProcess = spawn(piperPath, ['--model', modelPath, '--output_file', '-']);
            
            piperProcess.stderr.on('data', (data) => console.error(`[Piper Engine] ${data.toString().trim()}`));
            
            piperProcess.stdin.write(sanitizedText + '\n');
            piperProcess.stdin.end();

            return piperProcess.stdout;

        } else if (provider === 'espeak') {
            // Use standard hyphen strings explicitly to prevent any em-dash leak
            const espeakPath = resolvePath('espeak-ng');
            const voice = cleanVoiceKey || 'en-us';
            
            return new Promise((resolve, reject) => {
                console.log(`[eSpeak Debug] Spawning: ${espeakPath} -v ${voice} --stdout`);
                
                // Construct args with guaranteed standard hyphens
                const args = ['-v', voice, '--stdout'];
                const espeakProcess = spawn(espeakPath, args);
                
                let dataCount = 0;
                espeakProcess.stdout.on('data', (chunk) => dataCount += chunk.length);
                espeakProcess.stderr.on('data', (data) => console.error(`[eSpeak Engine] ${data.toString().trim()}`));

                espeakProcess.on('close', (code) => {
                    console.log(`[eSpeak Debug] Closed with code ${code}. Data: ${dataCount} bytes.`);
                });

                espeakProcess.on('error', (err) => {
                    console.error(`[eSpeak Spawn Error] ${err.message}`);
                    reject(err);
                });
                
                espeakProcess.stdin.write(sanitizedText + '\n');
                espeakProcess.stdin.end();

                resolve(espeakProcess.stdout);
            });

        } else if (provider === 'rhvoice') {
            const rhvoicePath = resolvePath('RHVoice-test');
            const voice = cleanVoiceKey || 'alan';

            return new Promise((resolve, reject) => {
                const args = ['-p', voice, '-o', '-'];
                const rhvoiceProcess = spawn(rhvoicePath, args);
                
                rhvoiceProcess.on('error', (err) => reject(err));
                rhvoiceProcess.stdin.write(sanitizedText + '\n');
                rhvoiceProcess.stdin.end();
                resolve(rhvoiceProcess.stdout);
            });
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
        return createAudioResource(stream, { 
            inputType: StreamType.Arbitrary,
            inlineVolume: true 
        });
    } catch (error) {
        console.error(`[AudioResource] ${error.message}`);
        throw error;
    }
}

module.exports = { init, getEdgeVoices, getAudioResource, getAudioStream };