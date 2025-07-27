const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const database = require('../../utils/database');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View bot statistics and analytics')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of statistics to view')
                .setRequired(false)
                .addChoices(
                    { name: 'Commands', value: 'commands' },
                    { name: 'Users', value: 'users' },
                    { name: 'System', value: 'system' },
                    { name: 'All', value: 'all' }
                ))
        .addStringOption(option =>
            option.setName('timerange')
                .setDescription('Time range for statistics')
                .setRequired(false)
                .addChoices(
                    { name: 'Last Hour', value: '1 HOUR' },
                    { name: 'Last 24 Hours', value: '24 HOURS' },
                    { name: 'Last Week', value: '7 DAYS' },
                    { name: 'Last Month', value: '30 DAYS' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        const type = interaction.options.getString('type') || 'all';
        const timeRange = interaction.options.getString('timerange') || '24 HOURS';
        
        await interaction.deferReply();
        
        try {
            const embeds = [];
            
            if (type === 'commands' || type === 'all') {
                embeds.push(await this.getCommandStats(timeRange));
            }
            
            if (type === 'users' || type === 'all') {
                embeds.push(await this.getUserStats());
            }
            
            if (type === 'system' || type === 'all') {
                embeds.push(await this.getSystemStats(interaction));
            }
            
            await interaction.editReply({ embeds });
            
        } catch (error) {
            logger.logError(error, { 
                command: 'stats', 
                user: interaction.user.id,
                guild: interaction.guild?.id 
            });
            
            await interaction.editReply({
                content: '❌ An error occurred while fetching statistics.',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async getCommandStats(timeRange) {
        try {
            const stats = await database.getCommandStats(timeRange);
            
            if (!stats || stats.length === 0) {
                return new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('📊 Command Statistics')
                    .setDescription('No command usage data available for the specified time range.')
                    .setTimestamp();
            }

            const totalCommands = stats.reduce((sum, stat) => sum + stat.usage_count, 0);
            const avgExecutionTime = stats.reduce((sum, stat) => sum + (stat.avg_execution_time || 0), 0) / stats.length;
            const successRate = stats.reduce((sum, stat) => sum + stat.success_count, 0) / totalCommands * 100;

            const topCommands = stats.slice(0, 10).map((stat, index) => 
                `**${index + 1}.** \`${stat.command_name}\` - ${stat.usage_count} uses (${(stat.success_count / stat.usage_count * 100).toFixed(1)}% success)`
            ).join('\n');

            return new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📊 Command Statistics')
                .setDescription(`Statistics for the last ${timeRange.toLowerCase()}`)
                .addFields(
                    { name: '📈 Overview', value: `**Total Commands:** ${totalCommands}\n**Average Execution Time:** ${avgExecutionTime.toFixed(2)}ms\n**Success Rate:** ${successRate.toFixed(1)}%`, inline: false },
                    { name: '🏆 Top Commands', value: topCommands || 'No data available', inline: false }
                )
                .setTimestamp();

        } catch (error) {
            logger.logError(error, { context: 'getCommandStats' });
            throw error;
        }
    },

    async getUserStats() {
        // This would require additional database queries - simplified for now
        return new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('👥 User Statistics')
            .setDescription('User statistics are being tracked. More detailed analytics coming soon!')
            .addFields(
                { name: '📊 Active Users', value: 'Coming soon...', inline: true },
                { name: '🎯 Power Users', value: 'Coming soon...', inline: true }
            )
            .setTimestamp();
    },

    async getSystemStats(interaction) {
        const client = interaction.client;
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        // Calculate uptime string
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = Math.floor(uptime) % 60;
        
        const uptimeString = [
            days > 0 ? `${days}d` : '',
            hours > 0 ? `${hours}h` : '',
            minutes > 0 ? `${minutes}m` : '',
            `${seconds}s`
        ].filter(Boolean).join(' ');

        return new EmbedBuilder()
            .setColor('#ff0099')
            .setTitle('🖥️ System Statistics')
            .addFields(
                { 
                    name: '⏱️ Uptime', 
                    value: uptimeString, 
                    inline: true 
                },
                { 
                    name: '💾 Memory Usage', 
                    value: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`, 
                    inline: true 
                },
                { 
                    name: '🏓 API Latency', 
                    value: `${Math.round(client.ws.ping)}ms`, 
                    inline: true 
                },
                { 
                    name: '🌐 Servers', 
                    value: client.guilds.cache.size.toString(), 
                    inline: true 
                },
                { 
                    name: '👥 Users', 
                    value: client.users.cache.size.toString(), 
                    inline: true 
                },
                { 
                    name: '🔧 Commands', 
                    value: client.commands.size.toString(), 
                    inline: true 
                },
                {
                    name: '📈 Process Info',
                    value: `**Node.js:** ${process.version}\n**Platform:** ${process.platform}\n**Architecture:** ${process.arch}`,
                    inline: false
                }
            )
            .setTimestamp();
    }
};
