// GitHub Actions updates these canonical production paths and process names.
module.exports = {
  apps: [
    {
      name: 'ilsangkit-backend',
      cwd: '/home/project2/backend',
      script: 'dist/server.js',
      node_args: '--env-file=/home/project2/backend/.env',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '8000',
        AFFILIATE_BANNER_CLEANUP_ENABLED: 'true',
      },
    },
    {
      name: 'ilsangkit-frontend',
      cwd: '/home/project2/frontend',
      script: '.output/server/index.mjs',
      node_args: '--env-file=/home/project2/frontend/.env --max-old-space-size=1024',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '850M',
      env_production: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        NITRO_HOST: '127.0.0.1',
        PORT: '3000',
        NUXT_PORT: '3000',
        NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:8000',
      },
    },
  ],
}
