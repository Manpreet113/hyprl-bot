const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Read version from package.json
let version = '1.0.0';
try {
    const packagePath = path.join(__dirname, '../../package.json');
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    version = packageData.version;
} catch (error) {
    console.log('Could not read package.json version');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Show bot information and statistics'),
    
    async execute(interaction) {
        const client = interaction.client;
        
        // Calculate uptime
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = Math.floor(uptime) % 60;
        
        const uptimeString = [
            days > 0 ? `${days}d` : '',
            hours > 0 ? `${hours}h` : '',
            minutes > 0 ? `${minutes}m` : '',
            `${seconds}s`
        ].filter(Boolean).join(' ');

        // Calculate memory usage
        const memoryUsage = process.memoryUsage();
        const memoryUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const memoryTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`🤖 ${client.user.username} Information`)
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`A comprehensive Discord bot for ${process.env.PROJECT_NAME || 'HyprL'} support server`)
            .addFields(
                { name: '📊 Statistics', value: `**Servers:** ${client.guilds.cache.size}\n**Users:** ${client.users.cache.size}\n**Commands:** ${client.commands.size}`, inline: true },
                { name: '⏱️ Uptime', value: uptimeString, inline: true },
                { name: '💾 Memory Usage', value: `${memoryUsed}MB / ${memoryTotal}MB`, inline: true },
                { name: '🏓 Latency', value: `**API:** ${Math.round(client.ws.ping)}ms\n**Bot:** ${Date.now() - interaction.createdTimestamp}ms`, inline: true },
                { name: '🔧 Version', value: `**Bot:** v${version}\n**Node.js:** ${process.version}\n**Discord.js:** v14`, inline: true },
                { name: '📅 Created', value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:F>`, inline: true },
                { name: '🛠️ Developer', value: process.env.OWNER_ID ? `<@${process.env.OWNER_ID}>` : 'Unknown', inline: true },
                { name: '🔗 Links', value: `[Repository](${process.env.PROJECT_URL})\n[Documentation](${process.env.DOCS_URL})`, inline: true },
                { name: '🎯 Features', value: '• Moderation System\n• Ticket Support\n• Music Player\n• Project Integration', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Support Bot` });

        await interaction.reply({ embeds: [embed] });
    },
};
