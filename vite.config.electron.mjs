import { defineConfig } from 'vite';
import { builtinModules } from 'module';

// https://vitejs.dev/config/
export default defineConfig({
  mode: 'development',
  build: {
    target: 'esnext',
    minify: false,
    sourcemap: false,
    outDir: 'dist-electron',
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`)
      ],
      input: {
        main: './electron/main.ts',
      },
      output: {
        entryFileNames: '[name].js',
        format: 'cjs', // 使用CommonJS格式
      }
    }
  }
});