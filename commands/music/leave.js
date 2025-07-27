const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { musicManager } = require('../../handlers/musicHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Leave the voice channel and clear the queue'),
    
    async execute(interaction) {
        const guildId = interaction.guild.id;
        
        if (!musicManager.connections.has(guildId)) {
            return await interaction.reply({
                content: '❌ I\'m not connected to any voice channel!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if user is in the same voice channel as the bot
        const botChannel = interaction.guild.members.me.voice.channel;
        if (botChannel && interaction.member.voice.channel?.id !== botChannel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel as me to use this command!',
                flags: MessageFlags.Ephemeral
            });
        }

        musicManager.leaveVoiceChannel(guildId);
        
        await interaction.reply({
            content: '👋 Left the voice channel and cleared the queue!'
        });
    },
};
