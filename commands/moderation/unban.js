const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addStringOption(option =>
            option.setName('userid')
                .setDescription('User ID to unban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the unban')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    async execute(interaction) {
        const userId = interaction.options.getString('userid');
        const reason = interaction.options.getString('reason') || 'No reason provided';
        
        // Validate user ID format
        if (!/^\\d{17,19}$/.test(userId)) {
            return await interaction.reply({
                content: '❌ Invalid user ID format!',
                ephemeral: true
            });
        }

        try {
            // Check if user is banned
            const bannedUsers = await interaction.guild.bans.fetch();
            const bannedUser = bannedUsers.get(userId);
            
            if (!bannedUser) {
                return await interaction.reply({
                    content: '❌ This user is not banned!',
                    ephemeral: true
                });
            }

            // Unban the user
            await interaction.guild.members.unban(userId, reason);
            
            // Log the action
            const logEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Member Unbanned')
                .addFields(
                    { name: 'User', value: `${bannedUser.user.tag} (${userId})`, inline: true },
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
            console.error('Error unbanning user:', error);
            await interaction.reply({
                content: '❌ An error occurred while trying to unban the user!',
                ephemeral: true
            });
        }
    },
};
