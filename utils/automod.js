const logger = require('./logger');
const database = require('./database');
const { MessageFlags, PermissionsBitField } = require('discord.js');
const similarity = require('string-similarity');

// Message tracking for spam detection
const messageTracker = new Map();
const SPAM_WINDOW = 10000; // 10 seconds
const VIOLATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Default automod configuration
const DEFAULT_CONFIG = {
    enabled: true,
    
    // Spam Detection
    spamDetection: {
        enabled: true,
        maxMessages: 5,
        timeWindow: 10000, // ms
        duplicateThreshold: 0.85, // similarity threshold
        maxDuplicates: 3
    },
    
    // Content Filtering
    blacklistedWords: {
        enabled: true,
        words: [],
        action: 'delete_warn'
    },
    
    // Link/Invite Detection
    inviteLinks: {
        enabled: true,
        allowOwnServer: true,
        whitelistedServers: [],
        action: 'delete_warn'
    },
    
    linkFilter: {
        enabled: false,
        whitelist: [],
        blacklist: [],
        action: 'delete_warn'
    },
    
    // Mention Limits
    mentions: {
        enabled: true,
        maxUsers: 5,
        maxRoles: 3,
        action: 'delete_warn'
    },
    
    // Text Formatting
    caps: {
        enabled: true,
        maxRatio: 0.7,
        minLength: 10,
        action: 'delete_warn'
    },
    
    repeatedChars: {
        enabled: true,
        maxRepeated: 10,
        action: 'delete_warn'
    },
    
    // Advanced Detection
    zalgoText: {
        enabled: true,
        threshold: 0.5,
        action: 'delete_warn'
    },
    
    phishing: {
        enabled: true,
        action: 'delete_warn'
    },
    
    // Punishment System
    punishments: {
        progressive: true,
        severityLevels: {
            1: { action: 'warn', duration: 0 },
            5: { action: 'timeout', duration: 5 * 60 * 1000 }, // 5 min
            10: { action: 'timeout', duration: 30 * 60 * 1000 }, // 30 min
            15: { action: 'timeout', duration: 60 * 60 * 1000 }, // 1 hour
            25: { action: 'kick', duration: 0 },
            35: { action: 'ban', duration: 0 }
        }
    },
    
    // Exemptions
    exemptRoles: [],
    exemptChannels: [],
    exemptUsers: []
};

// Known phishing domains (basic list)
const PHISHING_DOMAINS = [
    'discordnitro.info',
    'discordgift.info',
    'discord-nitro.com',
    'discordsteam.com'
];

module.exports = {
    /**
     * Main automod processing function
     * @param {Message} message - Discord message object
     */
    async processMessage(message) {
        try {
            // Skip bots and system messages
            if (message.author.bot || message.system) return;
            
            // Get guild configuration
            const config = await this.getGuildConfig(message.guild.id);
            if (!config.enabled) return;
            
            // Check exemptions
            if (await this.isExempt(message, config)) return;
            
            // Track message for spam detection
            await this.trackMessage(message);
            
            // Run all enabled rules
            const violations = [];
            
            if (config.spamDetection.enabled) {
                const spamViolation = await this.detectSpam(message, config);
                if (spamViolation) violations.push(spamViolation);
            }
            
            if (config.blacklistedWords.enabled) {
                const wordViolation = await this.checkBlacklistedWords(message, config);
                if (wordViolation) violations.push(wordViolation);
            }
            
            if (config.inviteLinks.enabled) {
                const inviteViolation = await this.checkInviteLinks(message, config);
                if (inviteViolation) violations.push(inviteViolation);
            }
            
            if (config.linkFilter.enabled) {
                const linkViolation = await this.checkLinks(message, config);
                if (linkViolation) violations.push(linkViolation);
            }
            
            if (config.mentions.enabled) {
                const mentionViolation = await this.checkMentions(message, config);
                if (mentionViolation) violations.push(mentionViolation);
            }
            
            if (config.caps.enabled) {
                const capsViolation = await this.checkCaps(message, config);
                if (capsViolation) violations.push(capsViolation);
            }
            
            if (config.repeatedChars.enabled) {
                const repeatViolation = await this.checkRepeatedChars(message, config);
                if (repeatViolation) violations.push(repeatViolation);
            }
            
            if (config.zalgoText.enabled) {
                const zalgoViolation = await this.checkZalgoText(message, config);
                if (zalgoViolation) violations.push(zalgoViolation);
            }
            
            if (config.phishing.enabled) {
                const phishingViolation = await this.checkPhishing(message, config);
                if (phishingViolation) violations.push(phishingViolation);
            }
            
            // Process violations
            for (const violation of violations) {
                await this.handleViolation(message, violation, config);
            }
            
        } catch (error) {
            logger.error('Error in automod processing:', error);
        }
    },
    
    /**
     * Get guild automod configuration
     */
    async getGuildConfig(guildId) {
        try {
            const config = await database.getAutomodConfig(guildId);
            return config ? { ...DEFAULT_CONFIG, ...config } : DEFAULT_CONFIG;
        } catch (error) {
            logger.error('Error getting guild config:', error);
            return DEFAULT_CONFIG;
        }
    },
    
    /**
     * Check if user/channel/role is exempt from automod
     */
    async isExempt(message, config) {
        // Check user exemptions
        if (config.exemptUsers.includes(message.author.id)) return true;
        
        // Check channel exemptions
        if (config.exemptChannels.includes(message.channel.id)) return true;
        
        // Check role exemptions
        const member = message.member;
        if (member && member.roles.cache.some(role => config.exemptRoles.includes(role.id))) {
            return true;
        }
        
        // Check permissions (admins/mods are exempt)
        if (member && member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return true;
        }
        
        return false;
    },
    
    /**
     * Track message for spam detection
     */
    async trackMessage(message) {
        const userId = message.author.id;
        const now = Date.now();
        
        if (!messageTracker.has(userId)) {
            messageTracker.set(userId, []);
        }
        
        const userMessages = messageTracker.get(userId);
        
        // Add current message
        userMessages.push({
            content: message.content,
            timestamp: now,
            channelId: message.channel.id
        });
        
        // Clean old messages
        messageTracker.set(userId, userMessages.filter(msg => 
            now - msg.timestamp < SPAM_WINDOW
        ));
        
        // Store in database for persistent tracking
        await database.trackMessage(message.guild.id, userId, message.content, message.channel.id);
    },
    
    /**
     * Detect spam (frequency and duplicate content)
     */
    async detectSpam(message, config) {
        const userId = message.author.id;
        const userMessages = messageTracker.get(userId) || [];
        const recentMessages = userMessages.filter(msg => 
            Date.now() - msg.timestamp < config.spamDetection.timeWindow
        );
        
        // Check message frequency
        if (recentMessages.length >= config.spamDetection.maxMessages) {
            return {
                type: 'spam_frequency',
                severity: 3,
                reason: `Sent ${recentMessages.length} messages in ${config.spamDetection.timeWindow/1000} seconds`,
                action: 'delete_warn'
            };
        }
        
        // Check duplicate content
        const duplicates = recentMessages.filter(msg => 
            similarity.compareTwoStrings(message.content.toLowerCase(), msg.content.toLowerCase()) 
            >= config.spamDetection.duplicateThreshold
        );
        
        if (duplicates.length >= config.spamDetection.maxDuplicates) {
            return {
                type: 'spam_duplicate',
                severity: 2,
                reason: `Repeated similar messages ${duplicates.length} times`,
                action: 'delete_warn'
            };
        }
        
        return null;
    },
    
    /**
     * Check for blacklisted words
     */
    async checkBlacklistedWords(message, config) {
        const content = message.content.toLowerCase();
        const foundWords = config.blacklistedWords.words.filter(word => 
            content.includes(word.toLowerCase())
        );
        
        if (foundWords.length > 0) {
            return {
                type: 'blacklisted_words',
                severity: 2,
                reason: `Contains blacklisted words: ${foundWords.join(', ')}`,
                action: config.blacklistedWords.action
            };
        }
        
        return null;
    },
    
    /**
     * Check for invite links
     */
    async checkInviteLinks(message, config) {
        const inviteRegex = /(discord\.gg\/|discordapp\.com\/invite\/|discord\.com\/invite\/)([a-zA-Z0-9]+)/gi;
        const matches = message.content.match(inviteRegex);
        
        if (matches) {
            // Allow own server invites if configured
            if (config.inviteLinks.allowOwnServer) {
                // This would require checking if the invite is for the current server
                // For now, we'll just check whitelisted servers
            }
            
            return {
                type: 'invite_links',
                severity: 1,
                reason: `Contains invite links: ${matches.join(', ')}`,
                action: config.inviteLinks.action
            };
        }
        
        return null;
    },
    
    /**
     * Check for filtered links
     */
    async checkLinks(message, config) {
        const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        const urls = message.content.match(urlRegex);
        
        if (urls) {
            for (const url of urls) {
                try {
                    const domain = new URL(url).hostname.toLowerCase();
                    
                    // Check blacklist
                    if (config.linkFilter.blacklist.includes(domain)) {
                        return {
                            type: 'blacklisted_link',
                            severity: 2,
                            reason: `Contains blacklisted domain: ${domain}`,
                            action: config.linkFilter.action
                        };
                    }
                    
                    // Check whitelist (if whitelist exists, only allow whitelisted)
                    if (config.linkFilter.whitelist.length > 0 && 
                        !config.linkFilter.whitelist.includes(domain)) {
                        return {
                            type: 'non_whitelisted_link',
                            severity: 1,
                            reason: `Contains non-whitelisted domain: ${domain}`,
                            action: config.linkFilter.action
                        };
                    }
                } catch (error) {
                    // Invalid URL, might be suspicious
                    continue;
                }
            }
        }
        
        return null;
    },
    
    /**
     * Check for excessive mentions
     */
    async checkMentions(message, config) {
        const userMentions = message.mentions.users.size;
        const roleMentions = message.mentions.roles.size;
        
        if (userMentions > config.mentions.maxUsers) {
            return {
                type: 'excessive_mentions',
                severity: 2,
                reason: `Too many user mentions: ${userMentions}/${config.mentions.maxUsers}`,
                action: config.mentions.action
            };
        }
        
        if (roleMentions > config.mentions.maxRoles) {
            return {
                type: 'excessive_role_mentions',
                severity: 3,
                reason: `Too many role mentions: ${roleMentions}/${config.mentions.maxRoles}`,
                action: config.mentions.action
            };
        }
        
        return null;
    },
    
    /**
     * Check for excessive caps
     */
    async checkCaps(message, config) {
        const content = message.content;
        if (content.length < config.caps.minLength) return null;
        
        const capsCount = (content.match(/[A-Z]/g) || []).length;
        const capsRatio = capsCount / content.length;
        
        if (capsRatio > config.caps.maxRatio) {
            return {
                type: 'excessive_caps',
                severity: 1,
                reason: `Excessive capitalization: ${Math.round(capsRatio * 100)}%`,
                action: config.caps.action
            };
        }
        
        return null;
    },
    
    /**
     * Check for repeated characters
     */
    async checkRepeatedChars(message, config) {
        const repeatedRegex = /(.)\1{9,}/g; // 10+ repeated chars
        const matches = message.content.match(repeatedRegex);
        
        if (matches) {
            const maxRepeated = Math.max(...matches.map(match => match.length));
            if (maxRepeated >= config.repeatedChars.maxRepeated) {
                return {
                    type: 'repeated_chars',
                    severity: 1,
                    reason: `Excessive repeated characters: ${maxRepeated} in a row`,
                    action: config.repeatedChars.action
                };
            }
        }
        
        return null;
    },
    
    /**
     * Check for zalgo text (excessive combining characters)
     */
    async checkZalgoText(message, config) {
        const combiningChars = message.content.match(/[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF]/g);
        if (combiningChars) {
            const ratio = combiningChars.length / message.content.length;
            if (ratio > config.zalgoText.threshold) {
                return {
                    type: 'zalgo_text',
                    severity: 2,
                    reason: `Zalgo/corrupted text detected (${Math.round(ratio * 100)}% combining chars)`,
                    action: config.zalgoText.action
                };
            }
        }
        return null;
    },
    
    /**
     * Check for phishing links
     */
    async checkPhishing(message, config) {
        const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
        const urls = message.content.match(urlRegex);
        
        if (urls) {
            for (const url of urls) {
                try {
                    const domain = new URL(url).hostname.toLowerCase();
                    if (PHISHING_DOMAINS.some(phishDomain => domain.includes(phishDomain))) {
                        return {
                            type: 'phishing_link',
                            severity: 4,
                            reason: `Suspected phishing domain: ${domain}`,
                            action: config.phishing.action
                        };
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        
        return null;
    },
    
    /**
     * Handle a violation with progressive punishment
     */
    async handleViolation(message, violation, config) {
        try {
            // Delete message if required
            if (violation.action.includes('delete')) {
                try {
                    await message.delete();
                } catch (error) {
                    logger.warn('Could not delete message:', error.message);
                }
            }
            
            // Log violation in database
            await database.logAutomodViolation(
                message.guild.id,
                message.author.id,
                violation.type,
                violation.reason,
                violation.severity
            );
            
            // Get user's violation history for progressive punishment
            const userViolations = await database.getUserViolations(
                message.guild.id, 
                message.author.id,
                Date.now() - VIOLATION_EXPIRY
            );
            
            const totalSeverity = userViolations.reduce((sum, v) => sum + v.severity, 0) + violation.severity;
            
            // Determine punishment based on total severity
            let punishment = null;
            if (config.punishments.progressive) {
                for (const [threshold, punishmentConfig] of Object.entries(config.punishments.severityLevels)) {
                    if (totalSeverity >= parseInt(threshold)) {
                        punishment = punishmentConfig;
                    }
                }
            }
            
            // Apply punishment
            if (punishment) {
                await this.applyPunishment(message, punishment, violation.reason, totalSeverity);
            } else {
                // Just warn the user
                await this.sendWarning(message, violation.reason);
            }
            
            // Log the action
            logger.info(`Automod violation: ${violation.type} by ${message.author.tag} in ${message.guild.name} (severity: ${totalSeverity})`);
            
        } catch (error) {
            logger.error('Error handling violation:', error);
        }
    },
    
    /**
     * Apply punishment to user
     */
    async applyPunishment(message, punishment, reason, totalSeverity) {
        const member = message.member;
        if (!member) return;
        
        try {
            let actionTaken = '';
            
            switch (punishment.action) {
                case 'warn':
                    await this.sendWarning(message, reason);
                    actionTaken = 'Warning issued';
                    break;
                    
                case 'timeout':
                    await member.timeout(punishment.duration, `Automod: ${reason}`);
                    await this.sendWarning(message, `You have been timed out for ${this.formatDuration(punishment.duration)}. Reason: ${reason}`);
                    actionTaken = `Timed out for ${this.formatDuration(punishment.duration)}`;
                    break;
                    
                case 'kick':
                    await member.kick(`Automod: ${reason}`);
                    actionTaken = 'Kicked from server';
                    break;
                    
                case 'ban':
                    await member.ban({ reason: `Automod: ${reason}`, deleteMessageDays: 1 });
                    actionTaken = 'Banned from server';
                    break;
            }
            
            // Log moderation action
            await database.logModerationAction(
                message.guild.id,
                message.author.id,
                message.client.user.id, // Bot as moderator
                punishment.action,
                reason,
                punishment.duration || 0
            );
            
            logger.info(`Automod punishment: ${actionTaken} for ${message.author.tag} (severity: ${totalSeverity})`);
            
        } catch (error) {
            logger.error('Error applying punishment:', error);
            await this.sendWarning(message, reason); // Fallback to warning
        }
    },
    
    /**
     * Send warning message to user
     */
    async sendWarning(message, reason) {
        try {
            // Try to send ephemeral reply first
            if (message.channel.type === 0) { // Text channel
                await message.channel.send({
                    content: `⚠️ **Automod Warning** <@${message.author.id}>\n${reason}`,
                    flags: MessageFlags.Ephemeral
                });
            }
        } catch (error) {
            // If ephemeral fails, try DM
            try {
                await message.author.send(`⚠️ **Automod Warning from ${message.guild.name}**\n${reason}`);
            } catch (dmError) {
                logger.warn('Could not send warning message:', dmError.message);
            }
        }
    },
    
    /**
     * Format duration in human readable format
     */
    formatDuration(ms) {
        const minutes = Math.floor(ms / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m`;
    },
    
    /**
     * Update guild automod configuration
     */
    async updateGuildConfig(guildId, config) {
        try {
            await database.updateAutomodConfig(guildId, config);
            logger.info(`Updated automod config for guild ${guildId}`);
        } catch (error) {
            logger.error('Error updating guild config:', error);
            throw error;
        }
    },
    
    /**
     * Get violation statistics for a user
     */
    async getUserStats(guildId, userId, timeframe = VIOLATION_EXPIRY) {
        try {
            const violations = await database.getUserViolations(guildId, userId, Date.now() - timeframe);
            const totalSeverity = violations.reduce((sum, v) => sum + v.severity, 0);
            const violationsByType = violations.reduce((acc, v) => {
                acc[v.type] = (acc[v.type] || 0) + 1;
                return acc;
            }, {});
            
            return {
                totalViolations: violations.length,
                totalSeverity,
                violationsByType,
                recentViolations: violations.slice(0, 5)
            };
        } catch (error) {
            logger.error('Error getting user stats:', error);
            return null;
        }
    }
};

