module.exports = {
  apps: [
    {
      name: 'gymstack-sales-platform',
      script: 'start-all.js',
      watch: false,
      restart_delay: 5000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
