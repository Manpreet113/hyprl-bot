const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member for rule violations')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to warn')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the warning')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
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
        
        // Check if trying to warn themselves
        if (target.id === interaction.user.id) {
            return await interaction.reply({ 
                content: '❌ You cannot warn yourself!', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Check if trying to warn the bot
        if (target.id === interaction.client.user.id) {
            return await interaction.reply({ 
                content: '❌ I cannot warn myself!', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Check if the target is moderatable
        if (!member.manageable) {
            return await interaction.reply({ 
                content: '❌ I cannot warn this user! They may have higher permissions than me.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        try {
            // Send DM to the user with warning
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ffcc00')
                    .setTitle('⚠️ You have been warned')
                    .setDescription(`You have received a warning in **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Moderator', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();
                
                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Could not send DM to user for warning');
            }
            
            // Log the warning
            const logEmbed = new EmbedBuilder()
                .setColor('#ffcc00')
                .setTitle('⚠️ Member Warned')
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
            console.error('Error warning member:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while trying to warn the member!', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },
};

