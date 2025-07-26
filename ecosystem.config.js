module.exports = {
  apps: [{
    name: 'hyprl-bot',
    script: 'index.js',
    instances: 1,
    autorestart: true,
    watch: false, // Set to true for development auto-restart
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    env_development: {
      NODE_ENV: 'development',
      watch: true,
      ignore_watch: ['node_modules', 'data', '.git']
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
