const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');

const ticketDataPath = path.join(__dirname, '../data/tickets.json');

// Ensure ticket data file exists
async function ensureTicketData() {
    try {
        await fs.ensureFile(ticketDataPath);
        const data = await fs.readJson(ticketDataPath).catch(() => ({}));
        return data;
    } catch (error) {
        return {};
    }
}

// Save ticket data
async function saveTicketData(data) {
    await fs.writeJson(ticketDataPath, data, { spaces: 2 });
}

module.exports = {
    // Handle ticket creation button
    async handleTicketButton(interaction) {
        if (interaction.customId === 'ticket_create') {
            await this.createTicket(interaction);
        } else if (interaction.customId === 'ticket_close') {
            await this.closeTicket(interaction);
        }
    },

    // Create a new ticket
    async createTicket(interaction) {
        const guild = interaction.guild;
        const member = interaction.member;
        
        // Check if user already has an open ticket
        const ticketData = await ensureTicketData();
        const existingTicket = Object.values(ticketData).find(ticket => 
            ticket.userId === member.id && ticket.status === 'open'
        );
        
        if (existingTicket) {
            return await interaction.reply({
                content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`,
                ephemeral: true
            });
        }
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            // Get ticket category
            const category = guild.channels.cache.get(process.env.TICKET_CATEGORY_ID);
            if (!category) {
                return await interaction.editReply({
                    content: '❌ Ticket category not found! Please contact an administrator.',
                });
            }
            
            // Create ticket channel
            const ticketChannel = await guild.channels.create({
                name: `ticket-${member.user.username}-${Date.now().toString().slice(-4)}`,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: member.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                        ],
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageChannels,
                        ],
                    },
                ],
            });
            
            // Add moderator role permissions if configured
            if (process.env.MOD_ROLE_ID) {
                await ticketChannel.permissionOverwrites.create(process.env.MOD_ROLE_ID, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                });
            }
            
            // Create ticket embed and controls
            const ticketEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎫 Support Ticket')
                .setDescription(`Hello ${member}! Please describe your issue and a staff member will assist you shortly.`)
                .addFields(
                    { name: '📋 Ticket Information', value: `**Created by:** ${member.user.tag}\n**Created at:** <t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                    { name: '❓ Need Help?', value: 'Please provide as much detail as possible about your issue.', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Support` });
            
            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            await ticketChannel.send({
                content: `${member} Welcome to your support ticket!`,
                embeds: [ticketEmbed],
                components: [closeButton]
            });
            
            // Save ticket data
            const ticketId = `ticket_${Date.now()}`;
            ticketData[ticketId] = {
                channelId: ticketChannel.id,
                userId: member.id,
                createdAt: Date.now(),
                status: 'open'
            };
            await saveTicketData(ticketData);
            
            await interaction.editReply({
                content: `✅ Ticket created successfully! Please check ${ticketChannel}`,
            });
            
        } catch (error) {
            console.error('Error creating ticket:', error);
            await interaction.editReply({
                content: '❌ An error occurred while creating your ticket. Please try again later.',
            });
        }
    },

    // Close a ticket
    async closeTicket(interaction) {
        const channel = interaction.channel;
        
        // Check if this is a ticket channel
        const ticketData = await ensureTicketData();
        const ticket = Object.entries(ticketData).find(([id, data]) => 
            data.channelId === channel.id && data.status === 'open'
        );
        
        if (!ticket) {
            return await interaction.reply({
                content: '❌ This is not a valid ticket channel!',
                ephemeral: true
            });
        }
        
        // Check permissions
        const member = interaction.member;
        const isTicketOwner = ticket[1].userId === member.id;
        const hasModerationPerms = member.permissions.has(PermissionFlagsBits.ManageChannels) || 
                                  (process.env.MOD_ROLE_ID && member.roles.cache.has(process.env.MOD_ROLE_ID));
        
        if (!isTicketOwner && !hasModerationPerms) {
            return await interaction.reply({
                content: '❌ You do not have permission to close this ticket!',
                ephemeral: true
            });
        }
        
        await interaction.reply('🔒 Closing ticket in 5 seconds...');
        
        // Update ticket status
        ticketData[ticket[0]].status = 'closed';
        ticketData[ticket[0]].closedAt = Date.now();
        ticketData[ticket[0]].closedBy = member.id;
        await saveTicketData(ticketData);
        
        // Delete channel after delay
        setTimeout(async () => {
            try {
                await channel.delete();
            } catch (error) {
                console.error('Error deleting ticket channel:', error);
            }
        }, 5000);
    },

    // Setup ticket system
    async setupTicketSystem(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎫 Create a Support Ticket')
            .setDescription(`Need help with ${process.env.PROJECT_NAME || 'HyprL'}? Click the button below to create a support ticket!`)
            .addFields(
                { name: '📝 What to include:', value: '• Detailed description of your issue\n• Steps you\'ve already tried\n• Screenshots (if applicable)', inline: false },
                { name: '⏱️ Response Time:', value: 'We typically respond within 24 hours', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Support System` });

        const createButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_create')
                    .setLabel('Create Ticket')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫')
            );

        await interaction.reply({
            embeds: [embed],
            components: [createButton]
        });
    }
};
