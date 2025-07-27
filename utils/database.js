const { Pool } = require('pg');
const logger = require('./logger');

class Database {
    constructor() {
        this.pool = null;
        this.init();
    }

    init() {
        // Use Supabase connection string from environment
        const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

        if (!connectionString) {
            logger.error('No database connection string provided. Please set DATABASE_URL or SUPABASE_DB_URL environment variable.');
            return;
        }

        this.pool = new Pool({
            connectionString,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.pool.on('error', (err) => {
            logger.error('Unexpected error on idle client', { error: err.message });
        });

        // Test connection
        this.testConnection();
    }

    async testConnection() {
        try {
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            logger.success('Database connected successfully');
            await this.createTables();
        } catch (err) {
            logger.error('Database connection failed', { error: err.message });
        }
    }

    async createTables() {
        const tables = [
            // User stats and preferences
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                discriminator TEXT,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                command_count INTEGER DEFAULT 0,
                warnings INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Guild settings
            `CREATE TABLE IF NOT EXISTS guilds (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                prefix TEXT DEFAULT '!',
                log_channel TEXT,
                mod_role TEXT,
                admin_role TEXT,
                welcome_channel TEXT,
                welcome_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Moderation logs
            `CREATE TABLE IF NOT EXISTS mod_logs (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                moderator_id TEXT NOT NULL,
                action TEXT NOT NULL,
                reason TEXT,
                duration INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Command usage statistics
            `CREATE TABLE IF NOT EXISTS command_stats (
                id SERIAL PRIMARY KEY,
                command_name TEXT NOT NULL,
                user_id TEXT NOT NULL,
                guild_id TEXT,
                execution_time INTEGER,
                success BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Warnings system
            `CREATE TABLE IF NOT EXISTS warnings (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                moderator_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Automod configuration per guild
            `CREATE TABLE IF NOT EXISTS automod_config (
                guild_id TEXT PRIMARY KEY,
                enabled BOOLEAN DEFAULT TRUE,
                spam_detection BOOLEAN DEFAULT TRUE,
                spam_threshold INTEGER DEFAULT 5,
                spam_window INTEGER DEFAULT 10,
                blacklist_enabled BOOLEAN DEFAULT TRUE,
                invites_enabled BOOLEAN DEFAULT TRUE,
                mentions_enabled BOOLEAN DEFAULT TRUE,
                mentions_limit INTEGER DEFAULT 5,
                caps_enabled BOOLEAN DEFAULT TRUE,
                caps_threshold REAL DEFAULT 0.7,
                repeated_chars_enabled BOOLEAN DEFAULT TRUE,
                repeated_chars_limit INTEGER DEFAULT 5,
                links_enabled BOOLEAN DEFAULT FALSE,
                phishing_enabled BOOLEAN DEFAULT TRUE,
                zalgo_enabled BOOLEAN DEFAULT TRUE,
                warning_threshold INTEGER DEFAULT 3,
                timeout_threshold INTEGER DEFAULT 5,
                kick_threshold INTEGER DEFAULT 7,
                ban_threshold INTEGER DEFAULT 10,
                timeout_duration INTEGER DEFAULT 600,
                log_channel TEXT,
                immune_roles TEXT,
                ignored_channels TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Automod violations log
            `CREATE TABLE IF NOT EXISTS automod_violations (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                message_id TEXT,
                violation_type TEXT NOT NULL,
                content TEXT,
                action_taken TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // User message tracking for spam detection
            `CREATE TABLE IF NOT EXISTS user_message_tracking (
                id SERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        try {
            for (let i = 0; i < tables.length; i++) {
                await this.pool.query(tables[i]);
                logger.debug(`Table ${i + 1} created/verified`);
            }
            logger.success('All database tables created/verified');
        } catch (err) {
            logger.error('Failed to create tables', { error: err.message });
        }
    }

    // User management
    async getUser(userId) {
        try {
            const result = await this.pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            return result.rows[0] || null;
        } catch (err) {
            logger.error('Error getting user', { userId, error: err.message });
            throw err;
        }
    }

    async createOrUpdateUser(userId, username, discriminator = null) {
        try {
            const query = `
                INSERT INTO users (id, username, discriminator, last_seen, updated_at) 
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET
                    username = EXCLUDED.username,
                    discriminator = EXCLUDED.discriminator,
                    last_seen = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id`;
            
            const result = await this.pool.query(query, [userId, username, discriminator]);
            return result.rows[0].id;
        } catch (err) {
            logger.error('Error creating/updating user', { userId, username, error: err.message });
            throw err;
        }
    }

    async incrementUserCommands(userId) {
        try {
            const result = await this.pool.query(
                'UPDATE users SET command_count = command_count + 1, last_seen = CURRENT_TIMESTAMP WHERE id = $1',
                [userId]
            );
            return result.rowCount;
        } catch (err) {
            logger.error('Error incrementing user commands', { userId, error: err.message });
            throw err;
        }
    }

    // Guild management
    async getGuild(guildId) {
        try {
            const result = await this.pool.query('SELECT * FROM guilds WHERE id = $1', [guildId]);
            return result.rows[0] || null;
        } catch (err) {
            logger.error('Error getting guild', { guildId, error: err.message });
            throw err;
        }
    }

    async createOrUpdateGuild(guildId, name, settings = {}) {
        try {
            const query = `
                INSERT INTO guilds (id, name, prefix, log_channel, mod_role, admin_role, welcome_channel, welcome_message, updated_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    prefix = COALESCE(EXCLUDED.prefix, guilds.prefix),
                    log_channel = COALESCE(EXCLUDED.log_channel, guilds.log_channel),
                    mod_role = COALESCE(EXCLUDED.mod_role, guilds.mod_role),
                    admin_role = COALESCE(EXCLUDED.admin_role, guilds.admin_role),
                    welcome_channel = COALESCE(EXCLUDED.welcome_channel, guilds.welcome_channel),
                    welcome_message = COALESCE(EXCLUDED.welcome_message, guilds.welcome_message),
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id`;
            
            const result = await this.pool.query(query, [
                guildId, 
                name, 
                settings.prefix || '!',
                settings.logChannel || null,
                settings.modRole || null,
                settings.adminRole || null,
                settings.welcomeChannel || null,
                settings.welcomeMessage || null
            ]);
            return result.rows[0].id;
        } catch (err) {
            logger.error('Error creating/updating guild', { guildId, name, error: err.message });
            throw err;
        }
    }

    // Moderation logs
    async addModLog(guildId, userId, moderatorId, action, reason = null, duration = null) {
        try {
            const query = `INSERT INTO mod_logs 
                (guild_id, user_id, moderator_id, action, reason, duration) 
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
            
            const result = await this.pool.query(query, [guildId, userId, moderatorId, action, reason, duration]);
            return result.rows[0].id;
        } catch (err) {
            logger.error('Error adding mod log', { guildId, userId, action, error: err.message });
            throw err;
        }
    }

    async getModLogs(guildId, userId = null, limit = 50) {
        try {
            let query = 'SELECT * FROM mod_logs WHERE guild_id = $1';
            const params = [guildId];
            
            if (userId) {
                query += ' AND user_id = $2';
                params.push(userId);
            }
            
            query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
            params.push(limit);
            
            const result = await this.pool.query(query, params);
            return result.rows;
        } catch (err) {
            logger.error('Error getting mod logs', { guildId, userId, error: err.message });
            throw err;
        }
    }

    // Command statistics
    async logCommand(commandName, userId, guildId = null, executionTime = null, success = true) {
        try {
            const query = `INSERT INTO command_stats 
                (command_name, user_id, guild_id, execution_time, success) 
                VALUES ($1, $2, $3, $4, $5) RETURNING id`;
            
            const result = await this.pool.query(query, [commandName, userId, guildId, executionTime, success]);
            return result.rows[0].id;
        } catch (err) {
            logger.error('Error logging command', { commandName, userId, error: err.message });
            throw err;
        }
    }

    async getCommandStats(timeRange = '24 hours') {
        try {
            const query = `SELECT 
                command_name,
                COUNT(*) as usage_count,
                AVG(execution_time) as avg_execution_time,
                SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as error_count
                FROM command_stats 
                WHERE created_at >= NOW() - INTERVAL '${timeRange}'
                GROUP BY command_name
                ORDER BY usage_count DESC`;
            
            const result = await this.pool.query(query);
            return result.rows;
        } catch (err) {
            logger.error('Error getting command stats', { timeRange, error: err.message });
            throw err;
        }
    }

    async getGlobalStats() {
        try {
            const queries = {
                totalUsers: 'SELECT COUNT(*) as count FROM users',
                totalGuilds: 'SELECT COUNT(*) as count FROM guilds',
                totalCommands: 'SELECT COUNT(*) as count FROM command_stats',
                totalWarnings: 'SELECT COUNT(*) as count FROM warnings WHERE active = true',
                totalModActions: 'SELECT COUNT(*) as count FROM mod_logs'
            };

            const results = {};
            for (const [key, query] of Object.entries(queries)) {
                const result = await this.pool.query(query);
                results[key] = parseInt(result.rows[0].count);
            }

            return results;
        } catch (err) {
            logger.error('Error getting global stats', { error: err.message });
            throw err;
        }
    }

    // Warnings system
    async addWarning(guildId, userId, moderatorId, reason) {
        try {
            const query = `INSERT INTO warnings 
                (guild_id, user_id, moderator_id, reason) 
                VALUES ($1, $2, $3, $4) RETURNING id`;
            
            const result = await this.pool.query(query, [guildId, userId, moderatorId, reason]);
            
            // Update user warnings count
            await this.pool.query(
                'UPDATE users SET warnings = warnings + 1 WHERE id = $1',
                [userId]
            );
            
            return result.rows[0].id;
        } catch (err) {
            logger.error('Error adding warning', { guildId, userId, reason, error: err.message });
            throw err;
        }
    }

    async getUserWarnings(guildId, userId) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM warnings WHERE guild_id = $1 AND user_id = $2 AND active = true ORDER BY created_at DESC',
                [guildId, userId]
            );
            return result.rows;
        } catch (err) {
            logger.error('Error getting user warnings', { guildId, userId, error: err.message });
            throw err;
        }
    }

    async removeWarning(warningId) {
        try {
            const result = await this.pool.query(
                'UPDATE warnings SET active = false WHERE id = $1 RETURNING user_id',
                [warningId]
            );
            
            if (result.rowCount > 0) {
                // Decrease user warnings count
                await this.pool.query(
                    'UPDATE users SET warnings = warnings - 1 WHERE id = $1 AND warnings > 0',
                    [result.rows[0].user_id]
                );
            }
            
            return result.rowCount;
        } catch (err) {
            logger.error('Error removing warning', { warningId, error: err.message });
            throw err;
        }
    }

    // Automod methods
    async getAutomodConfig(guildId) {
        try {
            const result = await this.pool.query(
                'SELECT * FROM automod_config WHERE guild_id = $1',
                [guildId]
            );
            
            if (result.rows.length === 0) {
                return null;
            }
            
            const config = result.rows[0];
            
            // Parse JSON fields
            return {
                ...config,
                immune_roles: config.immune_roles ? config.immune_roles.split(',') : [],
                ignored_channels: config.ignored_channels ? config.ignored_channels.split(',') : []
            };
        } catch (err) {
            logger.error('Error getting automod config', { guildId, error: err.message });
            throw err;
        }
    }

    async updateAutomodConfig(guildId, config) {
        try {
            const query = `
                INSERT INTO automod_config (
                    guild_id, enabled, spam_detection, spam_threshold, spam_window,
                    blacklist_enabled, invites_enabled, mentions_enabled, mentions_limit,
                    caps_enabled, caps_threshold, repeated_chars_enabled, repeated_chars_limit,
                    links_enabled, phishing_enabled, zalgo_enabled,
                    warning_threshold, timeout_threshold, kick_threshold, ban_threshold,
                    timeout_duration, log_channel, immune_roles, ignored_channels,
                    updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                    $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP
                )
                ON CONFLICT (guild_id) DO UPDATE SET
                    enabled = EXCLUDED.enabled,
                    spam_detection = EXCLUDED.spam_detection,
                    spam_threshold = EXCLUDED.spam_threshold,
                    spam_window = EXCLUDED.spam_window,
                    blacklist_enabled = EXCLUDED.blacklist_enabled,
                    invites_enabled = EXCLUDED.invites_enabled,
                    mentions_enabled = EXCLUDED.mentions_enabled,
                    mentions_limit = EXCLUDED.mentions_limit,
                    caps_enabled = EXCLUDED.caps_enabled,
                    caps_threshold = EXCLUDED.caps_threshold,
                    repeated_chars_enabled = EXCLUDED.repeated_chars_enabled,
                    repeated_chars_limit = EXCLUDED.repeated_chars_limit,
                    links_enabled = EXCLUDED.links_enabled,
                    phishing_enabled = EXCLUDED.phishing_enabled,
                    zalgo_enabled = EXCLUDED.zalgo_enabled,
                    warning_threshold = EXCLUDED.warning_threshold,
                    timeout_threshold = EXCLUDED.timeout_threshold,
                    kick_threshold = EXCLUDED.kick_threshold,
                    ban_threshold = EXCLUDED.ban_threshold,
                    timeout_duration = EXCLUDED.timeout_duration,
                    log_channel = EXCLUDED.log_channel,
                    immune_roles = EXCLUDED.immune_roles,
                    ignored_channels = EXCLUDED.ignored_channels,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING guild_id`;
            
            const result = await this.pool.query(query, [
                guildId,
                config.enabled ?? true,
                config.spam_detection ?? true,
                config.spam_threshold ?? 5,
                config.spam_window ?? 10,
                config.blacklist_enabled ?? true,
                config.invites_enabled ?? true,
                config.mentions_enabled ?? true,
                config.mentions_limit ?? 5,
                config.caps_enabled ?? true,
                config.caps_threshold ?? 0.7,
                config.repeated_chars_enabled ?? true,
                config.repeated_chars_limit ?? 5,
                config.links_enabled ?? false,
                config.phishing_enabled ?? true,
                config.zalgo_enabled ?? true,
                config.warning_threshold ?? 3,
                config.timeout_threshold ?? 5,
                config.kick_threshold ?? 7,
                config.ban_threshold ?? 10,
                config.timeout_duration ?? 600,
                config.log_channel || null,
                config.immune_roles ? config.immune_roles.join(',') : '',
                config.ignored_channels ? config.ignored_channels.join(',') : ''
            ]);
            
            return result.rows[0].guild_id;
        } catch (err) {
            logger.error('Error updating automod config', { guildId, error: err.message });
            throw err;
        }
    }

    async logAutomodViolation(guildId, userId, channelId, messageId, violationType, content, actionTaken) {
        try {
            const query = `
                INSERT INTO automod_violations 
                (guild_id, user_id, channel_id, message_id, violation_type, content, action_taken) 
                VALUES ($1, $2, $3, $4, $5, $6, $7) 
                RETURNING id`;
            
            const result = await this.pool.query(query, [
                guildId, userId, channelId, messageId, violationType, content, actionTaken
            ]);
            
            return result.rows[0].id;
        } catch (err) {
            logger.error('Error logging automod violation', { 
                guildId, userId, violationType, error: err.message 
            });
            throw err;
        }
    }

    async getUserViolations(guildId, userId, since = null) {
        try {
            let query = `
                SELECT * FROM automod_violations 
                WHERE guild_id = $1 AND user_id = $2`;
            
            const params = [guildId, userId];
            
            if (since) {
                query += ' AND created_at >= $3';
                params.push(new Date(since));
            }
            
            query += ' ORDER BY created_at DESC';
            
            const result = await this.pool.query(query, params);
            return result.rows;
        } catch (err) {
            logger.error('Error getting user violations', { guildId, userId, error: err.message });
            throw err;
        }
    }

    async trackMessage(guildId, userId, content, channelId) {
        try {
            // Create a simple hash of the message content
            const crypto = require('crypto');
            const contentHash = crypto.createHash('sha256').update(content.toLowerCase()).digest('hex');
            
            const query = `
                INSERT INTO user_message_tracking 
                (guild_id, user_id, channel_id, message_id, content_hash) 
                VALUES ($1, $2, $3, $4, $5)`;
            
            await this.pool.query(query, [guildId, userId, channelId, 'temp', contentHash]);
            
            // Clean old messages (older than 1 hour)
            await this.pool.query(`
                DELETE FROM user_message_tracking 
                WHERE created_at < NOW() - INTERVAL '1 hour'`
            );
            
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
        if (this.pool) {
            await this.pool.end();
            logger.info('Database connection closed');
        }
    }
}

module.exports = new Database();
