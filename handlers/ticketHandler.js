const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, MessageFlags, ThreadAutoArchiveDuration } = require('discord.js');
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
            ticket.userId === member.id && ticket.status === 'open' && guild.channels.cache.has(ticket.channelId)
        );
        
        if (existingTicket) {
            return await interaction.reply({
                content: `❌ You already have an open ticket: <#${existingTicket.channelId}>`,
                flags: MessageFlags.Ephemeral
            });
        }
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            // Find a suitable channel to create the thread in
            let parentChannel = guild.channels.cache.get(process.env.TICKET_PARENT_CHANNEL_ID);
            
            // If no parent channel is configured, use the current channel
            if (!parentChannel) {
                parentChannel = interaction.channel;
            }
            
            // Ensure the parent channel supports threads
            if (parentChannel.type !== ChannelType.GuildText && parentChannel.type !== ChannelType.GuildAnnouncement) {
                return await interaction.editReply({
                    content: '❌ Cannot create ticket thread. Please configure a proper text channel for tickets.'
                });
            }
            
            // Create private thread
            const ticketThread = await parentChannel.threads.create({
                name: `🎫 ${member.user.username}'s Support Ticket`,
                type: ChannelType.PrivateThread,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
                reason: `Support ticket created by ${member.user.tag}`
            });
            
            // Add the user to the thread
            await ticketThread.members.add(member.id);
            
            // Add bot to thread
            await ticketThread.members.add(interaction.client.user.id);
            
            // Add moderators and admins to thread
            const membersToAdd = [];
            
            // Add owner if configured
            if (process.env.OWNER_ID) {
                try {
                    const owner = await guild.members.fetch(process.env.OWNER_ID);
                    if (owner) membersToAdd.push(owner);
                } catch (e) { /* Owner not in guild */ }
            }
            
            // Add members with mod role
            if (process.env.MOD_ROLE_ID) {
                const modRole = guild.roles.cache.get(process.env.MOD_ROLE_ID);
                if (modRole) {
                    modRole.members.forEach(modMember => {
                        if (!membersToAdd.includes(modMember)) {
                            membersToAdd.push(modMember);
                        }
                    });
                }
            }
            
            // Add members with admin role
            if (process.env.ADMIN_ROLE_ID) {
                const adminRole = guild.roles.cache.get(process.env.ADMIN_ROLE_ID);
                if (adminRole) {
                    adminRole.members.forEach(adminMember => {
                        if (!membersToAdd.includes(adminMember)) {
                            membersToAdd.push(adminMember);
                        }
                    });
                }
            }
            
            // Add members with ManageChannels permission
            guild.members.cache.forEach(guildMember => {
                if (guildMember.permissions.has(PermissionFlagsBits.ManageChannels) && 
                    !membersToAdd.includes(guildMember) && 
                    !guildMember.user.bot) {
                    membersToAdd.push(guildMember);
                }
            });
            
            // Add all authorized members to the thread
            for (const memberToAdd of membersToAdd.slice(0, 10)) { // Discord limit
                try {
                    await ticketThread.members.add(memberToAdd.id);
                } catch (e) {
                    console.log(`Couldn't add ${memberToAdd.user.tag} to ticket thread`);
                }
            }
            
            // Create close button embed at the top
            const closeButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('ticket_close')
                        .setLabel('Close Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );
            
            // Send close button first
            await ticketThread.send({
                content: '**🎫 Ticket Controls**',
                components: [closeButton]
            });
            
            // Create main ticket embed
            const ticketEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎫 Support Ticket Created')
                .setDescription(`Hello ${member}! Please describe your issue in detail and a staff member will assist you shortly.`)
                .addFields(
                    { name: '📋 Ticket Information', value: `**Created by:** ${member.user.tag}\n**Created at:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Thread ID:** ${ticketThread.id}`, inline: false },
                    { name: '❓ How to get help:', value: '• Provide a detailed description of your issue\n• Include steps you\'ve already tried\n• Add screenshots if applicable\n• Be patient - staff will respond soon!', inline: false },
                    { name: '🔒 Closing this ticket', value: 'Click the "Close Ticket" button above when your issue is resolved, or staff will close it when appropriate.', inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Support` });
            
            await ticketThread.send({
                content: `${member} **Welcome to your private support ticket!**\n\n👥 **Who can see this:** You, bot admins, moderators, and the server owner.`,
                embeds: [ticketEmbed]
            });
            
            // Save ticket data
            const ticketId = `ticket_${Date.now()}`;
            ticketData[ticketId] = {
                channelId: ticketThread.id,
                userId: member.id,
                createdAt: Date.now(),
                status: 'open',
                type: 'thread'
            };
            await saveTicketData(ticketData);
            
            await interaction.editReply({
                content: `✅ Private support ticket created! Check ${ticketThread} 🎫`,
            });
            
        } catch (error) {
            console.error('Error creating ticket thread:', error);
            await interaction.editReply({
                content: `❌ Failed to create ticket: ${error.message}. Please contact an administrator.`
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
                flags: MessageFlags.Ephemeral
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
                flags: MessageFlags.Ephemeral
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
