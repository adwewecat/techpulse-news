import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Cho phép đọc trên điện thoại qua địa chỉ IP mạng nội bộ hoặc ZeroTier
    port: 5011,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true,
      },
    },
  },
});
