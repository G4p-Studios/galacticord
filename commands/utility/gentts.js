const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getAudioStream } = require('../../utils/ttsProvider');
const voiceOptions = require('../../utils/voiceConstants');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gentts')
        .setDescription('Generate an audio file from text using a selected voice')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('The TTS Provider')
                .setRequired(true)
                .addChoices(
                    { name: 'Google Translate', value: 'google' },
                    { name: 'Google Cloud (Official)', value: 'google-cloud' },
                    { name: 'Gemini TTS (Flash 2.5)', value: 'gemini' },
                    { name: 'Amazon Polly (Standard/Neural/Generative)', value: 'polly' },
                    { name: 'Piper (High Quality)', value: 'piper' },
                    { name: 'eSpeak-ng (Classic Synth)', value: 'espeak' },
                    { name: 'RHVoice (Local Natural)', value: 'rhvoice' },
                    { name: 'STAR (Distributed)', value: 'star' }
                ))
        .addStringOption(option =>
            option.setName('voice')
                .setDescription('The voice to use')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to speak')
                .setRequired(true)),

    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused();
            const mode = interaction.options.getString('mode') || 'piper';

            let choices = [];
            if (mode === 'google') {
                choices = Object.entries(voiceOptions).map(([key, value]) => ({
                    name: value.label,
                    value: key
                }));
            } else if (mode === 'google-cloud') {
                choices = Object.entries(voiceOptions)
                    .filter(([key, value]) => value.gcloud)
                    .map(([key, value]) => ({
                        name: value.label,
                        value: key
                    }));
            } else if (mode === 'gemini') {
                choices = Object.entries(voiceOptions)
                    .filter(([key, value]) => value.gemini)
                    .map(([key, value]) => ({
                        name: value.label,
                        value: key
                    }));
            } else if (mode === 'polly') {
                choices = Object.entries(voiceOptions)
                    .filter(([key, value]) => value.polly)
                    .map(([key, value]) => ({
                        name: value.label,
                        value: key
                    }));
            } else if (mode === 'piper') {
                const modelsDir = path.join(__dirname, '../../models');
                if (fs.existsSync(modelsDir)) {
                    const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.onnx'));
                    choices = files.map(f => {
                        let prettyName = f.replace('.onnx', '').replace('en_US-', '').replace('en_GB-', '');
                        prettyName = prettyName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                        return {
                            name: prettyName,
                            value: path.join('models', f)
                        };
                    });
                }
            } else if (mode === 'espeak') {
                choices = [
                    { name: 'English (US)', value: 'en-us' },
                    { name: 'English (UK)', value: 'en-gb' },
                    { name: 'Spanish', value: 'es' },
                    { name: 'French', value: 'fr' }
                ];
            } else if (mode === 'rhvoice') {
                choices = [
                    { name: 'Alan (English)', value: 'alan' },
                    { name: 'Bcl (English)', value: 'bdl' },
                    { name: 'Slt (English)', value: 'slt' },
                    { name: 'Aleksandr (Russian)', value: 'aleksandr' },
                    { name: 'Anna (Russian)', value: 'anna' },
                    { name: 'Elena (Russian)', value: 'elena' },
                    { name: 'Irina (Russian)', value: 'irina' }
                ];
            } else if (mode === 'star') {
                let settings = { users: {}, servers: {} };
                try {
                    const settingsPath = path.join(__dirname, '../../data/tts_settings.json');
                    if (fs.existsSync(settingsPath)) {
                        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                    }
                } catch (e) {}

                const userUrl = settings.users[interaction.user.id]?.starUrl || settings.servers[interaction.guild.id]?.starUrl || 'https://speech.seedy.cc';
                if (userUrl) {
                    try {
                        const { WebSocket } = require('ws');
                        const wsUrl = userUrl.replace(/^http/, 'ws');
                        const fetchVoices = () => new Promise((resolve) => {
                            const ws = new WebSocket(wsUrl);
                            const timeout = setTimeout(() => { ws.terminate(); resolve([]); }, 2000);
                            ws.on('open', () => ws.send(JSON.stringify({ user: 4 })));
                            ws.on('message', (data) => {
                                try {
                                    const response = JSON.parse(data.toString());
                                    if (response.voices) { resolve(response.voices); ws.close(); }
                                } catch (e) {}
                            });
                            ws.on('error', () => resolve([]));
                        });
                        const voiceList = await fetchVoices();
                        choices = voiceList.map(v => ({ name: v, value: v }));
                    } catch (e) {}
                }
            }

            const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
            
            // Check if interaction is still valid before responding
            if (!interaction.responded) {
                await interaction.respond(filtered.slice(0, 25)).catch(() => {});
            }
        } catch (error) {
            console.error('[GenTTS Autocomplete Error]', error);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        const mode = interaction.options.getString('mode');
        const voice = interaction.options.getString('voice');
        const text = interaction.options.getString('text');

        let finalVoice = voice;
        if (mode === 'google-cloud') {
            if (voice === 'studio') finalVoice = 'en-US-Studio-O';
            if (voice === 'sulafat') finalVoice = 'en-US-Chirp3-HD-Sulafat';
            if (voice === 'achernar') finalVoice = 'en-US-Chirp3-HD-Achernar';
            const namedChirps = ['aoede', 'charon', 'fenrir', 'kore', 'leda', 'orus', 'puck', 'zephyr'];
            if (namedChirps.includes(voice.toLowerCase())) {
                finalVoice = `en-US-Chirp3-HD-${voice.charAt(0).toUpperCase() + voice.slice(1).toLowerCase()}`;
            }
        } else if (mode === 'gemini') {
            const namedGemini = ['aoede', 'charon', 'fenrir', 'kore', 'leda', 'orus', 'puck', 'zephyr'];
            if (namedGemini.includes(voice.toLowerCase())) {
                finalVoice = `gemini-${voice.charAt(0).toUpperCase() + voice.slice(1).toLowerCase()}`;
            }
        } else if (mode === 'star') {
            let settings = { users: {}, servers: {} };
            try {
                const settingsPath = path.join(__dirname, '../../data/tts_settings.json');
                if (fs.existsSync(settingsPath)) {
                    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                }
            } catch (e) {}
            const starUrl = settings.users[interaction.user.id]?.starUrl || settings.servers[interaction.guild.id]?.starUrl || 'https://speech.seedy.cc';
            finalVoice = JSON.stringify({ url: starUrl, voice: voice });
        }

        try {
            const rawStream = await getAudioStream(text, mode, finalVoice);
            const tempFile = path.join(__dirname, `../../temp_tts_${interaction.user.id}.wav`);
            
            // Wrap the raw PCM stream into a valid WAV file using FFmpeg
            const { spawn } = require('child_process');
            const ffmpeg = spawn('ffmpeg', [
                '-f', 's16le',
                '-ar', '48000',
                '-ac', '2',
                '-i', 'pipe:0',
                '-y', // Overwrite
                tempFile
            ]);

            rawStream.pipe(ffmpeg.stdin);

            ffmpeg.on('close', async (code) => {
                if (code !== 0) {
                    console.error(`FFmpeg exited with code ${code}`);
                    return interaction.editReply('Failed to encode audio file.');
                }

                const attachment = new AttachmentBuilder(tempFile, { name: 'tts_output.wav' });
                await interaction.editReply({
                    content: `✅ Generated TTS for: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`,
                    files: [attachment]
                });

                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            });

            ffmpeg.on('error', (err) => {
                console.error(err);
                interaction.editReply('Failed to write audio file.');
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('Failed to generate TTS audio file.');
        }
    },
};
