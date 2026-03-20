const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection, StreamType } = require('@discordjs/voice');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

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
            // Join the voice channel
            const existingConnection = getVoiceConnection(interaction.guild.id);
            const connection = existingConnection || joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                daveEncryption: true,
            });

            // Download and pipe through ffmpeg to normalize audio
            const fetcher = attachment.url.startsWith('https') ? https : http;
            fetcher.get(attachment.url, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectFetcher = response.headers.location.startsWith('https') ? https : http;
                    redirectFetcher.get(response.headers.location, (redirected) => {
                        playStream(redirected, connection, existingConnection, interaction, attachment.name);
                    }).on('error', (err) => {
                        console.error('[pfile] Redirect download error:', err);
                        interaction.editReply('Failed to download the audio file.');
                    });
                    return;
                }
                playStream(response, connection, existingConnection, interaction, attachment.name);
            }).on('error', (err) => {
                console.error('[pfile] Download error:', err);
                interaction.editReply('Failed to download the audio file.');
            });

        } catch (error) {
            console.error('[pfile] Error:', error);
            await interaction.editReply('Failed to play the audio file.');
        }
    },
};

function playStream(stream, connection, existingConnection, interaction, filename) {
    const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
    ]);

    stream.pipe(ffmpeg.stdin);

    stream.on('error', (err) => {
        console.error('[pfile] Stream error:', err);
        ffmpeg.stdin.end();
    });

    ffmpeg.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg.includes('Error') || msg.includes('failed') || msg.includes('Invalid')) {
            console.error(`[pfile FFmpeg] ${msg}`);
        }
    });

    ffmpeg.on('error', (err) => {
        console.error('[pfile] FFmpeg error:', err);
        interaction.editReply('Failed to process the audio file.');
    });

    const resource = createAudioResource(ffmpeg.stdout, {
        inputType: StreamType.Raw,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);
    player.play(resource);

    interaction.editReply(`Playing **${filename}**...`);

    player.on(AudioPlayerStatus.Idle, () => {
        player.stop();
        // Only disconnect if the bot wasn't already in the channel
        if (!existingConnection) {
            connection.destroy();
        }
    });

    player.on('error', (error) => {
        console.error('[pfile] Player error:', error.message);
        interaction.editReply(`Failed to play **${filename}**: ${error.message}`);
        if (!existingConnection) {
            connection.destroy();
        }
    });
}
