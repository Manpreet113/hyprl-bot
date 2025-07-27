const { describe, it, beforeEach, afterEach, expect, jest } = require('@jest/globals');
const { MessageFlags } = require('discord.js');

// Mock the external dependencies
jest.mock('discord.js', () => ({
    EmbedBuilder: jest.fn().mockImplementation(() => ({
        setColor: jest.fn().mockReturnThis(),
        setTitle: jest.fn().mockReturnThis(),
        setDescription: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
        setThumbnail: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        setFooter: jest.fn().mockReturnThis()
    })),
    ActionRowBuilder: jest.fn().mockImplementation(() => ({
        addComponents: jest.fn().mockReturnThis()
    })),
    ButtonBuilder: jest.fn().mockImplementation(() => ({
        setCustomId: jest.fn().mockReturnThis(),
        setLabel: jest.fn().mockReturnThis(),
        setStyle: jest.fn().mockReturnThis(),
        setEmoji: jest.fn().mockReturnThis()
    })),
    ButtonStyle: {
        Primary: 1,
        Secondary: 2,
        Success: 3,
        Danger: 4
    },
    MessageFlags: {
        Ephemeral: 64
    }
}));

jest.mock('@discordjs/voice', () => ({
    createAudioPlayer: jest.fn(() => ({
        play: jest.fn(),
        pause: jest.fn(),
        unpause: jest.fn(),
        stop: jest.fn(),
        on: jest.fn()
    })),
    createAudioResource: jest.fn(),
    joinVoiceChannel: jest.fn(() => ({
        subscribe: jest.fn(),
        destroy: jest.fn(),
        on: jest.fn()
    })),
    AudioPlayerStatus: {
        Playing: 'playing',
        Idle: 'idle'
    },
    VoiceConnectionStatus: {
        Ready: 'ready',
        Disconnected: 'disconnected'
    }
}));

jest.mock('ytdl-core', () => ({
    getInfo: jest.fn()
}));

jest.mock('@distube/ytdl-core', () => ({
    getInfo: jest.fn()
}));

jest.mock('../utils/logger', () => ({
    debug: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

describe('MusicHandler', () => {
    let musicManager, ytdl, ytdlDistube;
    
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Re-require the module to get a fresh instance
        delete require.cache[require.resolve('../handlers/musicHandler.js')];
        const musicModule = require('../handlers/musicHandler.js');
        musicManager = musicModule.musicManager;
        
        ytdl = require('ytdl-core');
        ytdlDistube = require('@distube/ytdl-core');
    });

    afterEach(() => {
        // Clean up any timers
        jest.clearAllTimers();
    });

    describe('Queue Management', () => {
        it('should create a new queue for a guild', () => {
            const guildId = 'test-guild-123';
            const queue = musicManager.getQueue(guildId);
            
            expect(queue).toEqual({
                songs: [],
                currentSong: null,
                isPlaying: false,
                isPaused: false,
                volume: 0.5,
                loop: false,
                textChannel: null
            });
        });

        it('should return existing queue for a guild', () => {
            const guildId = 'test-guild-123';
            const queue1 = musicManager.getQueue(guildId);
            queue1.songs.push({ title: 'Test Song' });
            
            const queue2 = musicManager.getQueue(guildId);
            expect(queue2.songs).toHaveLength(1);
            expect(queue2.songs[0].title).toBe('Test Song');
        });

        it('should add song to queue and start playing if not already playing', async () => {
            const guildId = 'test-guild-123';
            const song = {
                title: 'Test Song',
                url: 'https://youtube.com/watch?v=test',
                duration: '3:45'
            };
            const textChannel = { send: jest.fn() };

            // Mock playNext to avoid actual playback
            jest.spyOn(musicManager, 'playNext').mockImplementation(() => {});

            const position = await musicManager.addToQueue(guildId, song, textChannel);
            
            expect(position).toBe(1);
            expect(musicManager.playNext).toHaveBeenCalledWith(guildId);
            
            const queue = musicManager.getQueue(guildId);
            expect(queue.textChannel).toBe(textChannel);
        });
    });

    describe('YouTube URL Validation', () => {
        it('should validate correct YouTube URLs', () => {
            const validUrls = [
                'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'https://youtube.com/watch?v=dQw4w9WgXcQ',
                'https://youtu.be/dQw4w9WgXcQ',
                'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
                'https://www.youtube.com/embed/dQw4w9WgXcQ',
                'https://www.youtube.com/v/dQw4w9WgXcQ'
            ];

            validUrls.forEach(url => {
                expect(musicManager.isValidYouTubeUrl(url)).toBe(true);
            });
        });

        it('should reject invalid YouTube URLs', () => {
            const invalidUrls = [
                'https://example.com/watch?v=dQw4w9WgXcQ',
                'not-a-url',
                'https://youtube.com/watch',
                'https://youtu.be/',
                'https://vimeo.com/123456',
                ''
            ];

            invalidUrls.forEach(url => {
                expect(musicManager.isValidYouTubeUrl(url)).toBe(false);
            });
        });
    });

    describe('Video Info Fetching', () => {
        it('should fetch video info successfully with first library', async () => {
            const mockVideoInfo = {
                videoDetails: {
                    title: 'Test Video',
                    video_url: 'https://youtube.com/watch?v=test',
                    lengthSeconds: '225', // 3:45
                    thumbnails: [
                        { url: 'https://img.youtube.com/vi/test/maxresdefault.jpg' }
                    ],
                    author: { name: 'Test Channel' },
                    viewCount: '1000000',
                    uploadDate: '2023-01-01',
                    shortDescription: 'Test description',
                    age_restricted: false,
                    isLiveContent: false,
                    isLive: false
                }
            };

            ytdlDistube.getInfo.mockResolvedValue(mockVideoInfo);

            const result = await musicManager.getVideoInfo('https://youtube.com/watch?v=test');
            
            expect(result).toEqual({
                title: 'Test Video',
                url: 'https://youtube.com/watch?v=test',
                duration: '3:45',
                thumbnail: 'https://img.youtube.com/vi/test/maxresdefault.jpg',
                author: 'Test Channel',
                views: '1.0M',
                uploadDate: '2023-01-01',
                description: 'Test description',
                ageRestricted: false
            });
        });

        it('should fallback to second library if first fails', async () => {
            const mockVideoInfo = {
                videoDetails: {
                    title: 'Test Video',
                    video_url: 'https://youtube.com/watch?v=test',
                    lengthSeconds: '180',
                    thumbnails: [
                        { url: 'https://img.youtube.com/vi/test/hqdefault.jpg' }
                    ],
                    author: { name: 'Test Channel' },
                    viewCount: '5000',
                    uploadDate: '2023-01-01',
                    shortDescription: 'Test description',
                    age_restricted: false,
                    isLiveContent: false,
                    isLive: false
                }
            };

            ytdlDistube.getInfo.mockRejectedValue(new Error('First library failed'));
            ytdl.getInfo.mockResolvedValue(mockVideoInfo);

            const result = await musicManager.getVideoInfo('https://youtube.com/watch?v=test');
            
            expect(result.title).toBe('Test Video');
            expect(result.views).toBe('5.0K');
        });

        it('should reject invalid URLs', async () => {
            await expect(musicManager.getVideoInfo('invalid-url'))
                .rejects.toThrow('Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.');
        });

        it('should reject private videos', async () => {
            const mockVideoInfo = {
                videoDetails: {
                    title: '[Private video]',
                    video_url: 'https://youtube.com/watch?v=test',
                    lengthSeconds: '180',
                    thumbnails: [],
                    author: { name: 'Test Channel' }
                }
            };

            ytdlDistube.getInfo.mockResolvedValue(mockVideoInfo);

            await expect(musicManager.getVideoInfo('https://youtube.com/watch?v=test'))
                .rejects.toThrow('This video is private, deleted, or unavailable.');
        });

        it('should reject videos that are too long', async () => {
            const mockVideoInfo = {
                videoDetails: {
                    title: 'Very Long Video',
                    video_url: 'https://youtube.com/watch?v=test',
                    lengthSeconds: '7300', // Over 2 hours
                    thumbnails: [],
                    author: { name: 'Test Channel' }
                }
            };

            ytdlDistube.getInfo.mockResolvedValue(mockVideoInfo);

            await expect(musicManager.getVideoInfo('https://youtube.com/watch?v=test'))
                .rejects.toThrow('Video is too long (maximum 2 hours allowed).');
        });

        it('should reject live streams', async () => {
            const mockVideoInfo = {
                videoDetails: {
                    title: 'Live Stream',
                    video_url: 'https://youtube.com/watch?v=test',
                    lengthSeconds: '0',
                    thumbnails: [],
                    author: { name: 'Test Channel' },
                    isLiveContent: true,
                    isLive: true
                }
            };

            ytdlDistube.getInfo.mockResolvedValue(mockVideoInfo);

            await expect(musicManager.getVideoInfo('https://youtube.com/watch?v=test'))
                .rejects.toThrow('Live streams are not supported.');
        });
    });

    describe('Playback Controls', () => {
        beforeEach(() => {
            // Set up a mock player and queue
            const guildId = 'test-guild-123';
            const mockPlayer = {
                play: jest.fn(),
                pause: jest.fn(),
                unpause: jest.fn(),
                stop: jest.fn(),
                on: jest.fn()
            };
            
            musicManager.players.set(guildId, mockPlayer);
            
            const queue = musicManager.getQueue(guildId);
            queue.isPlaying = true;
            queue.isPaused = false;
        });

        it('should pause playback successfully', () => {
            const guildId = 'test-guild-123';
            const result = musicManager.pause(guildId);
            
            expect(result).toBe(true);
            expect(musicManager.players.get(guildId).pause).toHaveBeenCalled();
            expect(musicManager.getQueue(guildId).isPaused).toBe(true);
        });

        it('should not pause if already paused', () => {
            const guildId = 'test-guild-123';
            const queue = musicManager.getQueue(guildId);
            queue.isPaused = true;
            
            const result = musicManager.pause(guildId);
            
            expect(result).toBe(false);
        });

        it('should resume playback successfully', () => {
            const guildId = 'test-guild-123';
            const queue = musicManager.getQueue(guildId);
            queue.isPaused = true;
            
            const result = musicManager.resume(guildId);
            
            expect(result).toBe(true);
            expect(musicManager.players.get(guildId).unpause).toHaveBeenCalled();
            expect(queue.isPaused).toBe(false);
        });

        it('should not resume if not paused', () => {
            const guildId = 'test-guild-123';
            const result = musicManager.resume(guildId);
            
            expect(result).toBe(false);
        });

        it('should skip current song', () => {
            const guildId = 'test-guild-123';
            const result = musicManager.skip(guildId);
            
            expect(result).toBe(true);
            expect(musicManager.players.get(guildId).stop).toHaveBeenCalled();
        });

        it('should not skip if nothing is playing', () => {
            const guildId = 'test-guild-123';
            const queue = musicManager.getQueue(guildId);
            queue.isPlaying = false;
            
            const result = musicManager.skip(guildId);
            
            expect(result).toBe(false);
        });
    });

    describe('Voice Channel Management', () => {
        it('should join voice channel successfully', async () => {
            const mockChannel = {
                id: 'voice-channel-123',
                guild: {
                    id: 'test-guild-123',
                    voiceAdapterCreator: jest.fn()
                }
            };

            const { joinVoiceChannel } = require('@discordjs/voice');
            const mockConnection = {
                subscribe: jest.fn(),
                destroy: jest.fn(),
                on: jest.fn()
            };
            joinVoiceChannel.mockReturnValue(mockConnection);

            const connection = await musicManager.joinVoiceChannel(mockChannel);
            
            expect(joinVoiceChannel).toHaveBeenCalledWith({
                channelId: 'voice-channel-123',
                guildId: 'test-guild-123',
                adapterCreator: mockChannel.guild.voiceAdapterCreator
            });
            expect(connection).toBe(mockConnection);
            expect(musicManager.connections.get('test-guild-123')).toBe(mockConnection);
        });

        it('should leave voice channel and clean up', () => {
            const guildId = 'test-guild-123';
            const mockConnection = {
                destroy: jest.fn()
            };
            const mockPlayer = {
                stop: jest.fn()
            };

            musicManager.connections.set(guildId, mockConnection);
            musicManager.players.set(guildId, mockPlayer);
            
            // Add some data to queue
            const queue = musicManager.getQueue(guildId);
            queue.songs.push({ title: 'Test Song' });

            musicManager.leaveVoiceChannel(guildId);

            expect(mockConnection.destroy).toHaveBeenCalled();
            expect(mockPlayer.stop).toHaveBeenCalled();
            expect(musicManager.connections.has(guildId)).toBe(false);
            expect(musicManager.players.has(guildId)).toBe(false);
            expect(musicManager.queues.has(guildId)).toBe(false);
        });
    });

    describe('Utility Functions', () => {
        it('should format duration correctly', () => {
            expect(musicManager.formatDuration(0)).toBe('0:00');
            expect(musicManager.formatDuration(30)).toBe('0:30');
            expect(musicManager.formatDuration(90)).toBe('1:30');
            expect(musicManager.formatDuration(3661)).toBe('61:01');
        });

        it('should format view counts correctly', () => {
            expect(musicManager.formatViews('0')).toBe('0');
            expect(musicManager.formatViews('999')).toBe('999');
            expect(musicManager.formatViews('1500')).toBe('1.5K');
            expect(musicManager.formatViews('1500000')).toBe('1.5M');
            expect(musicManager.formatViews('')).toBe('Unknown');
            expect(musicManager.formatViews(null)).toBe('Unknown');
        });

        it('should get best thumbnail quality', () => {
            const thumbnails = [
                { url: 'https://img.youtube.com/vi/test/default.jpg' },
                { url: 'https://img.youtube.com/vi/test/hqdefault.jpg' },
                { url: 'https://img.youtube.com/vi/test/maxresdefault.jpg' }
            ];

            const result = musicManager.getBestThumbnail(thumbnails);
            expect(result).toBe('https://img.youtube.com/vi/test/maxresdefault.jpg');
        });

        it('should handle empty thumbnail array', () => {
            expect(musicManager.getBestThumbnail([])).toBe(null);
            expect(musicManager.getBestThumbnail(null)).toBe(null);
            expect(musicManager.getBestThumbnail(undefined)).toBe(null);
        });
    });

    describe('Button Handlers', () => {
        let mockInteraction;

        beforeEach(() => {
            mockInteraction = {
                guild: { id: 'test-guild-123' },
                reply: jest.fn()
            };
        });

        it('should handle pause button', async () => {
            mockInteraction.customId = 'music_pause';
            jest.spyOn(musicManager, 'pause').mockReturnValue(true);

            const { handleMusicButton } = require('../handlers/musicHandler.js');
            await handleMusicButton(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '⏸️ Music paused!',
                flags: MessageFlags.Ephemeral
            });
        });

        it('should handle resume button', async () => {
            mockInteraction.customId = 'music_resume';
            jest.spyOn(musicManager, 'resume').mockReturnValue(true);

            const { handleMusicButton } = require('../handlers/musicHandler.js');
            await handleMusicButton(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '▶️ Music resumed!',
                flags: MessageFlags.Ephemeral
            });
        });

        it('should handle skip button', async () => {
            mockInteraction.customId = 'music_skip';
            jest.spyOn(musicManager, 'skip').mockReturnValue(true);

            const { handleMusicButton } = require('../handlers/musicHandler.js');
            await handleMusicButton(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '⏭️ Song skipped!',
                flags: MessageFlags.Ephemeral
            });
        });

        it('should handle queue button', async () => {
            mockInteraction.customId = 'music_queue';
            const mockEmbed = { title: 'Queue Embed' };
            jest.spyOn(musicManager, 'createQueueEmbed').mockReturnValue(mockEmbed);

            const { handleMusicButton } = require('../handlers/musicHandler.js');
            await handleMusicButton(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [mockEmbed],
                flags: MessageFlags.Ephemeral
            });
        });

        it('should handle stop button', async () => {
            mockInteraction.customId = 'music_stop';
            jest.spyOn(musicManager, 'leaveVoiceChannel').mockImplementation(() => {});

            const { handleMusicButton } = require('../handlers/musicHandler.js');
            await handleMusicButton(mockInteraction);

            expect(musicManager.leaveVoiceChannel).toHaveBeenCalledWith('test-guild-123');
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '⏹️ Music stopped and left voice channel!',
                flags: MessageFlags.Ephemeral
            });
        });

        it('should handle unknown button', async () => {
            mockInteraction.customId = 'unknown_button';

            const { handleMusicButton } = require('../handlers/musicHandler.js');
            await handleMusicButton(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '❌ Unknown music control!',
                flags: MessageFlags.Ephemeral
            });
        });

        it('should handle failed operations gracefully', async () => {
            mockInteraction.customId = 'music_pause';
            jest.spyOn(musicManager, 'pause').mockReturnValue(false);

            const { handleMusicButton } = require('../handlers/musicHandler.js');
            await handleMusicButton(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '❌ Nothing to pause!',
                flags: MessageFlags.Ephemeral
            });
        });
    });

    describe('Queue Embed Creation', () => {
        it('should create queue embed with current song and upcoming songs', () => {
            const guildId = 'test-guild-123';
            const queue = musicManager.getQueue(guildId);
            
            queue.currentSong = {
                title: 'Current Song',
                url: 'https://youtube.com/watch?v=current',
                author: 'Current Author',
                duration: '3:45'
            };
            
            queue.songs = [
                { title: 'Next Song 1', url: 'https://youtube.com/watch?v=next1', duration: '4:20' },
                { title: 'Next Song 2', url: 'https://youtube.com/watch?v=next2', duration: '3:15' }
            ];

            const embed = musicManager.createQueueEmbed(guildId);
            
            expect(embed.addFields).toHaveBeenCalledWith({
                name: '🎵 Currently Playing',
                value: '**[Current Song](https://youtube.com/watch?v=current)**\nBy: Current Author | Duration: 3:45',
                inline: false
            });
            
            expect(embed.addFields).toHaveBeenCalledWith({
                name: '⏭️ Up Next (2 songs)',
                value: '**1.** [Next Song 1](https://youtube.com/watch?v=next1) - 4:20\n**2.** [Next Song 2](https://youtube.com/watch?v=next2) - 3:15',
                inline: false
            });
        });

        it('should create queue embed with no songs', () => {
            const guildId = 'test-guild-123';
            const embed = musicManager.createQueueEmbed(guildId);
            
            expect(embed.addFields).toHaveBeenCalledWith({
                name: '⏭️ Up Next',
                value: 'No songs in queue',
                inline: false
            });
        });
    });
});
