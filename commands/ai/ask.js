const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const aiHandler = require('../../handlers/ai/aiHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask AI about HyprL documentation and get intelligent answers')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Your question about HyprL')
                .setRequired(true)),
    
    async execute(interaction) {
        const question = interaction.options.getString('question');
        
        // Defer reply as AI processing might take time
        await interaction.deferReply();
        
        try {
            // Get AI response
            const result = await aiHandler.generateResponse(question);
            
            const embed = new EmbedBuilder()
                .setColor(result.success ? '#00ff00' : '#ff9900')
                .setTitle('🤖 AI Documentation Assistant')
                .addFields(
                    { name: '❓ Your Question', value: question, inline: false },
                    { name: '💡 Answer', value: result.response.substring(0, 1000) + (result.response.length > 1000 ? '...' : ''), inline: false }
                )
                .setTimestamp()
                .setFooter({ 
                    text: `Source: ${result.source} | Asked by ${interaction.user.tag}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            // Add relevant topics if found
            if (result.relevantTopics && result.relevantTopics.length > 0) {
                const topics = result.relevantTopics.map(topic => `• ${topic.name}`).join('\\n');
                embed.addFields({ name: '📋 Related Topics', value: topics, inline: false });
            }

            // Add helpful links
            const links = [
                `[📖 Documentation](${process.env.DOCS_URL})`,
                `[💻 Repository](${process.env.PROJECT_URL})`,
                '[🎫 Create Ticket](/ticket create)'
            ].join(' | ');
            
            embed.addFields({ name: '🔗 Helpful Links', value: links, inline: false });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in ask command:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ Error')
                .setDescription('Sorry, I encountered an error while processing your question. Please try again later.')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },
};
