const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reload the bot (Owner only)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('What to reload')
                .setRequired(false)
                .addChoices(
                    { name: 'Commands', value: 'commands' },
                    { name: 'Full Restart', value: 'restart' }
                )),
    
    async execute(interaction) {
        // Check if user is the bot owner
        if (interaction.user.id !== process.env.OWNER_ID) {
            return await interaction.reply({
                content: '❌ Only the bot owner can use this command!',
                flags: MessageFlags.Ephemeral
            });
        }

        const type = interaction.options.getString('type') || 'commands';

        if (type === 'commands') {
            await interaction.deferReply();
            
            try {
                // Clear require cache for commands
                const fs = require('fs');
                const path = require('path');
                
                const commandFolders = fs.readdirSync(path.join(__dirname, '../../commands'));
                let reloadedCount = 0;
                
                for (const folder of commandFolders) {
                    const commandFiles = fs.readdirSync(path.join(__dirname, '../../commands', folder))
                        .filter(file => file.endsWith('.js'));
                    
                    for (const file of commandFiles) {
                        const commandPath = path.join(__dirname, '../../commands', folder, file);
                        
                        // Remove from cache
                        delete require.cache[require.resolve(commandPath)];
                        
                        // Reload command
                        const command = require(commandPath);
                        interaction.client.commands.set(command.data.name, command);
                        reloadedCount++;
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🔄 Commands Reloaded')
                    .setDescription(`Successfully reloaded **${reloadedCount}** commands!`)
                    .setTimestamp()
                    .setFooter({ text: 'Bot reloaded by ' + interaction.user.tag });

                await interaction.editReply({ embeds: [embed] });
                
            } catch (error) {
                console.error('Error reloading commands:', error);
                await interaction.editReply({
                    content: '❌ Error reloading commands: ' + error.message
                });
            }
            
        } else if (type === 'restart') {
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🔄 Bot Restarting')
                .setDescription('Bot is restarting... I\'ll be back in a moment!')
                .setTimestamp()
                .setFooter({ text: 'Restarted by ' + interaction.user.tag });

            await interaction.reply({ embeds: [embed] });
            
            // Give time for the message to send
            setTimeout(() => {
                process.exit(0); // PM2 will automatically restart
            }, 2000);
        }
    },
};
