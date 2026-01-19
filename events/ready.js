const { Events, ActivityType } = require('discord.js');
const { checkSocials } = require('../utils/socialCheck');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Galacticord is Ready! Logged in as ${client.user.tag}`);
        
        client.user.setActivity('Serving the Galaxy', { type: ActivityType.Listening });

        // Check immediately then every 5 minutes
        checkSocials(client);
        setInterval(() => checkSocials(client), 5 * 60 * 1000);
    },
};
