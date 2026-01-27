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
        const focusedValue = interaction.options.getFocused();
        const mode = interaction.options.getString('mode') || 'piper';

        let choices = [];
        if (mode === 'google') {
            choices = Object.entries(voiceOptions).map(([key, value]) => ({
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
                { name: 'Aleksandr (Russian)', value: 'aleksandr' }
            ];
        } else if (mode === 'star') {
            // Load Settings to get starUrl
            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(path.join(__dirname, '../../data/tts_settings.json'))) {
                    settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/tts_settings.json'), 'utf8'));
                }
            } catch (e) {}

            const userUrl = settings.users[interaction.user.id]?.starUrl || settings.servers[interaction.guild.id]?.starUrl || 'https://speech.seedy.cc';
            if (userUrl) {
                try {
                    const WebSocket = require('ws');
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
        await interaction.respond(filtered.slice(0, 25));
    },

    async execute(interaction) {
        await interaction.deferReply();

        const mode = interaction.options.getString('mode');
        const voice = interaction.options.getString('voice');
        const text = interaction.options.getString('text');

        let finalVoice = voice;
        if (mode === 'star') {
            // Load settings to get the URL
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
            const stream = await getAudioStream(text, mode, finalVoice);
            
            // Create a temporary file path
            const tempFile = path.join(__dirname, `../../temp_tts_${interaction.user.id}.wav`);
            const writeStream = fs.createWriteStream(tempFile);

            stream.pipe(writeStream);

            writeStream.on('finish', async () => {
                const attachment = new AttachmentBuilder(tempFile, { name: 'tts_output.wav' });
                await interaction.editReply({
                    content: `✅ Generated TTS for: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`,
                    files: [attachment]
                });

                // Cleanup
                fs.unlinkSync(tempFile);
            });

            writeStream.on('error', (err) => {
                console.error(err);
                interaction.editReply('Failed to write audio file.');
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('Failed to generate TTS audio file.');
        }
    },
};
