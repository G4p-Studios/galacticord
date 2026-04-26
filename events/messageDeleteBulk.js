const { Events, EmbedBuilder, AuditLogEvent, AttachmentBuilder } = require('discord.js');
const { sendLog } = require('../utils/logger');
const { fetchLatestAuditLog } = require('../utils/auditLogUtil');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: Events.MessageBulkDelete,
    async execute(messages) {
        const firstMsg = messages.first();
        if (!firstMsg || !firstMsg.guild) return;

        const guild = firstMsg.guild;
        const channel = firstMsg.channel;

        // 1. Create the transcript content
        let transcript = `PURGE LOG - CHANNEL: #${channel.name} (${channel.id})\n`;
        transcript += `TIME: ${new Date().toUTCString()}\n`;
        transcript += `TOTAL MESSAGES: ${messages.size}\n`;
        transcript += `----------------------------------------------------\n\n`;

        // Reverse the collection so they appear in chronological order
        const sortedMessages = messages.reverse();
        
        sortedMessages.forEach(msg => {
            const time = msg.createdAt ? msg.createdAt.toISOString() : 'Unknown Time';
            const author = msg.author ? msg.author.tag : 'Unknown Author';
            const content = msg.content || '[No Text Content / Attachment]';
            transcript += `[${time}] ${author}: ${content}\n`;
        });

        // 2. Save to temporary file
        const tempPath = path.join(__dirname, `../../temp_purge_${channel.id}_${Date.now()}.txt`);
        fs.writeFileSync(tempPath, transcript);

        // 3. Prepare the Embed
        const embed = new EmbedBuilder()
            .setTitle('Messages Purged (Bulk Delete)')
            .setColor(0xFF0000)
            .setDescription(`**${messages.size}** messages were deleted in ${channel}. A full transcript is attached below.`)
            .setTimestamp();

        // Attempt to find the moderator who purged
        const entry = await fetchLatestAuditLog(guild, AuditLogEvent.MessageBulkDelete, channel.id);
        const executor = entry ? entry.executor.tag : 'Unknown / Bot';
        
        embed.addFields({ name: 'Purged By', value: executor });

        // 4. Send the log with attachment
        const attachment = new AttachmentBuilder(tempPath, { name: `purge_log_${channel.name}.txt` });

        try {
            // We use a custom send here because sendLog only takes an embed
            // I'll make sure it handles the attachment
            const configFile = path.join(__dirname, '../../data/server_config.json');
            let config = {};
            if (fs.existsSync(configFile)) {
                config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
            const logChannelId = config[guild.id]?.logChannel;
            const logChannel = logChannelId ? await guild.channels.fetch(logChannelId).catch(() => null) : null;

            if (logChannel) {
                await logChannel.send({ embeds: [embed], files: [attachment] });
            }
        } catch (error) {
            console.error('[PurgeLog] Error sending log:', error);
        }

        // 5. Cleanup the file immediately
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    },
};
