import './chat.css.js';
import MQTTChat from './chat.js';

// 确保只初始化一次
let chatInstance = null;

function initChat() {
    if (chatInstance) {
        return;
    }
    chatInstance = new MQTTChat();
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChat);
} else {
    initChat();
}
