const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Select a member and ban them.')
        .addUserOption(option => option.setName('target').setDescription('The member to ban').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('The reason for the ban'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) {
            return interaction.reply({ content: 'Member not found.', ephemeral: true });
        }

        if (!target.bannable) {
            return interaction.reply({ content: 'I cannot ban this user. Check my role hierarchy.', ephemeral: true });
        }

        await target.ban({ reason: reason });
        await interaction.reply(`User ${target.user.tag} was banned for: ${reason}`);
    },
};
