const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const aiHandler = require('../../handlers/ai/aiHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('topics')
        .setDescription('Show available documentation topics that the AI can help with'),
    
    async execute(interaction) {
        try {
            // Access the knowledge base
            const knowledgeBase = aiHandler.knowledgeBase;
            
            if (!knowledgeBase || !knowledgeBase.topics) {
                return await interaction.reply({
                    content: '❌ Knowledge base not available!',
                    flags: MessageFlags.Ephemeral
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`📚 ${knowledgeBase.project.name} Documentation Topics`)
                .setDescription(`Available topics you can ask about using \`/ask\`:`)
                .setTimestamp()
                .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} AI Assistant` });

            // Add each topic as a field
            for (const [topicName, topicData] of Object.entries(knowledgeBase.topics)) {
                const keywords = topicData.keywords.slice(0, 5).join(', '); // Show first 5 keywords
                const moreKeywords = topicData.keywords.length > 5 ? ` (+${topicData.keywords.length - 5} more)` : '';
                
                embed.addFields({
                    name: `📋 ${topicName.charAt(0).toUpperCase() + topicName.slice(1)}`,
                    value: `**Keywords:** ${keywords}${moreKeywords}\\n**Preview:** ${topicData.content.substring(0, 100)}...`,
                    inline: false
                });
            }

            // Add helpful information
            embed.addFields({
                name: '💡 How to Use',
                value: `• Use \`/ask <question>\` to get AI-powered answers\\n• Keywords help the AI find relevant information\\n• Example: \`/ask how to install hyprl\``,
                inline: false
            });

            embed.addFields({
                name: '🔗 Additional Resources',
                value: `[📖 Full Documentation](${knowledgeBase.project.documentation}) | [💻 Repository](${knowledgeBase.project.repository})`,
                inline: false
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in topics command:', error);
            await interaction.reply({
                content: '❌ An error occurred while fetching topics.',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
