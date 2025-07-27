const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member for a specified duration')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The member to timeout')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in minutes (1-10080 = 7 days)')
                .setMinValue(1)
                .setMaxValue(10080)
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the timeout')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        const member = interaction.guild.members.cache.get(target.id);
        
        // Check if the target is in the server
        if (!member) {
            return await interaction.reply({ 
                content: '❌ User not found in this server!', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Check if trying to timeout themselves
        if (target.id === interaction.user.id) {
            return await interaction.reply({ 
                content: '❌ You cannot timeout yourself!', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Check if trying to timeout the bot
        if (target.id === interaction.client.user.id) {
            return await interaction.reply({ 
                content: '❌ I cannot timeout myself!', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Check if the target is moderatable
        if (!member.moderatable) {
            return await interaction.reply({ 
                content: '❌ I cannot timeout this user! They may have higher permissions than me.', 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        try {
            // Calculate timeout duration
            const timeoutUntil = new Date(Date.now() + duration * 60 * 1000);
            
            // Send DM to the user before timeout
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('⏰ You have been timed out')
                    .setDescription(`You have been timed out in **${interaction.guild.name}**`)
                    .addFields(
                        { name: 'Duration', value: `${duration} minutes`, inline: true },
                        { name: 'Until', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: true },
                        { name: 'Reason', value: reason, inline: false },
                        { name: 'Moderator', value: interaction.user.tag, inline: true }
                    )
                    .setTimestamp();
                
                await target.send({ embeds: [dmEmbed] });
            } catch (error) {
                console.log('Could not send DM to user before timeout');
            }
            
            // Timeout the member
            await member.timeout(duration * 60 * 1000, reason);
            
            // Log the action
            const logEmbed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('⏰ Member Timed Out')
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
                    { name: 'Moderator', value: interaction.user.tag, inline: true },
                    { name: 'Duration', value: `${duration} minutes`, inline: true },
                    { name: 'Until', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: true },
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
            console.error('Error timing out member:', error);
            await interaction.reply({ 
                content: '❌ An error occurred while trying to timeout the member!', 
                flags: MessageFlags.Ephemeral 
            });
        }
    },
};
