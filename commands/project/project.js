const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('project')
        .setDescription('HyprL project commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show project status and statistics'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('changelog')
                .setDescription('Show recent changes from git log'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('update')
                .setDescription('Send a project update to the update channel')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Update message to send')
                        .setRequired(true))),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
        case 'status':
            await this.handleStatus(interaction);
            break;
        case 'changelog':
            await this.handleChangelog(interaction);
            break;
        case 'update':
            await this.handleUpdate(interaction);
            break;
        }
    },

    async handleStatus(interaction) {
        await interaction.deferReply();
        
        try {
            const projectPath = process.env.PROJECT_PATH;
            
            if (!projectPath || !await fs.pathExists(projectPath)) {
                return await interaction.editReply({
                    content: '❌ Project path not found or not configured!'
                });
            }

            // Get git information
            const gitInfo = await this.getGitInfo(projectPath);
            
            // Get project statistics
            const stats = await this.getProjectStats(projectPath);
            
            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`📊 ${process.env.PROJECT_NAME || 'HyprL'} Project Status`)
                .setDescription('Current project information and statistics')
                .addFields(
                    { name: '🔗 Repository', value: `[GitHub](${process.env.PROJECT_URL})`, inline: true },
                    { name: '📖 Documentation', value: `[Docs](${process.env.DOCS_URL})`, inline: true },
                    { name: '🌿 Current Branch', value: gitInfo.branch || 'Unknown', inline: true },
                    { name: '📝 Latest Commit', value: gitInfo.lastCommit || 'No commits', inline: false },
                    { name: '📊 Project Stats', value: `${stats.files} files | ${stats.lines} lines of code`, inline: true },
                    { name: '📅 Last Updated', value: gitInfo.lastCommitDate || 'Unknown', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Bot` });

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error getting project status:', error);
            await interaction.editReply({
                content: '❌ Error getting project status. Make sure the project path is configured correctly.'
            });
        }
    },

    async handleChangelog(interaction) {
        await interaction.deferReply();
        
        try {
            const projectPath = process.env.PROJECT_PATH;
            
            if (!projectPath || !await fs.pathExists(projectPath)) {
                return await interaction.editReply({
                    content: '❌ Project path not found or not configured!'
                });
            }

            // Get recent commits
            const { stdout } = await execAsync(
                'git log --oneline -10 --pretty=format:"%h - %s (%an, %ar)"',
                { cwd: projectPath }
            );

            const commits = stdout.trim().split('\\n').slice(0, 10);
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`📋 ${process.env.PROJECT_NAME || 'HyprL'} Recent Changes`)
                .setDescription('Latest commits from the repository')
                .addFields({
                    name: '🔄 Recent Commits',
                    value: commits.length > 0 ? commits.join('\\n') : 'No recent commits found',
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Bot` });

            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error getting changelog:', error);
            await interaction.editReply({
                content: '❌ Error getting changelog. Make sure git is available and the project path is correct.'
            });
        }
    },

    async handleUpdate(interaction) {
        // Check permissions (only owner or admins can send updates)
        const isOwner = interaction.user.id === process.env.OWNER_ID;
        const hasAdminRole = process.env.ADMIN_ROLE_ID && 
                           interaction.member.roles.cache.has(process.env.ADMIN_ROLE_ID);
        
        if (!isOwner && !hasAdminRole) {
            return await interaction.reply({
                content: '❌ You don\'t have permission to send project updates!',
                flags: MessageFlags.Ephemeral
            });
        }

        const message = interaction.options.getString('message');
        const updateChannelId = process.env.UPDATE_CHANNEL_ID;
        
        if (!updateChannelId) {
            return await interaction.reply({
                content: '❌ Update channel not configured!',
                flags: MessageFlags.Ephemeral
            });
        }

        const updateChannel = interaction.guild.channels.cache.get(updateChannelId);
        if (!updateChannel) {
            return await interaction.reply({
                content: '❌ Update channel not found!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle(`🚀 ${process.env.PROJECT_NAME || 'HyprL'} Update`)
                .setDescription(message)
                .addFields(
                    { name: '👤 Posted by', value: interaction.user.tag, inline: true },
                    { name: '🔗 Links', value: `[Repository](${process.env.PROJECT_URL}) | [Documentation](${process.env.DOCS_URL})`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Development Team` });

            await updateChannel.send({ embeds: [embed] });
            
            await interaction.reply({
                content: `✅ Project update sent to ${updateChannel}!`,
                flags: MessageFlags.Ephemeral
            });
            
        } catch (error) {
            console.error('Error sending project update:', error);
            await interaction.reply({
                content: '❌ Error sending project update!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async getGitInfo(projectPath) {
        try {
            const [branchResult, commitResult, dateResult] = await Promise.all([
                execAsync('git branch --show-current', { cwd: projectPath }),
                execAsync('git log -1 --pretty=format:"%h - %s"', { cwd: projectPath }),
                execAsync('git log -1 --pretty=format:"%ar"', { cwd: projectPath })
            ]);

            return {
                branch: branchResult.stdout.trim(),
                lastCommit: commitResult.stdout.trim(),
                lastCommitDate: dateResult.stdout.trim()
            };
        } catch (error) {
            return {
                branch: 'Unknown',
                lastCommit: 'No commits',
                lastCommitDate: 'Unknown'
            };
        }
    },

    async getProjectStats(projectPath) {
        try {
            // Simple approach - count JavaScript files
            const { stdout: fileCount } = await execAsync(
                'find . -name "*.js" | grep -v node_modules | wc -l',
                { cwd: projectPath }
            );

            const { stdout: lineCount } = await execAsync(
                'find . -name "*.js" | grep -v node_modules | xargs wc -l 2>/dev/null | tail -1 | awk \'{ print $1 }\'',
                { cwd: projectPath }
            );

            return {
                files: parseInt(fileCount.trim()) || 0,
                lines: parseInt(lineCount.trim()) || 0
            };
        } catch (error) {
            return {
                files: 0,
                lines: 0
            };
        }
    }
};
