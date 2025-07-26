const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const { spawn } = require('child_process');

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

    // Get video info from YouTube URL
    async getVideoInfo(url) {
        try {
            const info = await ytdl.getInfo(url);
            return {
                title: info.videoDetails.title,
                url: info.videoDetails.video_url,
                duration: this.formatDuration(parseInt(info.videoDetails.lengthSeconds)),
                thumbnail: info.videoDetails.thumbnails[0]?.url,
                author: info.videoDetails.author.name,
                views: parseInt(info.videoDetails.viewCount).toLocaleString()
            };
        } catch (error) {
            throw new Error('Invalid YouTube URL or video unavailable');
        }
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
                    await interaction.reply({ content: '⏸️ Music paused!', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Nothing to pause!', ephemeral: true });
                }
                break;

            case 'music_resume':
                if (musicManager.resume(guildId)) {
                    await interaction.reply({ content: '▶️ Music resumed!', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Nothing to resume!', ephemeral: true });
                }
                break;

            case 'music_skip':
                if (musicManager.skip(guildId)) {
                    await interaction.reply({ content: '⏭️ Song skipped!', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Nothing to skip!', ephemeral: true });
                }
                break;

            case 'music_queue':
                const queueEmbed = musicManager.createQueueEmbed(guildId);
                await interaction.reply({ embeds: [queueEmbed], ephemeral: true });
                break;

            case 'music_stop':
                musicManager.leaveVoiceChannel(guildId);
                await interaction.reply({ content: '⏹️ Music stopped and left voice channel!', ephemeral: true });
                break;

            default:
                await interaction.reply({ content: '❌ Unknown music control!', ephemeral: true });
        }
    }
};
