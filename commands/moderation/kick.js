const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);
        
        // Check if the target is in the server
        if (!member) {
            return await interaction.reply({ 
                content: '❌ User not found in this server!', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Check if the target is kickable
        if (!member.kickable) {
            return await interaction.reply({ 
                content: '❌ I cannot kick this user! They may have higher permissions than me.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Check if trying to kick themselves
        if (target.id === interaction.user.id) {
            return await interaction.reply({ 
                content: '❌ You cannot kick yourself!', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Check if trying to kick the bot
        if (target.id === interaction.client.user.id) {
            return await interaction.reply({ 
                content: '❌ I cannot kick myself!', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        try {
            // Send DM to the user before kicking
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('⚠️ You have been kicked')
                    .setDescription(`You have been kicked from **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Moderator', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();
                
                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Could not send DM to user before kick');
            }
            
            // Kick the member
            await member.kick(reason);
            
            // Log the action
            const logEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('👢 Member Kicked')
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Reason', value: reason, inline: false }
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
            console.error('Error kicking member:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while trying to kick the member!', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },
};
