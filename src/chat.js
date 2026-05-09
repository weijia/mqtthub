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
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.connect();
    }

    createUI() {
        const main = document.createElement('div');
        main.id = 'mqtt-chat';
        main.innerHTML = `
            <div id="mqtt-header">
                <span><span id="mqtt-status" class="status-dot"></span>MQTT Hub Chat</span>
                <span style="cursor:pointer;" id="gear-icon">⚙️</span>
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
    }

    bindEvents() {
        const main = document.querySelector('#mqtt-chat');
        const inputField = main.querySelector('#mqtt-input');

        // 双击标题栏折叠/展开
        main.querySelector('#mqtt-header').ondblclick = () => {
            main.style.height = (main.style.height === '42px') ? '434px' : '42px';
        };

        // 设置按钮
        main.querySelector('#gear-icon').onclick = () => {
            const p = main.querySelector('#mqtt-config-panel');
            p.style.display = p.style.display === 'block' ? 'none' : 'block';
        };

        // 保存配置
        main.querySelector('#save-config').onclick = () => {
            this.config.broker = main.querySelector('#cfg-broker').value.trim();
            this.config.topic = main.querySelector('#cfg-topic').value.trim();
            this.config.password = main.querySelector('#cfg-pass').value.trim();
            localStorage.setItem('mqtt_chat_config', JSON.stringify(this.config));
            main.querySelector('#mqtt-config-panel').style.display = 'none';
            this.connect();
        };

        // 发送消息
        inputField.onkeypress = (e) => {
            if (e.key === 'Enter' && inputField.value.trim() && this.client?.connected) {
                this.sendMessage(inputField.value.trim());
                inputField.value = '';
            }
        };
    }

    connect() {
        if (this.client) {
            this.client.end();
        }

        const statusDot = document.querySelector('#mqtt-status');
        statusDot.className = 'status-dot';

        try {
            this.client = mqtt.connect(this.config.broker, {
                clientId: this.clientId,
                reconnectPeriod: 5000
            });

            this.client.on('connect', () => {
                statusDot.className = 'status-dot status-online';
                this.client.subscribe(this.config.topic);
                console.log('[MQTT] Connected to', this.config.broker);
            });

            this.client.on('message', (topic, payload) => {
                this.handleMessage(payload.toString());
            });

            this.client.on('close', () => {
                statusDot.className = 'status-dot';
            });

            this.client.on('error', (err) => {
                console.error('[MQTT] Error:', err);
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
            // 忽略自己发送的消息
            if (data.id === this.clientId) return;

            this.displayMessage(data.user, data.msg, false);
        } catch (e) {
            console.warn('[MQTT] Failed to decrypt message:', e);
        }
    }

    sendMessage(msg) {
        const payload = {
            id: this.clientId,
            user: "User_" + this.clientId.slice(-3),
            msg: msg
        };

        const cipher = CryptoJS.AES.encrypt(
            JSON.stringify(payload),
            this.config.password
        ).toString();

        this.client.publish(this.config.topic, cipher);
        this.displayMessage('我', msg, true);
    }

    displayMessage(user, msg, isSelf) {
        const msgBox = document.querySelector('#mqtt-msgs');
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
        });
    }
}

export default MQTTChat;
