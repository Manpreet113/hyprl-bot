const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Display information about the server'),
    
    async execute(interaction) {
        const guild = interaction.guild;
        
        // Count members by status
        const members = guild.members.cache;
        const totalMembers = members.size;
        const humans = members.filter(member => !member.user.bot).size;
        const bots = members.filter(member => member.user.bot).size;
        const online = members.filter(member => member.presence?.status === 'online').size;
        
        // Count channels by type
        const channels = guild.channels.cache;
        const textChannels = channels.filter(channel => channel.type === ChannelType.GuildText).size;
        const voiceChannels = channels.filter(channel => channel.type === ChannelType.GuildVoice).size;
        const categories = channels.filter(channel => channel.type === ChannelType.GuildCategory).size;
        
        // Server features
        const features = guild.features.length > 0 ? guild.features.map(feature => 
            feature.toLowerCase().replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase())
        ).join(', ') : 'None';
        
        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🏰 ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '📊 Server Info', value: `**ID:** ${guild.id}\\n**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:F>\\n**Owner:** <@${guild.ownerId}>`, inline: false },
                { name: '👥 Members', value: `**Total:** ${totalMembers}\\n**Humans:** ${humans}\\n**Bots:** ${bots}\\n**Online:** ${online}`, inline: true },
                { name: '📺 Channels', value: `**Text:** ${textChannels}\\n**Voice:** ${voiceChannels}\\n**Categories:** ${categories}`, inline: true },
                { name: '🎭 Other', value: `**Roles:** ${guild.roles.cache.size}\\n**Emojis:** ${guild.emojis.cache.size}\\n**Boost Level:** ${guild.premiumTier}\\n**Boosts:** ${guild.premiumSubscriptionCount || 0}`, inline: true },
                { name: '✨ Features', value: features, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Support Bot` });

        if (guild.banner) {
            embed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
        }

        await interaction.reply({ embeds: [embed] });
    },
};
