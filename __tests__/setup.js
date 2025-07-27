// Jest setup file for Discord bot tests
const { jest } = require('@jest/globals');

// Mock Discord.js module
jest.mock('discord.js', () => {
    const mockClient = {
        login: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        user: { tag: 'TestBot#1234' },
        guilds: {
            cache: new Map()
        },
        channels: {
            cache: new Map()
        }
    };

    const mockGuild = {
        id: '123456789',
        name: 'Test Guild',
        members: {
            cache: new Map()
        },
        channels: {
            cache: new Map(),
            create: jest.fn()
        }
    };

    const mockUser = {
        id: '987654321',
        username: 'testuser',
        tag: 'testuser#1234',
        displayAvatarURL: jest.fn(() => 'https://example.com/avatar.png')
    };

    const mockMember = {
        id: '987654321',
        user: mockUser,
        displayName: 'Test User',
        permissions: {
            has: jest.fn(() => true)
        }
    };

    const mockChannel = {
        id: '555666777',
        name: 'test-channel',
        type: 0, // TEXT
        send: jest.fn(),
        createThread: jest.fn(),
        permissionOverwrites: {
            edit: jest.fn()
        }
    };

    const mockVoiceChannel = {
        id: '111222333',
        name: 'voice-channel',
        type: 2, // VOICE
        joinable: true,
        speakable: true,
        join: jest.fn(),
        leave: jest.fn()
    };

    const mockInteraction = {
        id: '444555666',
        guild: mockGuild,
        user: mockUser,
        member: mockMember,
        channel: mockChannel,
        reply: jest.fn(),
        editReply: jest.fn(),
        followUp: jest.fn(),
        deferReply: jest.fn(),
        isCommand: jest.fn(() => true),
        isChatInputCommand: jest.fn(() => true),
        isButton: jest.fn(() => false),
        commandName: 'test',
        options: {
            getString: jest.fn(),
            getChannel: jest.fn(),
            getUser: jest.fn(),
            getMember: jest.fn()
        }
    };

    const mockMessage = {
        id: '777888999',
        author: mockUser,
        guild: mockGuild,
        channel: mockChannel,
        content: 'test message',
        reply: jest.fn(),
        edit: jest.fn(),
        delete: jest.fn()
    };

    const mockEmbedBuilder = jest.fn().mockImplementation(() => ({
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setThumbnail: jest.fn().mockReturnThis(),
        setAuthor: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setImage: jest.fn().mockReturnThis()
    }));

    const mockActionRowBuilder = jest.fn().mockImplementation(() => ({
        addComponents: jest.fn().mockReturnThis(),
        setComponents: jest.fn().mockReturnThis()
    }));

    const mockButtonBuilder = jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setEmoji: jest.fn().mockReturnThis(),
        setDisabled: jest.fn().mockReturnThis()
    }));

    return {
        Client: jest.fn(() => mockClient),
        GatewayIntentBits: {
            Guilds: 1,
            GuildMessages: 512,
            MessageContent: 32768,
            GuildVoiceStates: 128
        },
        EmbedBuilder: mockEmbedBuilder,
        ActionRowBuilder: mockActionRowBuilder,
        ButtonBuilder: mockButtonBuilder,
        ButtonStyle: {
            Primary: 1,
            Secondary: 2,
            Success: 3,
            Danger: 4,
            Link: 5
        },
        ChannelType: {
            GuildText: 0,
            DM: 1,
            GuildVoice: 2,
            GroupDM: 3,
            GuildCategory: 4,
            GuildAnnouncement: 5,
            AnnouncementThread: 10,
            PublicThread: 11,
            PrivateThread: 12,
            GuildStageVoice: 13,
            GuildDirectory: 14,
            GuildForum: 15
        },
        PermissionsBitField: {
            Flags: {
                ManageChannels: 1n << 4n,
                ManageMessages: 1n << 13n,
                Administrator: 1n << 3n,
                ModerateMembers: 1n << 40n
            }
        },
        MessageFlags: {
            Ephemeral: 1 << 6
        },
        ActivityType: {
            Playing: 0,
            Streaming: 1,
            Listening: 2,
            Watching: 3,
            Custom: 4,
            Competing: 5
        },
        // Mock objects for tests
        __mocks: {
            client: mockClient,
            guild: mockGuild,
            user: mockUser,
            member: mockMember,
            channel: mockChannel,
            voiceChannel: mockVoiceChannel,
            interaction: mockInteraction,
            message: mockMessage
        }
    };
});

// Mock @discordjs/voice
jest.mock('@discordjs/voice', () => ({
    createAudioPlayer: jest.fn(() => ({
        play: jest.fn(),
        stop: jest.fn(),
        pause: jest.fn(),
        unpause: jest.fn(),
        on: jest.fn(),
        state: { status: 'idle' }
    })),
    createAudioResource: jest.fn(() => ({})),
    joinVoiceChannel: jest.fn(() => ({
        destroy: jest.fn(),
        subscribe: jest.fn(),
        on: jest.fn()
    })),
    AudioPlayerStatus: {
        Idle: 'idle',
        Playing: 'playing',
        Paused: 'paused',
        Buffering: 'buffering',
        AutoPaused: 'autopaused'
    },
    VoiceConnectionStatus: {
        Ready: 'ready',
        Connecting: 'connecting',
        Disconnected: 'disconnected',
        Signalling: 'signalling'
    },
    entersState: jest.fn(),
    getVoiceConnection: jest.fn()
}));

// Mock ytdl-core and @distube/ytdl-core
const mockYtdlCore = {
    getInfo: jest.fn(),
    validateURL: jest.fn(),
    getBasicInfo: jest.fn()
};

jest.mock('ytdl-core', () => mockYtdlCore);
jest.mock('@distube/ytdl-core', () => mockYtdlCore);

// Mock file system operations
jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
    readFileSync: jest.fn(() => '{}'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(() => [])
}));

// Mock path module
jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
    resolve: jest.fn((...args) => '/' + args.join('/')),
    dirname: jest.fn(() => '/mock/dir'),
    extname: jest.fn(() => '.js')
}));

// Global test utilities
global.mockInteraction = (options = {}) => {
    const { Client } = require('discord.js');
    const mockClient = new Client();
    const mocks = require('discord.js').__mocks;
    
    return {
        ...mocks.interaction,
        ...options,
        reply: jest.fn().mockResolvedValue(),
        editReply: jest.fn().mockResolvedValue(),
        followUp: jest.fn().mockResolvedValue(),
        deferReply: jest.fn().mockResolvedValue()
    };
};

global.mockGuild = (options = {}) => {
    const mocks = require('discord.js').__mocks;
    return {
        ...mocks.guild,
        ...options
    };
};

global.mockUser = (options = {}) => {
    const mocks = require('discord.js').__mocks;
    return {
        ...mocks.user,
        ...options
    };
};

// Setup test environment
beforeEach(() => {
    jest.clearAllMocks();
});

// Clean up after tests
afterEach(() => {
    jest.restoreAllMocks();
});

console.log('Jest setup complete for Discord bot testing environment');
