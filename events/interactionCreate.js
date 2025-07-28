const { InteractionType, MessageFlags } = require('discord.js');
const db = require('../utils/database');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Ensure user and guild are in the database before anything else
        try {
            if (interaction.guild) {
                await db.createOrUpdateGuild(interaction.guild.id, interaction.guild.name);
            }
            await db.createOrUpdateUser(interaction.user.id, interaction.user.username, interaction.user.discriminator);
        } catch (dbError) {
            logger.error('Failed to update guild/user in DB on interaction', { error: dbError });
            // Decide if you want to stop execution if the DB fails. For now, we'll let it continue.
        }

        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    logger.error(`No command matching ${interaction.commandName} was found.`);
                    return;
                }
                await command.execute(interaction);
                await db.logCommand(interaction.commandName, interaction.user.id, interaction.guildId, null, true);
                await db.incrementUserCommands(interaction.user.id);
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
            // Log failed command execution
            if (interaction.isChatInputCommand()) {
                await db.logCommand(interaction.commandName, interaction.user.id, interaction.guildId, null, false);
            }
await errorHandler.handleCommandError(error, interaction);
        }
    },
};
