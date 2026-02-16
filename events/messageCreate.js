const { Events } = require('discord.js');
const { getVoiceConnection, joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const { getAudioResource } = require('../utils/ttsProvider');
const { addToQueue } = require('../utils/audioQueue');

const settingsFile = path.join(__dirname, '../data/tts_settings.json');
const configFile = path.join(__dirname, '../data/server_config.json');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // We keep this one for basic entry check
        // console.log(`[MessageCreate Debug] Received message from ${message.author.tag} in #${message.channel.name}`);
        
        if (!message.guild) return;

        // Prefix command handling (Only for non-bots)
        const prefix = 'mal!';
        if (!message.author.bot && message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();

            if (commandName === 'ping') {
                const start = Date.now();
                const sent = await message.reply('Pinging...');
                const end = Date.now();
                const latency = end - start;
                return sent.edit(`Pong! Latency: ${latency}ms (API Latency: ${Math.round(message.client.ws.ping)}ms)`);
            }

            if (commandName === 'help') {
                const helpText = `**Galacticord Help (mal! prefix)**\n` +
                    `- \`mal!ping\`: Check bot latency.\n` +
                    `- \`mal!help\`: Show this help message.\n\n` +
                    `**Owner Only Commands:**\n` +
                    `- \`mal!serverslist\`: List all servers the bot is in.\n` +
                    `- \`mal!shutdown\`: Power off the bot.\n` +
                    `- \`mal!restart\`: Restart the bot.\n` +
                    `- \`mal!freshpull\`: Pull the latest code from GitHub.`;
                return message.reply(helpText);
            }

            // Owner Only Commands
            const ownerId = '1365401272798281850';
            if (message.author.id === ownerId) {
                if (commandName === 'serverslist') {
                    const guilds = message.client.guilds.cache.map(g => `${g.name} (${g.id})`).join('\n');
                    return message.reply(`**Servers List:**\n${guilds || 'No servers found.'}`);
                }

                if (commandName === 'shutdown') {
                    await message.reply('Shutting down...');
                    process.exit();
                }

                if (commandName === 'restart') {
                    await message.reply('Restarting...');
                    // In a production environment with PM2 or a similar process manager, 
                    // exiting will trigger an automatic restart.
                    process.exit();
                }

                if (commandName === 'freshpull') {
                    await message.reply('Pulling latest updates from GitHub...');
                    const { exec } = require('child_process');
                    exec('git pull origin main', (err, stdout, stderr) => {
                        if (err) return message.reply(`Error: ${err.message}`);
                        message.reply(`**Git Pull Success:**\n\`\`\`\n${stdout}\`\`\``);
                    });
                }
            }
        }

        // Load Server Config
        let config = {};
        try {
            if (fs.existsSync(configFile)) {
                config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
            }
        } catch (e) {
             // If config is broken, we can't proceed.
             return console.error(`[FATAL] Could not parse server_config.json: ${e.message}`);
        }

        const serverConfig = config[message.guild.id] || {};

        // Bot Ignore Logic
        const ignoreBots = serverConfig.ignoreBots !== false; // Default to true if not set
        if (message.author.bot && ignoreBots) {
            return; // Silently ignore
        }

        const ttsChannelId = serverConfig.ttsChannel;
        const autoJoin = serverConfig.autoJoin || false;
        
        // Check if message is in TTS Channel OR in the user's current Voice Chat
        const isTTSChannel = ttsChannelId && message.channel.id === ttsChannelId;
        const isVoiceChat = message.member?.voice?.channel && message.channel.id === message.member.voice.channel.id;

        if (!isTTSChannel && !isVoiceChat) return; 

        let connection = getVoiceConnection(message.guild.id);

        // If the sender is a bot, they won't be in a VC. 
        // We should check if we are already in a VC, or if there's someone else we can join.
        let targetChannel = message.member?.voice?.channel;

        if (message.author.bot && !targetChannel) {
            // If we're already connected, just use that.
            if (connection) {
                // Stay where we are
            } else {
                // If not connected, we can't really "follow" a bot. 
                // We'll skip unless we are already there or have a specific channel to join.
                return;
            }
        } else if (!targetChannel) {
            // Non-bot but not in VC
            return;
        }

        // If not connected, only join if autoJoin is enabled
        if (!connection && targetChannel) {
            if (autoJoin) {
                try {
                    connection = joinVoiceChannel({
                        channelId: targetChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });
                    console.log(`[AutoJoin] Automatically joined VC: ${targetChannel.name} for user: ${message.author.tag}`);
                    
                    connection.on('stateChange', (oldState, newState) => {
                        console.log(`[VoiceConnection AutoJoin] State changed from ${oldState.status} to ${newState.status}`);
                    });
        
                    connection.on('error', (error) => {
                        console.error(`[VoiceConnection AutoJoin Error] ${error.message}`);
                    });
                } catch (error) {
                    console.error("Failed to auto-join VC:", error);
                    return;
                }
            } else {
                return;
            }
        }

        try {
            // Determine Settings
            let settings = { users: {}, servers: {} };
            try {
                if (fs.existsSync(settingsFile)) {
                    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
                }
            } catch (e) {
                console.error(`[MessageCreate Debug] Error reading TTS settings file: ${e.message}`);
            }

            const userSetting = settings.users[message.author.id];
            const serverSetting = settings.servers[message.guild.id];

            const getProp = (setting, prop) => {
                if (!setting) return null;
                if (typeof setting === 'string' && prop === 'voice') return setting;
                if (typeof setting === 'object') return setting[prop];
                return null;
            };

            const userMode = getProp(userSetting, 'mode');
            const serverMode = getProp(serverSetting, 'mode');
            const mode = userMode || serverMode || 'piper';

            const userVoice = getProp(userSetting, 'voice');
            const serverVoice = getProp(serverSetting, 'voice');
            
            let defaultVoice = 'en-US';
            if (mode === 'piper') defaultVoice = 'models/en_US-amy-medium.onnx';

            let voiceKey = userVoice || serverVoice || defaultVoice;

            // SPECIAL HANDLING FOR STAR
            if (mode === 'star') {
                const defaultStarUrl = 'https://speech.seedy.cc';
                const starUrl = userSetting?.starUrl || serverSetting?.starUrl || defaultStarUrl;
                
                // Pack URL and Voice into the key for ttsProvider to unpack
                voiceKey = JSON.stringify({
                    url: starUrl,
                    voice: voiceKey
                });
            }

            console.log(`[MessageCreate Debug] Determined Mode: ${mode}, VoiceKey: ${mode === 'star' ? '(Hidden JSON)' : voiceKey}`);

            // --- Link Preview / URL Cleaning Logic ---
            // We wait a moment because Discord takes 1-2 seconds to generate embeds (link previews)
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Fetch the message again to get updated embeds
            const updatedMessage = await message.channel.messages.fetch(message.id).catch(() => message);

            let cleanContent = updatedMessage.content;
            
            // Regex to find URLs
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = cleanContent.match(urlRegex);

            if (urls) {
                for (const url of urls) {
                    let replacement = "a link";
                    try {
                        const urlObj = new URL(url);
                        const domain = urlObj.hostname.replace('www.', '');
                        
                        // Check if Discord generated an embed for this URL
                        const embed = updatedMessage.embeds.find(e => e.url === url || (e.data && e.data.url === url));
                        
                        if (embed && (embed.title || embed.description)) {
                            const title = embed.title || (embed.description ? embed.description.substring(0, 50) + "..." : "");
                            replacement = `a link to ${title} on ${domain}`;
                        } else {
                            replacement = `a link to ${domain}`;
                        }
                    } catch (e) {
                        replacement = "a link";
                    }
                    cleanContent = cleanContent.replace(url, replacement);
                }
            }

            // Replace user mentions <@ID> or <@!ID>
            const userMentionRegex = /<@!?(\d+)>/g;
            let match;
            while ((match = userMentionRegex.exec(cleanContent)) !== null) {
                const userId = match[1];
                const member = message.guild.members.cache.get(userId);
                const replacement = member ? member.displayName : "someone";
                cleanContent = cleanContent.replace(match[0], replacement);
            }

            // Replace channel mentions <#ID>
            const channelMentionRegex = /<#(\d+)>/g;
            while ((match = channelMentionRegex.exec(cleanContent)) !== null) {
                const channelId = match[1];
                const channel = message.guild.channels.cache.get(channelId);
                const replacement = channel ? channel.name : "a channel";
                cleanContent = cleanContent.replace(match[0], replacement);
            }

            // Get Resource from Provider
            const textToSpeak = `${message.member?.displayName || message.author.username} said: ${cleanContent}`;
            const resource = await getAudioResource(textToSpeak, mode, voiceKey);

            // Add to the shared queue
            addToQueue(message.guild.id, resource, connection);

        } catch (error) {
            console.error('[MessageCreate Debug] Uncaught TTS Error:', error);
        }
    },
};
