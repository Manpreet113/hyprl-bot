const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display detailed information about a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to get info about')
                .setRequired(false)),
    
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const member = interaction.guild.members.cache.get(user.id);
        
        // User flags
        const flags = user.flags?.toArray();
        const flagEmojis = {
            'Staff': '👮',
            'Partner': '🤝',
            'Hypesquad': '🎉',
            'BugHunterLevel1': '🐛',
            'BugHunterLevel2': '🐛',
            'HypesquadOnlineHouse1': '🏠', // Bravery
            'HypesquadOnlineHouse2': '🏠', // Brilliance
            'HypesquadOnlineHouse3': '🏠', // Balance
            'PremiumEarlySupporter': '💎',
            'VerifiedDeveloper': '👨‍💻',
            'CertifiedModerator': '🛡️',
            'BotHTTPInteractions': '🤖'
        };

        const userFlags = flags?.map(flag => `${flagEmojis[flag] || '🏷️'} ${flag}`).join('\n') || 'None';

        const embed = new EmbedBuilder()
            .setColor(member?.displayHexColor || '#0099ff')
            .setTitle(`👤 User Information`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '🏷️ Tag', value: user.tag, inline: true },
                { name: '🆔 ID', value: user.id, inline: true },
                { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
                { name: '📅 Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: '🏆 Badges', value: userFlags, inline: false }
            );

        // Add server-specific information if member exists
        if (member) {
            embed.addFields(
                { name: '📅 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`, inline: true },
                { name: '📛 Nickname', value: member.nickname || 'None', inline: true },
                { name: '🎨 Display Color', value: member.displayHexColor || 'Default', inline: true },
                { name: '🏷️ Roles', value: member.roles.cache.size > 1 ? member.roles.cache.filter(role => role.id !== interaction.guild.id).map(role => role.toString()).join(', ') : 'None', inline: false }
            );

            // Add permissions if user has any special permissions
            const keyPermissions = member.permissions.toArray().filter(perm => 
                ['Administrator', 'ManageGuild', 'ManageChannels', 'ManageMessages', 'BanMembers', 'KickMembers', 'ModerateMembers'].includes(perm)
            );
            
            if (keyPermissions.length > 0) {
                embed.addFields({ name: '🔑 Key Permissions', value: keyPermissions.join(', '), inline: false });
            }
        }

        embed.setTimestamp()
             .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
