const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const rrFile = path.join(__dirname, '../data/reaction_roles.json');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;

        if (!interaction.customId.startsWith('rr_')) return;

        let data = {};
        try {
            if (fs.existsSync(rrFile)) {
                data = JSON.parse(fs.readFileSync(rrFile, 'utf8'));
            }
        } catch (e) {}

        const roleId = data[interaction.customId];
        if (!roleId) return;

        const role = interaction.guild.roles.cache.get(roleId);
        if (!role) {
            return interaction.reply({ content: 'Role not found.', ephemeral: true });
        }

        const member = interaction.member;

        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(role);
            await interaction.reply({ content: `Removed role ${role.name}`, ephemeral: true });
        } else {
            await member.roles.add(role);
            await interaction.reply({ content: `Added role ${role.name}`, ephemeral: true });
        }
    },
};
