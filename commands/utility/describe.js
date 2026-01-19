const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('describe')
        .setDescription('Describe an image using AI')
        .addAttachmentOption(option =>
            option.setName('image')
                .setDescription('The image to describe')
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply();

        const image = interaction.options.getAttachment('image');
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return interaction.editReply('Error: GEMINI_API_KEY is not configured in .env');
        }

        if (!image.contentType.startsWith('image/')) {
            return interaction.editReply('Please upload a valid image file.');
        }

        try {
            // Fetch the image
            const response = await axios.get(image.url, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data);

            // Initialize Gemini
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = "Describe this image in detail.";
            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: image.contentType,
                },
            };

            const result = await model.generateContent([prompt, imagePart]);
            const responseText = result.response.text();

            // Discord has a 2000 char limit, truncate if needed
            const description = responseText.length > 1900 ? responseText.substring(0, 1900) + '...' : responseText;

            await interaction.editReply(`**Image Description:**\n${description}`);

        } catch (error) {
            console.error(error);
            await interaction.editReply('Failed to process image. Please try again later.');
        }
    },
};
