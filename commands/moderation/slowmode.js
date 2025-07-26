const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Set or remove slowmode for a channel')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('Slowmode duration in seconds (0 to disable)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(21600)) // Discord max is 6 hours
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to set slowmode for')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    
    async execute(interaction) {
        const seconds = interaction.options.getInteger('seconds');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        // Check if channel is a text channel
        if (channel.type !== 0) {
            return await interaction.reply({
                content: '❌ Slowmode can only be set on text channels!',
                ephemeral: true
            });
        }

        try {
            await channel.setRateLimitPerUser(seconds);
            
            const embed = new EmbedBuilder()
                .setColor(seconds > 0 ? '#ff9900' : '#00ff00')
                .setTitle(seconds > 0 ? '🐌 Slowmode Enabled' : '🚀 Slowmode Disabled')
                .addFields(
                    { name: 'Channel', value: channel.toString(), inline: true },
                    { name: 'Duration', value: seconds > 0 ? `${seconds} seconds` : 'Disabled', inline: true },
                    { name: 'Set by', value: interaction.user.toString(), inline: true }
                )
                .setTimestamp();
            
            // Send log to log channel if configured
            if (process.env.LOG_CHANNEL_ID) {
                const logChannel = interaction.guild.channels.cache.get(process.env.LOG_CHANNEL_ID);
                if (logChannel && logChannel.id !== channel.id) {
                    await logChannel.send({ embeds: [embed] });
                }
            }
            
            await interaction.reply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error setting slowmode:', error);
            await interaction.reply({
                content: '❌ Failed to set slowmode! Make sure I have the proper permissions.',
                ephemeral: true
            });
        }
    },
};
