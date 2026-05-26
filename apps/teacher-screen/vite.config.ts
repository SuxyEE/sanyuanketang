import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  // 部署时挂在 /screen/ 子路径下（容器内 nginx 做了 alias），
  // 让构建产物的资源引用都加这个前缀；dev 时 vite root='/' 不受影响
  base: process.env.VITE_BASE || '/screen/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@snyuan/shared': resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 3001,
    host: true,
  },
})
