module.exports = {
  apps: [{
    name: 'email-forrt',
    script: 'server.js',
    cwd: '/opt/email-forrt',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/email-forrt/error.log',
    out_file: '/var/log/email-forrt/out.log',
    log_file: '/var/log/email-forrt/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    restart_delay: 1000
  }]
};
