const { EmbedBuilder, WebhookClient, MessageFlags } = require('discord.js');
const logger = require('./logger');

class ErrorHandler {
    constructor() {
        this.errorWebhook = process.env.ERROR_WEBHOOK_URL ? 
            new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL }) : null;
        
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', { 
                error: error.message, 
                stack: error.stack 
            });
            
            this.sendErrorAlert('Uncaught Exception', error);
            
            // Graceful shutdown
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection', {
                reason: reason?.message || reason,
                stack: reason?.stack,
                promise: promise.toString()
            });
            
            this.sendErrorAlert('Unhandled Promise Rejection', reason);
        });

        // Handle warnings
        process.on('warning', (warning) => {
            logger.warn('Process Warning', {
                name: warning.name,
                message: warning.message,
                stack: warning.stack
            });
        });
    }

    // Handle command errors
    async handleCommandError(error, interaction) {
        const errorId = this.generateErrorId();
        
        logger.logError(error, {
            errorId,
            command: interaction.commandName,
            user: interaction.user.tag,
            userId: interaction.user.id,
            guild: interaction.guild?.name || 'DM',
            guildId: interaction.guild?.id || null
        });

        // Send user-friendly error message
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ Command Error')
            .setDescription('An unexpected error occurred while executing this command.')
            .addFields(
                { name: 'Error ID', value: `\`${errorId}\``, inline: true },
                { name: 'Support', value: 'Please report this error ID to the bot developer.', inline: false }
            )
            .setTimestamp();

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed], components: [] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (replyError) {
            logger.error('Failed to send primary error reply', { 
                errorId,
                originalError: error.message,
                replyError: replyError.message 
            });
            
            // Fallback to a follow-up message if the initial reply/edit fails
            try {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            } catch (followUpError) {
                logger.error('Failed to send follow-up error reply', {
                    errorId,
                    followUpError: followUpError.message
                });
            }
        }

        // Send detailed error to webhook/channel
        await this.sendErrorAlert('Command Error', error, {
            errorId,
            command: interaction.commandName,
            user: `${interaction.user.tag} (${interaction.user.id})`,
            guild: interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : 'DM'
        });

        return errorId;
    }

    // Send error alerts to webhook or log channel
    async sendErrorAlert(type, error, context = {}) {
        if (!this.errorWebhook) {return;}

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle(`🚨 ${type}`)
            .setDescription(`\`\`\`${error.message || error}\`\`\``)
            .addFields(
                { name: 'Time', value: new Date().toISOString(), inline: true },
                { name: 'Error ID', value: context.errorId || 'N/A', inline: true }
            )
            .setTimestamp();

        if (context.command) {
            embed.addFields({ name: 'Command', value: context.command, inline: true });
        }

        if (context.user) {
            embed.addFields({ name: 'User', value: context.user, inline: true });
        }

        if (context.guild) {
            embed.addFields({ name: 'Guild', value: context.guild, inline: true });
        }

        if (error.stack) {
            const stackTrace = error.stack.length > 1000 ? 
                error.stack.substring(0, 1000) + '...' : 
                error.stack;
            
            embed.addFields({ 
                name: 'Stack Trace', 
                value: `\`\`\`${stackTrace}\`\`\``, 
                inline: false 
            });
        }

        try {
            await this.errorWebhook.send({ embeds: [embed] });
        } catch (webhookError) {
            logger.error('Failed to send error webhook', { error: webhookError.message });
        }
    }

    // Generate unique error ID
    generateErrorId() {
        return Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    // Check if error is retryable
    isRetryableError(error) {
        const retryableErrors = [
            'ECONNRESET',
            'ENOTFOUND',
            'ECONNREFUSED',
            'ETIMEDOUT',
            'Rate limited'
        ];

        return retryableErrors.some(retryError => 
            error.message.includes(retryError) || 
            error.code === retryError
        );
    }

    // Retry function with exponential backoff
    async retry(fn, maxAttempts = 3, baseDelay = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts || !this.isRetryableError(error)) {
                    throw error;
                }

                const delay = baseDelay * Math.pow(2, attempt - 1);
                logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms`, {
                    error: error.message,
                    attempt,
                    maxAttempts
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Graceful shutdown
    async gracefulShutdown(client) {
        logger.info('Initiating graceful shutdown...');

        try {
            // Close database connections
            const database = require('./database');
            database.close();

            // Destroy client
            if (client) {
                client.destroy();
            }

            logger.info('Graceful shutdown completed');
        } catch (error) {
            logger.error('Error during graceful shutdown', { error: error.message });
        }
    }
}

module.exports = new ErrorHandler();
