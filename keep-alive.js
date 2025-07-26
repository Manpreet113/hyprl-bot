// Keep-Alive Script for Render
// This script pings the bot every 14 minutes to prevent sleep

const https = require('https');

const BOT_URL = process.env.RENDER_EXTERNAL_URL || 'https://hyprl-bot.onrender.com';
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes

function pingBot() {
    const url = new URL(BOT_URL);
    
    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'GET',
        timeout: 10000
    };

    const req = https.request(options, (res) => {
        console.log(`✅ Keep-alive ping: ${res.statusCode} - ${new Date().toISOString()}`);
    });
    
    req.on('error', (err) => {
        console.log(`❌ Keep-alive error: ${err.message} - ${new Date().toISOString()}`);
    });
    
    req.on('timeout', () => {
        console.log(`⏰ Keep-alive timeout - ${new Date().toISOString()}`);
        req.destroy();
    });
    
    req.end();
}

// Only run keep-alive in production on Render
if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
    console.log('🔄 Starting keep-alive service...');
    
    // Initial ping after 1 minute
    setTimeout(pingBot, 60000);
    
    // Set up interval pinging
    setInterval(pingBot, PING_INTERVAL);
} else {
    console.log('⏭️ Keep-alive service disabled (not on Render)');
}
