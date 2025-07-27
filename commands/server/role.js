const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Manage server roles')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new role')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the role')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Color of the role (hex code)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to delete')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('give')
                .setDescription('Give a role to a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to give role to')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to give')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a role from a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to remove role from')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to remove')
                        .setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
        case 'create':
            await this.createRole(interaction);
            break;
        case 'delete':
            await this.deleteRole(interaction);
            break;
        case 'give':
            await this.giveRole(interaction);
            break;
        case 'remove':
            await this.removeRole(interaction);
            break;
        }
    },

    async createRole(interaction) {
        const name = interaction.options.getString('name');
        const color = interaction.options.getString('color') || '#99AAB5';

        try {
            const role = await interaction.guild.roles.create({
                name: name,
                color: color,
                reason: `Role created by ${interaction.user.tag}`
            });

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Role Created')
                .addFields(
                    { name: 'Role', value: role.toString(), inline: true },
                    { name: 'Color', value: color, inline: true },
                    { name: 'ID', value: role.id, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error creating role:', error);
            await interaction.reply({
                content: '❌ Failed to create role. Make sure I have the proper permissions!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async deleteRole(interaction) {
        const role = interaction.options.getRole('role');

        if (!role.editable) {
            return await interaction.reply({
                content: '❌ I cannot delete this role! It may be higher than my role.',
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await role.delete(`Role deleted by ${interaction.user.tag}`);

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🗑️ Role Deleted')
                .setDescription(`**${role.name}** has been deleted`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error deleting role:', error);
            await interaction.reply({
                content: '❌ Failed to delete role!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async giveRole(interaction) {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return await interaction.reply({
                content: '❌ User not found in this server!',
                flags: MessageFlags.Ephemeral
            });
        }

        if (member.roles.cache.has(role.id)) {
            return await interaction.reply({
                content: `❌ ${user.tag} already has the ${role.name} role!`,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await member.roles.add(role);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ Role Given')
                .setDescription(`${role} has been given to ${user}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error giving role:', error);
            await interaction.reply({
                content: '❌ Failed to give role!',
                flags: MessageFlags.Ephemeral
            });
        }
    },

    async removeRole(interaction) {
        const user = interaction.options.getUser('user');
        const role = interaction.options.getRole('role');
        const member = interaction.guild.members.cache.get(user.id);

        if (!member) {
            return await interaction.reply({
                content: '❌ User not found in this server!',
                flags: MessageFlags.Ephemeral
            });
        }

        if (!member.roles.cache.has(role.id)) {
            return await interaction.reply({
                content: `❌ ${user.tag} doesn't have the ${role.name} role!`,
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            await member.roles.remove(role);

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('➖ Role Removed')
                .setDescription(`${role} has been removed from ${user}`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error removing role:', error);
            await interaction.reply({
                content: '❌ Failed to remove role!',
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
