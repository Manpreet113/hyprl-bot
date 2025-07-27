const fs = require('fs');
const path = require('path');
const http = require('http');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();

// Load keep-alive service for Render
require('./keep-alive');

const automod = require('./utils/automod');

// Create a new client instance with comprehensive intents
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ] 
});

client.on('messageCreate', async message => {
    await automod.processMessage(message);
});

// Initialize command collection
client.commands = new Collection();

// Load commands dynamically from folders
const commandFolders = fs.readdirSync(path.join(__dirname, 'commands'));
for (const folder of commandFolders) {
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands', folder)).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${folder}/${file}`);
        client.commands.set(command.data.name, command);
    }
}

// Load events dynamically
const eventFiles = fs.readdirSync(path.join(__dirname, 'events')).filter(file => file.endsWith('.js'));
for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Register all slash commands
async function registerCommands() {
    const commands = [];
    
    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(__dirname, 'commands', folder)).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./commands/${folder}/${file}`);
            commands.push(command.data.toJSON());
        }
    }
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log('🔄 Started refreshing application (/) commands...');
        
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        
        console.log('✅ Successfully reloaded application (/) commands!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

// Error handling
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

// HTTP Health Check Server (for Render deployment)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'online',
        bot: client.user?.tag || 'Starting...',
        guilds: client.guilds.cache.size,
        users: client.users.cache.size,
        commands: client.commands.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

// Start the bot
async function startBot() {
    try {
        await registerCommands();
        await client.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

startBot();
