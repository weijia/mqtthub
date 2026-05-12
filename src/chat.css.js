/* MQTT Chat 样式 */
const CHAT_CSS = `
#mqtt-chat {
    position: fixed;
    bottom: 15px;
    right: 15px;
    width: 320px;
    height: 450px;
    background: #ffffff;
    border-radius: 12px;
    z-index: 200000;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: 1px solid #e0e0e0;
    overflow: hidden;
    transition: all 0.3s ease;
    resize: both;
    min-width: 280px;
    min-height: 300px;
    max-width: 90vw;
    max-height: 90vh;
}
#mqtt-chat.fullscreen {
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    border-radius: 0;
    resize: none;
}
#mqtt-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #ffffff;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    cursor: move;
    user-select: none;
}
#mqtt-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
}
#mqtt-channel {
    flex: 1;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
#gear-icon { cursor: pointer; padding: 4px; border-radius: 4px; transition: background 0.2s; }
#gear-icon:hover { background: rgba(255, 255, 255, 0.2); }
#mqtt-body { height: calc(100% - 42px); display: flex; flex-direction: column; }
#mqtt-config-panel { display: none; padding: 15px; background: #f8f9fa; border-bottom: 1px solid #eee; max-height: 60%; overflow-y: auto; }
#mqtt-config-panel.show { display: block; }
.cfg-label { font-size: 11px; color: #666; margin-bottom: 4px; display: block; font-weight: 500; }
#mqtt-config-panel input { width: 100%; margin-bottom: 10px; padding: 8px 10px; font-size: 13px; border: 1px solid #ddd; border-radius: 6px; outline: none; box-sizing: border-box; }
#mqtt-config-panel input:focus { border-color: #667eea; }
.btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; padding: 10px; cursor: pointer; width: 100%; margin-top: 5px; font-size: 13px; font-weight: 500; }
.btn-primary:hover { opacity: 0.9; }
#mqtt-msgs { flex: 1; overflow-y: auto; padding: 12px; font-size: 13px; background: #fafafa; }
.msg-item { margin-bottom: 12px; word-break: break-word; }
.msg-meta { font-size: 11px; color: #999; margin-bottom: 4px; }
.bubble-container { display: flex; align-items: flex-end; gap: 6px; }
.msg-bubble { padding: 8px 14px; border-radius: 12px; display: inline-block; max-width: 80%; font-size: 13px; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
.copy-btn { cursor: pointer; font-size: 12px; padding: 4px 6px; border-radius: 4px; background: rgba(0, 0, 0, 0.05); color: #888; border: none; transition: all 0.2s; }
.copy-btn:hover { background: rgba(0, 0, 0, 0.1); color: #333; }
.msg-left .bubble-container { flex-direction: row; }
.msg-left .msg-bubble { background: #e9ecef; color: #333; border-bottom-left-radius: 2px; }
.msg-right { text-align: right; }
.msg-right .bubble-container { flex-direction: row-reverse; }
.msg-right .msg-bubble { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-bottom-right-radius: 2px; }
.msg-system .msg-meta { color: #999; }
#mqtt-input-area { display: flex; flex-direction: column; border-top: 1px solid #eee; padding: 10px; background: #fff; gap: 8px; }
#mqtt-input { width: 100%; border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; font-size: 13px; outline: none; resize: vertical; font-family: inherit; min-height: 40px; max-height: 200px; line-height: 1.4; box-sizing: border-box; }
#mqtt-input:focus { border-color: #667eea; }
#send-btn { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-size: 13px; align-self: flex-end; }
#send-btn:hover { opacity: 0.9; }
.status-dot { width: 8px; height: 8px; background: #bdc3c7; border-radius: 50%; display: inline-block; transition: background 0.3s; }
.status-online { background: #2ecc71; box-shadow: 0 0 8px #2ecc71; }
.version-info { font-size: 10px; color: #999; text-align: center; margin-bottom: 10px; padding: 4px; background: #f0f0f0; border-radius: 4px; }
#mqtt-msgs::-webkit-scrollbar, #mqtt-config-panel::-webkit-scrollbar { width: 6px; }
#mqtt-msgs::-webkit-scrollbar-track, #mqtt-config-panel::-webkit-scrollbar { background: transparent; }
#mqtt-msgs::-webkit-scrollbar-thumb, #mqtt-config-panel::-webkit-scrollbar { background: #ccc; border-radius: 3px; }
#mqtt-msgs::-webkit-scrollbar-thumb:hover { background: #999; }
`;

// 注入样式
const style = document.createElement('style');
style.textContent = CHAT_CSS;
document.head.appendChild(style);

export default CHAT_CSS;
