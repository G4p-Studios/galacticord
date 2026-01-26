const googleTTS = require('google-tts-api');
const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn, execSync } = require('child_process');

function resolvePath(command) {
    try {
        return execSync(`which ${command}`).toString().trim();
    } catch (e) {
        return command; // Fallback to name if which fails
    }
}

async function getAudioStream(text, provider, voiceKey) {
    if (provider === 'google') {
        const voiceOptions = require('./voiceConstants');
        const voiceConfig = voiceOptions[voiceKey] || voiceOptions['en-US'];
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
        const piperPath = 'piper';
        const botRoot = path.resolve(__dirname, '..');
        let effectiveVoiceKey = (typeof voiceKey === 'string') ? voiceKey.trim() : 'models/en_US-amy-medium.onnx';
        const isModelFile = effectiveVoiceKey.endsWith('.onnx');
        const hasPath = effectiveVoiceKey.includes('/') || effectiveVoiceKey.includes('\\');

        if (!effectiveVoiceKey || effectiveVoiceKey === 'onnx' || effectiveVoiceKey === 'undefined' || (!isModelFile && !hasPath)) {
            effectiveVoiceKey = 'models/en_US-amy-medium.onnx';
        }

        const modelPath = path.isAbsolute(effectiveVoiceKey) ? effectiveVoiceKey : path.resolve(botRoot, effectiveVoiceKey);
        
        if (!fs.existsSync(modelPath)) throw new Error(`Piper model not found at: ${modelPath}`);

        const piperProcess = spawn(piperPath, ['--model', modelPath, '--output_file', '-']);
        const sanitizedText = text.replace(/\s+/g, ' ').trim();
        
        piperProcess.stdin.write(sanitizedText + '\n');
        piperProcess.stdin.end();

        return piperProcess.stdout;
    } else if (provider === 'espeak') {
        return new Promise((resolve, reject) => {
            const espeakPath = resolvePath('espeak-ng');
            const voice = voiceKey || 'en-us';
            const sanitizedText = text.replace(/\s+/g, ' ').trim();
            
            console.log(`[eSpeak Debug] Spawning absolute path: ${espeakPath} -v ${voice}`);
            const espeakProcess = spawn(espeakPath, ['-v', voice, '--stdout', sanitizedText]);
            
            espeakProcess.on('error', (err) => {
                console.error(`[eSpeak TTS Error] Failed to start espeak-ng at ${espeakPath}: ${err.message}`);
                reject(new Error("Failed to start eSpeak-ng. Is it installed and executable?"));
            });

            resolve(espeakProcess.stdout);
        });

    } else if (provider === 'rhvoice') {
        return new Promise((resolve, reject) => {
            const rhvoicePath = resolvePath('RHVoice-test');
            const voice = voiceKey || 'alan';
            const sanitizedText = text.replace(/\s+/g, ' ').trim();

            console.log(`[RHVoice Debug] Spawning absolute path: ${rhvoicePath} -p ${voice}`);
            const rhvoiceProcess = spawn(rhvoicePath, ['-p', voice, '-o', '-']);
            
            rhvoiceProcess.on('error', (err) => {
                console.error(`[RHVoice TTS Error] Failed to start RHVoice at ${rhvoicePath}: ${err.message}`);
                reject(new Error("Failed to start RHVoice. Is it installed and executable?"));
            });

            rhvoiceProcess.stdin.write(sanitizedText + '\n');
            rhvoiceProcess.stdin.end();

            resolve(rhvoiceProcess.stdout);
        });
    }
    throw new Error("Unknown provider");
}

async function getAudioResource(text, provider, voiceKey) {
    const stream = await getAudioStream(text, provider, voiceKey);
    return createAudioResource(stream, { inputType: StreamType.Arbitrary });
}

module.exports = { init, getEdgeVoices, getAudioResource, getAudioStream };