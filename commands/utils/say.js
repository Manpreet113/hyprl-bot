const { SlashCommandBuilder, PermissionFlagsBits, PermissionsBitField, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Make the bot say something')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message for the bot to say')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send the message to')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        const message = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        
        // Check if the bot can send messages in the target channel
        if (!channel.permissionsFor(interaction.client.user).has(PermissionsBitField.Flags.SendMessages)) {
            return await interaction.reply({
                content: '❌ I don\'t have permission to send messages in that channel!',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await channel.send(message);
            
            if (channel.id !== interaction.channel.id) {
                await interaction.reply({
                    content: `✅ Message sent to ${channel}!`,
                    flags: MessageFlags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: '✅ Message sent!',
                    flags: MessageFlags.Ephemeral
                });
            }

        } catch (error) {
            console.error('Error sending message:', error);
            await interaction.reply({
                content: '❌ Failed to send message!',
                flags: MessageFlags.Ephemeral
            });
        }
    },
};
