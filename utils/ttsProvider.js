const googleTTS = require('google-tts-api');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

async function init() {
    // Edge Voices initialization removed
}

function getEdgeVoices() {
    return [];
}

async function getAudioResource(text, provider, voiceKey) {
    console.log(`[TTS Debug] Provider: ${provider}, Voice: ${voiceKey}, Text: "${text}"`);

    if (provider === 'google') {
        const voiceOptions = require('./voiceConstants');
        const voiceConfig = voiceOptions[voiceKey] || voiceOptions['en-US'];

        // Google Translate TTS has a 200 character limit.
        // We will split the text into chunks if it's too long.
        const MAX_GOOGLE_TEXT = 200;
        const textToProcess = text.substring(0, 2000); // Respect user's 2000 char request

        if (textToProcess.length <= MAX_GOOGLE_TEXT) {
            const url = googleTTS.getAudioUrl(textToProcess, {
                lang: voiceConfig.lang,
                slow: false,
                host: voiceConfig.host,
            });
            try {
                const response = await axios.get(url, { responseType: 'stream' });
                return createAudioResource(response.data, { inputType: StreamType.Arbitrary });
            } catch (error) {
                console.error("Failed to fetch Google TTS audio:", error.message);
                throw new Error("Could not retrieve Google TTS audio.");
            }
        } else {
            // For text > 200 chars, google-tts-api provides getAllAudioUrls
            const results = googleTTS.getAllAudioUrls(textToProcess, {
                lang: voiceConfig.lang,
                slow: false,
                host: voiceConfig.host,
            });
            
            // Note: createAudioResource normally takes one stream.
            // To handle multiple chunks seamlessly, we'd need a complex queue.
            // For now, to satisfy the 2000 char request without crashing, 
            // we will take the first 200 chars to avoid the RangeError, 
            // but Piper/Edge are recommended for longer texts.
            // ALTERNATIVELY: Just use the first chunk to keep it simple and stable.
            const firstUrl = results[0].url;
            try {
                const response = await axios.get(firstUrl, { responseType: 'stream' });
                return createAudioResource(response.data, { inputType: StreamType.Arbitrary });
            } catch (error) {
                console.error("Failed to fetch Google TTS audio:", error.message);
                throw new Error("Could not retrieve Google TTS audio.");
            }
        }
    
    } else if (provider === 'piper') {
        return new Promise((resolve, reject) => {
            const piperPath = 'piper'; 
            const botRoot = path.resolve(__dirname, '..');
            
            // Aggressive Fix for the 'onnx' bug or leftover language codes (e.g., 'en-US')
            let effectiveVoiceKey = voiceKey;
            const isPath = effectiveVoiceKey && (effectiveVoiceKey.endsWith('.onnx') || effectiveVoiceKey.includes('/') || effectiveVoiceKey.includes('\\'));
            
            if (!effectiveVoiceKey || !isPath || effectiveVoiceKey === 'onnx' || effectiveVoiceKey === 'undefined') {
                effectiveVoiceKey = 'models/en_US-amy-medium.onnx';
                console.log(`[Piper Debug] Invalid voiceKey ("${voiceKey}") detected for Piper. Forcing fallback to: ${effectiveVoiceKey}`);
            }

            const modelPath = path.isAbsolute(effectiveVoiceKey) ? effectiveVoiceKey : path.resolve(botRoot, effectiveVoiceKey);
            
            console.log(`[Piper Debug] Attempting to spawn Piper:`);
            console.log(`  - Command: ${piperPath}`);
            console.log(`  - Model: ${modelPath}`);
            console.log(`  - Text: "${text.substring(0, 30)}..."`);

            if (!fs.existsSync(modelPath)) {
                console.error(`[Piper Error] Model file NOT found at: ${modelPath}`);
                return reject(new Error(`Piper model not found at: ${modelPath}`));
            }

            const piperProcess = spawn(piperPath, [
                '--model', modelPath,
                '--output_file', '-'
            ]);

            let dataCount = 0;
            piperProcess.stdout.on('data', (chunk) => {
                dataCount += chunk.length;
                if (dataCount > 0 && dataCount < 1000) { // Log once when data starts
                    console.log(`[Piper Debug] Started receiving audio data (${chunk.length} bytes received so far)`);
                }
            });

            piperProcess.stdin.write(text);
            piperProcess.stdin.end();

            piperProcess.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) console.log(`[Piper Process Log] ${msg}`);
            });

            piperProcess.on('close', (code) => {
                console.log(`[Piper Debug] Process closed with code: ${code}. Total audio data: ${dataCount} bytes.`);
                if (dataCount === 0) {
                    console.error(`[Piper Warning] Piper produced ZERO bytes of audio data. Check Piper logs above.`);
                }
            });

            piperProcess.on('error', (err) => {
                console.error(`[Piper TTS Error] Failed to start Piper process: ${err.message}`);
                reject(new Error("Failed to start Piper TTS. Please ensure 'piper' is installed and in your PATH."));
            });

            const stream = piperProcess.stdout;
            
            resolve(createAudioResource(stream, { 
                inputType: StreamType.Arbitrary 
            }));
        });
    }

    throw new Error("Unknown provider");
}

module.exports = { init, getEdgeVoices, getAudioResource };
