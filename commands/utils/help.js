const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),
    
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('🤖 Bot Commands')
            .setDescription(`Here are all available commands for ${process.env.PROJECT_NAME || 'HyprL'} Support Bot:`)
            .addFields(
                { 
                    name: '📚 **Utility Commands**', 
                    value: '`/docs` - Get documentation links\n`/help` - Show this help message\n`/ping` - Check bot latency\n`/info` - Show bot information', 
                    inline: false 
                },
                { 
                    name: '🛡️ **Moderation Commands**', 
                    value: '`/kick` - Kick a member\n`/ban` - Ban a member\n`/timeout` - Timeout a member\n`/warn` - Warn a member\n`/clear` - Clear messages', 
                    inline: false 
                },
                { 
                    name: '🎵 **Music Commands**', 
                    value: '`/play` - Play music\n`/pause` - Pause current track\n`/resume` - Resume playback\n`/skip` - Skip current track\n`/queue` - Show music queue\n`/leave` - Leave voice channel', 
                    inline: false 
                },
                { 
                    name: '🎫 **Ticket System**', 
                    value: '`/ticket create` - Create a support ticket\n`/ticket close` - Close current ticket\n`/ticket setup` - Setup ticket system', 
                    inline: false 
                },
                { 
                    name: '📋 **Project Commands**', 
                    value: '`/project status` - Check project status\n`/project update` - Send project update\n`/project changelog` - Show recent changes', 
                    inline: false 
                }
            )
            .setTimestamp()
            .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Support Bot` });

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
