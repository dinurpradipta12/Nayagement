import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const builtAt = new Date().toISOString()
  const appVersion = command === 'build' ? builtAt : 'development'

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_BUILD_TIME__: JSON.stringify(builtAt),
    },
    plugins: [
      react(),
      {
        name: 'nayagement-app-version',
        apply: 'build',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'app-version.json',
            source: JSON.stringify({ version: appVersion, builtAt }),
          })
        },
      },
    ],
    server: {
      host: true,
    },
  }
})
