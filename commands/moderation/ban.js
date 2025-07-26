const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Days of messages to delete (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const days = interaction.options.getInteger('days') || 0;
        const member = interaction.guild.members.cache.get(target.id);
        
        // Check if trying to ban themselves
        if (target.id === interaction.user.id) {
            return await interaction.reply({ 
                content: '❌ You cannot ban yourself!', 
                ephemeral: true 
            });
        }
        
        // Check if trying to ban the bot
        if (target.id === interaction.client.user.id) {
            return await interaction.reply({ 
                content: '❌ I cannot ban myself!', 
                ephemeral: true 
            });
        }
        
        // Check if the target is bannable
        if (member && !member.bannable) {
            return await interaction.reply({ 
                content: '❌ I cannot ban this user! They may have higher permissions than me.', 
                ephemeral: true 
            });
        }
        
        try {
            // Send DM to the user before banning (if they're in the server)
            if (member) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('⚠️ You have been banned')
                        .setDescription(`You have been banned from **${interaction.guild.name}**`)
                        .addFields(
                            { name: 'Reason', value: reason, inline: false },
                            { name: 'Moderator', value: interaction.user.tag, inline: true }
                        )
                        .setTimestamp();
                    
                    await target.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.log('Could not send DM to user before ban');
                }
            }
            
            // Ban the user
            await interaction.guild.members.ban(target, { 
                reason: reason,
                deleteMessageSeconds: days * 24 * 60 * 60
            });
            
            // Log the action
            const logEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔨 Member Banned')
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                    { name: 'Messages Deleted', value: `${days} days`, inline: true }
                )
                .setTimestamp();
            
            // Send log to log channel if configured
            if (process.env.LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
                if (logChannel) {
                    await logChannel.send({ embeds: [logEmbed] });
                }
            }
            
            await interaction.reply({ embeds: [logEmbed] });
            
        } catch (error) {
            console.error('Error banning member:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while trying to ban the member!', 
                ephemeral: true 
            });
        }
    },
};
