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
                        .setDescription('The API URL (include http:// or https://)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('bot')
                .setDescription('Set whether the bot should speak messages from other bots.')
                .addBooleanOption(option =>
                    option.setName('speak')
                        .setDescription('True to speak bot messages, False to ignore them (default).')
                        .setRequired(true)))
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
        const focusedValue = interaction.options.getFocused();
        const target = interaction.options.getString('target');
        
        // Determine current mode for target to show relevant voices
        let settings = { users: {}, servers: {} };
        try {
            if (fs.existsSync(ttsSettingsFile)) {
                settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8'));
            }
        } catch (e) {}

        // Default to Piper if not set
        let mode = 'piper';
        if (target === 'user') {
            mode = settings.users[interaction.user.id]?.mode || settings.servers[interaction.guild.id]?.mode || 'piper';
        } else {
            mode = settings.servers[interaction.guild.id]?.mode || 'piper';
        }

        // Wait... user might be changing mode separately.
        // But for selecting a voice, we should probably show voices for the CURRENTLY selected mode
        // OR we could show all but that's messy. 
        // Better: Check the mode setting in the file.

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
                    // Prettify name: en_US-amy-medium.onnx -> Amy (Medium)
                    let prettyName = f.replace('.onnx', '').replace('en_US-', '').replace('en_GB-', '');
                    prettyName = prettyName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    
                    return {
                        name: prettyName,
                        value: path.join('models', f)
                    };
                });
            }
            // Always allow manual path entry if nothing found or to complement
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
                // Fetch voices via WebSocket
                const WebSocket = require('ws');
                const wsUrl = userUrl.replace(/^http/, 'ws');
                    
                    const fetchVoices = () => new Promise((resolve, reject) => {
                        const ws = new WebSocket(wsUrl);
                        const timeout = setTimeout(() => { ws.terminate(); resolve([]); }, 2000); // 2s timeout for UI responsiveness

                        ws.on('open', () => {
                            ws.send(JSON.stringify({ user: 4 })); // Request voice list with revision 4
                        });

                        ws.on('message', (data) => {
                            try {
                                const response = JSON.parse(data.toString());
                                if (response.voices && Array.isArray(response.voices)) {
                                    resolve(response.voices);
                                    ws.close();
                                }
                            } catch (e) {}
                        });

                        ws.on('error', () => { resolve([]); });
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
        }

        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
        
        // Max 25 choices
        await interaction.respond(
            filtered.slice(0, 25)
        );
    },
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const serverConfigFile = path.join(__dirname, '../../data/server_config.json');

        if (subcommand === 'channel') {
            // --- Channel Logic ---
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to use this command.', ephemeral: true });
            }

            const type = interaction.options.getString('type');
            const channel = interaction.options.getChannel('channel');

            let config = {};
            try {
                if (fs.existsSync(serverConfigFile)) {
                    config = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8'));
                }
            } catch (e) {}

            if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
            config[interaction.guild.id][type] = channel.id;

            fs.writeFileSync(serverConfigFile, JSON.stringify(config, null, 2));

            const typeName = type === 'logChannel' ? 'Log Channel' : 'TTS Channel';
            await interaction.reply({ content: `✅ **${typeName}** has been set to ${channel}.` });

        } else if (subcommand === 'bot') {
            // --- Bot Toggle Logic ---
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to use this command.', ephemeral: true });
            }
            
            const speak = interaction.options.getBoolean('speak');

            let config = {};
            try {
                if (fs.existsSync(serverConfigFile)) {
                    config = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8'));
                }
            } catch (e) {}

            if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
            config[interaction.guild.id].ignoreBots = !speak; // If speak is true, ignoreBots is false

            fs.writeFileSync(serverConfigFile, JSON.stringify(config, null, 2));

            await interaction.reply({ content: `✅ Bot messages will now be **${speak ? 'SPOKEN' : 'IGNORED'}**.` });

        } else if (subcommand === 'star_url') {
            // --- STAR URL Logic ---
            const target = interaction.options.getString('target');
            const url = interaction.options.getString('url');
            
            if (target === 'server' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to set the Server STAR URL.', ephemeral: true });
            }

            // Basic validation
            if (!url.startsWith('http')) {
                return interaction.reply({ content: '❌ Invalid URL. Please include http:// or https://', ephemeral: true });
            }

            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(ttsSettingsFile)) {
                    settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8'));
                }
            } catch (e) {}

            if (target === 'user') {
                if (!settings.users[interaction.user.id]) settings.users[interaction.user.id] = {};
                settings.users[interaction.user.id].starUrl = url;
                settings.users[interaction.user.id].mode = 'star';
                await interaction.reply({ content: `✅ Your **STAR URL** has been set to: \`${url}\`\n✅ Provider switched to **STAR**.` });
            } else {
                if (!settings.servers[interaction.guild.id]) settings.servers[interaction.guild.id] = {};
                settings.servers[interaction.guild.id].starUrl = url;
                settings.servers[interaction.guild.id].mode = 'star';
                await interaction.reply({ content: `✅ **Server Default STAR URL** has been set to: \`${url}\`\n✅ Server Default Provider switched to **STAR**.` });
            }

            fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));

        } else if (subcommand === 'mode') {
            // --- Mode Logic ---
            const target = interaction.options.getString('target');
            const provider = interaction.options.getString('provider');

            if (target === 'server' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to set Server Default.', ephemeral: true });
            }

            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(ttsSettingsFile)) {
                    settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8'));
                }
            } catch (e) {}

            if (target === 'user') {
                if (!settings.users[interaction.user.id]) settings.users[interaction.user.id] = {};
                // If it was string (old format), convert to object
                if (typeof settings.users[interaction.user.id] === 'string') {
                    settings.users[interaction.user.id] = { voice: settings.users[interaction.user.id] };
                }
                settings.users[interaction.user.id].mode = provider;
                const providerMap = { 'google': 'Google Translate', 'piper': 'Piper', 'espeak': 'eSpeak-ng', 'rhvoice': 'RHVoice', 'star': 'STAR (Distributed)' };
                const providerName = providerMap[provider] || provider;
                await interaction.reply({ content: `✅ Your TTS Provider is now: **${providerName}**` });
            } else {
                if (!settings.servers[interaction.guild.id]) settings.servers[interaction.guild.id] = {};
                if (typeof settings.servers[interaction.guild.id] === 'string') {
                    settings.servers[interaction.guild.id] = { voice: settings.servers[interaction.guild.id] };
                }
                settings.servers[interaction.guild.id].mode = provider;
                const providerMap = { 'google': 'Google Translate', 'piper': 'Piper', 'espeak': 'eSpeak-ng', 'rhvoice': 'RHVoice', 'star': 'STAR (Distributed)' };
                const providerName = providerMap[provider] || provider;
                await interaction.reply({ content: `✅ Server Default TTS Provider is now: **${providerName}**` });
            }

            fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));

        } else if (subcommand === 'voice') {
            // --- Voice Logic ---
            const target = interaction.options.getString('target');
            const selectedVoiceKey = interaction.options.getString('voice');

            if (target === 'server' && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to set the Server Default voice.', ephemeral: true });
            }

            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(ttsSettingsFile)) {
                    settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8'));
                }
            } catch (e) {}

            if (target === 'user') {
                if (!settings.users[interaction.user.id]) settings.users[interaction.user.id] = {};
                if (typeof settings.users[interaction.user.id] === 'string') {
                    settings.users[interaction.user.id] = { voice: settings.users[interaction.user.id] };
                }
                settings.users[interaction.user.id].voice = selectedVoiceKey;
                
                await interaction.reply({ content: `✅ Your personal TTS voice has been set.` });
            } else {
                if (!settings.servers[interaction.guild.id]) settings.servers[interaction.guild.id] = {};
                if (typeof settings.servers[interaction.guild.id] === 'string') {
                    settings.servers[interaction.guild.id] = { voice: settings.servers[interaction.guild.id] };
                }
                settings.servers[interaction.guild.id].voice = selectedVoiceKey;
                await interaction.reply({ content: `✅ Server default TTS voice has been set.` });
            }

            fs.writeFileSync(ttsSettingsFile, JSON.stringify(settings, null, 2));
        }
    },
};
