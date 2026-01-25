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
                            { name: 'Microsoft Edge (High Quality, Many Voices)', value: 'edge' },
                            { name: 'Piper (High Quality Local TTS)', value: 'piper' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('botignore')
                .setDescription('Set whether to ignore messages from other bots for TTS.')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('True to ignore bots (default), False to speak bot messages.')
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

        // Default to Google if not set
        let mode = 'google';
        if (target === 'user') {
            mode = settings.users[interaction.user.id]?.mode || settings.servers[interaction.guild.id]?.mode || 'google';
        } else {
            mode = settings.servers[interaction.guild.id]?.mode || 'google';
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
        } else if (mode === 'edge') {
            const voices = getEdgeVoices();
            choices = voices.map(v => {
                const fullName = `${v.FriendlyName} (${v.ShortName})`;
                return {
                    name: fullName.length > 100 ? fullName.substring(0, 97) + '...' : fullName,
                    value: v.ShortName
                };
            });
        } else if (mode === 'piper') {
            const modelsDir = path.join(__dirname, '../../models');
            if (fs.existsSync(modelsDir)) {
                const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('.onnx'));
                choices = files.map(f => ({
                    name: f,
                    value: path.join('models', f)
                }));
            }
            // Always allow manual path entry if nothing found or to complement
            if (focusedValue.includes('/') || focusedValue.includes('\\')) {
                choices.push({ name: `Custom Path: ${focusedValue}`, value: focusedValue });
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

        } else if (subcommand === 'botignore') {
            // --- Bot Ignore Logic ---
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: 'You need Manage Guild permissions to use this command.', ephemeral: true });
            }
            
            const enabled = interaction.options.getBoolean('enabled');

            let config = {};
            try {
                if (fs.existsSync(serverConfigFile)) {
                    config = JSON.parse(fs.readFileSync(serverConfigFile, 'utf8'));
                }
            } catch (e) {}

            if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
            config[interaction.guild.id].ignoreBots = enabled;

            fs.writeFileSync(serverConfigFile, JSON.stringify(config, null, 2));

            await interaction.reply({ content: `✅ Bot message ignoring is now **${enabled ? 'ENABLED' : 'DISABLED'}**.` });

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
                const providerName = provider === 'google' ? 'Google Translate' : (provider === 'edge' ? 'Microsoft Edge' : 'Piper');
                await interaction.reply({ content: `✅ Your TTS Provider is now: **${providerName}**` });
            } else {
                if (!settings.servers[interaction.guild.id]) settings.servers[interaction.guild.id] = {};
                if (typeof settings.servers[interaction.guild.id] === 'string') {
                    settings.servers[interaction.guild.id] = { voice: settings.servers[interaction.guild.id] };
                }
                settings.servers[interaction.guild.id].mode = provider;
                const providerName = provider === 'google' ? 'Google Translate' : (provider === 'edge' ? 'Microsoft Edge' : 'Piper');
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
