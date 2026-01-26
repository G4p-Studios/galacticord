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
 * This prevents path and command execution errors on some systems.
 */
function normalizeDashes(str) {
    if (typeof str !== 'string') return str;
    // Replace all Unicode dash variations (\u2010 to \u2015) with ASCII hyphen (\u002d)
    return str.replace(/[‐‑‒–—―]/g, '\u002d');
}

/**
 * Resolves the absolute path of a command, checking common Linux locations as fallbacks.
 */
function resolvePath(command) {
    const cmd = normalizeDashes(command);
    try {
        // Try 'which' first
        const fullPath = execSync(`which ${cmd}`).toString().trim();
        return fullPath;
    } catch (e) {
        // Search common Linux binary paths
        const searchPaths = ['/usr/bin', '/usr/local/bin', '/usr/sbin', '/bin'];
        for (const dir of searchPaths) {
            const p = path.join(dir, cmd);
            if (fs.existsSync(p)) return p;
        }
        return cmd; // Fallback to raw name if not found
    }
}

async function getAudioStream(text, provider, voiceKey) {
    const cleanVoiceKey = normalizeDashes(voiceKey);
    const sanitizedText = text.replace(/\s+/g, ' ').trim();

    try {
        if (provider === 'google') {
            const voiceOptions = require('./voiceConstants');
            const voiceConfig = voiceOptions[cleanVoiceKey] || voiceOptions['en-US'];
            const textToProcess = text.substring(0, 2000);

            if (textToProcess.length <= 200) {
                const url = googleTTS.getAudioUrl(textToProcess, {
                    lang: voiceConfig.lang,
                    slow: false,
                    host: voiceConfig.host,
                });
                const response = await axios.get(url, { responseType: 'stream' });
                return response.data;
            } else {
                const results = googleTTS.getAllAudioUrls(textToProcess, {
                    lang: voiceConfig.lang,
                    slow: false,
                    host: voiceConfig.host,
                });
                const response = await axios.get(results[0].url, { responseType: 'stream' });
                return response.data;
            }

        } else if (provider === 'piper') {
            const piperPath = resolvePath('piper');
            const botRoot = path.resolve(__dirname, '..');
            
            let effectiveVoiceKey = (typeof cleanVoiceKey === 'string') ? cleanVoiceKey.trim() : 'models/en_US-amy-medium.onnx';
            if (!effectiveVoiceKey.endsWith('.onnx')) {
                effectiveVoiceKey = 'models/en_US-amy-medium.onnx';
            }

            const modelPath = path.isAbsolute(effectiveVoiceKey) ? effectiveVoiceKey : path.resolve(botRoot, effectiveVoiceKey);
            if (!fs.existsSync(modelPath)) throw new Error(`Piper model not found: ${modelPath}`);

            const piperProcess = spawn(piperPath, ['--model', modelPath, '--output_file', '-']);
            piperProcess.stdin.write(sanitizedText + '\n');
            piperProcess.stdin.end();

            return piperProcess.stdout;

        } else if (provider === 'espeak') {
            const espeakPath = resolvePath('espeak-ng');
            const voice = cleanVoiceKey || 'en-us';
            
            return new Promise((resolve, reject) => {
                const espeakProcess = spawn(espeakPath, ['-v', voice, '--stdout', sanitizedText]);
                espeakProcess.on('error', (err) => reject(new Error(`Failed to start espeak-ng: ${err.message}`)));
                resolve(espeakProcess.stdout);
            });

        } else if (provider === 'rhvoice') {
            const rhvoicePath = resolvePath('RHVoice-test');
            const voice = cleanVoiceKey || 'alan';

            return new Promise((resolve, reject) => {
                const rhvoiceProcess = spawn(rhvoicePath, ['-p', voice, '-o', '-']);
                rhvoiceProcess.on('error', (err) => reject(new Error(`Failed to start RHVoice: ${err.message}`)));
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
        return createAudioResource(stream, { inputType: StreamType.Arbitrary });
    } catch (error) {
        console.error(`[AudioResource] ${error.message}`);
        throw error;
    }
}

module.exports = { init, getEdgeVoices, getAudioResource, getAudioStream };
