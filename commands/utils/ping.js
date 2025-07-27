const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Check bot latency and API response time'),
    
    async execute(interaction) {
        const sent = await interaction.reply({ content: '🏓 Pinging...' }).withResponse();
        
        const embed = new EmbedBuilder()
            .setColor('#ffff00')
            .setTitle('🏓 Pong!')
            .addFields(
                { name: '📡 Latency', value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true },
                { name: '💓 API Latency', value: `${Math.round(interaction.client.ws.ping)}ms`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Support Bot` });

        await interaction.editReply({ content: '', embeds: [embed] });
    },
};
