const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Select a member and kick them.')
        .addUserOption(option => option.setName('target').setDescription('The member to kick').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the kick'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) {
            return interaction.reply({ content: 'Member not found.', ephemeral: true });
        }

        if (!target.kickable) {
            return interaction.reply({ content: 'I cannot kick this user. Check my role hierarchy.', ephemeral: true });
        }

        await target.kick(reason);
        await interaction.reply(`User ${target.user.tag} was kicked for: ${reason}`);
    },
};
