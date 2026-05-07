const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getPlayer, getQueueLength, isGuildPlayingTTS } = require('../../utils/audioQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voicedebug')
        .setDescription('Debug the current voice and TTS engine state.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const player = getPlayer(interaction.guild.id);
        const queueLen = getQueueLength(interaction.guild.id);
        const isPlaying = isGuildPlayingTTS(interaction.guild.id);

        let status = 'Unknown';
        if (player) {
            status = player.state.status;
        }

        const report = [
            `**Voice Engine Debug Report**`,
            `• **Player Status:** \`${status}\``,
            `• **Is TTS Playing:** \`${isPlaying}\``,
            `• **Queue Length:** \`${queueLen} messages waiting\``,
            `• **Guild ID:** \`${interaction.guild.id}\``,
            `\n*If the player is stuck in 'Playing' but silent, try using \`/silence\` to reset.*`
        ].join('\n');

        await interaction.reply({ content: report, ephemeral: true });
    },
};
