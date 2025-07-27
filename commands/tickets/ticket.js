const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const ticketHandler = require('../../handlers/ticketHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage the ticket system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Setup the ticket system in this channel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Close the current ticket'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new support ticket')),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
        case 'setup':
            // Check permissions for setup
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await interaction.reply({
                    content: '❌ You need the "Manage Channels" permission to setup the ticket system!',
                    flags: MessageFlags.Ephemeral
                });
            }
            await ticketHandler.setupTicketSystem(interaction);
            break;
                
        case 'close':
            await ticketHandler.closeTicket(interaction);
            break;
                
        case 'create':
            await ticketHandler.createTicket(interaction);
            break;
                
        default:
            await interaction.reply({
                content: '❌ Invalid subcommand!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
