const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin - heads or tails?'),
    
    async execute(interaction) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const emoji = result === 'Heads' ? '🪙' : '🥇';
        
        const embed = new EmbedBuilder()
            .setColor(result === 'Heads' ? '#FFD700' : '#C0C0C0')
            .setTitle('🪙 Coin Flip')
            .setDescription(`${emoji} **${result}**!`)
            .setTimestamp()
            .setFooter({ text: `Flipped by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
