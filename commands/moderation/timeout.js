const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member.')
        .addUserOption(option => option.setName('target').setDescription('The member to timeout').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('Reason for timeout'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction) {
        const target = interaction.options.getMember('target');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!target) {
            return interaction.reply({ content: 'Member not found.', ephemeral: true });
        }

        if (!target.moderatable) {
            return interaction.reply({ content: 'I cannot timeout this user.', ephemeral: true });
        }

        await target.timeout(duration * 60 * 1000, reason);
        await interaction.reply(`User ${target.user.tag} was timed out for ${duration} minutes. Reason: ${reason}`);
    },
};
