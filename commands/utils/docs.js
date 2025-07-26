const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('docs')
        .setDescription('Get the link to HyprL documentation'),
    
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📚 HyprL Documentation')
            .setDescription(`You can find the official ${process.env.PROJECT_NAME || 'HyprL'} documentation here:`)
            .addFields(
                { name: '📖 Documentation', value: `[Click here](${process.env.DOCS_URL || 'https://your-docs-site.com'})`, inline: true },
                { name: '🔗 Project Repository', value: `[GitHub](${process.env.PROJECT_URL || 'https://github.com/yourusername/hyprl'})`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Support Bot` });

        await interaction.reply({ embeds: [embed] });
    },
};
