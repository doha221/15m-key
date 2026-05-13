module.exports = {
  apps: [
    {
      name: '15m-key',
      script: './node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: __dirname,
      autorestart: true,
      max_memory_restart: '300M',
      out_file: './logs/out.log',
      error_file: './logs/err.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
