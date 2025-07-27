const { SlashCommandBuilder } = require('discord.js');
const automod = require('../../utils/automod');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config-automod')
        .setDescription('Configure automod rules for the server')
        .addStringOption(option =>
            option.setName('rule')
                .setDescription('The automod rule to configure')
                .setRequired(true)
                .addChoices(
                    { name: 'Spam Detection', value: 'spamDetection' },
                    { name: 'Blacklisted Words', value: 'blacklistedWords' },
                    { name: 'Invite Links', value: 'inviteLinks' },
                    { name: 'Caps Lock', value: 'caps' },
                    { name: 'Mass Mentions', value: 'mentions' },
                    { name: 'Mass Emoji', value: 'massEmoji' },
                    { name: 'Unicode Abuse', value: 'unicodeAbuse' },
                    { name: 'Newline Spam', value: 'newlineSpam' },
                    { name: 'Suspicious Attachments', value: 'suspiciousAttachment' },
                    { name: 'Phishing Links', value: 'phishing' }   
                )
        )
        .addBooleanOption(option =>
            option.setName('enable')
                .setDescription('Enable or disable the rule')
        ),

    async execute(interaction) {
        const rule = interaction.options.getString('rule');
        const enable = interaction.options.getBoolean('enable');

        try {
            // Fetch current configuration
            const config = await automod.getGuildConfig(interaction.guild.id);
            if (enable !== null) { // Check if change requested
                config[rule].enabled = enable;

                // Update the configuration
                await automod.updateGuildConfig(interaction.guild.id, config);

                await interaction.reply({
                    content: `${rule.charAt(0).toUpperCase() + rule.slice(1)} rule is now ${enable ? 'enabled' : 'disabled'}.`,
                    ephemeral: true
                });
            } else {
                // Report current rule status
                await interaction.reply({
                    content: `${rule.charAt(0).toUpperCase() + rule.slice(1)} rule is currently ${config[rule].enabled ? 'enabled' : 'disabled'}.`,
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('Error configuring automod:', error);
            await interaction.reply({
                content: 'An error occurred while configuring automod. Please try again.',
                ephemeral: true
            });
        }
    },
};

