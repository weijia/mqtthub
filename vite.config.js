import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  // 从环境变量获取 BASE_URL
  // WebDAV: 使用相对路径 './'
  // GitHub Pages: 使用项目名作为 base '/x/'
  const baseUrl = process.env.BASE_URL || './';
  
  return {
    base: baseUrl,
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // 确保资源引用使用相对路径
      assetsDir: 'assets',
      rollupOptions: {
        output: {
          // 使用相对路径的资源命名
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js'
        }
      }
    }
  };
});
