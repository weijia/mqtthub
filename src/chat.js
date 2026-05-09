import mqtt from 'mqtt';
import CryptoJS from 'crypto-js';

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
        this.clientId = 'mq_' + Math.random().toString(16).slice(2, 6);
        console.log('[MQTT Chat] Initializing with clientId:', this.clientId);
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        // 延迟连接，确保UI先渲染
        setTimeout(() => this.connect(), 100);
    }

    createUI() {
        // 检查是否已存在
        if (document.getElementById('mqtt-chat')) {
            console.log('[MQTT Chat] UI already exists');
            return;
        }

        const main = document.createElement('div');
        main.id = 'mqtt-chat';
        main.innerHTML = `
            <div id="mqtt-header">
                <span><span id="mqtt-status" class="status-dot"></span>MQTT Hub Chat</span>
                <span id="gear-icon">⚙️</span>
            </div>
            <div id="mqtt-config-panel">
                <label class="cfg-label">Broker (支持下拉)</label>
                <input type="text" id="cfg-broker" list="broker-list" value="${this.config.broker}">
                <datalist id="broker-list">${PRESET_BROKERS.map(b => `<option value="${b}">`).join('')}</datalist>
                <label class="cfg-label">频道 Topic</label>
                <input type="text" id="cfg-topic" value="${this.config.topic}">
                <label class="cfg-label">AES 密码</label>
                <input type="password" id="cfg-pass" value="${this.config.password}">
                <button class="btn-primary" id="save-config">应用并重连</button>
            </div>
            <div id="mqtt-body">
                <div id="mqtt-msgs"></div>
                <div id="mqtt-input-area">
                    <input type="text" id="mqtt-input" placeholder="输入内容按回车..." autocomplete="off">
                </div>
            </div>
        `;
        document.body.appendChild(main);
        console.log('[MQTT Chat] UI created');
    }

    bindEvents() {
        const main = document.getElementById('mqtt-chat');
        if (!main) {
            console.error('[MQTT Chat] Main element not found');
            return;
        }

        const header = main.querySelector('#mqtt-header');
        const gearIcon = main.querySelector('#gear-icon');
        const saveBtn = main.querySelector('#save-config');
        const inputField = main.querySelector('#mqtt-input');

        console.log('[MQTT Chat] Binding events...');

        // 双击标题栏折叠/展开
        header.addEventListener('dblclick', () => {
            console.log('[MQTT Chat] Header double-clicked');
            const currentHeight = main.style.height;
            main.style.height = (currentHeight === '42px') ? '450px' : '42px';
        });

        // 设置按钮 - 使用 click 事件
        gearIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('[MQTT Chat] Gear icon clicked');
            const panel = main.querySelector('#mqtt-config-panel');
            const isVisible = panel.style.display === 'block';
            panel.style.display = isVisible ? 'none' : 'block';
            console.log('[MQTT Chat] Panel display:', panel.style.display);
        });

        // 保存配置
        saveBtn.addEventListener('click', () => {
            console.log('[MQTT Chat] Save config clicked');
            this.config.broker = main.querySelector('#cfg-broker').value.trim();
            this.config.topic = main.querySelector('#cfg-topic').value.trim();
            this.config.password = main.querySelector('#cfg-pass').value.trim();
            localStorage.setItem('mqtt_chat_config', JSON.stringify(this.config));
            main.querySelector('#mqtt-config-panel').style.display = 'none';
            this.connect();
        });

        // 发送消息
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && inputField.value.trim()) {
                if (!this.client?.connected) {
                    console.warn('[MQTT Chat] Not connected to broker');
                    return;
                }
                this.sendMessage(inputField.value.trim());
                inputField.value = '';
            }
        });

        console.log('[MQTT Chat] Events bound successfully');
    }

    connect() {
        console.log('[MQTT] Connecting to:', this.config.broker);
        
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
                console.log('[MQTT] Connected to', this.config.broker);
                const status = document.getElementById('mqtt-status');
                if (status) {
                    status.className = 'status-dot status-online';
                }
                this.client.subscribe(this.config.topic, (err) => {
                    if (err) {
                        console.error('[MQTT] Subscribe error:', err);
                    } else {
                        console.log('[MQTT] Subscribed to:', this.config.topic);
                    }
                });
            });

            this.client.on('message', (topic, payload) => {
                console.log('[MQTT] Message received on:', topic);
                this.handleMessage(payload.toString());
            });

            this.client.on('close', () => {
                console.log('[MQTT] Connection closed');
                const status = document.getElementById('mqtt-status');
                if (status) {
                    status.className = 'status-dot';
                }
            });

            this.client.on('error', (err) => {
                console.error('[MQTT] Error:', err);
            });

            this.client.on('offline', () => {
                console.log('[MQTT] Client offline');
            });

        } catch (err) {
            console.error('[MQTT] Connection failed:', err);
        }
    }

    handleMessage(encryptedData) {
        try {
            console.log('[MQTT] Handling message...');
            const bytes = CryptoJS.AES.decrypt(encryptedData, this.config.password);
            const raw = bytes.toString(CryptoJS.enc.Utf8);
            if (!raw) {
                console.warn('[MQTT] Decryption returned empty');
                return;
            }

            const data = JSON.parse(raw);
            console.log('[MQTT] Received from:', data.user);
            
            // 忽略自己发送的消息
            if (data.id === this.clientId) return;

            this.displayMessage(data.user, data.msg, false);
        } catch (e) {
            console.warn('[MQTT] Failed to decrypt message:', e);
        }
    }

    sendMessage(msg) {
        if (!this.client?.connected) {
            console.warn('[MQTT] Cannot send: not connected');
            return;
        }

        const payload = {
            id: this.clientId,
            user: "User_" + this.clientId.slice(-3),
            msg: msg,
            time: Date.now()
        };

        const cipher = CryptoJS.AES.encrypt(
            JSON.stringify(payload),
            this.config.password
        ).toString();

        this.client.publish(this.config.topic, cipher, (err) => {
            if (err) {
                console.error('[MQTT] Publish error:', err);
            } else {
                console.log('[MQTT] Message published');
            }
        });
        this.displayMessage('我', msg, true);
    }

    displayMessage(user, msg, isSelf) {
        const msgBox = document.getElementById('mqtt-msgs');
        if (!msgBox) return;
        
        const msgEl = this.createMsgElement(user, msg, isSelf);
        msgBox.appendChild(msgEl);
        msgBox.scrollTop = msgBox.scrollHeight;
    }

    createMsgElement(user, msg, isSelf) {
        const d = document.createElement('div');
        d.className = `msg-item ${isSelf ? 'msg-right' : 'msg-left'}`;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const bubbleWrap = document.createElement('div');
        bubbleWrap.className = 'bubble-container';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerText = msg;

        const btn = document.createElement('button');
        btn.className = 'copy-btn';
        btn.innerText = '📋';
        btn.onclick = () => this.copyToClipboard(msg, btn);

        bubbleWrap.appendChild(bubble);
        bubbleWrap.appendChild(btn);

        d.innerHTML = `<div class="msg-meta">${user} · ${time}</div>`;
        d.appendChild(bubbleWrap);

        return d;
    }

    copyToClipboard(text, btn) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = btn.innerText;
            btn.innerText = '✅';
            setTimeout(() => { btn.innerText = originalText; }, 1500);
        }).catch(err => {
            console.error('[MQTT] Copy failed:', err);
        });
    }
}

export default MQTTChat;
