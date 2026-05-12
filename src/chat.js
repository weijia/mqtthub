import CryptoJS from 'crypto-js';
import mqtt from 'mqtt';
import { getFullVersion } from './version.js';

// 预设 Broker 列表
const PRESET_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://test.mosquitto.org:8081/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
];

// 获取保存的配置
const getSavedConfig = () => {
    const saved = localStorage.getItem('mqtt_chat_config');
    return saved ? JSON.parse(saved) : {
        broker: PRESET_BROKERS[0],
        topic: 'secure/mqtthub/chat/2026',
        password: 'Your_Secret_Password'
    };
};

class MQTTChat {
    constructor() {
        this.config = getSavedConfig();
        this.client = null;
        this.clientId = 'mq_' + Math.random().toString(16).slice(2, 8);
        this.pendingMessages = new Set();
        
        console.log('[MQTT Chat] Initializing with clientId:', this.clientId);
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        setTimeout(() => this.connect(), 100);
    }

    createUI() {
        if (document.getElementById('mqtt-chat')) {
            return;
        }

        const main = document.createElement('div');
        main.id = 'mqtt-chat';
        main.innerHTML = `
            <div id="mqtt-header">
                <span id="mqtt-title"><span id="mqtt-status" class="status-dot"></span>MQTT Hub</span>
                <span id="mqtt-channel">${this.config.topic}</span>
                <span id="gear-icon">⚙️</span>
            </div>
            <div id="mqtt-config-panel">
                <div class="version-info">版本: ${getFullVersion()}</div>
                <label class="cfg-label">Broker (支持下拉)</label>
                <input type="text" id="cfg-broker" list="broker-list" value="${this.config.broker}">
                <datalist id="broker-list">${PRESET_BROKERS.map(b => `<option value="${b}">`).join('')}</datalist>
                <label class="cfg-label">频道 Topic</label>
                <input type="text" id="cfg-topic" value="${this.config.topic}">
                <label class="cfg-label">AES 密码 (所有用户必须相同)</label>
                <input type="password" id="cfg-pass" value="${this.config.password}">
                <button class="btn-primary" id="save-config">应用并重连</button>
            </div>
            <div id="mqtt-body">
                <div id="mqtt-msgs"></div>
                <div id="mqtt-input-area">
                    <textarea id="mqtt-input" placeholder="输入内容，Shift+Enter 换行，Enter 发送..." rows="2"></textarea>
                    <button id="send-btn">发送</button>
                </div>
            </div>
        `;
        document.body.appendChild(main);
    }

    bindEvents() {
        const main = document.getElementById('mqtt-chat');
        if (!main) return;

        const header = main.querySelector('#mqtt-header');
        const gearIcon = main.querySelector('#gear-icon');
        const saveBtn = main.querySelector('#save-config');
        const inputField = main.querySelector('#mqtt-input');
        const sendBtn = main.querySelector('#send-btn');

        // 双击标题栏全屏/还原
        header.addEventListener('dblclick', () => {
            main.classList.toggle('fullscreen');
        });

        // 拖动功能
        this.makeDraggable(main, header);

        // 设置按钮
        gearIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            main.querySelector('#mqtt-config-panel').classList.toggle('show');
        });

        // 保存配置
        saveBtn.addEventListener('click', () => {
            this.config.broker = main.querySelector('#cfg-broker').value.trim();
            this.config.topic = main.querySelector('#cfg-topic').value.trim();
            this.config.password = main.querySelector('#cfg-pass').value.trim();
            localStorage.setItem('mqtt_chat_config', JSON.stringify(this.config));
            main.querySelector('#mqtt-config-panel').classList.remove('show');
            main.querySelector('#mqtt-channel').textContent = this.config.topic;
            this.connect();
        });

        // 发送消息 - Enter 发送，Shift+Enter 换行
        inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.trySend();
            }
        });

        // 发送按钮
        sendBtn.addEventListener('click', () => {
            this.trySend();
        });
    }

    trySend() {
        const inputField = document.getElementById('mqtt-input');
        const msg = inputField.value.trim();
        if (msg && this.client?.connected) {
            this.sendMessage(msg);
            inputField.value = '';
            inputField.rows = 2;
        } else if (!this.client?.connected) {
            this.displaySystemMessage('⚠️ 未连接到服务器');
        }
    }

    makeDraggable(element, handle) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        handle.addEventListener('mousedown', (e) => {
            if (e.target.id === 'gear-icon' || e.target.id === 'mqtt-channel') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = element.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            element.style.left = (startLeft + dx) + 'px';
            element.style.top = (startTop + dy) + 'px';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    connect() {
        if (this.client) {
            this.client.end(true);
        }

        const statusDot = document.getElementById('mqtt-status');
        if (statusDot) {
            statusDot.className = 'status-dot';
        }

        try {
            this.client = mqtt.connect(this.config.broker, {
                clientId: this.clientId,
                reconnectPeriod: 5000,
                connectTimeout: 30000,
                clean: true
            });

            this.client.on('connect', () => {
                const status = document.getElementById('mqtt-status');
                if (status) status.className = 'status-dot status-online';
                this.client.subscribe(this.config.topic, { qos: 1 });
                this.displaySystemMessage('✅ 已连接到服务器');
            });

            this.client.on('message', (topic, payload) => {
                this.handleMessage(payload.toString());
            });

            this.client.on('close', () => {
                const status = document.getElementById('mqtt-status');
                if (status) status.className = 'status-dot';
            });

            this.client.on('error', (err) => {
                this.displaySystemMessage('❌ 连接错误: ' + err.message);
            });

        } catch (err) {
            console.error('[MQTT] Connection failed:', err);
        }
    }

    handleMessage(encryptedData) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, this.config.password);
            const raw = bytes.toString(CryptoJS.enc.Utf8);
            if (!raw) return;

            const data = JSON.parse(raw);
            if (data.id === this.clientId) return;
            if (data.msgId && this.pendingMessages.has(data.msgId)) return;

            this.displayMessage(data.user, data.msg, false);
        } catch (e) {
            console.warn('[MQTT] Failed to process message');
        }
    }

    sendMessage(msg) {
        const msgId = Date.now() + '_' + Math.random().toString(16).slice(2, 6);
        
        const payload = {
            id: this.clientId,
            msgId: msgId,
            user: "User_" + this.clientId.slice(-4),
            msg: msg,
            time: Date.now()
        };

        const cipher = CryptoJS.AES.encrypt(JSON.stringify(payload), this.config.password).toString();

        // 检查长度
        if (cipher.length > 60000) {
            this.displaySystemMessage('⚠️ 消息过长');
            return;
        }

        this.pendingMessages.add(msgId);
        setTimeout(() => this.pendingMessages.delete(msgId), 5000);

        this.client.publish(this.config.topic, cipher, { qos: 1 });
        this.displayMessage('我', msg, true);
    }

    displayMessage(user, msg, isSelf) {
        const msgBox = document.getElementById('mqtt-msgs');
        if (!msgBox) return;
        
        const msgEl = document.createElement('div');
        msgEl.className = `msg-item ${isSelf ? 'msg-right' : 'msg-left'}`;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgEl.innerHTML = `
            <div class="msg-meta">${user} · ${time}</div>
            <div class="bubble-container">
                <div class="msg-bubble">${this.escapeHtml(msg).replace(/\n/g, '<br>')}</div>
                <button class="copy-btn" title="复制">📋</button>
            </div>
        `;
        
        msgEl.querySelector('.copy-btn').onclick = () => {
            navigator.clipboard.writeText(msg);
            const btn = msgEl.querySelector('.copy-btn');
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = '📋', 1500);
        };

        msgBox.appendChild(msgEl);
        msgBox.scrollTop = msgBox.scrollHeight;
    }

    displaySystemMessage(msg) {
        const msgBox = document.getElementById('mqtt-msgs');
        if (!msgBox) return;
        
        const msgEl = document.createElement('div');
        msgEl.className = 'msg-item msg-system';
        msgEl.innerHTML = `<div class="msg-meta" style="text-align:center;color:#999;font-size:11px;">${msg}</div>`;
        msgBox.appendChild(msgEl);
        msgBox.scrollTop = msgBox.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

export default MQTTChat;
