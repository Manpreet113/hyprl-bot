const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { musicManager } = require('../../handlers/musicHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused music playback'),
    
    async execute(interaction) {
        const guildId = interaction.guild.id;
        
        // Check if user is in a voice channel
        if (!interaction.member.voice.channel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel to use music commands!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if bot is connected to voice
        if (!musicManager.connections.has(guildId)) {
            return await interaction.reply({
                content: '❌ I\'m not connected to any voice channel!',
                flags: MessageFlags.Ephemeral
            });
        }

        // Check if user is in the same voice channel as the bot
        const botChannel = interaction.guild.members.me.voice.channel;
        if (botChannel && interaction.member.voice.channel.id !== botChannel.id) {
            return await interaction.reply({
                content: '❌ You need to be in the same voice channel as me!',
                flags: MessageFlags.Ephemeral
            });
        }

        if (musicManager.resume(guildId)) {
            await interaction.reply({
                content: '▶️ Music resumed!'
            });
        } else {
            await interaction.reply({
                content: '❌ Nothing is paused!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
