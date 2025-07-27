const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages from the channel')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of messages to delete (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100))
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Only delete messages from this user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const target = interaction.options.getUser('target');
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            const messages = await interaction.channel.messages.fetch({ limit: amount });
            
            let messagesToDelete = messages;
            
            // Filter messages by target user if specified
            if (target) {
                messagesToDelete = messages.filter(msg => msg.author.id === target.id);
            }
            
            // Filter out messages older than 14 days (Discord API limitation)
            const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);
            messagesToDelete = messagesToDelete.filter(msg => msg.createdTimestamp > fourteenDaysAgo);
            
            if (messagesToDelete.size === 0) {
                return await interaction.editReply({
                    content: '❌ No messages found to delete! Messages must be less than 14 days old.',
                });
            }
            
            // Bulk delete messages
            await interaction.channel.bulkDelete(messagesToDelete, true);
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🧹 Messages Cleared')
                .setDescription(`Successfully deleted **${messagesToDelete.size}** message(s)`)
                .addFields(
                    { name: 'Channel', value: `${interaction.channel}`, inline: true },
                    { name: 'Moderator', value: `${interaction.user}`, inline: true }
                )
                .setTimestamp();
            
            if (target) {
                embed.addFields({ name: 'Target User', value: `${target}`, inline: true });
            }
            
            // Log the action
            if (process.env.LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
                if (logChannel && logChannel.id !== interaction.channel.id) {
                    await logChannel.send({ embeds: [embed] });
                }
            }
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error clearing messages:', error);
            await interaction.editReply({
                content: '❌ An error occurred while trying to clear messages!',
            });
        }
    },
};
