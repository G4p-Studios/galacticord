const googleTTS = require('google-tts-api');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn, execSync } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

async function init() {} 
function getEdgeVoices() { return []; }

/**
 * The ultimate cleaner. Converts ALL Unicode dashes to ASCII hyphens.
 * Uses explicit hex codes to ensure no character encoding issues.
 */
function ultimateClean(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/\u2010/g, '-') // Hyphen
        .replace(/\u2011/g, '-') // Non-breaking hyphen
        .replace(/\u2012/g, '-') // Figure dash
        .replace(/\u2013/g, '-') // En dash
        .replace(/\u2014/g, '-') // Em dash
        .replace(/\u2015/g, '-') // Horizontal bar
        .replace(/\u2212/g, '-') // Minus sign
        .replace(/\u2043/g, '-') // Hyphen bullet
        .trim();
}

function resolvePath(command) {
    const cmd = ultimateClean(command);
    try {
        const fullPath = execSync(`which ${cmd}`).toString().trim();
        return ultimateClean(fullPath);
    } catch (e) {
        const searchPaths = ['/usr/bin', '/usr/local/bin', '/bin'];
        for (const dir of searchPaths) {
            const p = path.join(dir, cmd);
            if (fs.existsSync(p)) return p;
        }
        return cmd; 
    }
}

async function getAudioStream(text, provider, voiceKey) {
    // Clean everything immediately upon entry
    const cleanProvider = ultimateClean(provider).toLowerCase();
    const cleanVoiceKey = ultimateClean(voiceKey);
    const sanitizedText = text.replace(/\s+/g, ' ').trim();

    try {
        if (cleanProvider === 'google') {
            const voiceOptions = require('./voiceConstants');
            const voiceConfig = voiceOptions[cleanVoiceKey] || voiceOptions['en-US'];
            const url = googleTTS.getAudioUrl(text.substring(0, 2000), {
                lang: voiceConfig.lang || 'en',
                slow: false, host: voiceConfig.host || 'https://translate.google.com',
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
            
            console.log(`[eSpeak] Spawning: "${espeakPath}" with voice: "${voice}"`);
            
            return new Promise((resolve, reject) => {
                const espeakProcess = spawn(espeakPath, ['-v', voice, '--stdout']);
                
                espeakProcess.on('error', (err) => {
                    console.error(`[eSpeak Error] ${err.message}`);
                    reject(err);
                });

                // Safety: Check if stdin exists before writing to prevent EPIPE crash
                if (espeakProcess.stdin) {
                    espeakProcess.stdin.on('error', (err) => console.error('[eSpeak Stdin Error]', err.message));
                    espeakProcess.stdin.write(sanitizedText + '\n');
                    espeakProcess.stdin.end();
                }

                resolve(espeakProcess.stdout);
            });

        } else if (cleanProvider === 'rhvoice') {
            const rhvoicePath = resolvePath('RHVoice-test');
            const voice = cleanVoiceKey || 'alan';
            const rhvoiceProcess = spawn(rhvoicePath, ['-p', voice, '-o', '-']);
            if (rhvoiceProcess.stdin) {
                rhvoiceProcess.stdin.write(sanitizedText + '\n');
                rhvoiceProcess.stdin.end();
            }
            return rhvoiceProcess.stdout;
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