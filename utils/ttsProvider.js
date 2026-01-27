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
    return str.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2043]/g, '-').trim();
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
                    const idLen = data.readUInt16LE(0);
                    const audioData = data.subarray(2 + idLen);
                    console.log(`[STAR Debug] Received audio (${audioData.length} bytes)`);
                    resolve(Readable.from(audioData));
                    ws.close();
                } catch (e) {
                    reject(new Error(`Failed to parse STAR audio packet: ${e.message}`));
                    ws.close();
                }
            } else {
                console.log(`[STAR Debug] Received text message: ${data.toString()}`);
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
            const safeText = sanitizedText.replace(/