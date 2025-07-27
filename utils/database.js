const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, '../data/bot.db');
        this.ensureDataDir();
        this.db = null;
        this.init();
    }

    ensureDataDir() {
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    init() {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                logger.error('Database connection failed', { error: err.message });
            } else {
                logger.success('Database connected successfully');
                this.createTables();
            }
        });
    }

    createTables() {
        const tables = [
            // User stats and preferences
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                discriminator TEXT,
                first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                command_count INTEGER DEFAULT 0,
                warnings INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Moderation logs
            `CREATE TABLE IF NOT EXISTS mod_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                moderator_id TEXT NOT NULL,
                action TEXT NOT NULL,
                reason TEXT,
                duration INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (guild_id) REFERENCES guilds(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,

            // Command usage statistics
            `CREATE TABLE IF NOT EXISTS command_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                command_name TEXT NOT NULL,
                user_id TEXT NOT NULL,
                guild_id TEXT,
                execution_time INTEGER,
                success BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Warnings system
            `CREATE TABLE IF NOT EXISTS warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                moderator_id TEXT NOT NULL,
                reason TEXT NOT NULL,
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        tables.forEach((table, index) => {
            this.db.run(table, (err) => {
                if (err) {
                    logger.error(`Failed to create table ${index + 1}`, { error: err.message });
                } else {
                    logger.debug(`Table ${index + 1} created/verified`);
                }
            });
        });
    }

    // User management
    async getUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    }

    async createOrUpdateUser(userId, username, discriminator = null) {
        return new Promise((resolve, reject) => {
            const query = `INSERT OR REPLACE INTO users 
                (id, username, discriminator, last_seen, updated_at) 
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
            
            this.db.run(query, [userId, username, discriminator], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });
    }

    async incrementUserCommands(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET command_count = command_count + 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
                [userId],
                function(err) {
                    if (err) reject(err);
                    resolve(this.changes);
                }
            );
        });
    }

    // Guild management
    async getGuild(guildId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM guilds WHERE id = ?', [guildId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    }

    async createOrUpdateGuild(guildId, name, settings = {}) {
        return new Promise((resolve, reject) => {
            const query = `INSERT OR REPLACE INTO guilds 
                (id, name, prefix, log_channel, mod_role, admin_role, welcome_channel, welcome_message, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
            
            this.db.run(query, [
                guildId, 
                name, 
                settings.prefix || '!',
                settings.logChannel || null,
                settings.modRole || null,
                settings.adminRole || null,
                settings.welcomeChannel || null,
                settings.welcomeMessage || null
            ], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });
    }

    // Moderation logs
    async addModLog(guildId, userId, moderatorId, action, reason = null, duration = null) {
        return new Promise((resolve, reject) => {
            const query = `INSERT INTO mod_logs 
                (guild_id, user_id, moderator_id, action, reason, duration) 
                VALUES (?, ?, ?, ?, ?, ?)`;
            
            this.db.run(query, [guildId, userId, moderatorId, action, reason, duration], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });
    }

    // Command statistics
    async logCommand(commandName, userId, guildId = null, executionTime = null, success = true) {
        return new Promise((resolve, reject) => {
            const query = `INSERT INTO command_stats 
                (command_name, user_id, guild_id, execution_time, success) 
                VALUES (?, ?, ?, ?, ?)`;
            
            this.db.run(query, [commandName, userId, guildId, executionTime, success], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });
    }

    async getCommandStats(timeRange = '24 HOURS') {
        return new Promise((resolve, reject) => {
            const query = `SELECT 
                command_name,
                COUNT(*) as usage_count,
                AVG(execution_time) as avg_execution_time,
                SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
                SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count
                FROM command_stats 
                WHERE created_at >= datetime('now', '-${timeRange}')
                GROUP BY command_name
                ORDER BY usage_count DESC`;
            
            this.db.all(query, [], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
    }

    // Warnings system
    async addWarning(guildId, userId, moderatorId, reason) {
        return new Promise((resolve, reject) => {
            const query = `INSERT INTO warnings 
                (guild_id, user_id, moderator_id, reason) 
                VALUES (?, ?, ?, ?)`;
            
            this.db.run(query, [guildId, userId, moderatorId, reason], function(err) {
                if (err) reject(err);
                resolve(this.lastID);
            });
        });
    }

    async getUserWarnings(guildId, userId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1 ORDER BY created_at DESC',
                [guildId, userId],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });
    }

    // Close database connection
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    logger.error('Error closing database', { error: err.message });
                } else {
                    logger.info('Database connection closed');
                }
            });
        }
    }
}

module.exports = new Database();
