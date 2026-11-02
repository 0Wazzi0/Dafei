import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      // 组件用 defineComponent + template 字符串编写，需要带编译器的完整版 Vue
      vue: 'vue/dist/vue.esm-bundler.js'
    }
  }
})