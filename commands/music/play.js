const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { musicManager } = require('../../handlers/musicHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music from YouTube')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('YouTube URL or search query')
                .setRequired(true)),
    
    async execute(interaction) {
        // Check if user is in a voice channel
        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel to play music!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if bot has permissions to join and speak in the voice channel
        const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user);
        if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return await interaction.reply({
                content: '❌ I need permissions to join and speak in your voice channel!',
                flags: MessageFlags.Ephemeral
            });
        }

        const query = interaction.options.getString('query');
        
        await interaction.deferReply();

        try {
            // Validate YouTube URL
            let url = query;
            if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                return await interaction.editReply({
                    content: '❌ Please provide a valid YouTube URL. YouTube search functionality coming soon!'
                });
            }

            // Normalize URL format
            if (query.includes('youtu.be/')) {
                const videoId = query.split('youtu.be/')[1].split('?')[0];
                url = `https://www.youtube.com/watch?v=${videoId}`;
            }

            // Get video information with timeout
            let songInfo;
            try {
                songInfo = await Promise.race([
                    musicManager.getVideoInfo(url),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
                    )
                ]);
            } catch (infoError) {
                return await interaction.editReply({
                    content: `❌ Failed to get video info: ${infoError.message}`
                });
            }
            
            // Join voice channel if not already connected
            const guildId = interaction.guild.id;
            try {
                if (!musicManager.connections.has(guildId)) {
                    await musicManager.joinVoiceChannel(interaction.member.voice.channel);
                }
            } catch (connectionError) {
                return await interaction.editReply({
                    content: `❌ Failed to join voice channel: ${connectionError.message}`
                });
            }

            // Add to queue
            const queuePosition = await musicManager.addToQueue(
                guildId,
                songInfo,
                interaction.channel
            );

            if (queuePosition === 1) {
                // Started playing immediately
                await interaction.editReply({
                    content: `🎵 Now playing **${songInfo.title}** by **${songInfo.author}**`
                });
            } else {
                // Added to queue
                await interaction.editReply({
                    content: `✅ Added **${songInfo.title}** to queue at position **${queuePosition}**`
                });
            }

        } catch (error) {
            console.error('Error in play command:', error);
            await interaction.editReply({
                content: `❌ Error playing music: ${error.message}\n\nPlease try again with a different YouTube URL.`
            });
        }
    },
};
