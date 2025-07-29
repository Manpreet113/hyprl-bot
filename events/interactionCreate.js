const { InteractionType, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        console.log(`[DEBUG] New interaction received: ${interaction.type} | Command: ${interaction.commandName}`);
        
        // Fire-and-forget database updates to avoid blocking the interaction response
        if (interaction.guild) {
            db.createOrUpdateGuild(interaction.guild.id, interaction.guild.name)
                .catch(dbError => logger.error('Background guild update failed', { error: dbError }));
        }
        db.createOrUpdateUser(interaction.user.id, interaction.user.username, interaction.user.discriminator)
            .catch(dbError => logger.error('Background user update failed', { error: dbError }));

        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    logger.error(`No command matching ${interaction.commandName} was found.`);
                    return;
                }
                await command.execute(interaction);
                
                // Fire-and-forget logging
                db.logCommand(interaction.commandName, interaction.user.id, interaction.guildId, null, true)
                    .catch(e => logger.error('Failed to log command success', {error: e}));
                db.incrementUserCommands(interaction.user.id)
                    .catch(e => logger.error('Failed to increment user commands', {error: e}));
            }
            // Handle button interactions
            else if (interaction.isButton()) {
                const { customId } = interaction;
                if (customId.startsWith('ticket_')) {
                    const ticketHandler = require('../handlers/ticketHandler');
                    await ticketHandler.handleTicketButton(interaction);
                } else if (customId.startsWith('music_')) {
                    const musicHandler = require('../handlers/musicHandler');
                    await musicHandler.handleMusicButton(interaction);
                }
            }
            // Handle select menu interactions
            else if (interaction.isStringSelectMenu()) {
                const { customId } = interaction;
                if (customId.startsWith('ticket_category_')) {
                    const ticketHandler = require('../handlers/ticketHandler');
                    await ticketHandler.handleTicketCategory(interaction);
                }
            }
        } catch (error) {
            // Log failed command execution (fire-and-forget)
            if (interaction.isChatInputCommand()) {
                db.logCommand(interaction.commandName, interaction.user.id, interaction.guildId, null, false)
                    .catch(e => logger.error('Failed to log command failure', {error: e}));
            }
            // Use the central error handler
            await errorHandler.handleCommandError(error, interaction);
        }
    },
};
