const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { musicManager } = require('../../handlers/musicHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),
    
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const queue = musicManager.getQueue(guildId);
        
        if (!queue.currentSong && queue.songs.length === 0) {
            return await interaction.reply({
                content: '📋 The music queue is empty! Use `/play` to add some songs.',
                flags: MessageFlags.Ephemeral
            });
        }

        const queueEmbed = musicManager.createQueueEmbed(guildId);
        await interaction.reply({ embeds: [queueEmbed] });
    },
};
