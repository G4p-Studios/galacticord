const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configFile = path.join(__dirname, '../../data/server_config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autojoin')
        .setDescription('Configure the bot to automatically join your Voice Channel when you chat in the TTS channel.')
        .addBooleanOption(option => 
            option.setName('enabled')
                .setDescription('True to enable auto-joining, False to disable.')
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
