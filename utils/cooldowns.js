const { Collection } = require('discord.js');

class CooldownManager {
    constructor() {
        this.cooldowns = new Collection();
        this.globalCooldowns = new Collection();
    }

    // Check if user is on cooldown for a specific command
    isOnCooldown(userId, commandName, cooldownTime = 3000) {
        const key = `${userId}-${commandName}`;
        const now = Date.now();
        
        if (this.cooldowns.has(key)) {
            const expirationTime = this.cooldowns.get(key) + cooldownTime;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return timeLeft;
            }
        }
        
        this.cooldowns.set(key, now);
        return false;
    }

    // Global rate limiting (across all commands)
    isOnGlobalCooldown(userId, cooldownTime = 1000) {
        const now = Date.now();
        
        if (this.globalCooldowns.has(userId)) {
            const expirationTime = this.globalCooldowns.get(userId) + cooldownTime;
            
            if (now < expirationTime) {
                const timeLeft = (expirationTime - now) / 1000;
                return timeLeft;
            }
        }
        
        this.globalCooldowns.set(userId, now);
        return false;
    }

    // Clear expired cooldowns periodically
    cleanup() {
        const now = Date.now();
        
        // Clean command-specific cooldowns (older than 10 minutes)
        this.cooldowns.sweep((timestamp) => now - timestamp > 600000);
        
        // Clean global cooldowns (older than 1 minute)
        this.globalCooldowns.sweep((timestamp) => now - timestamp > 60000);
    }

    // Get formatted time left string
    formatTimeLeft(timeLeft) {
        if (timeLeft >= 60) {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = Math.floor(timeLeft % 60);
            return `${minutes}m ${seconds}s`;
        }
        return `${Math.ceil(timeLeft)}s`;
    }
}

// Start cleanup interval
const cooldownManager = new CooldownManager();
setInterval(() => cooldownManager.cleanup(), 300000); // Clean every 5 minutes

module.exports = cooldownManager;
