module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('Error executing command:', error);
                const errorMessage = { 
                    content: '❌ There was an error while executing this command!', 
                    flags: MessageFlags.Ephemeral 
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }
        
        // Handle button interactions (for tickets, music controls, etc.)
        else if (interaction.isButton()) {
            const { customId } = interaction;
            
            // Ticket system buttons
            if (customId.startsWith('ticket_')) {
                const ticketHandler = require('../handlers/ticketHandler');
                await ticketHandler.handleTicketButton(interaction);
            }
            
            // Music control buttons
            else if (customId.startsWith('music_')) {
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
    },
};
