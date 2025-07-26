const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll a dice with a specified number of sides')
        .addIntegerOption(option =>
            option.setName('sides')
                .setDescription('Number of sides on the dice')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(100)),
    async execute(interaction) {
        const sides = interaction.options.getInteger('sides');
        const result = Math.floor(Math.random() * sides) + 1;

        const embed = new EmbedBuilder()
            .setColor('#ff6347')
            .setTitle('🎲 Dice Roll')
            .addFields(
                { name: 'Sides', value: `${sides}`, inline: true },
                { name: 'Result', value: `${result}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Rolled by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};

