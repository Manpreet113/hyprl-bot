const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Ask the magic 8-ball a question')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('Your question for the magic 8-ball')
                .setRequired(true)),
    
    async execute(interaction) {
        const question = interaction.options.getString('question');
        
        const responses = [
            // Positive
            '🟢 It is certain',
            '🟢 Without a doubt',
            '🟢 Yes definitely',
            '🟢 You may rely on it',
            '🟢 As I see it, yes',
            '🟢 Most likely',
            '🟢 Outlook good',
            '🟢 Yes',
            '🟢 Signs point to yes',
            
            // Neutral
            '🟡 Reply hazy, try again',
            '🟡 Ask again later',
            '🟡 Better not tell you now',
            '🟡 Cannot predict now',
            '🟡 Concentrate and ask again',
            
            // Negative
            '🔴 Don\'t count on it',
            '🔴 My reply is no',
            '🔴 My sources say no',
            '🔴 Outlook not so good',
            '🔴 Very doubtful'
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#9932cc')
            .setTitle('🎱 Magic 8-Ball')
            .addFields(
                { name: '❓ Question', value: question, inline: false },
                { name: '🔮 Answer', value: randomResponse, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Asked by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.reply({ embeds: [embed] });
    },
};
