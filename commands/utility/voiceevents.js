const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '../../data/server_config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voiceevents')
        .setDescription('Toggle voice state announcements (joining, muting, etc.)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of event to toggle')
                .setRequired(true)
                .addChoices(
                    { name: 'All Events', value: 'all' },
                    { name: 'Join/Leave', value: 'joinLeave' },
                    { name: 'Mute/Unmute', value: 'mute' },
                    { name: 'Deafen/Undeafen', value: 'deafen' },
                    { name: 'Streaming', value: 'streaming' }
                ))
        .addBooleanOption(option =>
            option.setName('enabled')
                .setDescription('Whether this event type should be announced')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const type = interaction.options.getString('type');
        const enabled = interaction.options.getBoolean('enabled');
        const guildId = interaction.guild.id;

        let config = {};
        try {
            if (fs.existsSync(configFile)) {
                config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
        } catch (e) {}

        if (!config[guildId]) config[guildId] = {};
        if (!config[guildId].voiceEvents) config[guildId].voiceEvents = {
            joinLeave: true,
            mute: true,
            deafen: true,
            streaming: true
        };

        if (type === 'all') {
            config[guildId].voiceEvents.joinLeave = enabled;
            config[guildId].voiceEvents.mute = enabled;
            config[guildId].voiceEvents.deafen = enabled;
            config[guildId].voiceEvents.streaming = enabled;
        } else {
            config[guildId].voiceEvents[type] = enabled;
        }

        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

        const typeLabels = {
            all: 'All Voice Events',
            joinLeave: 'Join/Leave Events',
            mute: 'Mute/Unmute Events',
            deafen: 'Deafen/Undeafen Events',
            streaming: 'Streaming Events'
        };

        await interaction.reply({
            content: `✅ **${typeLabels[type]}** have been **${enabled ? 'ENABLED' : 'DISABLED'}** for this server.`,
            flags: MessageFlags.Ephemeral
        });
    },
};
