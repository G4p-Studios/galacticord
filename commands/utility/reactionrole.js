const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const rrFile = path.join(__dirname, '../../data/reaction_roles.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Create a reaction role message')
        .addRoleOption(option => option.setName('role').setDescription('The role to give').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('Description of the role').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    async execute(interaction) {
        const role = interaction.options.getRole('role');
        const description = interaction.options.getString('description');

        const embed = new EmbedBuilder()
            .setTitle('Reaction Role')
            .setDescription(description)
            .setColor(0x0099FF);

        const button = new ButtonBuilder()
            .setCustomId(`rr_${role.id}`)
            .setLabel(role.name)
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        // Save mapping
        let data = {};
        try {
            if (fs.existsSync(rrFile)) {
                data = JSON.parse(fs.readFileSync(rrFile, 'utf8'));
            }
        } catch (e) {}

        data[`rr_${role.id}`] = role.id;
        fs.writeFileSync(rrFile, JSON.stringify(data, null, 2));
    },
};
