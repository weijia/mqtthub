import './chat.css';
import MQTTChat from './chat.js';

// 确保只初始化一次
let chatInstance = null;

function initChat() {
    if (chatInstance) {
        console.log('[Main] Chat already initialized, skipping');
        return;
    }
    console.log('[Main] Initializing MQTT Chat...');
    chatInstance = new MQTTChat();
    console.log('[Main] MQTT Chat initialized');
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    // DOM 还在加载中，等待 DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initChat);
} else {
    // DOM 已经加载完成，立即初始化
    initChat();
}
