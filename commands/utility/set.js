const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const voiceOptions = require('../../utils/voiceConstants'); // Google Options
const { getEdgeVoices } = require('../../utils/ttsProvider');

const serverConfigFile = path.join(__dirname, '../../data/server_config.json');
const ttsSettingsFile = path.join(__dirname, '../../data/tts_settings.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set')
        .setDescription('Configure settings')
        // Subcommand: Channel
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set a specific channel for features')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('The type of channel to set')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Log Channel', value: 'logChannel' },
                            { name: 'Moderation Log', value: 'modLog' },
                            { name: 'TTS Channel', value: 'ttsChannel' }
                        ))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to use')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)))
        // Subcommand: Mode
        .addSubcommand(subcommand => 
            subcommand
                .setName('mode')
                .setDescription('Set the TTS Provider Mode')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('Who is this mode for?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Me (User Preference)', value: 'user' },
                            { name: 'Server (Default)', value: 'server' }
                        ))
                .addStringOption(option =>
                    option.setName('provider')
                        .setDescription('The TTS Provider')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Google Translate (Simple, Fast)', value: 'google' },
                            { name: 'Google Cloud (Official - Neural, Studio, HD3)', value: 'google-cloud' },
                            { name: 'Gemini TTS (Official - Flash 2.5)', value: 'gemini' },
                            { name: 'Amazon Polly (Standard/Neural/Generative)', value: 'polly' },
                            { name: 'Piper (High Quality Local TTS)', value: 'piper' },
                            { name: 'eSpeak-ng (Classic Synth)', value: 'espeak' },
                            { name: 'RHVoice (Natural local voices)', value: 'rhvoice' },
                            { name: 'STAR (Distributed TTS Client)', value: 'star' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('star_url')
                .setDescription('Set the URL for your STAR TTS server (e.g. http://my-server:7774)')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('Who is this URL for?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Me (User Preference)', value: 'user' },
                            { name: 'Server (Default)', value: 'server' }
                        ))
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('The API URL (include http:// or https://) or choose a preset.')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('music_proxy')
                .setDescription('Set a proxy for the music player (e.g. socks5://127.0.0.1:9050)')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('Who is this proxy for?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Me (User Preference)', value: 'user' },
                            { name: 'Server (Default)', value: 'server' }
                        ))
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('The proxy URL')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bot')
                .setDescription('Set whether the bot should speak messages from other bots.')
                .addBooleanOption(option =>
                    option.setName('speak')
                        .setDescription('True to speak bot messages, False to ignore them (default).')
                        .setRequired(true)))
                // Subcommand: Verbose
                .addSubcommand(subcommand =>
                subcommand
                .setName('verbose')
                .setDescription('Toggle verbose internal logging for debugging.')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable verbose console logging.')
                        .setRequired(true)))
                // Subcommand: Voice
                .addSubcommand(subcommand =>

            subcommand
                .setName('join_message')
                .setDescription('Set a custom voice channel join message (use {user} for the username)')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message (e.g. "bursts into the room") or "reset" to restore default')
                        .setRequired(true)))
        // Subcommand: Leave Message
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave_message')
                .setDescription('Set a custom voice channel leave message (use {user} for the username)')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message (e.g. "runs away and hides") or "reset" to restore default')
                        .setRequired(true)))
        // Subcommand: Mute Message
        .addSubcommand(subcommand =>
            subcommand
                .setName('mute_message')
                .setDescription('Set a custom message when you mute (use {user} for the username)')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message (e.g. "goes silent") or "reset" to restore default')
                        .setRequired(true)))
        // Subcommand: Unmute Message
        .addSubcommand(subcommand =>
            subcommand
                .setName('unmute_message')
                .setDescription('Set a custom message when you unmute (use {user} for the username)')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message (e.g. "speaks again") or "reset" to restore default')
                        .setRequired(true)))
        // Subcommand: Deafen Message
        .addSubcommand(subcommand =>
            subcommand
                .setName('deafen_message')
                .setDescription('Set a custom message when you deafen (use {user} for the username)')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message (e.g. "covers their ears") or "reset" to restore default')
                        .setRequired(true)))
        // Subcommand: Undeafen Message
        .addSubcommand(subcommand =>
            subcommand
                .setName('undeafen_message')
                .setDescription('Set a custom message when you undeafen (use {user} for the username)')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The message (e.g. "can hear again") or "reset" to restore default')
                        .setRequired(true)))
        // Subcommand: Ducking
        .addSubcommand(subcommand =>
            subcommand
                .setName('ducking')
                .setDescription('Set how much the sound file volume ducks when TTS speaks (0-100%, default 30%)')
                .addIntegerOption(option =>
                    option.setName('percent')
                        .setDescription('Volume level during TTS (0 = silent, 100 = no ducking)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)))
        // Subcommand: Voice
        .addSubcommand(subcommand =>
            subcommand
                .setName('voice')
                .setDescription('Set the TTS voice preference')
                .addStringOption(option =>
                    option.setName('target')
                        .setDescription('Who is this voice for?')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Me (User Preference)', value: 'user' },
                            { name: 'Server (Default)', value: 'server' }
                        ))
                .addStringOption(option =>
                    option.setName('voice')
                        .setDescription('The language/voice to use')
                        .setRequired(true)
                        .setAutocomplete(true))),
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const focusedValue = focusedOption.value;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'star_url' && focusedOption.name === 'url') {
            const presets = [
                { name: 'Default (speech.seedy.cc)', value: 'https://speech.seedy.cc' },
                { name: 'Mad Gamer (star.mad-gamer.com)', value: 'https://star.mad-gamer.com' },
                { name: 'Blindsoft Star (star.blindsoft.net)', value: 'https://star.blindsoft.net' },
                { name: 'Blindsoft R720 (r720.blindsoft.net)', value: 'https://r720.blindsoft.net' },
                { name: 'Localhost (Self-hosted)', value: 'http://localhost:7774' },
                { name: `Other: ${focusedValue}`, value: focusedValue }
            ];
            const filtered = presets.filter(p => p.name.toLowerCase().includes(focusedValue.toLowerCase()) || p.value.toLowerCase().includes(focusedValue.toLowerCase()));
            return await interaction.respond(filtered.slice(0, 25));
        }

        const target = interaction.options.getString('target');
        
        let settings = { users: {}, servers: {} };
        try {
            if (fs.existsSync(ttsSettingsFile)) {
                settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8'));
            }
        } catch (e) {}

        let mode = 'piper';
        if (target === 'user') {
            mode = settings.users[interaction.user.id]?.mode || settings.servers[interaction.guild.id]?.mode || 'piper';
        } else {
            mode = settings.servers[interaction.guild.id]?.mode || 'piper';
        }

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
                    return { name: prettyName, value: path.join('models', f) };
                });
            }
            if (focusedValue.includes('/') || focusedValue.includes('\\')) {
                choices.push({ name: `Custom Path: ${focusedValue}`, value: focusedValue });
            }
        } else if (mode === 'espeak') {
            choices = [
                { name: 'English (US)', value: 'en-us' },
                { name: 'English (UK)', value: 'en-gb' },
                { name: 'Spanish', value: 'es' },
                { name: 'French', value: 'fr' },
                { name: 'German', value: 'de' },
                { name: 'Russian', value: 'ru' },
                { name: 'Polish', value: 'pl' },
                { name: 'Italian', value: 'it' }
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
            const userUrl = settings.users[interaction.user.id]?.starUrl || settings.servers[interaction.guild.id]?.starUrl || 'https://speech.seedy.cc';
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
                            if (response.voices && Array.isArray(response.voices)) {
                                resolve(response.voices);
                                ws.close();
                            }
                        } catch (e) {}
                    });
                    ws.on('error', () => resolve([]));
                });
                const voiceList = await fetchVoices();
                if (voiceList.length > 0) {
                    choices = voiceList.map(v => ({ name: v, value: v }));
                } else {
                    choices = [{ name: 'No voices found or connection failed', value: 'error_empty' }];
                }
            } catch (e) {
                choices = [{ name: '❌ Error connecting to server', value: 'error_conn' }];
            }
        }

        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25));
    },
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const serverConfigFile = path.join(__dirname, '../../data/server_config.json');

        if (subcommand === 'channel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to use this command.', ephemeral: true });
            }
            const type = interaction.options.getString('type');
            const channel = interaction.options.getChannel('channel');
            let config = {};
            try { if (fs.existsSync(serverConfigFile)) config = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8')); } catch (e) {}
            if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
            config[interaction.guild.id][type] = channel.id;
            fs.writeFileSync(serverConfigFile, JSON.stringify(config, null, 2));
            const typeNames = {
                'logChannel': 'Log Channel',
                'modLog': 'Moderation Log',
                'ttsChannel': 'TTS Channel'
            };
            await interaction.reply({ content: `${typeNames[type] || type} has been set to ${channel}.` });

        } else if (subcommand === 'bot') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to use this command.', ephemeral: true });
            }
            const speak = interaction.options.getBoolean('speak');
            let config = {};
            try { if (fs.existsSync(serverConfigFile)) config = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8')); } catch (e) {}
            if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
            config[interaction.guild.id].ignoreBots = !speak;
            fs.writeFileSync(serverConfigFile, JSON.stringify(config, null, 2));
            await interaction.reply({ content: `✅ Bot messages will now be ${speak ? 'SPOKEN' : 'IGNORED'}.` });

        } else if (subcommand === 'verbose') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to use this command.', ephemeral: true });
            }
            const enabled = interaction.options.getBoolean('enabled');
            let config = {};
            try { if (fs.existsSync(serverConfigFile)) config = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8')); } catch (e) {}
            if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
            config[interaction.guild.id].verboseLogging = enabled;
            fs.writeFileSync(serverConfigFile, JSON.stringify(config, null, 2));
            await interaction.reply({ content: `✅ Verbose console logging has been **${enabled ? 'ENABLED' : 'DISABLED'}** for this server.` });

        } else if (subcommand === 'star_url') {
            const target = interaction.options.getString('target');
            const url = interaction.options.getString('url');
            if (target === 'server' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to set the Server STAR URL.', ephemeral: true });
            }
            if (!url.startsWith('http')) return interaction.reply({ content: '❌ Invalid URL. Please include http:// or https://', ephemeral: true });
            let settings = { users: {}, servers: {} };
            try { if (fs.existsSync(ttsSettingsFile)) settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8')); } catch (e) {}
            if (target === 'user') {
                if (!settings.users[interaction.user.id]) settings.users[interaction.user.id] = {};
                settings.users[interaction.user.id].starUrl = url;
                settings.users[interaction.user.id].mode = 'star';
                await interaction.reply({ content: `Your STAR URL has been set to: 
${url}
Provider switched to STAR.` });
            } else {
                if (!settings.servers[interaction.guild.id]) settings.servers[interaction.guild.id] = {};
                settings.servers[interaction.guild.id].starUrl = url;
                settings.servers[interaction.guild.id].mode = 'star';
                await interaction.reply({ content: `Server Default STAR URL has been set to: 
${url}
Server Default Provider switched to STAR.` });
            }
            fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));

        } else if (subcommand === 'music_proxy') {
            // --- Music Proxy Logic ---
            const target = interaction.options.getString('target');
            const url = interaction.options.getString('url');

            if (target === 'server' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to set the Server Music Proxy.', ephemeral: true });
            }

            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(ttsSettingsFile)) {
                    settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8'));
                }
            } catch (e) {}

            if (target === 'user') {
                if (!settings.users[interaction.user.id]) settings.users[interaction.user.id] = {};
                settings.users[interaction.user.id].musicProxy = url;
                await interaction.reply({ content: `Your Music Proxy has been set to: \`${url}\`` });
            } else {
                if (!settings.servers[interaction.guild.id]) settings.servers[interaction.guild.id] = {};
                settings.servers[interaction.guild.id].musicProxy = url;
                await interaction.reply({ content: `Server Default Music Proxy has been set to: \`${url}\`` });
            }

            fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));

        } else if (subcommand === 'mode') {
            const target = interaction.options.getString('target');
            const provider = interaction.options.getString('provider');
            if (target === 'server' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to set Server Default.', ephemeral: true });
            }
            let settings = { users: {}, servers: {} };
            try { if (fs.existsSync(ttsSettingsFile)) settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8')); } catch (e) {}
            if (target === 'user') {
                if (!settings.users[interaction.user.id]) settings.users[interaction.user.id] = {};
                if (typeof settings.users[interaction.user.id] === 'string') settings.users[interaction.user.id] = { voice: settings.users[interaction.user.id] };
                settings.users[interaction.user.id].mode = provider;
                const providerMap = { 
                    'google': 'Google Translate', 
                    'google-cloud': 'Google Cloud (Official)', 
                    'gemini': 'Gemini TTS (Flash 2.5)',
                    'polly': 'Amazon Polly',
                    'piper': 'Piper', 
                    'espeak': 'eSpeak-ng', 
                    'rhvoice': 'RHVoice', 
                    'star': 'STAR (Distributed)' 
                };
                await interaction.reply({ content: `Your TTS Provider is now: ${providerMap[provider] || provider}` });
            } else {
                if (!settings.servers[interaction.guild.id]) settings.servers[interaction.guild.id] = {};
                if (typeof settings.servers[interaction.guild.id] === 'string') settings.servers[interaction.guild.id] = { voice: settings.servers[interaction.guild.id] };
                settings.servers[interaction.guild.id].mode = provider;
                const providerMap = { 
                    'google': 'Google Translate', 
                    'google-cloud': 'Google Cloud (Official)', 
                    'gemini': 'Gemini TTS (Flash 2.5)',
                    'polly': 'Amazon Polly',
                    'piper': 'Piper', 
                    'espeak': 'eSpeak-ng', 
                    'rhvoice': 'RHVoice', 
                    'star': 'STAR (Distributed)' 
                };
                await interaction.reply({ content: `Server Default TTS Provider is now: ${providerMap[provider] || provider}` });
            }
            fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));

        } else if (['join_message', 'leave_message', 'mute_message', 'unmute_message', 'deafen_message', 'undeafen_message'].includes(subcommand)) {
            const message = interaction.options.getString('message');
            const keyMap = {
                join_message: 'joinMessage', leave_message: 'leaveMessage',
                mute_message: 'muteMessage', unmute_message: 'unmuteMessage',
                deafen_message: 'deafenMessage', undeafen_message: 'undeafenMessage'
            };
            const labelMap = {
                join_message: 'Join', leave_message: 'Leave',
                mute_message: 'Mute', unmute_message: 'Unmute',
                deafen_message: 'Deafen', undeafen_message: 'Undeafen'
            };
            const configKey = keyMap[subcommand];
            const label = labelMap[subcommand];
            let settings = { users: {}, servers: {} };
            try { if (fs.existsSync(ttsSettingsFile)) settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8')); } catch (e) {}
            if (!settings.users[interaction.user.id]) settings.users[interaction.user.id] = {};
            if (message.toLowerCase() === 'reset') {
                delete settings.users[interaction.user.id][configKey];
                fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));
                await interaction.reply({ content: `${label} message reset to default.` });
            } else {
                settings.users[interaction.user.id][configKey] = message;
                fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));
                const preview = message.includes('{user}') ? message.replace('{user}', interaction.member.displayName) : `${interaction.member.displayName} ${message}`;
                await interaction.reply({ content: `${label} message set. Preview: *"${preview}"*` });
            }

        } else if (subcommand === 'ducking') {
            const percent = interaction.options.getInteger('percent');
            let config = {};
            try { if (fs.existsSync(serverConfigFile)) config = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8')); } catch (e) {}
            if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
            config[interaction.guild.id].duckingVolume = percent / 100;
            fs.writeFileSync(serverConfigFile, JSON.stringify(config, null, 2));
            await interaction.reply({ content: `Sound file ducking volume set to **${percent}%** during TTS.` });

        } else if (subcommand === 'voice') {
            const target = interaction.options.getString('target');
            const selectedVoiceKey = interaction.options.getString('voice');
            if (target === 'server' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to set the Server Default voice.', ephemeral: true });
            }
            let settings = { users: {}, servers: {} };
            try { if (fs.existsSync(ttsSettingsFile)) settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8')); } catch (e) {}

            // Try to find a pretty label for the voice
            let voiceName = selectedVoiceKey;
            if (voiceOptions[selectedVoiceKey]) {
                voiceName = voiceOptions[selectedVoiceKey].label;
            } else if (selectedVoiceKey.startsWith('models/')) {
                // Piper model path cleanup for display
                voiceName = selectedVoiceKey.split('/').pop().replace('.onnx', '');
            }

            if (target === 'user') {
                if (!settings.users[interaction.user.id]) settings.users[interaction.user.id] = {};
                if (typeof settings.users[interaction.user.id] === 'string') settings.users[interaction.user.id] = { voice: settings.users[interaction.user.id] };
                settings.users[interaction.user.id].voice = selectedVoiceKey;
                await interaction.reply({ content: `Your personal TTS voice has been set to ${voiceName}.` });
            } else {
                if (!settings.servers[interaction.guild.id]) settings.servers[interaction.guild.id] = {};
                if (typeof settings.servers[interaction.guild.id] === 'string') settings.servers[interaction.guild.id] = { voice: settings.servers[interaction.guild.id] };
                settings.servers[interaction.guild.id].voice = selectedVoiceKey;
                await interaction.reply({ content: `Server default TTS voice has been set to ${voiceName}.` });
            }
            fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));
        }
    },
};