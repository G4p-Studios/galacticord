const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join your voice channel (required for TTS)'),
    async execute(interaction) {
        if (!interaction.member.voice.channel) {
            return interaction.reply({ 
                content: 'You need to be in a voice channel first!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        try {
            joinVoiceChannel({
                channelId: interaction.member.voice.channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            await interaction.reply({ content: `Joined **${interaction.member.voice.channel.name}**! I am now listening for TTS messages.`, flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Failed to join voice channel.', flags: MessageFlags.Ephemeral });
        }
    },
};
