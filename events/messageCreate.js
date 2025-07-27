const { Events } = require('discord.js');
const automod = require('../utils/automod');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bot messages and system messages
        if (message.author.bot || message.system) return;

        // Ignore DMs (automod typically only works in servers)
        if (!message.guild) return;

        try {
            // Process message through automod system
            await automod.processMessage(message);
        } catch (error) {
            logger.error('Error in messageCreate automod processing:', error);
        }
    },
};
