#!/bin/bash

# HyprL Bot Deployment Script
echo "🚀 Starting HyprL Bot deployment..."

# Pull latest changes from git
echo "📥 Pulling latest changes..."
git pull origin main

# Install/update dependencies
echo "📦 Installing dependencies..."
npm install

# Restart the bot with PM2
echo "🔄 Restarting bot..."
pm2 restart hyprl-bot || pm2 start ecosystem.config.js

# Show status
echo "📊 Bot status:"
pm2 status hyprl-bot

echo "✅ Deployment complete!"
echo "📝 View logs with: pm2 logs hyprl-bot"
echo "⏹️  Stop bot with: pm2 stop hyprl-bot"
echo "🔄 Restart bot with: pm2 restart hyprl-bot"
