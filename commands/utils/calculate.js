const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calculate')
        .setDescription('Perform basic math calculations')
        .addStringOption(option =>
            option.setName('expression')
                .setDescription('Math expression to calculate (e.g., 2+2, 10*5, 100/4)')
                .setRequired(true)),
    
    async execute(interaction) {
        const expression = interaction.options.getString('expression');
        
        // Sanitize input - only allow numbers, operators, parentheses, and spaces
        if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
            return await interaction.reply({
                content: '❌ Invalid expression! Only use numbers and basic operators (+, -, *, /, parentheses).',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            // Use Function constructor as a safer alternative to eval
            const result = Function(`"use strict"; return (${expression})`)();
            
            if (!isFinite(result)) {
                throw new Error('Result is not a finite number');
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🧮 Calculator')
                .addFields(
                    { name: '📝 Expression', value: `\`${expression}\``, inline: false },
                    { name: '🔢 Result', value: `\`${result}\``, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: `Calculated by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Calculation error:', error);
            await interaction.reply({
                content: '❌ Invalid mathematical expression! Please check your syntax.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
