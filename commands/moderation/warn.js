const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const warningsFile = path.join(__dirname, '../../data/warnings.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to warn')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('reason')
                .setDescription('The reason for the warning')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason');

        let warnings = {};
        try {
            if (fs.existsSync(warningsFile)) {
                const data = fs.readFileSync(warningsFile, 'utf8');
                warnings = JSON.parse(data);
            }
        } catch (err) {
            console.error(err);
        }

        if (!warnings[interaction.guild.id]) warnings[interaction.guild.id] = {};
        if (!warnings[interaction.guild.id][target.id]) warnings[interaction.guild.id][target.id] = [];

        warnings[interaction.guild.id][target.id].push({
            reason: reason,
            moderator: interaction.user.id,
            date: new Date().toISOString()
        });

        fs.writeFileSync(warningsFile, JSON.stringify(warnings, null, 2));

        await interaction.reply({ content: `⚠️ **Warned** ${target.tag} for: ${reason}`, ephemeral: false });
        
        // DM the user if possible
        try {
            await target.send(`You have been warned in **${interaction.guild.name}** for: ${reason}`);
        } catch (e) {
            // Cannot DM user
        }
    },
};
