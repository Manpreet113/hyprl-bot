const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const aiHandler = require('../../handlers/ai/aiHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('learn')
        .setDescription('Teach the AI new information about HyprL (Admin only)')
        .addStringOption(option =>
            option.setName('topic')
                .setDescription('Topic name (e.g., "installation", "configuration")')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('keywords')
                .setDescription('Keywords separated by commas (e.g., "install,setup,build")')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('content')
                .setDescription('Information content to teach the AI')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    async execute(interaction) {
        // Additional owner check
        if (interaction.user.id !== process.env.OWNER_ID) {
            return await interaction.reply({
                content: '❌ Only the bot owner can teach new information!',
                flags: MessageFlags.Ephemeral
            });
        }

        const topic = interaction.options.getString('topic').toLowerCase();
        const keywordsStr = interaction.options.getString('keywords');
        const content = interaction.options.getString('content');
        
        // Parse keywords
        const keywords = keywordsStr.split(',').map(k => k.trim().toLowerCase());
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        try {
            const success = await aiHandler.updateKnowledgeBase(topic, keywords, content);
            
            if (success) {
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🧠 AI Learning Complete')
                    .addFields(
                        { name: '📚 Topic', value: topic, inline: true },
                        { name: '🔑 Keywords', value: keywords.join(', '), inline: true },
                        { name: '📝 Content Preview', value: content.substring(0, 200) + (content.length > 200 ? '...' : ''), inline: false }
                    )
                    .setTimestamp()
                    .setFooter({ text: `Taught by ${interaction.user.tag}` });

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({
                    content: '❌ Failed to update the knowledge base. Please try again.'
                });
            }

        } catch (error) {
            console.error('Error in learn command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while updating the knowledge base.'
            });
        }
    },
};
