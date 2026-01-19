const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const socialsFile = path.join(__dirname, '../../data/socials.json');
const parser = new Parser();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addyoutube')
        .setDescription('Add a YouTube channel to notify')
        .addStringOption(option => 
            option.setName('channel_id')
                .setDescription('The YouTube Channel ID (starts with UC...)')
                .setRequired(true))
        .addChannelOption(option => 
            option.setName('target_channel')
                .setDescription('Where to post notifications')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageWebhooks),
    async execute(interaction) {
        await interaction.deferReply();
        
        const ytChannelId = interaction.options.getString('channel_id');
        const targetChannel = interaction.options.getChannel('target_channel');

        // Verify channel exists
        try {
            const feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${ytChannelId}`);
            
            let subscriptions = [];
            if (fs.existsSync(socialsFile)) {
                subscriptions = JSON.parse(fs.readFileSync(socialsFile, 'utf8'));
            }

            // Check if already added
            if (subscriptions.find(s => s.youtubeChannelId === ytChannelId && s.discordChannelId === targetChannel.id)) {
                return interaction.editReply('This YouTube channel is already being tracked in that channel.');
            }

            subscriptions.push({
                youtubeChannelId: ytChannelId,
                discordChannelId: targetChannel.id,
                lastVideoId: feed.items.length > 0 ? feed.items[0].id : null
            });

            fs.writeFileSync(socialsFile, JSON.stringify(subscriptions, null, 2));

            await interaction.editReply(`Successfully added **${feed.title}** to notifications in ${targetChannel}.`);

        } catch (error) {
            await interaction.editReply('Invalid YouTube Channel ID or unable to fetch feed. Make sure it starts with "UC".');
        }
    },
};
