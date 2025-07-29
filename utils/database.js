const { createClient } = require('@supabase/supabase-js');
const logger = require('./logger');

class Database {
    constructor() {
        this.supabase = null;
        this.init();
    }

    init() {
        // Initialize Supabase client
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            logger.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
            return;
        }

        this.supabase = createClient(supabaseUrl, supabaseKey);
        
        // Test connection
        this.testConnection();
    }

    async testConnection() {
        try {
            // Test connection with a simple query
            const { data, error } = await this.supabase
                .from('users')
                .select('count')
                .limit(1);
                
            if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist, which is expected
                throw error;
            }
            
            logger.success('Supabase connected successfully');
            logger.info('Database initialization complete - tables should be created manually in Supabase dashboard');
        } catch (err) {
            logger.error('Supabase connection failed', { error: err.message });
        }
    }

    // Note: Tables should be created manually in Supabase dashboard
    getTableSchemas() {
        return {
            users: {
                id: 'TEXT PRIMARY KEY',
                username: 'TEXT NOT NULL',
                discriminator: 'TEXT',
                first_seen: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                last_seen: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                command_count: 'INTEGER DEFAULT 0',
                warnings: 'INTEGER DEFAULT 0',
                created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            guilds: {
                id: 'TEXT PRIMARY KEY',
                name: 'TEXT NOT NULL',
                prefix: 'TEXT DEFAULT \'!\'',
                log_channel: 'TEXT',
                mod_role: 'TEXT',
                admin_role: 'TEXT',
                welcome_channel: 'TEXT',
                welcome_message: 'TEXT',
                created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            mod_logs: {
                id: 'SERIAL PRIMARY KEY',
                guild_id: 'TEXT NOT NULL',
                user_id: 'TEXT NOT NULL',
                moderator_id: 'TEXT NOT NULL',
                action: 'TEXT NOT NULL',
                reason: 'TEXT',
                duration: 'INTEGER',
                created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            command_stats: {
                id: 'SERIAL PRIMARY KEY',
                command_name: 'TEXT NOT NULL',
                user_id: 'TEXT NOT NULL',
                guild_id: 'TEXT',
                execution_time: 'INTEGER',
                success: 'BOOLEAN DEFAULT TRUE',
                created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            warnings: {
                id: 'SERIAL PRIMARY KEY',
                guild_id: 'TEXT NOT NULL',
                user_id: 'TEXT NOT NULL',
                moderator_id: 'TEXT NOT NULL',
                reason: 'TEXT NOT NULL',
                active: 'BOOLEAN DEFAULT TRUE',
                created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            automod_config: {
                guild_id: 'TEXT PRIMARY KEY',
                enabled: 'BOOLEAN DEFAULT TRUE',
                spam_detection: 'BOOLEAN DEFAULT TRUE',
                spam_threshold: 'INTEGER DEFAULT 5',
                spam_window: 'INTEGER DEFAULT 10',
                blacklist_enabled: 'BOOLEAN DEFAULT TRUE',
                blacklist_words: 'TEXT[]',
                invites_enabled: 'BOOLEAN DEFAULT TRUE',
                mentions_enabled: 'BOOLEAN DEFAULT TRUE',
                mentions_limit: 'INTEGER DEFAULT 5',
                caps_enabled: 'BOOLEAN DEFAULT TRUE',
                caps_threshold: 'REAL DEFAULT 0.7',
                repeated_chars_enabled: 'BOOLEAN DEFAULT TRUE',
                repeated_chars_limit: 'INTEGER DEFAULT 5',
                links_enabled: 'BOOLEAN DEFAULT FALSE',
                phishing_enabled: 'BOOLEAN DEFAULT TRUE',
                zalgo_enabled: 'BOOLEAN DEFAULT TRUE',
                mass_emoji_enabled: 'BOOLEAN DEFAULT TRUE',
                mass_emoji_limit: 'INTEGER DEFAULT 10',
                newline_spam_enabled: 'BOOLEAN DEFAULT TRUE',
                newline_spam_limit: 'INTEGER DEFAULT 15',
                unicode_abuse_enabled: 'BOOLEAN DEFAULT TRUE',
                unicode_abuse_threshold: 'REAL DEFAULT 0.3',
                suspicious_attachment_enabled: 'BOOLEAN DEFAULT TRUE',
                warning_threshold: 'INTEGER DEFAULT 3',
                timeout_threshold: 'INTEGER DEFAULT 5',
                kick_threshold: 'INTEGER DEFAULT 7',
                ban_threshold: 'INTEGER DEFAULT 10',
                timeout_duration: 'INTEGER DEFAULT 600',
                log_channel: 'TEXT',
                immune_roles: 'TEXT[]',
                ignored_channels: 'TEXT[]',
                created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
                updated_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            automod_violations: {
                id: 'SERIAL PRIMARY KEY',
                guild_id: 'TEXT NOT NULL',
                user_id: 'TEXT NOT NULL', 
                channel_id: 'TEXT NOT NULL',
                message_id: 'TEXT',
                violation_type: 'TEXT NOT NULL',
                content: 'TEXT',
                action_taken: 'TEXT NOT NULL',
                severity: 'INTEGER DEFAULT 1',
                created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            },
            user_message_tracking: {
                id: 'SERIAL PRIMARY KEY',
                guild_id: 'TEXT NOT NULL',
                user_id: 'TEXT NOT NULL',
                channel_id: 'TEXT NOT NULL', 
                message_id: 'TEXT NOT NULL',
                content_hash: 'TEXT NOT NULL',
                created_at: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
            }
        };
    }

    // User management
    async getUser(userId) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
                
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            
            return data || null;
        } catch (err) {
            logger.error('Error getting user', { userId, error: err.message });
            throw err;
        }
    }

    async createOrUpdateUser(userId, username, discriminator = null) {
        try {
            const userData = {
                id: userId,
                username,
                discriminator,
                last_seen: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            const { data, error } = await this.supabase
                .from('users')
                .upsert(userData)
                .select('id')
                .single();
                
            if (error) {
                throw error;
            }
            
            return data.id;
        } catch (err) {
            logger.error('Error creating/updating user', { userId, username, error: err.message });
            throw err;
        }
    }

    async incrementUserCommands(userId) {
        try {
            // First get current count
            const { data: user, error: getError } = await this.supabase
                .from('users')
                .select('command_count')
                .eq('id', userId)
                .single();
                
            if (getError && getError.code !== 'PGRST116') {
                throw getError;
            }
            
            const currentCount = user?.command_count || 0;
            
            const { data, error } = await this.supabase
                .from('users')
                .update({
                    command_count: currentCount + 1,
                    last_seen: new Date().toISOString()
                })
                .eq('id', userId)
                .select();
                
            if (error) {
                throw error;
            }
            
            return data?.length || 0;
        } catch (err) {
            logger.error('Error incrementing user commands', { userId, error: err.message });
            throw err;
        }
    }

    // Guild management
    async getGuild(guildId) {
        try {
            const { data, error } = await this.supabase
                .from('guilds')
                .select('*')
                .eq('id', guildId)
                .single();
                
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            
            return data || null;
        } catch (err) {
            logger.error('Error getting guild', { guildId, error: err.message });
            throw err;
        }
    }

    async createOrUpdateGuild(guildId, name, settings = {}) {
        try {
            // First try to get existing guild to merge settings
            const existing = await this.getGuild(guildId);
            
            const guildData = {
                id: guildId,
                name,
                prefix: settings.prefix || existing?.prefix || '!',
                log_channel: settings.logChannel || existing?.log_channel || null,
                mod_role: settings.modRole || existing?.mod_role || null,
                admin_role: settings.adminRole || existing?.admin_role || null,
                welcome_channel: settings.welcomeChannel || existing?.welcome_channel || null,
                welcome_message: settings.welcomeMessage || existing?.welcome_message || null,
                updated_at: new Date().toISOString()
            };
            
            const { data, error } = await this.supabase
                .from('guilds')
                .upsert(guildData)
                .select('id')
                .single();
                
            if (error) {
                throw error;
            }
            
            return data.id;
        } catch (err) {
            logger.error('Error creating/updating guild', { guildId, name, error: err.message });
            throw err;
        }
    }

    // Moderation logs
    async addModLog(guildId, userId, moderatorId, action, reason = null, duration = null) {
        try {
            const { data, error } = await this.supabase
                .from('mod_logs')
                .insert({
                    guild_id: guildId,
                    user_id: userId,
                    moderator_id: moderatorId,
                    action,
                    reason,
                    duration
                })
                .select('id')
                .single();
                
            if (error) {
                throw error;
            }
            
            return data.id;
        } catch (err) {
            logger.error('Error adding mod log', { guildId, userId, action, error: err.message });
            throw err;
        }
    }

    async getModLogs(guildId, userId = null, limit = 50) {
        try {
            let query = this.supabase
                .from('mod_logs')
                .select('*')
                .eq('guild_id', guildId);
            
            if (userId) {
                query = query.eq('user_id', userId);
            }
            
            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(limit);
                
            if (error) {
                throw error;
            }
            
            return data || [];
        } catch (err) {
            logger.error('Error getting mod logs', { guildId, userId, error: err.message });
            throw err;
        }
    }

    // Command statistics
    async logCommand(commandName, userId, guildId = null, executionTime = null, success = true) {
        try {
            const { data, error } = await this.supabase
                .from('command_stats')
                .insert({
                    command_name: commandName,
                    user_id: userId,
                    guild_id: guildId,
                    execution_time: executionTime,
                    success
                })
                .select('id')
                .single();
                
            if (error) {
                throw error;
            }
            
            return data.id;
        } catch (err) {
            logger.error('Error logging command', { commandName, userId, error: err.message });
            throw err;
        }
    }

    async getCommandStats(timeRange = '24 hours') {
        try {
            // Note: Supabase doesn't support interval arithmetic like PostgreSQL
            // For now, we'll calculate the timestamp in JavaScript
            const hoursAgo = parseInt(timeRange.split(' ')[0]) || 24;
            const sinceTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
            
            const { data, error } = await this.supabase
                .from('command_stats')
                .select('*')
                .gte('created_at', sinceTime);
                
            if (error) {
                throw error;
            }
            
            // Group and aggregate in JavaScript since Supabase doesn't support complex aggregations
            const stats = {};
            data.forEach(row => {
                if (!stats[row.command_name]) {
                    stats[row.command_name] = {
                        command_name: row.command_name,
                        usage_count: 0,
                        total_execution_time: 0,
                        execution_count: 0,
                        success_count: 0,
                        error_count: 0
                    };
                }
                
                stats[row.command_name].usage_count++;
                if (row.execution_time) {
                    stats[row.command_name].total_execution_time += row.execution_time;
                    stats[row.command_name].execution_count++;
                }
                if (row.success) {
                    stats[row.command_name].success_count++;
                } else {
                    stats[row.command_name].error_count++;
                }
            });
            
            // Calculate averages and sort
            const result = Object.values(stats).map(stat => ({
                ...stat,
                avg_execution_time: stat.execution_count > 0 ? 
                    stat.total_execution_time / stat.execution_count : null
            })).sort((a, b) => b.usage_count - a.usage_count);
            
            return result;
        } catch (err) {
            logger.error('Error getting command stats', { timeRange, error: err.message });
            throw err;
        }
    }

    async getGlobalStats() {
        try {
            // Get counts from each table separately
            const results = {};
            
            // Total users
            const { count: totalUsers } = await this.supabase
                .from('users')
                .select('*', { count: 'exact', head: true });
            results.totalUsers = totalUsers || 0;
            
            // Total guilds
            const { count: totalGuilds } = await this.supabase
                .from('guilds')
                .select('*', { count: 'exact', head: true });
            results.totalGuilds = totalGuilds || 0;
            
            // Total commands
            const { count: totalCommands } = await this.supabase
                .from('command_stats')
                .select('*', { count: 'exact', head: true });
            results.totalCommands = totalCommands || 0;
            
            // Total warnings
            const { count: totalWarnings } = await this.supabase
                .from('warnings')
                .select('*', { count: 'exact', head: true })
                .eq('active', true);
            results.totalWarnings = totalWarnings || 0;
            
            // Total mod actions
            const { count: totalModActions } = await this.supabase
                .from('mod_logs')
                .select('*', { count: 'exact', head: true });
            results.totalModActions = totalModActions || 0;

            return results;
        } catch (err) {
            logger.error('Error getting global stats', { error: err.message });
            throw err;
        }
    }

    // Warnings system
    async addWarning(guildId, userId, moderatorId, reason) {
        try {
            const { data, error } = await this.supabase
                .from('warnings')
                .insert({
                    guild_id: guildId,
                    user_id: userId,
                    moderator_id: moderatorId,
                    reason
                })
                .select('id')
                .single();
                
            if (error) {
                throw error;
            }
            
            // Update user warnings count
            const { data: user, error: getUserError } = await this.supabase
                .from('users')
                .select('warnings')
                .eq('id', userId)
                .single();
                
            if (getUserError && getUserError.code !== 'PGRST116') {
                logger.warn('Could not get user for warning count update', { userId, error: getUserError.message });
            } else {
                const currentWarnings = user?.warnings || 0;
                await this.supabase
                    .from('users')
                    .update({ warnings: currentWarnings + 1 })
                    .eq('id', userId);
            }
            
            return data.id;
        } catch (err) {
            logger.error('Error adding warning', { guildId, userId, reason, error: err.message });
            throw err;
        }
    }

    async getUserWarnings(guildId, userId) {
        try {
            const { data, error } = await this.supabase
                .from('warnings')
                .select('*')
                .eq('guild_id', guildId)
                .eq('user_id', userId)
                .eq('active', true)
                .order('created_at', { ascending: false });
                
            if (error) {
                throw error;
            }
            
            return data || [];
        } catch (err) {
            logger.error('Error getting user warnings', { guildId, userId, error: err.message });
            throw err;
        }
    }

    async removeWarning(warningId) {
        try {
            const { data, error } = await this.supabase
                .from('warnings')
                .update({ active: false })
                .eq('id', warningId)
                .select('user_id')
                .single();
                
            if (error) {
                throw error;
            }
            
            if (data) {
                // Decrease user warnings count
                const { data: user, error: getUserError } = await this.supabase
                    .from('users')
                    .select('warnings')
                    .eq('id', data.user_id)
                    .single();
                    
                if (!getUserError && user && user.warnings > 0) {
                    await this.supabase
                        .from('users')
                        .update({ warnings: user.warnings - 1 })
                        .eq('id', data.user_id);
                }
            }
            
            return data ? 1 : 0;
        } catch (err) {
            logger.error('Error removing warning', { warningId, error: err.message });
            throw err;
        }
    }

    // Automod methods
    async getAutomodConfig(guildId) {
        try {
            const { data, error } = await this.supabase
                .from('automod_config')
                .select('*')
                .eq('guild_id', guildId)
                .single();
                
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            
            if (!data) {
                return null;
            }
            
            // Parse array fields (Supabase handles arrays differently)
            return {
                ...data,
                immune_roles: data.immune_roles || [],
                ignored_channels: data.ignored_channels || [],
                blacklist_words: data.blacklist_words || []
            };
        } catch (err) {
            logger.error('Error getting automod config', { guildId, error: err.message });
            throw err;
        }
    }

    async updateAutomodConfig(guildId, config) {
        try {
            // This function now correctly maps the nested config object from the application
            // to the flat schema of the 'automod_config' table in Supabase.
            const automodData = {
                guild_id: guildId,
                enabled: config.enabled ?? true,
                spam_detection: config.spamDetection?.enabled ?? true,
                spam_threshold: config.spamDetection?.maxMessages ?? 5,
                spam_window: config.spamDetection?.timeWindow ?? 10000,
                blacklist_enabled: config.blacklistedWords?.enabled ?? true,
                blacklist_words: config.blacklistedWords?.words ?? [],
                invites_enabled: config.inviteLinks?.enabled ?? true,
                mentions_enabled: config.mentions?.enabled ?? true,
                mentions_limit: config.mentions?.maxUsers ?? 5,
                caps_enabled: config.caps?.enabled ?? true,
                caps_threshold: config.caps?.maxRatio ?? 0.7,
                repeated_chars_enabled: config.repeatedChars?.enabled ?? true,
                repeated_chars_limit: config.repeatedChars?.maxRepeated ?? 10,
                links_enabled: config.linkFilter?.enabled ?? false,
                phishing_enabled: config.phishing?.enabled ?? true,
                zalgo_enabled: config.zalgoText?.enabled ?? true,
                mass_emoji_enabled: config.massEmoji?.enabled ?? true,
                mass_emoji_limit: config.massEmoji?.maxEmojis ?? 10,
                newline_spam_enabled: config.newlineSpam?.enabled ?? true,
                newline_spam_limit: config.newlineSpam?.maxNewlines ?? 15,
                unicode_abuse_enabled: config.unicodeAbuse?.enabled ?? true,
                unicode_abuse_threshold: config.unicodeAbuse?.threshold ?? 0.3,
                suspicious_attachment_enabled: config.suspiciousAttachment?.enabled ?? true,
                warning_threshold: config.punishments?.severityLevels?.[1]?.action === 'warn' ? 1 : 3,
                timeout_threshold: config.punishments?.severityLevels?.[5]?.action === 'timeout' ? 5 : 5,
                kick_threshold: config.punishments?.severityLevels?.[25]?.action === 'kick' ? 25 : 7,
                ban_threshold: config.punishments?.severityLevels?.[35]?.action === 'ban' ? 35 : 10,
                timeout_duration: config.punishments?.severityLevels?.[5]?.duration / 1000 ?? 600,
                log_channel: config.log_channel || null,
                immune_roles: config.exemptRoles ?? [],
                ignored_channels: config.exemptChannels ?? [],
                updated_at: new Date().toISOString()
            };
            
            const { data, error } = await this.supabase
                .from('automod_config')
                .upsert(automodData)
                .select('guild_id')
                .single();
                
            if (error) {
                throw error;
            }
            
            return data.guild_id;
        } catch (err) {
            logger.error('Error updating automod config', { guildId, error: err.message });
            throw err;
        }
    }

    async logAutomodViolation(guildId, userId, channelId, messageId, violationType, content, actionTaken) {
        try {
            const { data, error } = await this.supabase
                .from('automod_violations')
                .insert({
                    guild_id: guildId,
                    user_id: userId,
                    channel_id: channelId,
                    message_id: messageId,
                    violation_type: violationType,
                    content: content,
                    action_taken: actionTaken
                })
                .select('id')
                .single();
                
            if (error) {
                throw error;
            }
            
            return data.id;
        } catch (err) {
            logger.error('Error logging automod violation', { 
                guildId, userId, violationType, error: err.message 
            });
            throw err;
        }
    }

    async getUserViolations(guildId, userId, since = null) {
        try {
            let query = this.supabase
                .from('automod_violations')
                .select('*')
                .eq('guild_id', guildId)
                .eq('user_id', userId);

            if (since) {
                const sinceDate = new Date(since).toISOString();
                query = query.gte('created_at', sinceDate);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                throw error;
            }

            return data || [];
        } catch (err) {
            logger.error('Error getting user violations', { guildId, userId, error: err.message });
            throw err;
        }
    }

    async trackMessage(guildId, userId, content, channelId, messageId = 'temp') {
        try {
            // Create a simple hash of the message content
            const crypto = require('crypto');
            const contentHash = crypto.createHash('sha256').update(content.toLowerCase()).digest('hex');

            await this.supabase
                .from('user_message_tracking')
                .insert({
                    guild_id: guildId,
                    user_id: userId,
                    channel_id: channelId,
                    message_id: messageId,
                    content_hash: contentHash
                });

            // Clean old messages (older than 1 hour)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            await this.supabase
                .from('user_message_tracking')
                .delete()
                .lt('created_at', oneHourAgo);

        } catch (err) {
            logger.error('Error tracking message', { guildId, userId, error: err.message });
            // Don't throw error for message tracking as it's not critical
        }
    }

    async logModerationAction(guildId, userId, moderatorId, action, reason, duration = 0) {
        try {
            return await this.addModLog(guildId, userId, moderatorId, action, reason, duration);
        } catch (err) {
            logger.error('Error logging moderation action', { 
                guildId, userId, action, error: err.message 
            });
            throw err;
        }
    }

    // Close database connection
    async close() {
        // Supabase client doesn't need explicit connection closing
        logger.info('Database connection closed');
    }
}

module.exports = new Database();
