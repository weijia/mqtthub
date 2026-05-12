// 版本信息 - 由构建时注入
export const VERSION = import.meta.env.VITE_APP_VERSION || 'dev';
export const BUILD_TIME = import.meta.env.VITE_APP_BUILD_TIME || new Date().toISOString();

export function getFullVersion() {
    return `${VERSION} (${BUILD_TIME})`;
}
