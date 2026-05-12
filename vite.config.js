import { defineConfig } from 'vite';
import { execSync } from 'child_process';

// 获取 git 标签
function getGitTag() {
    try {
        return execSync('git describe --tags --always', { encoding: 'utf-8' }).trim();
    } catch {
        return 'dev';
    }
}

export default defineConfig({
    base: './',
    define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(getGitTag()),
        'import.meta.env.VITE_APP_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: false,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                assetFileNames: 'assets/[name]-[hash][extname]',
            }
        }
    }
});
