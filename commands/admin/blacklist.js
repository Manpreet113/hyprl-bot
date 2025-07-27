const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const automod = require('../../utils/automod');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Manage blacklisted words for automod')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a word to the blacklist')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to blacklist')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a word from the blacklist')
                .addStringOption(option =>
                    option.setName('word')
                        .setDescription('The word to remove from blacklist')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View all blacklisted words'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear')
                .setDescription('Clear all blacklisted words'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const word = interaction.options.getString('word');

        try {
            const config = await automod.getGuildConfig(interaction.guild.id);
            
            switch (subcommand) {
            case 'add':
                if (!config.blacklistedWords.words.includes(word.toLowerCase())) {
                    config.blacklistedWords.words.push(word.toLowerCase());
                    await automod.updateGuildConfig(interaction.guild.id, config);
                        
                    await interaction.reply({
                        content: `✅ Added "${word}" to the blacklist.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `⚠️ "${word}" is already in the blacklist.`,
                        ephemeral: true
                    });
                }
                break;

            case 'remove':
                const index = config.blacklistedWords.words.indexOf(word.toLowerCase());
                if (index > -1) {
                    config.blacklistedWords.words.splice(index, 1);
                    await automod.updateGuildConfig(interaction.guild.id, config);
                        
                    await interaction.reply({
                        content: `✅ Removed "${word}" from the blacklist.`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `⚠️ "${word}" is not in the blacklist.`,
                        ephemeral: true
                    });
                }
                break;

            case 'list':
                if (config.blacklistedWords.words.length === 0) {
                    await interaction.reply({
                        content: '📋 No words are currently blacklisted.',
                        ephemeral: true
                    });
                } else {
                    const embed = new EmbedBuilder()
                        .setColor('#ff9900')
                        .setTitle('🚫 Blacklisted Words')
                        .setDescription(`**${config.blacklistedWords.words.length}** words currently blacklisted:`)
                        .addFields({
                            name: 'Words',
                            value: config.blacklistedWords.words.map(w => `• ${w}`).join('\\n'),
                            inline: false
                        })
                        .setFooter({
                            text: `Blacklist is ${config.blacklistedWords.enabled ? 'enabled' : 'disabled'}`
                        })
                        .setTimestamp();

                    await interaction.reply({
                        embeds: [embed],
                        ephemeral: true
                    });
                }
                break;

            case 'clear':
                const wordCount = config.blacklistedWords.words.length;
                config.blacklistedWords.words = [];
                await automod.updateGuildConfig(interaction.guild.id, config);
                    
                await interaction.reply({
                    content: `✅ Cleared ${wordCount} words from the blacklist.`,
                    ephemeral: true
                });
                break;
            }

        } catch (error) {
            console.error('Error in blacklist command:', error);
            await interaction.reply({
                content: '❌ An error occurred while managing the blacklist. Please try again.',
                ephemeral: true
            });
        }
    },
};
