// pm2 process definition (CommonJS — pm2 requires it)
module.exports = {
  apps: [
    {
      name: 'pulse',
      script: 'server/index.js',
      env_file: '.env',
    },
  ],
};
