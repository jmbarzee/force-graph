// Declarations are pruned afterwards by verify/prune-dts.mjs (build:lib).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['**/*.test.*'],
    }),
  ],
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', 'react-dom/server'],
      output: {
        assetFileNames: (assetInfo) => (assetInfo.name?.endsWith('.css') ? 'styles.css' : 'assets/[name].[ext]'),
      },
    },
  },
})
