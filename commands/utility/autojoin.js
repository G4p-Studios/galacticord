const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '../../data/server_config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autojoin')
        .setDescription('Toggle auto-joining voice channels for TTS')
        .addBooleanOption(option => 
            option.setName('enabled')
                .setDescription('Enable or disable auto-join')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(interaction) {
        const enabled = interaction.options.getBoolean('enabled');

        let config = {};
        try {
            if (fs.existsSync(configFile)) {
                config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
        } catch (e) { console.error(e); }

        if (!config[interaction.guild.id]) config[interaction.guild.id] = {};
        
        config[interaction.guild.id].autoJoin = enabled;

        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

        await interaction.reply({ 
            content: `✅ Auto-join for TTS has been **${enabled ? 'ENABLED' : 'DISABLED'}**.`, 
            flags: MessageFlags.Ephemeral 
        });
    },
};
