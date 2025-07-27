const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`✅ ${client.user.tag} is online and ready!`);
        console.log(`🔗 Serving ${client.guilds.cache.size} guild(s)`);
        console.log(`👥 Watching ${client.users.cache.size} user(s)`);
        
        // Set bot activity
        client.user.setActivity(`Reading ${process.env.PROJECT_NAME || 'HyprL'} docs`, { 
            type: ActivityType.Reading
        });
    },
};
