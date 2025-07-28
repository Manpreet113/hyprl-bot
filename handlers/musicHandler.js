const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, VoiceConnectionStatus, generateDependencyReport } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const playdl = require('play-dl');
const logger = require('../utils/logger');

class MusicManager {
    constructor() {
        this.queues = new Map(); // Guild ID -> Queue
        this.players = new Map(); // Guild ID -> Audio Player
        this.connections = new Map(); // Guild ID -> Voice Connection
    }

    // Get or create queue for a guild
    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, {
                songs: [],
                currentSong: null,
                isPlaying: false,
                isPaused: false,
                volume: 0.5,
                loop: false,
                textChannel: null
            });
        }
        return this.queues.get(guildId);
    }

    // Add song to queue
    async addToQueue(guildId, song, textChannel) {
        const queue = this.getQueue(guildId);
        queue.songs.push(song);
        queue.textChannel = textChannel;

        if (!queue.isPlaying) {
            this.playNext(guildId);
        }

        return queue.songs.length;
    }

    // Play next song in queue
    async playNext(guildId) {
        const queue = this.getQueue(guildId);
        
        if (queue.songs.length === 0) {
            queue.isPlaying = false;
            queue.currentSong = null;
            
            // Leave voice channel after 5 minutes of inactivity
            setTimeout(() => {
                if (!queue.isPlaying) {
                    this.leaveVoiceChannel(guildId);
                }
            }, 300000); // 5 minutes
            
            return;
        }

        const song = queue.songs.shift();
        queue.currentSong = song;
        queue.isPlaying = true;
        queue.isPaused = false;

        try {
            // Create audio resource
            const stream = ytdl(song.url, {
                filter: 'audioonly',
                highWaterMark: 1 << 25,
                quality: 'highestaudio'
            });

            const resource = createAudioResource(stream, {
                metadata: song
            });

            // Get or create audio player
            let player = this.players.get(guildId);
            if (!player) {
                player = createAudioPlayer();
                this.players.set(guildId, player);

                // Handle player events
                player.on(AudioPlayerStatus.Playing, () => {
                    console.log(`Now playing: ${song.title}`);
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    this.playNext(guildId);
                });

                player.on('error', (error) => {
                    console.error('Audio player error:', error);
                    this.playNext(guildId);
                });
            }

            // Play the resource
            player.play(resource);

            // Subscribe connection to player
            const connection = this.connections.get(guildId);
            if (connection) {
                connection.subscribe(player);
            }

            // Send now playing embed
            if (queue.textChannel) {
                const embed = await this.createNowPlayingEmbed(song);
                const controls = this.createMusicControls();
                
                await queue.textChannel.send({
                    embeds: [embed],
                    components: [controls]
                });
            }

        } catch (error) {
            console.error('Error playing song:', error);
            queue.textChannel?.send(`❌ Error playing **${song.title}**: ${error.message}`);
            this.playNext(guildId);
        }
    }

    // Join voice channel
    async joinVoiceChannel(channel) {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        this.connections.set(channel.guild.id, connection);

        connection.on(VoiceConnectionStatus.Ready, () => {
            console.log('Voice connection ready');
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
            console.log('Voice connection disconnected');
        });

        return connection;
    }

    // Leave voice channel
    leaveVoiceChannel(guildId) {
        const connection = this.connections.get(guildId);
        if (connection) {
            connection.destroy();
            this.connections.delete(guildId);
        }

        const player = this.players.get(guildId);
        if (player) {
            player.stop();
            this.players.delete(guildId);
        }

        // Clear queue
        this.queues.delete(guildId);
    }

    // Pause playback
    pause(guildId) {
        const player = this.players.get(guildId);
        const queue = this.getQueue(guildId);
        
        if (player && queue.isPlaying && !queue.isPaused) {
            player.pause();
            queue.isPaused = true;
            return true;
        }
        return false;
    }

    // Resume playback
    resume(guildId) {
        const player = this.players.get(guildId);
        const queue = this.getQueue(guildId);
        
        if (player && queue.isPlaying && queue.isPaused) {
            player.unpause();
            queue.isPaused = false;
            return true;
        }
        return false;
    }

    // Skip current song
    skip(guildId) {
        const player = this.players.get(guildId);
        const queue = this.getQueue(guildId);
        
        if (player && queue.isPlaying) {
            player.stop();
            return true;
        }
        return false;
    }

    // Get video info from YouTube URL with multiple fallbacks
    async getVideoInfo(url) {
        try {
            // Validate YouTube URL format first
            if (!this.isValidYouTubeUrl(url)) {
                throw new Error('Invalid YouTube URL format');
            }

            logger.debug('Attempting to fetch video info', { url });

            // Try play-dl first (most reliable)
            try {
                const info = await playdl.video_info(url);
                
                if (!info || !info.video_details) {
                    throw new Error('No video details found');
                }

                const details = info.video_details;
                
                // Check if video is available
                if (!details.title || details.title.includes('[Private video]') || details.title.includes('[Deleted video]')) {
                    throw new Error('Video is private, deleted, or unavailable');
                }

                // Check duration (max 2 hours)
                const duration = details.durationInSec || 0;
                if (duration > 7200) {
                    throw new Error('Video is too long (max 2 hours)');
                }

                // Check if live stream
                if (details.live) {
                    throw new Error('Live streams are not supported');
                }

                const result = {
                    title: details.title,
                    url: details.url || url,
                    duration: this.formatDuration(duration),
                    thumbnail: details.thumbnails?.[0]?.url || null,
                    author: details.channel?.name || 'Unknown',
                    views: this.formatViews(details.views),
                    uploadDate: details.uploadedAt || 'Unknown',
                    description: details.description?.substring(0, 200) || 'No description'
                };

                logger.success('Successfully fetched video info using play-dl', { 
                    title: result.title, 
                    author: result.author,
                    duration: result.duration 
                });

                return result;
                
            } catch (playDlError) {
                logger.warn('play-dl failed, trying ytdl-core:', playDlError.message);
                
                // Fallback to ytdl-core
                try {
                    const info = await Promise.race([
                        ytdl.getInfo(url),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('ytdl-core timeout')), 15000)
                        )
                    ]);

                    const videoDetails = info.videoDetails;
                    
                    if (!videoDetails || !videoDetails.title) {
                        throw new Error('No video details found');
                    }

                    // Check availability
                    if (videoDetails.title === '[Private video]' || 
                        videoDetails.title === '[Deleted video]' ||
                        videoDetails.title.includes('Private') ||
                        videoDetails.title.includes('Deleted')) {
                        throw new Error('Video is private, deleted, or unavailable');
                    }

                    const duration = parseInt(videoDetails.lengthSeconds || 0);
                    if (duration > 7200) {
                        throw new Error('Video is too long (max 2 hours)');
                    }

                    if (videoDetails.isLiveContent && videoDetails.isLive) {
                        throw new Error('Live streams are not supported');
                    }

                    const result = {
                        title: videoDetails.title,
                        url: videoDetails.video_url || url,
                        duration: this.formatDuration(duration),
                        thumbnail: this.getBestThumbnail(videoDetails.thumbnails),
                        author: videoDetails.author?.name || videoDetails.ownerChannelName || 'Unknown',
                        views: this.formatViews(videoDetails.viewCount),
                        uploadDate: videoDetails.uploadDate || 'Unknown',
                        description: videoDetails.shortDescription?.substring(0, 200) || 'No description'
                    };

                    logger.success('Successfully fetched video info using ytdl-core', { 
                        title: result.title, 
                        author: result.author,
                        duration: result.duration 
                    });

                    return result;
                    
                } catch (ytdlError) {
                    logger.error('All libraries failed:', ytdlError.message);
                    throw new Error('Unable to fetch video information from YouTube');
                }
            }
            
        } catch (error) {
            logger.error('Error getting video info:', error);
            
            // Provide more specific error messages
            if (error.message.includes('timeout')) {
                throw new Error('Request timed out. YouTube might be experiencing issues.');
            } else if (error.message.includes('private') || error.message.includes('deleted') || error.message.includes('unavailable')) {
                throw new Error('This video is private, deleted, or unavailable.');
            } else if (error.message.includes('too long')) {
                throw new Error('Video is too long (maximum 2 hours allowed).');
            } else if (error.message.includes('live')) {
                throw new Error('Live streams are not supported.');
            } else if (error.message.includes('format')) {
                throw new Error('Invalid YouTube URL. Please provide a valid youtube.com or youtu.be link.');
            } else {
                throw new Error(`Unable to fetch video: ${error.message}`);
            }
        }
    }

    // Get the best quality thumbnail
    getBestThumbnail(thumbnails) {
        if (!thumbnails || !Array.isArray(thumbnails)) {return null;}
        
        // Try to get the highest quality thumbnail
        const qualityOrder = ['maxresdefault', 'hqdefault', 'mqdefault', 'default'];
        
        for (const quality of qualityOrder) {
            const thumb = thumbnails.find(t => t.url && t.url.includes(quality));
            if (thumb) {return thumb.url;}
        }
        
        // Fallback to first available thumbnail
        return thumbnails[0]?.url || null;
    }

    // Format view count
    formatViews(viewCount) {
        if (!viewCount) {return 'Unknown';}
        const count = parseInt(viewCount);
        if (count >= 1000000) {
            return `${(count / 1000000).toFixed(1)}M`;
        } else if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toLocaleString();
    }

    // Validate YouTube URL format
    isValidYouTubeUrl(url) {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
        return youtubeRegex.test(url);
    }

    // Format duration from seconds to MM:SS
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Create now playing embed
    async createNowPlayingEmbed(song) {
        return new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🎵 Now Playing')
            .setDescription(`**[${song.title}](${song.url})**`)
            .addFields(
                { name: '👤 Author', value: song.author, inline: true },
                { name: '⏱️ Duration', value: song.duration, inline: true },
                { name: '👁️ Views', value: song.views, inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setTimestamp()
            .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Music Player` });
    }

    // Create music control buttons
    createMusicControls() {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('music_pause')
                    .setLabel('Pause')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⏸️'),
                new ButtonBuilder()
                    .setCustomId('music_resume')
                    .setLabel('Resume')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('▶️'),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setLabel('Skip')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⏭️'),
                new ButtonBuilder()
                    .setCustomId('music_queue')
                    .setLabel('Queue')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📋'),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setLabel('Stop')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⏹️')
            );
    }

    // Create queue embed
    createQueueEmbed(guildId) {
        const queue = this.getQueue(guildId);
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('📋 Music Queue')
            .setTimestamp()
            .setFooter({ text: `${process.env.PROJECT_NAME || 'HyprL'} Music Player` });

        if (queue.currentSong) {
            embed.addFields({
                name: '🎵 Currently Playing',
                value: `**[${queue.currentSong.title}](${queue.currentSong.url})**\nBy: ${queue.currentSong.author} | Duration: ${queue.currentSong.duration}`,
                inline: false
            });
        }

        if (queue.songs.length > 0) {
            const upcoming = queue.songs.slice(0, 10).map((song, index) => 
                `**${index + 1}.** [${song.title}](${song.url}) - ${song.duration}`
            ).join('\n');

            embed.addFields({
                name: `⏭️ Up Next (${queue.songs.length} songs)`,
                value: upcoming || 'No songs in queue',
                inline: false
            });
        } else {
            embed.addFields({
                name: '⏭️ Up Next',
                value: 'No songs in queue',
                inline: false
            });
        }

        return embed;
    }
}

// Create global music manager instance
const musicManager = new MusicManager();

module.exports = {
    musicManager,
    
    async handleMusicButton(interaction) {
        const { customId } = interaction;
        const guildId = interaction.guild.id;
        const queue = musicManager.getQueue(guildId);

        switch (customId) {
        case 'music_pause':
            if (musicManager.pause(guildId)) {
                await interaction.reply({ content: '⏸️ Music paused!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: '❌ Nothing to pause!', flags: MessageFlags.Ephemeral });
            }
            break;

        case 'music_resume':
            if (musicManager.resume(guildId)) {
                await interaction.reply({ content: '▶️ Music resumed!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: '❌ Nothing to resume!', flags: MessageFlags.Ephemeral });
            }
            break;

        case 'music_skip':
            if (musicManager.skip(guildId)) {
                await interaction.reply({ content: '⏭️ Song skipped!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: '❌ Nothing to skip!', flags: MessageFlags.Ephemeral });
            }
            break;

        case 'music_queue':
            const queueEmbed = musicManager.createQueueEmbed(guildId);
            await interaction.reply({ embeds: [queueEmbed], flags: MessageFlags.Ephemeral });
            break;

        case 'music_stop':
            musicManager.leaveVoiceChannel(guildId);
            await interaction.reply({ content: '⏹️ Music stopped and left voice channel!', flags: MessageFlags.Ephemeral });
            break;

        default:
            await interaction.reply({ content: '❌ Unknown music control!', flags: MessageFlags.Ephemeral });
        }
    }
};
