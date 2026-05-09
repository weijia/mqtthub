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
        this.clientId = 'mq_' + Math.random().toString(16).slice(2, 8);
        this.pendingMessages = new Set();
        this.messageCount = 0;
        
        console.log('========== MQTT Chat Debug ==========');
        console.log('[DEBUG] ClientId:', this.clientId);
        console.log('[DEBUG] Config:', JSON.stringify(this.config, null, 2));
        console.log('======================================');
        
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        setTimeout(() => this.connect(), 100);
    }

    createUI() {
        if (document.getElementById('mqtt-chat')) {
            console.log('[DEBUG] UI already exists, skipping creation');
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
                <label class="cfg-label">AES 密码 (所有用户必须相同)</label>
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
        console.log('[DEBUG] UI created successfully');
    }

    bindEvents() {
        const main = document.getElementById('mqtt-chat');
        if (!main) {
            console.error('[DEBUG] ERROR: Main element not found!');
            return;
        }

        const header = main.querySelector('#mqtt-header');
        const gearIcon = main.querySelector('#gear-icon');
        const saveBtn = main.querySelector('#save-config');
        const inputField = main.querySelector('#mqtt-input');

        console.log('[DEBUG] Elements found:', {
            header: !!header,
            gearIcon: !!gearIcon,
            saveBtn: !!saveBtn,
            inputField: !!inputField
        });

        header.addEventListener('dblclick', () => {
            const currentHeight = main.style.height;
            main.style.height = (currentHeight === '42px') ? '450px' : '42px';
            console.log('[DEBUG] Toggle height:', main.style.height);
        });

        gearIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = main.querySelector('#mqtt-config-panel');
            const isVisible = panel.style.display === 'block';
            panel.style.display = isVisible ? 'none' : 'block';
            console.log('[DEBUG] Panel toggled:', panel.style.display);
        });

        saveBtn.addEventListener('click', () => {
            this.config.broker = main.querySelector('#cfg-broker').value.trim();
            this.config.topic = main.querySelector('#cfg-topic').value.trim();
            this.config.password = main.querySelector('#cfg-pass').value.trim();
            localStorage.setItem('mqtt_chat_config', JSON.stringify(this.config));
            main.querySelector('#mqtt-config-panel').style.display = 'none';
            console.log('[DEBUG] Config saved:', this.config);
            this.connect();
        });

        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && inputField.value.trim()) {
                console.log('[DEBUG] Enter pressed, input:', inputField.value.trim());
                if (!this.client?.connected) {
                    this.displaySystemMessage('⚠️ 未连接到服务器，请稍候...');
                    console.warn('[DEBUG] Not connected! client.connected:', this.client?.connected);
                    return;
                }
                this.sendMessage(inputField.value.trim());
                inputField.value = '';
            }
        });

        console.log('[DEBUG] Events bound successfully');
    }

    connect() {
        console.log('========== MQTT Connect ==========');
        console.log('[DEBUG] Broker:', this.config.broker);
        console.log('[DEBUG] ClientId:', this.clientId);
        console.log('[DEBUG] Topic:', this.config.topic);
        console.log('==================================');
        
        if (this.client) {
            console.log('[DEBUG] Ending previous connection...');
            this.client.end(true);
        }

        const statusDot = document.getElementById('mqtt-status');
        if (statusDot) {
            statusDot.className = 'status-dot';
        }

        try {
            console.log('[DEBUG] Creating MQTT client...');
            this.client = mqtt.connect(this.config.broker, {
                clientId: this.clientId,
                reconnectPeriod: 5000,
                connectTimeout: 30000,
                clean: true
            });

            console.log('[DEBUG] MQTT client created, binding events...');

            this.client.on('connect', (connack) => {
                console.log('========== MQTT Connected ==========');
                console.log('[DEBUG] Broker:', this.config.broker);
                console.log('[DEBUG] Connack:', connack);
                
                const status = document.getElementById('mqtt-status');
                if (status) {
                    status.className = 'status-dot status-online';
                }
                
                this.client.subscribe(this.config.topic, { qos: 1 }, (err, granted) => {
                    if (err) {
                        console.error('[DEBUG] Subscribe ERROR:', err);
                    } else {
                        console.log('[DEBUG] Subscribe SUCCESS, granted:', granted);
                        this.displaySystemMessage('✅ 已连接到 ' + this.config.broker);
                    }
                });
            });

            this.client.on('message', (topic, payload, packet) => {
                this.messageCount++;
                console.log('========== MQTT Message Received ==========');
                console.log('[DEBUG] Message #', this.messageCount);
                console.log('[DEBUG] Topic:', topic);
                console.log('[DEBUG] Payload length:', payload.length);
                console.log('[DEBUG] Payload (first 100 chars):', payload.toString().substring(0, 100));
                console.log('[DEBUG] Packet:', packet);
                console.log('==========================================');
                this.handleMessage(payload.toString());
            });

            this.client.on('close', () => {
                console.log('[DEBUG] Connection CLOSED');
                const status = document.getElementById('mqtt-status');
                if (status) {
                    status.className = 'status-dot';
                }
            });

            this.client.on('error', (err) => {
                console.error('[DEBUG] Connection ERROR:', err);
                this.displaySystemMessage('❌ 连接错误: ' + err.message);
            });

            this.client.on('offline', () => {
                console.log('[DEBUG] Client OFFLINE');
            });

            this.client.on('reconnect', () => {
                console.log('[DEBUG] Client RECONNECTING...');
            });

        } catch (err) {
            console.error('[DEBUG] Connection FAILED:', err);
        }
    }

    handleMessage(encryptedData) {
        console.log('========== Handle Message ==========');
        console.log('[DEBUG] My ClientId:', this.clientId);
        console.log('[DEBUG] Password used:', this.config.password);
        console.log('[DEBUG] Encrypted data length:', encryptedData.length);
        
        try {
            console.log('[DEBUG] Attempting AES decrypt...');
            const bytes = CryptoJS.AES.decrypt(encryptedData, this.config.password);
            console.log('[DEBUG] Decrypt bytes result:', bytes.toString());
            
            const raw = bytes.toString(CryptoJS.enc.Utf8);
            console.log('[DEBUG] Decrypted raw:', raw ? raw.substring(0, 200) : '(empty)');
            
            if (!raw) {
                console.error('[DEBUG] DECRYPTION FAILED - raw is empty!');
                console.error('[DEBUG] This usually means wrong password!');
                console.error('[DEBUG] Expected password:', this.config.password);
                this.displaySystemMessage('⚠️ 收到消息但解密失败（密码不匹配？）');
                return;
            }

            const data = JSON.parse(raw);
            console.log('[DEBUG] Parsed data:', JSON.stringify(data, null, 2));
            console.log('[DEBUG] Sender ID:', data.id);
            console.log('[DEBUG] My ID:', this.clientId);
            console.log('[DEBUG] IDs match?', data.id === this.clientId);
            
            // 检查是否是自己发送的消息
            if (data.id === this.clientId) {
                console.log('[DEBUG] >>> IGNORING: This is my own message <<<');
                return;
            }

            // 检查是否已经显示过
            if (data.msgId && this.pendingMessages.has(data.msgId)) {
                console.log('[DEBUG] >>> IGNORING: Message already displayed <<<');
                return;
            }

            console.log('[DEBUG] >>> DISPLAYING message from:', data.user, '<<<');
            this.displayMessage(data.user, data.msg, false);
            
        } catch (e) {
            console.error('[DEBUG] Handle message ERROR:', e);
            console.error('[DEBUG] Error stack:', e.stack);
        }
        console.log('=====================================');
    }

    sendMessage(msg) {
        console.log('========== Send Message ==========');
        console.log('[DEBUG] Message to send:', msg);
        console.log('[DEBUG] Client connected?', this.client?.connected);
        
        if (!this.client?.connected) {
            console.error('[DEBUG] Cannot send: not connected');
            return;
        }

        const msgId = Date.now() + '_' + Math.random().toString(16).slice(2, 6);
        
        const payload = {
            id: this.clientId,
            msgId: msgId,
            user: "User_" + this.clientId.slice(-4),
            msg: msg,
            time: Date.now()
        };

        console.log('[DEBUG] Payload:', JSON.stringify(payload, null, 2));

        const payloadStr = JSON.stringify(payload);
        console.log('[DEBUG] Encrypting with password:', this.config.password);
        
        const cipher = CryptoJS.AES.encrypt(payloadStr, this.config.password).toString();
        console.log('[DEBUG] Encrypted cipher length:', cipher.length);
        console.log('[DEBUG] Cipher (first 50 chars):', cipher.substring(0, 50));

        // 记录已发送消息
        this.pendingMessages.add(msgId);
        console.log('[DEBUG] Added to pendingMessages:', msgId);
        console.log('[DEBUG] pendingMessages size:', this.pendingMessages.size);

        // 发布消息
        console.log('[DEBUG] Publishing to topic:', this.config.topic);
        this.client.publish(this.config.topic, cipher, { qos: 1 }, (err) => {
            if (err) {
                console.error('[DEBUG] Publish ERROR:', err);
                this.pendingMessages.delete(msgId);
            } else {
                console.log('[DEBUG] Publish SUCCESS');
            }
        });

        // 显示自己发送的消息
        console.log('[DEBUG] Displaying my own message in UI');
        this.displayMessage('我', msg, true);
        
        // 5秒后清理
        setTimeout(() => {
            console.log('[DEBUG] Cleaning up msgId:', msgId);
            this.pendingMessages.delete(msgId);
        }, 5000);
        
        console.log('==================================');
    }

    displayMessage(user, msg, isSelf) {
        console.log('[DEBUG] displayMessage called:', { user, msg, isSelf });
        
        const msgBox = document.getElementById('mqtt-msgs');
        if (!msgBox) {
            console.error('[DEBUG] msgBox not found!');
            return;
        }
        
        const msgEl = this.createMsgElement(user, msg, isSelf);
        msgBox.appendChild(msgEl);
        msgBox.scrollTop = msgBox.scrollHeight;
        console.log('[DEBUG] Message appended to UI');
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
            console.error('[DEBUG] Copy failed:', err);
        });
    }
}

export default MQTTChat;
