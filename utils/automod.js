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
    
    // New Advanced Rules
    massEmoji: {
        enabled: true,
        maxEmojis: 10,
        action: 'delete_warn'
    },
    
    newlineSpam: {
        enabled: true,
        maxNewlines: 15,
        action: 'delete_warn'
    },
    
    unicodeAbuse: {
        enabled: true,
        threshold: 0.3,
        action: 'delete_warn'
    },
    
    suspiciousAttachment: {
        enabled: true,
        blockedExtensions: ['.exe', '.bat', '.com', '.cmd', '.pif', '.scr', '.vbs', '.js'],
        action: 'delete_warn'
    },
    
    slowmode: {
        enabled: false,
        triggers: ['spam_frequency', 'advanced_spam'],
        duration: 30 // seconds
    },
    
    antiRaid: {
        enabled: true,
        joinThreshold: 10, // users joining within timeframe
        timeWindow: 60000, // 1 minute
        action: 'lockdown'
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
            if (message.author.bot || message.system) {return;}
            
            // Get guild configuration
            const config = await this.getGuildConfig(message.guild.id);
            if (!config.enabled) {return;}
            
            // Check exemptions
            if (await this.isExempt(message, config)) {return;}
            
            // Track message for spam detection
            await this.trackMessage(message);
            
            // Run all enabled rules
            const violations = [];
            
            if (config.spamDetection.enabled) {
                const spamViolation = await this.detectSpam(message, config);
                if (spamViolation) {violations.push(spamViolation);}
            }
            
            if (config.blacklistedWords.enabled) {
                const wordViolation = await this.checkBlacklistedWords(message, config);
                if (wordViolation) {violations.push(wordViolation);}
            }
            
            if (config.inviteLinks.enabled) {
                const inviteViolation = await this.checkInviteLinks(message, config);
                if (inviteViolation) {violations.push(inviteViolation);}
            }
            
            if (config.linkFilter.enabled) {
                const linkViolation = await this.checkLinks(message, config);
                if (linkViolation) {violations.push(linkViolation);}
            }
            
            if (config.mentions.enabled) {
                const mentionViolation = await this.checkMentions(message, config);
                if (mentionViolation) {violations.push(mentionViolation);}
            }
            
            if (config.caps.enabled) {
                const capsViolation = await this.checkCaps(message, config);
                if (capsViolation) {violations.push(capsViolation);}
            }
            
            if (config.repeatedChars.enabled) {
                const repeatViolation = await this.checkRepeatedChars(message, config);
                if (repeatViolation) {violations.push(repeatViolation);}
            }
            
            if (config.zalgoText.enabled) {
                const zalgoViolation = await this.checkZalgoText(message, config);
                if (zalgoViolation) {violations.push(zalgoViolation);}
            }
            
            if (config.phishing.enabled) {
                const phishingViolation = await this.checkPhishing(message, config);
                if (phishingViolation) {violations.push(phishingViolation);}
            }
            
            // New advanced rules
            if (config.massEmoji && config.massEmoji.enabled) {
                const emojiViolation = await this.checkMassEmoji(message, config);
                if (emojiViolation) {violations.push(emojiViolation);}
            }
            
            if (config.newlineSpam && config.newlineSpam.enabled) {
                const newlineViolation = await this.checkNewlineSpam(message, config);
                if (newlineViolation) {violations.push(newlineViolation);}
            }
            
            if (config.unicodeAbuse && config.unicodeAbuse.enabled) {
                const unicodeViolation = await this.checkUnicodeAbuse(message, config);
                if (unicodeViolation) {violations.push(unicodeViolation);}
            }
            
            if (config.suspiciousAttachment && config.suspiciousAttachment.enabled) {
                const attachmentViolation = await this.checkSuspiciousAttachments(message, config);
                if (attachmentViolation) {violations.push(attachmentViolation);}
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
        if (config.exemptUsers.includes(message.author.id)) {return true;}
        
        // Check channel exemptions
        if (config.exemptChannels.includes(message.channel.id)) {return true;}
        
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
        const now = Date.now();
        const recentMessages = userMessages.filter(msg => 
            now - msg.timestamp < config.spamDetection.timeWindow
        );
        
        // Advanced spam detection metrics
        const spamScore = await this.calculateSpamScore(message, recentMessages, config);
        
        if (spamScore.totalScore >= 10) {
            return {
                type: 'advanced_spam',
                severity: Math.min(5, Math.floor(spamScore.totalScore / 2)),
                reason: `Advanced spam detected (score: ${spamScore.totalScore}): ${spamScore.reasons.join(', ')}`,
                action: 'delete_warn',
                details: spamScore
            };
        }
        
        // Message frequency spam
        if (recentMessages.length >= config.spamDetection.maxMessages) {
            return {
                type: 'spam_frequency',
                severity: 3,
                reason: `Sent ${recentMessages.length} messages in ${config.spamDetection.timeWindow/1000} seconds`,
                action: 'delete_warn'
            };
        }
        
        // Duplicate content spam
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
     * Calculate advanced spam score using multiple metrics
     */
    async calculateSpamScore(message, recentMessages, config) {
        let totalScore = 0;
        const reasons = [];
        const content = message.content.toLowerCase();
        
        // 1. Message frequency analysis
        const messageCount = recentMessages.length;
        if (messageCount > config.spamDetection.maxMessages * 0.7) {
            const frequencyScore = Math.min(5, messageCount - config.spamDetection.maxMessages);
            totalScore += frequencyScore;
            reasons.push(`high frequency (${messageCount} msgs)`);
        }
        
        // 2. Content similarity clustering
        const similarityGroups = this.groupSimilarMessages(recentMessages, content);
        if (similarityGroups.maxGroupSize >= 3) {
            const similarityScore = Math.min(4, similarityGroups.maxGroupSize - 2);
            totalScore += similarityScore;
            reasons.push(`repeated content (${similarityGroups.maxGroupSize} similar)`);
        }
        
        // 3. Pattern detection (repeated characters, caps, etc.)
        const patternScore = this.analyzeMessagePatterns(content);
        if (patternScore > 0) {
            totalScore += patternScore;
            reasons.push('suspicious patterns');
        }
        
        // 4. Cross-channel spam detection
        const crossChannelScore = await this.checkCrossChannelSpam(message, recentMessages);
        if (crossChannelScore > 0) {
            totalScore += crossChannelScore;
            reasons.push('cross-channel spam');
        }
        
        // 5. Rapid emoji/mention spam
        const rapidSpamScore = this.checkRapidSpam(message, recentMessages);
        if (rapidSpamScore > 0) {
            totalScore += rapidSpamScore;
            reasons.push('rapid spam elements');
        }
        
        // 6. Time-based pattern analysis
        const temporalScore = this.analyzeTemporalPatterns(recentMessages);
        if (temporalScore > 0) {
            totalScore += temporalScore;
            reasons.push('bot-like timing');
        }
        
        return {
            totalScore,
            reasons,
            breakdown: {
                frequency: messageCount,
                similarity: similarityGroups,
                patterns: patternScore,
                crossChannel: crossChannelScore,
                rapidSpam: rapidSpamScore,
                temporal: temporalScore
            }
        };
    },
    
    /**
     * Group messages by similarity
     */
    groupSimilarMessages(recentMessages, currentContent) {
        const groups = [];
        const threshold = 0.8;
        
        // Add current message to comparison
        const allMessages = [...recentMessages.map(m => m.content), currentContent];
        
        for (const message of allMessages) {
            let addedToGroup = false;
            
            for (const group of groups) {
                if (group.some(msg => similarity.compareTwoStrings(message.toLowerCase(), msg.toLowerCase()) >= threshold)) {
                    group.push(message);
                    addedToGroup = true;
                    break;
                }
            }
            
            if (!addedToGroup) {
                groups.push([message]);
            }
        }
        
        return {
            groups: groups.length,
            maxGroupSize: Math.max(...groups.map(g => g.length)),
            totalMessages: allMessages.length
        };
    },
    
    /**
     * Analyze message patterns for spam indicators
     */
    analyzeMessagePatterns(content) {
        let score = 0;
        
        // Excessive repeated characters
        const repeatedChars = content.match(/(.)\1{4,}/g);
        if (repeatedChars) {
            score += Math.min(3, repeatedChars.length);
        }
        
        // All caps (if long enough)
        if (content.length > 20 && content === content.toUpperCase()) {
            score += 2;
        }
        
        // Excessive punctuation
        const punctuation = content.match(/[!?.,]{3,}/g);
        if (punctuation) {
            score += Math.min(2, punctuation.length);
        }
        
        // Common spam words
        const spamWords = ['free', 'money', 'winner', 'click here', 'urgent', 'limited time'];
        const foundSpamWords = spamWords.filter(word => content.includes(word.toLowerCase()));
        if (foundSpamWords.length > 0) {
            score += foundSpamWords.length;
        }
        
        return score;
    },
    
    /**
     * Check for cross-channel spam
     */
    async checkCrossChannelSpam(message, recentMessages) {
        const channels = new Set(recentMessages.map(m => m.channelId));
        channels.add(message.channel.id);
        
        // If posting in multiple channels rapidly
        if (channels.size >= 3) {
            return Math.min(4, channels.size - 2);
        }
        
        return 0;
    },
    
    /**
     * Check for rapid spam elements (emojis, mentions, etc.)
     */
    checkRapidSpam(message, recentMessages) {
        let score = 0;
        
        // Rapid emoji spam
        const emojiCount = (message.content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
        if (emojiCount > 5) {
            score += Math.min(3, Math.floor(emojiCount / 3));
        }
        
        // Rapid mention spam
        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        if (mentionCount > 3) {
            score += Math.min(3, mentionCount - 3);
        }
        
        // Very short messages sent rapidly
        if (message.content.length < 5 && recentMessages.length > 3) {
            score += 2;
        }
        
        return score;
    },
    
    /**
     * Analyze temporal patterns for bot-like behavior
     */
    analyzeTemporalPatterns(recentMessages) {
        if (recentMessages.length < 3) {return 0;}
        
        // Calculate intervals between messages
        const intervals = [];
        for (let i = 1; i < recentMessages.length; i++) {
            intervals.push(recentMessages[i].timestamp - recentMessages[i-1].timestamp);
        }
        
        // Check for suspiciously regular intervals (bot-like)
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((acc, interval) => acc + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Low variance in timing suggests automated behavior
        if (stdDev < 500 && avgInterval < 2000) { // Less than 500ms variance, under 2s average
            return 3;
        }
        
        return 0;
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
        if (content.length < config.caps.minLength) {return null;}
        
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
        if (!member) {return;}
        
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
        
        if (days > 0) {return `${days}d ${hours % 24}h`;}
        if (hours > 0) {return `${hours}h ${minutes % 60}m`;}
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
    },
    
    /**
     * Check for mass emoji spam
     */
    async checkMassEmoji(message, config) {
        // Count Unicode emojis
        const unicodeEmojiCount = (message.content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
        
        // Count custom Discord emojis
        const customEmojiCount = (message.content.match(/<a?:[a-zA-Z0-9_]+:[0-9]+>/g) || []).length;
        
        const totalEmojis = unicodeEmojiCount + customEmojiCount;
        
        if (totalEmojis > config.massEmoji.maxEmojis) {
            return {
                type: 'mass_emoji',
                severity: Math.min(3, Math.floor(totalEmojis / 5)),
                reason: `Excessive emoji usage: ${totalEmojis}/${config.massEmoji.maxEmojis}`,
                action: config.massEmoji.action
            };
        }
        
        return null;
    },
    
    /**
     * Check for newline spam
     */
    async checkNewlineSpam(message, config) {
        const newlineCount = (message.content.match(/\n/g) || []).length;
        
        if (newlineCount > config.newlineSpam.maxNewlines) {
            return {
                type: 'newline_spam',
                severity: Math.min(3, Math.floor(newlineCount / 10)),
                reason: `Excessive newlines: ${newlineCount}/${config.newlineSpam.maxNewlines}`,
                action: config.newlineSpam.action
            };
        }
        
        return null;
    },
    
    /**
     * Check for Unicode abuse (invisible characters, RTL overrides, etc.)
     */
    async checkUnicodeAbuse(message, config) {
        const content = message.content;
        let suspiciousCount = 0;
        const reasons = [];
        
        // Check for invisible/zero-width characters
        const invisibleChars = content.match(/[\u200B-\u200D\uFEFF\u00AD\u061C\u180E\u2060-\u2069]/g);
        if (invisibleChars && invisibleChars.length > 0) {
            suspiciousCount += invisibleChars.length;
            reasons.push(`${invisibleChars.length} invisible chars`);
        }
        
        // Check for RTL/LTR override characters (can be used for spoofing)
        const rtlChars = content.match(/[\u202A-\u202E]/g);
        if (rtlChars && rtlChars.length > 0) {
            suspiciousCount += rtlChars.length * 2; // Weight these higher
            reasons.push(`${rtlChars.length} directional override chars`);
        }
        
        // Check for homograph attack characters (similar looking characters)
        const homographs = content.match(/[\u0430-\u044F\u0410-\u042F]/g); // Cyrillic that looks like Latin
        if (homographs && homographs.length > content.length * 0.3) {
            suspiciousCount += Math.floor(homographs.length / 2);
            reasons.push('potential homograph attack');
        }
        
        const ratio = suspiciousCount / content.length;
        
        if (ratio > config.unicodeAbuse.threshold && suspiciousCount > 0) {
            return {
                type: 'unicode_abuse',
                severity: Math.min(4, Math.floor(ratio * 10)),
                reason: `Unicode abuse detected: ${reasons.join(', ')}`,
                action: config.unicodeAbuse.action
            };
        }
        
        return null;
    },
    
    /**
     * Check for suspicious attachments
     */
    async checkSuspiciousAttachments(message, config) {
        if (!message.attachments || message.attachments.size === 0) {
            return null;
        }
        
        const suspiciousAttachments = [];
        
        for (const attachment of message.attachments.values()) {
            const filename = attachment.name.toLowerCase();
            
            // Check for blocked extensions
            const hasBlockedExtension = config.suspiciousAttachment.blockedExtensions.some(ext => 
                filename.endsWith(ext.toLowerCase())
            );
            
            if (hasBlockedExtension) {
                suspiciousAttachments.push(attachment.name);
            }
            
            // Check for suspicious patterns
            if (filename.includes('.exe.') || filename.includes('.scr.') || filename.match(/\.(txt|jpg|png)\.exe$/)) {
                suspiciousAttachments.push(attachment.name);
            }
            
            // Check for double extensions
            const extensions = filename.match(/\.[a-z0-9]+/g);
            if (extensions && extensions.length > 1) {
                const lastExt = extensions[extensions.length - 1];
                if (config.suspiciousAttachment.blockedExtensions.includes(lastExt)) {
                    suspiciousAttachments.push(attachment.name);
                }
            }
        }
        
        if (suspiciousAttachments.length > 0) {
            return {
                type: 'suspicious_attachment',
                severity: 4, // High severity for potential malware
                reason: `Suspicious attachments: ${suspiciousAttachments.join(', ')}`,
                action: config.suspiciousAttachment.action
            };
        }
        
        return null;
    }
};

