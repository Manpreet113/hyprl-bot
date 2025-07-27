# 🛡️ HyprL Bot - Advanced Automod System

## Overview

The HyprL Discord Bot features a comprehensive, enterprise-grade automod system designed to provide robust protection for your Discord server. This system combines multiple detection algorithms, progressive punishment, and extensive configuration options to create a powerful moderation solution.

## 🌟 Features

### 🚀 Advanced Spam Detection
- **Multi-metric Analysis**: Uses 6+ different algorithms to detect spam
- **Pattern Recognition**: Identifies bot-like behavior through temporal analysis
- **Content Similarity**: Groups and detects repeated content using string similarity
- **Cross-channel Detection**: Identifies users posting identical content across channels
- **Frequency Analysis**: Monitors message frequency patterns
- **Smart Scoring System**: Combines multiple metrics for accurate spam detection

### 📝 Content Filtering
- **Blacklisted Words**: Configurable word filtering with case-insensitive matching
- **Phishing Protection**: Built-in database of known phishing domains
- **Unicode Abuse**: Detects invisible characters, RTL overrides, and homograph attacks
- **Zalgo Text**: Identifies corrupted/zalgo text using combining character analysis
- **Suspicious Attachments**: Blocks potentially malicious file extensions

### 🔗 Link & Invite Management
- **Invite Link Detection**: Identifies Discord invite links
- **Server Whitelist**: Allow invites from specific servers
- **Link Filtering**: Whitelist/blacklist specific domains
- **Phishing Detection**: Automatic detection of known phishing sites

### 💬 Message Quality Control
- **Caps Lock Filter**: Limits excessive capitalization
- **Repeated Characters**: Prevents character spam (aaaaaaa)
- **Mass Emoji**: Controls excessive emoji usage
- **Newline Spam**: Limits excessive line breaks
- **Mass Mentions**: Prevents mention bombing

### ⚖️ Progressive Punishment System
- **Severity-based**: Actions scale based on violation severity
- **Configurable Thresholds**: Customize punishment levels
- **Multiple Actions**: Warn → Timeout → Kick → Ban progression
- **Duration Control**: Configurable timeout durations
- **History Tracking**: 24-hour violation tracking

### 📊 Advanced Analytics
- **Real-time Statistics**: Live violation tracking
- **User Profiles**: Individual violation histories
- **Trend Analysis**: Identify patterns and repeat offenders
- **Performance Metrics**: Track automod effectiveness

## 🎛️ Configuration Commands

### `/config-automod`
Configure individual automod rules for your server.

**Options:**
- `rule`: Select the rule to configure
- `enable`: Enable or disable the rule

**Available Rules:**
- Spam Detection
- Blacklisted Words
- Invite Links
- Caps Lock
- Mass Mentions
- Mass Emoji
- Unicode Abuse
- Newline Spam
- Suspicious Attachments
- Phishing Links

### `/blacklist`
Manage your server's blacklisted words.

**Subcommands:**
- `add <word>`: Add a word to the blacklist
- `remove <word>`: Remove a word from the blacklist
- `list`: View all blacklisted words
- `clear`: Clear all blacklisted words

### `/automod-status`
View comprehensive automod statistics and status.

**Options:**
- `user` (optional): View violations for a specific user

## 🔧 Technical Implementation

### Architecture
- **Modular Design**: Each rule is independently configurable
- **Database Integration**: PostgreSQL/Supabase for persistent storage
- **Real-time Processing**: Immediate message analysis
- **Scalable**: Handles high-volume servers efficiently

### Detection Algorithms

#### Spam Detection Algorithm
```javascript
// Multi-factor scoring system
totalScore = frequencyScore + similarityScore + patternScore + 
             crossChannelScore + rapidSpamScore + temporalScore

// Threshold-based action
if (totalScore >= 10) {
    // Advanced spam detected
    severity = Math.min(5, Math.floor(totalScore / 2))
}
```

#### Pattern Analysis
- **Temporal Patterns**: Detects bot-like regular intervals
- **Content Clustering**: Groups similar messages using string similarity
- **Behavioral Analysis**: Identifies suspicious posting patterns

### Database Schema

#### Automod Configuration
```sql
CREATE TABLE automod_config (
    guild_id TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    -- Rule-specific settings
    spam_detection BOOLEAN DEFAULT TRUE,
    blacklist_enabled BOOLEAN DEFAULT TRUE,
    -- ... additional configuration fields
);
```

#### Violation Tracking
```sql
CREATE TABLE automod_violations (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    violation_type TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📈 Performance Features

### Efficiency Optimizations
- **In-memory Caching**: Fast message tracking using Maps
- **Batch Processing**: Efficient database operations
- **Cleanup Routines**: Automatic cleanup of old data
- **Connection Pooling**: Optimized database connections

### Scalability Features
- **Configurable Thresholds**: Adjust sensitivity per server
- **Exemption System**: Bypass rules for trusted users/roles/channels
- **Resource Management**: Automatic cleanup prevents memory leaks

## 🛠️ Setup Instructions

### 1. Database Setup
Ensure your Supabase/PostgreSQL database is configured with the required environment variables:

```env
DATABASE_URL=postgresql://user:pass@host:port/db
# or
SUPABASE_DB_URL=postgresql://user:pass@host:port/db
```

### 2. Configuration
The automod system is automatically initialized with sensible defaults. Use the configuration commands to customize settings for your server.

### 3. Permissions
Ensure the bot has the following permissions:
- `MANAGE_MESSAGES` (to delete violating messages)
- `MODERATE_MEMBERS` (for timeouts)
- `KICK_MEMBERS` (for kicks)
- `BAN_MEMBERS` (for bans)

## 📋 Rule Details

### Spam Detection Rules
| Rule | Default Threshold | Action |
|------|-------------------|--------|
| Message Frequency | 5 messages/10s | Delete + Warn |
| Duplicate Content | 3 similar messages | Delete + Warn |
| Advanced Spam | Score ≥ 10 | Delete + Progressive |

### Content Rules
| Rule | Default Settings | Configurable |
|------|------------------|--------------|
| Caps Lock | 70% ratio, 10+ chars | ✅ |
| Repeated Chars | 10+ in a row | ✅ |
| Mass Emoji | 10+ emojis | ✅ |
| Newlines | 15+ line breaks | ✅ |

### Progressive Punishment
| Severity Level | Default Action | Duration |
|----------------|----------------|----------|
| 1-4 | Warning | - |
| 5-9 | Timeout | 5 minutes |
| 10-14 | Timeout | 30 minutes |
| 15-24 | Timeout | 1 hour |
| 25-34 | Kick | - |
| 35+ | Ban | - |

## 🔍 Monitoring & Analytics

### Real-time Monitoring
- Live violation tracking in database
- Immediate notification of severe violations
- Performance metrics and statistics

### Analytics Dashboard
Use `/automod-status` to access:
- Server-wide violation statistics
- Top violation types
- User-specific violation histories
- Trend analysis over time

## 🚨 Security Features

### Privacy Protection
- Content hashing for spam detection (no full content storage)
- Automatic data cleanup (24-hour retention)
- Role-based access control for configuration

### False Positive Prevention
- Multiple confirmation methods
- Configurable sensitivity levels
- Exemption system for trusted users
- Manual override capabilities

## 🔮 Advanced Features

### Experimental Rules
- **Anti-Raid Protection**: Detect mass join events
- **Slowmode Automation**: Automatic slowmode on spam detection
- **Behavior Analysis**: Long-term user behavior tracking

### Integration Features
- **Webhook Logging**: Send violation logs to external systems
- **API Integration**: RESTful endpoints for external monitoring
- **Custom Actions**: Configurable response actions

## 📚 Best Practices

### Configuration Tips
1. **Start Conservative**: Begin with default settings and adjust based on server needs
2. **Monitor Initially**: Watch violation logs for the first few days
3. **Adjust Gradually**: Make small adjustments to avoid over-moderation
4. **Use Exemptions**: Exempt trusted roles/channels as needed

### Maintenance
1. **Regular Review**: Check violation statistics weekly
2. **Update Blacklists**: Keep word filters current
3. **Performance Monitoring**: Watch for any performance issues
4. **User Feedback**: Listen to community feedback about false positives

## 🤝 Support

For issues or questions about the automod system:
1. Check the violation logs using `/automod-status`
2. Review configuration settings
3. Test with exempted users first
4. Contact server administrators for assistance

## 📖 API Reference

### Core Functions
```javascript
// Process a message through automod
await automod.processMessage(message);

// Get guild configuration
const config = await automod.getGuildConfig(guildId);

// Update configuration
await automod.updateGuildConfig(guildId, newConfig);

// Get user statistics
const stats = await automod.getUserStats(guildId, userId);
```

---

*This automod system represents a state-of-the-art approach to Discord server moderation, combining advanced algorithms with practical usability to create a comprehensive protection solution.*
