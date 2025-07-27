const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const automod = require('../../utils/automod');
const database = require('../../utils/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('automod-status')
        .setDescription('View automod status and statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View violations for a specific user')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user');
            const config = await automod.getGuildConfig(interaction.guild.id);

            if (targetUser) {
                // Show user-specific violations
                const userStats = await automod.getUserStats(interaction.guild.id, targetUser.id);
                
                if (!userStats || userStats.totalViolations === 0) {
                    return await interaction.editReply({
                        content: `📊 **${targetUser.tag}** has no automod violations in the last 24 hours.`
                    });
                }

                const embed = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle(`📊 Automod Violations - ${targetUser.tag}`)
                    .setThumbnail(targetUser.displayAvatarURL())
                    .addFields(
                        { name: '📈 Total Violations', value: userStats.totalViolations.toString(), inline: true },
                        { name: '⚖️ Severity Score', value: userStats.totalSeverity.toString(), inline: true },
                        { name: '📅 Timeframe', value: 'Last 24 hours', inline: true }
                    )
                    .setTimestamp();

                // Add breakdown by violation type
                if (Object.keys(userStats.violationsByType).length > 0) {
                    const violationBreakdown = Object.entries(userStats.violationsByType)
                        .map(([type, count]) => `• **${type.replace('_', ' ')}**: ${count}`)
                        .join('\\n');
                    
                    embed.addFields({
                        name: '📋 Violation Breakdown',
                        value: violationBreakdown,
                        inline: false
                    });
                }

                // Add recent violations
                if (userStats.recentViolations.length > 0) {
                    const recentList = userStats.recentViolations
                        .slice(0, 5)
                        .map(v => `• ${v.violation_type} - ${v.created_at.toLocaleString()}`)
                        .join('\\n');
                    
                    embed.addFields({
                        name: '🕐 Recent Violations',
                        value: recentList,
                        inline: false
                    });
                }

                await interaction.editReply({ embeds: [embed] });

            } else {
                // Show general automod status
                const embed = new EmbedBuilder()
                    .setColor(config.enabled ? '#00ff00' : '#ff0000')
                    .setTitle('🛡️ Automod System Status')
                    .setDescription(`Automod is currently **${config.enabled ? 'ENABLED' : 'DISABLED'}**`)
                    .setTimestamp();

                // Add rule status overview
                const ruleStatus = [];
                const rules = [
                    'spamDetection', 'blacklistedWords', 'inviteLinks', 'mentions',
                    'caps', 'repeatedChars', 'zalgoText', 'phishing',
                    'massEmoji', 'newlineSpam', 'unicodeAbuse', 'suspiciousAttachment'
                ];

                for (const rule of rules) {
                    if (config[rule]) {
                        const status = config[rule].enabled ? '✅' : '❌';
                        const ruleName = rule.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        ruleStatus.push(`${status} ${ruleName}`);
                    }
                }

                // Split into two columns for better readability
                const midpoint = Math.ceil(ruleStatus.length / 2);
                const column1 = ruleStatus.slice(0, midpoint).join('\\n');
                const column2 = ruleStatus.slice(midpoint).join('\\n');

                embed.addFields(
                    { name: '📋 Rules Status (1/2)', value: column1, inline: true },
                    { name: '📋 Rules Status (2/2)', value: column2, inline: true },
                    { name: '⚡ Quick Stats', value: '\\u200B', inline: false }
                );

                // Get recent violation statistics
                try {
                    const recentViolations = await database.pool.query(`
                        SELECT 
                            violation_type,
                            COUNT(*) as count,
                            AVG(CASE 
                                WHEN violation_type = 'advanced_spam' THEN 5
                                WHEN violation_type = 'phishing_link' THEN 4
                                WHEN violation_type = 'suspicious_attachment' THEN 4
                                WHEN violation_type = 'spam_frequency' THEN 3
                                WHEN violation_type = 'excessive_role_mentions' THEN 3
                                WHEN violation_type = 'blacklisted_words' THEN 2
                                WHEN violation_type = 'zalgo_text' THEN 2
                                ELSE 1
                            END) as avg_severity
                        FROM automod_violations 
                        WHERE guild_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
                        GROUP BY violation_type
                        ORDER BY count DESC
                        LIMIT 5
                    `, [interaction.guild.id]);

                    if (recentViolations.rows.length > 0) {
                        const violationStats = recentViolations.rows
                            .map(row => `• **${row.violation_type.replace('_', ' ')}**: ${row.count} (avg severity: ${parseFloat(row.avg_severity).toFixed(1)})`)
                            .join('\\n');
                        
                        embed.addFields({
                            name: '📊 Top Violations (24h)',
                            value: violationStats,
                            inline: false
                        });
                    } else {
                        embed.addFields({
                            name: '📊 Top Violations (24h)',
                            value: 'No violations in the last 24 hours! 🎉',
                            inline: false
                        });
                    }

                    // Add punishment configuration
                    if (config.punishments && config.punishments.progressive) {
                        const punishmentLevels = Object.entries(config.punishments.severityLevels)
                            .map(([threshold, punishment]) => {
                                const duration = punishment.duration ? ` (${Math.floor(punishment.duration / 60000)}min)` : '';
                                return `• **${threshold}+ severity**: ${punishment.action}${duration}`;
                            })
                            .join('\\n');
                        
                        embed.addFields({
                            name: '⚖️ Progressive Punishment',
                            value: punishmentLevels,
                            inline: false
                        });
                    }

                } catch (dbError) {
                    console.error('Error fetching violation stats:', dbError);
                    embed.addFields({
                        name: '📊 Statistics',
                        value: 'Unable to fetch statistics at this time.',
                        inline: false
                    });
                }

                embed.setFooter({ 
                    text: 'Use /automod-status user:<user> to view specific user violations',
                    iconURL: interaction.client.user.displayAvatarURL()
                });

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error in automod-status command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while fetching automod status. Please try again.',
            });
        }
    },
};
