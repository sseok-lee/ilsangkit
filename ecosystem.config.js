module.exports = {
  apps: [
    {
      name: 'ilsangkit-api',
      cwd: './backend',
      script: 'dist/server.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 8000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000,
        // loopback 바인딩 — nginx 우회 외부 직접 노출 방지 (server.ts 기본값과 일치)
        HOST: '127.0.0.1'
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'ilsangkit-web',
      cwd: './frontend',
      script: '.output/server/index.mjs',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Nitro SSR loopback 바인딩 — nginx 우회 외부 직접 노출 방지 (deploy.yml 과 일치)
        NITRO_HOST: '127.0.0.1',
        NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:8000'
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
}
