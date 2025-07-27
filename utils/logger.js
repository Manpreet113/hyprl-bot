const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaString = Object.keys(meta).length ? ` | ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
    }

    writeToFile(level, formattedMessage) {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `${date}.log`);
        
        fs.appendFileSync(logFile, formattedMessage + '\n');
        
        // Also write errors to separate error log
        if (level === 'error') {
            const errorFile = path.join(this.logDir, `${date}-errors.log`);
            fs.appendFileSync(errorFile, formattedMessage + '\n');
        }
    }

    log(level, message, meta = {}) {
        const formattedMessage = this.formatMessage(level, message, meta);
        
        // Console output with colors
        const colors = {
            error: '\x1b[31m',
            warn: '\x1b[33m',
            info: '\x1b[36m',
            debug: '\x1b[37m',
            success: '\x1b[32m'
        };
        
        console.log(colors[level] || '\x1b[37m', formattedMessage, '\x1b[0m');
        
        // File output
        this.writeToFile(level, formattedMessage);
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development') {
            this.log('debug', message, meta);
        }
    }

    success(message, meta = {}) {
        this.log('success', message, meta);
    }

    // Command usage logging
    logCommand(interaction, executionTime = null) {
        this.info('Command executed', {
            command: interaction.commandName,
            user: interaction.user.tag,
            userId: interaction.user.id,
            guild: interaction.guild?.name || 'DM',
            guildId: interaction.guild?.id || null,
            executionTime: executionTime ? `${executionTime}ms` : null
        });
    }

    // Error logging with stack trace
    logError(error, context = {}) {
        this.error(error.message, {
            stack: error.stack,
            ...context
        });
    }
}

module.exports = new Logger();
