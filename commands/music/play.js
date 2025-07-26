const { SlashCommandBuilder } = require('discord.js');
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
                ephemeral: true
            });
        }

        // Check if bot has permissions to join and speak in the voice channel
        const permissions = interaction.member.voice.channel.permissionsFor(interaction.client.user);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return await interaction.reply({
                content: '❌ I need permissions to join and speak in your voice channel!',
                ephemeral: true
            });
        }

        const query = interaction.options.getString('query');
        
        await interaction.deferReply();

        try {
            // Check if it's a YouTube URL
            let url = query;
            if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                // For now, require YouTube URLs. Later we can add search functionality
                return await interaction.editReply({
                    content: '❌ Please provide a valid YouTube URL. Search functionality coming soon!'
                });
            }

            // Get video information
            const songInfo = await musicManager.getVideoInfo(url);
            
            // Join voice channel if not already connected
            const guildId = interaction.guild.id;
            if (!musicManager.connections.has(guildId)) {
                await musicManager.joinVoiceChannel(interaction.member.voice.channel);
            }

            // Add to queue
            const queuePosition = await musicManager.addToQueue(
                guildId,
                songInfo,
                interaction.channel
            );

            if (queuePosition === 0) {
                // Started playing immediately
                await interaction.editReply({
                    content: `🎵 Now playing **${songInfo.title}**`
                });
            } else {
                // Added to queue
                await interaction.editReply({
                    content: `✅ Added **${songInfo.title}** to queue at position ${queuePosition}`
                });
            }

        } catch (error) {
            console.error('Error in play command:', error);
            await interaction.editReply({
                content: `❌ Error playing music: ${error.message}`
            });
        }
    },
};
