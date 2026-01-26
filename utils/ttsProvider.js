const googleTTS = require('google-tts-api');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn } = require('child_process');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

async function init() {}

function getEdgeVoices() {
    return [];
}

async function getAudioResource(text, provider, voiceKey) {
    console.log(`[TTS Debug] Provider: ${provider}, Voice: ${voiceKey}, Text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    if (provider === 'google') {
        const voiceOptions = require('./voiceConstants');
        const voiceConfig = voiceOptions[voiceKey] || voiceOptions['en-US'];

        const MAX_GOOGLE_TEXT = 200;
        const textToProcess = text.substring(0, 2000); 

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
            const results = googleTTS.getAllAudioUrls(textToProcess, {
                lang: voiceConfig.lang,
                slow: false,
                host: voiceConfig.host,
            });
            
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
            
            // Clean the voiceKey and handle fallbacks
            let effectiveVoiceKey = (typeof voiceKey === 'string') ? voiceKey.trim() : 'models/en_US-amy-medium.onnx';
            
            const isModelFile = effectiveVoiceKey.endsWith('.onnx');
            const hasPath = effectiveVoiceKey.includes('/') || effectiveVoiceKey.includes('\\');

            if (!effectiveVoiceKey || effectiveVoiceKey === 'onnx' || effectiveVoiceKey === 'undefined' || (!isModelFile && !hasPath)) {
                effectiveVoiceKey = 'models/en_US-amy-medium.onnx';
                console.log(`[Piper Debug] Invalid voiceKey detected. Using default: ${effectiveVoiceKey}`);
            }

            const modelPath = path.isAbsolute(effectiveVoiceKey) ? effectiveVoiceKey : path.resolve(botRoot, effectiveVoiceKey);
            
            if (!fs.existsSync(modelPath)) {
                console.error(`[Piper Error] Model file NOT found at: ${modelPath}`);
                return reject(new Error(`Piper model not found at: ${modelPath}`));
            }

            // Check if JSON config exists (Piper needs this)
            const configPath = modelPath + '.json';
            if (!fs.existsSync(configPath)) {
                console.error(`[Piper Error] Configuration file NOT found at: ${configPath}`);
                return reject(new Error(`Piper config (.json) missing for model: ${modelPath}`));
            }

            const piperProcess = spawn(piperPath, [
                '--model', modelPath,
                '--output_file', '-'
            ]);

            let dataCount = 0;
            piperProcess.stdout.on('data', (chunk) => {
                dataCount += chunk.length;
            });

            // Clean the text aggressively: No newlines, no tabs, just a clean sentence.
            const sanitizedText = text.replace(/\s+/g, ' ').trim();
            console.log(`[Piper Debug] Final Sanitized Text (length ${sanitizedText.length})`);
            
            piperProcess.stdin.write(sanitizedText + '\n');
            piperProcess.stdin.end();

            piperProcess.stderr.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) console.log(`[Piper Process Log] ${msg}`);
            });

            piperProcess.on('close', (code) => {
                if (dataCount === 0) {
                    console.error(`[Piper Warning] Piper produced ZERO bytes of audio data. Exit code: ${code}`);
                }
            });

            piperProcess.on('error', (err) => {
                console.error(`[Piper TTS Error] ${err.message}`);
                reject(new Error("Failed to start Piper process."));
            });

            resolve(createAudioResource(piperProcess.stdout, { 
                inputType: StreamType.Arbitrary 
            }));
        });
    }

    throw new Error("Unknown provider");
}

module.exports = { init, getEdgeVoices, getAudioResource };