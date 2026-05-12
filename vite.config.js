import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 将 CSS 内联到 JS 中，避免 MIME 类型问题
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // 内联所有 CSS
        inlineDynamicImports: true,
        assetFileNames: 'assets/[name]-[hash][extname]',
      }
    }
  }
});
