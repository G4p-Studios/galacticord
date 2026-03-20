const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { playSoundFile } = require('../../utils/audioQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pfile')
        .setDescription('Play a sound file in your voice channel')
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('The sound file to play (mp3, wav, ogg, flac, etc.)')
                .setRequired(true)),
    async execute(interaction) {
        const channel = interaction.member.voice.channel;
        if (!channel) {
            return interaction.reply({
                content: 'You need to be in a voice channel first!',
                flags: MessageFlags.Ephemeral
            });
        }

        const attachment = interaction.options.getAttachment('file');
        const contentType = attachment.contentType || '';
        if (!contentType.startsWith('audio/') && !contentType.startsWith('video/')) {
            const ext = attachment.name.split('.').pop().toLowerCase();
            const allowedExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'webm', 'mp4'];
            if (!allowedExts.includes(ext)) {
                return interaction.reply({
                    content: 'Please upload a valid audio file (mp3, wav, ogg, flac, aac, m4a, opus, etc.).',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        await interaction.deferReply();

        try {
            const connection = getVoiceConnection(interaction.guild.id) || joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                daveEncryption: true,
            });

            // Download to temp file so we can seek into it for mixing
            const tmpFile = path.join(os.tmpdir(), `pfile_${interaction.guild.id}_${Date.now()}${path.extname(attachment.name)}`);
            await downloadFile(attachment.url, tmpFile);

            playSoundFile(interaction.guild.id, tmpFile, connection);
            await interaction.editReply(`Playing **${attachment.name}**...`);

        } catch (error) {
            console.error('[pfile] Error:', error);
            await interaction.editReply('Failed to play the audio file.');
        }
    },
};

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const fetcher = url.startsWith('https') ? https : http;
        fetcher.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            const file = fs.createWriteStream(dest);
            response.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
        }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    });
}
