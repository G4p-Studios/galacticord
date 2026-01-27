const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getAudioStream } = require('../../utils/ttsProvider');
const fs = require('fs');
const path = require('path');

const ttsSettingsFile = path.join(__dirname, '../../data/tts_settings.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('startts')
        .setDescription('Generate an audio file using your configured STAR TTS server')
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to speak')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const text = interaction.options.getString('text');

        // Load Settings to get user's STAR config
        let settings = { users: {}, servers: {} };
        try {
            if (fs.existsSync(ttsSettingsFile)) {
                settings = JSON.parse(fs.readFileSync(ttsSettingsFile, 'utf8'));
            }
        } catch (e) {
            console.error(e);
        }

        const userSetting = settings.users[interaction.user.id] || {};
        const serverSetting = settings.servers[interaction.guild.id] || {};

        const defaultStarUrl = 'https://speech.seedy.cc';
        const starUrl = userSetting.starUrl || serverSetting.starUrl || defaultStarUrl;
        const voiceKey = userSetting.voice || serverSetting.voice || 'default';

        try {
            // Bundle STAR config into voiceKey JSON string as expected by ttsProvider
            const configPayload = JSON.stringify({
                url: starUrl,
                voice: voiceKey
            });

            const stream = await getAudioStream(text, 'star', configPayload);
            
            // Create a temporary file path
            const tempFile = path.join(__dirname, `../../temp_star_${interaction.user.id}.wav`);
            const writeStream = fs.createWriteStream(tempFile);

            stream.pipe(writeStream);

            writeStream.on('finish', async () => {
                const attachment = new AttachmentBuilder(tempFile, { name: 'star_tts.wav' });
                await interaction.editReply({
                    content: `✅ STAR TTS generated for: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"\n**Voice:** 
${voiceKey}
**Server:** 
${starUrl}`,
                    files: [attachment]
                });

                // Cleanup
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
            });

            writeStream.on('error', (err) => {
                console.error(err);
                interaction.editReply('Failed to write audio file.');
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Failed to generate STAR TTS: ${error.message}`);
        }
    },
};