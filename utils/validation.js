const { EmbedBuilder } = require('discord.js');

class ValidationUtils {
    // Sanitize text input to prevent XSS and injection attacks
    static sanitizeText(text, maxLength = 2000) {
        if (!text || typeof text !== 'string') return '';
        
        return text
            .trim()
            .slice(0, maxLength)
            .replace(/[<>@]/g, '') // Remove potential Discord markup
            .replace(/```/g, '`') // Prevent code block injection
            .replace(/https?:\/\/[^\s]+/g, '[URL]'); // Replace URLs for safety
    }

    // Validate mathematical expressions more securely
    static validateMathExpression(expression) {
        // Only allow safe mathematical characters
        const safePattern = /^[0-9+\-*/().^%\s]+$/;
        
        if (!safePattern.test(expression)) {
            return { valid: false, error: 'Expression contains invalid characters' };
        }

        // Check for dangerous patterns
        const dangerousPatterns = [
            /while\s*\(/i,
            /for\s*\(/i,
            /function/i,
            /eval/i,
            /constructor/i,
            /prototype/i,
            /__/,
            /\[\]/,
            /\{\}/
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(expression)) {
                return { valid: false, error: 'Expression contains potentially dangerous patterns' };
            }
        }

        // Limit expression length
        if (expression.length > 100) {
            return { valid: false, error: 'Expression is too long (max 100 characters)' };
        }

        return { valid: true };
    }

    // Validate URLs
    static validateURL(url) {
        try {
            const urlObj = new URL(url);
            
            // Only allow http/https
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return { valid: false, error: 'Only HTTP/HTTPS URLs are allowed' };
            }

            // Block localhost and private IPs for security
            const hostname = urlObj.hostname.toLowerCase();
            if (hostname === 'localhost' || 
                hostname.startsWith('127.') || 
                hostname.startsWith('192.168.') ||
                hostname.startsWith('10.') ||
                hostname.startsWith('172.')) {
                return { valid: false, error: 'Private/localhost URLs are not allowed' };
            }

            return { valid: true, url: urlObj };
        } catch (error) {
            return { valid: false, error: 'Invalid URL format' };
        }
    }

    // Check if user has required permissions
    static hasPermission(member, requiredPermissions) {
        if (!member || !requiredPermissions) return false;
        
        // Bot owner always has permission
        if (member.id === process.env.OWNER_ID) return true;
        
        return member.permissions.has(requiredPermissions);
    }

    // Create standardized error embed
    static createErrorEmbed(title, description, ephemeral = true) {
        return {
            embeds: [new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle(`❌ ${title}`)
                .setDescription(description)
                .setTimestamp()
            ],
            ephemeral
        };
    }

    // Create standardized success embed
    static createSuccessEmbed(title, description, ephemeral = false) {
        return {
            embeds: [new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle(`✅ ${title}`)
                .setDescription(description)
                .setTimestamp()
            ],
            ephemeral
        };
    }

    // Validate Discord mention patterns
    static validateMention(mention, type = 'user') {
        const patterns = {
            user: /^<@!?(\d{17,19})>$/,
            role: /^<@&(\d{17,19})>$/,
            channel: /^<#(\d{17,19})>$/
        };

        const match = mention.match(patterns[type]);
        return match ? match[1] : null;
    }

    // Rate limit check helper
    static checkRateLimit(userId, commandName, cooldownTime = 3000) {
        const cooldowns = require('./cooldowns');
        return cooldowns.isOnCooldown(userId, commandName, cooldownTime);
    }
}

module.exports = ValidationUtils;
