import './chat.css';
import MQTTChat from './chat.js';

// 页面加载完成后初始化聊天组件
document.addEventListener('DOMContentLoaded', () => {
    console.log('MQTT Hub 已加载');
    
    // 初始化 MQTT 聊天组件
    const chat = new MQTTChat();
    
    console.log('MQTT Chat 组件已初始化');
});

// 如果 DOM 已经加载完成，立即初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('MQTT Hub 已加载');
    new MQTTChat();
}
