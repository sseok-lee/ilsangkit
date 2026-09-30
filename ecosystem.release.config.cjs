const { readFileSync } = require('node:fs')
const { join } = require('node:path')

function loadBackendEnvFile(env = process.env) {
  const envFile = env.ILSK_BACKEND_ENV_FILE
  if (!envFile) throw new Error('Missing ILSK_BACKEND_ENV_FILE')
  let dotenv
  try {
    dotenv = require(join(env.ILSK_RELEASE_ROOT, 'backend', 'node_modules', 'dotenv'))
  } catch (error) {
    throw new Error(`Failed to load release backend dotenv package: ${error.message}`)
  }
  try {
    return dotenv.parse(readFileSync(envFile))
  } catch (error) {
    throw new Error(`Failed to load release backend env file: ${error.message}`)
  }
}

function createReleaseEcosystem(env = process.env) {
  const releaseId = env.ILSK_RELEASE_ID
  const releaseRoot = env.ILSK_RELEASE_ROOT
  const backendPort = env.ILSK_BACKEND_PORT
  const frontendPort = env.ILSK_FRONTEND_PORT
  const internalApiBase = env.NUXT_INTERNAL_API_BASE

  if (!releaseId || !releaseRoot || !backendPort || !frontendPort || !internalApiBase) {
    throw new Error('Missing release ecosystem environment')
  }

  const backendEnvFile = loadBackendEnvFile(env)
  const backendReleaseEnv = {
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    PORT: backendPort,
    ILSK_RELEASE_ID: releaseId,
    REAL_ESTATE_SUMMARY_MODE: env.REAL_ESTATE_SUMMARY_MODE,
    REAL_ESTATE_URL_MODE: env.REAL_ESTATE_URL_MODE,
    REAL_ESTATE_SUMMARY_RUN_ID: env.REAL_ESTATE_SUMMARY_RUN_ID,
    ILSK_SUMMARY_RUN_ID: env.ILSK_SUMMARY_RUN_ID,
    REAL_ESTATE_WRITE_LOCK_DIR: env.REAL_ESTATE_WRITE_LOCK_DIR,
    SITEMAP_DIR: env.SITEMAP_DIR,
    ILSK_BACKEND_ENV_FILE: env.ILSK_BACKEND_ENV_FILE,
  }

  return {
    apps: [
      {
        name: `ilsangkit-backend-${releaseId}`,
        cwd: `${releaseRoot}/backend`,
        script: 'dist/server.js',
        exec_mode: 'fork',
        instances: 1,
        env: {
          ...backendEnvFile,
          ...backendReleaseEnv,
        },
      },
      {
        name: `ilsangkit-frontend-${releaseId}`,
        cwd: `${releaseRoot}/frontend`,
        script: '.output/server/index.mjs',
        exec_mode: 'fork',
        instances: 1,
        env: {
          NODE_ENV: 'production',
          HOST: '127.0.0.1',
          NITRO_HOST: '127.0.0.1',
          PORT: frontendPort,
          NUXT_PORT: frontendPort,
          NUXT_INTERNAL_API_BASE: internalApiBase,
          NUXT_PUBLIC_API_BASE: '',
          ILSK_RELEASE_ID: releaseId,
        },
      },
    ],
  }
}

module.exports = createReleaseEcosystem()
module.exports.createReleaseEcosystem = createReleaseEcosystem
module.exports.loadBackendEnvFile = loadBackendEnvFile
