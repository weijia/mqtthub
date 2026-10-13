import CryptoJS from 'crypto-js';
import mqtt from 'mqtt';
import { getFullVersion } from './version.js';

// 预设 Broker 列表
const PRESET_BROKERS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://test.mosquitto.org:8081/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
];

// 消息协议已知字段，其余字段视为扩展字段并额外显示
const KNOWN_FIELDS = ['id', 'msgId', 'user', 'msg', 'time'];

// 多组配置存储键
const STORAGE_KEY = 'mqtt_chat_configs';
const ACTIVE_KEY = 'mqtt_chat_active';

// 读取所有配置组（兼容旧版单组 mqtt_chat_config）
const loadConfigs = () => {
    let arr;
    try {
        arr = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch { arr = null; }
    if (!Array.isArray(arr) || arr.length === 0) {
        let legacy = null;
        try {
            const old = localStorage.getItem('mqtt_chat_config');
            legacy = old ? JSON.parse(old) : null;
        } catch {}
        arr = [{
            name: '默认',
            broker: legacy?.broker || PRESET_BROKERS[0],
            topic: legacy?.topic || 'secure/mqtthub/chat/2026',
            password: legacy?.password || 'Your_Secret_Password'
        }];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }
    return arr;
};

// 获取当前激活的配置
const getActiveConfig = (configs) => {
    const activeName = localStorage.getItem(ACTIVE_KEY);
    return configs.find(c => c.name === activeName) || configs[0];
};

class MQTTChat {
    constructor() {
        this.configs = loadConfigs();
        this.config = getActiveConfig(this.configs);
        this.client = null;
        this.clientId = 'mq_' + Math.random().toString(16).slice(2, 8);
        this.pendingMessages = new Set();
        this.seenMessages = new Set();   // 已展示消息的密文哈希，用于订阅多条导致的重复去重

        console.log('[MQTT Chat] Initializing with clientId:', this.clientId);
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        setTimeout(() => this.connect(), 100);
    }

    saveConfigs() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs));
        localStorage.setItem(ACTIVE_KEY, this.config.name);
    }

    // 序列化配置为明文字符串：key=value&...（值用 URL 编码，通用格式）
    serializeConfig(cfg) {
        return ['name', 'broker', 'topic', 'password']
            .map(k => `${k}=${encodeURIComponent(cfg[k] || '')}`)
            .join('&');
    }

    // 从字符串解析配置（容忍多余空格、未知字段）
    parseConfig(str) {
        const cfg = {};
        for (const p of str.trim().split('&')) {
            const idx = p.indexOf('=');
            if (idx < 0) continue;
            const k = p.slice(0, idx).trim();
            const v = decodeURIComponent(p.slice(idx + 1));
            cfg[k] = v;
        }
        if (!cfg.broker || !cfg.topic) return null;
        if (!cfg.name) {
            cfg.name = cfg.broker.replace(/^wss?:\/\//, '').split('/')[0];
        }
        return cfg;
    }

    renderConfigList() {
        const sel = document.getElementById('cfg-list');
        if (!sel) return;
        sel.innerHTML = this.configs.map(c =>
            `<option value="${this.escapeAttr(c.name)}"${c.name === this.config.name ? ' selected' : ''}>${this.escapeAttr(c.name)}</option>`
        ).join('');
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
                <span id="mqtt-channel">${this.escapeAttr(this.config.topic)}</span>
                <span id="gear-icon">⚙️</span>
            </div>
            <div id="mqtt-config-panel">
                <div class="version-info">版本: ${getFullVersion()}</div>
                <label class="cfg-label">配置组</label>
                <div class="cfg-list-row">
                    <select id="cfg-list"></select>
                    <button type="button" class="btn-small" id="cfg-new" title="新建">＋</button>
                    <button type="button" class="btn-small" id="cfg-rename" title="重命名">✎</button>
                    <button type="button" class="btn-small" id="cfg-delete" title="删除">🗑</button>
                </div>
                <label class="cfg-label">Broker (支持下拉)</label>
                <input type="text" id="cfg-broker" list="broker-list" value="${this.escapeAttr(this.config.broker)}">
                <datalist id="broker-list">${PRESET_BROKERS.map(b => `<option value="${b}">`).join('')}</datalist>
                <label class="cfg-label">频道 Topic</label>
                <input type="text" id="cfg-topic" value="${this.escapeAttr(this.config.topic)}">
                <label class="cfg-label">AES 密码 (所有用户必须相同，留空则不加密)</label>
                <div class="password-field">
                    <input type="password" id="cfg-pass" value="${this.escapeAttr(this.config.password)}">
                    <button type="button" id="toggle-pass" title="显示/隐藏密码">👁️</button>
                </div>
                <div class="cfg-actions">
                    <button type="button" class="btn-secondary" id="cfg-export">导出</button>
                    <button type="button" class="btn-secondary" id="cfg-import">导入</button>
                    <button type="button" class="btn-primary" id="save-config">应用并重连</button>
                </div>
                <div id="cfg-io" class="cfg-io" style="display:none">
                    <textarea id="cfg-io-text" rows="3" placeholder="name=...&broker=...&topic=...&password=..."></textarea>
                    <div class="cfg-io-actions">
                        <button type="button" class="btn-small" id="cfg-io-copy">复制</button>
                        <button type="button" class="btn-small" id="cfg-io-load">解析并加入</button>
                        <button type="button" class="btn-small" id="cfg-io-close">关闭</button>
                    </div>
                    <div class="cfg-hint" id="cfg-io-hint"></div>
                </div>
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
        this.renderConfigList();
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

        // 密码显示/隐藏
        main.querySelector('#toggle-pass').addEventListener('click', () => {
            const passInput = main.querySelector('#cfg-pass');
            const btn = main.querySelector('#toggle-pass');
            if (passInput.type === 'password') {
                passInput.type = 'text';
                btn.textContent = '🙈';
            } else {
                passInput.type = 'password';
                btn.textContent = '👁️';
            }
        });

        // 切换配置组
        const cfgList = main.querySelector('#cfg-list');
        cfgList.addEventListener('change', () => {
            const name = cfgList.value;
            const found = this.configs.find(c => c.name === name);
            if (!found) return;
            this.config = found;
            localStorage.setItem(ACTIVE_KEY, this.config.name);
            this.fillConfigInputs();
            main.querySelector('#mqtt-channel').textContent = this.config.topic;
            this.connect();
        });

        // 新建配置组
        main.querySelector('#cfg-new').addEventListener('click', () => {
            const name = prompt('新配置名称：', '配置' + (this.configs.length + 1));
            if (!name) return;
            if (this.configs.find(c => c.name === name)) {
                this.toast('名称已存在');
                return;
            }
            const fresh = {
                name,
                broker: PRESET_BROKERS[0],
                topic: 'secure/mqtthub/chat/2026',
                password: 'Your_Secret_Password'
            };
            this.configs.push(fresh);
            this.config = fresh;
            this.saveConfigs();
            this.renderConfigList();
            this.fillConfigInputs();
        });

        // 重命名当前组
        main.querySelector('#cfg-rename').addEventListener('click', () => {
            const name = prompt('重命名当前配置：', this.config.name);
            if (!name || name === this.config.name) return;
            if (this.configs.find(c => c.name === name)) {
                this.toast('名称已存在');
                return;
            }
            this.config.name = name;
            this.saveConfigs();
            this.renderConfigList();
        });

        // 删除当前组
        main.querySelector('#cfg-delete').addEventListener('click', () => {
            if (this.configs.length <= 1) {
                this.toast('至少保留一组配置');
                return;
            }
            if (!confirm(`删除配置「${this.config.name}」？`)) return;
            this.configs = this.configs.filter(c => c.name !== this.config.name);
            this.config = this.configs[0];
            this.saveConfigs();
            this.renderConfigList();
            this.fillConfigInputs();
            this.connect();
        });

        // 导出：序列化当前组到文本框
        main.querySelector('#cfg-export').addEventListener('click', () => {
            this.collectInputsToConfig();
            const str = this.serializeConfig(this.config);
            const io = main.querySelector('#cfg-io');
            const text = main.querySelector('#cfg-io-text');
            const hint = main.querySelector('#cfg-io-hint');
            io.style.display = '';
            text.value = str;
            text.readOnly = true;
            hint.textContent = '⚠️ 此串包含 AES 密钥，请妥善保管';
        });

        // 导入：清空文本框等待粘贴
        main.querySelector('#cfg-import').addEventListener('click', () => {
            const io = main.querySelector('#cfg-io');
            const text = main.querySelector('#cfg-io-text');
            const hint = main.querySelector('#cfg-io-hint');
            io.style.display = '';
            text.value = '';
            text.readOnly = false;
            hint.textContent = '粘贴配置字符串后点「解析并加入」';
            text.focus();
        });

        // 复制文本框内容
        main.querySelector('#cfg-io-copy').addEventListener('click', async () => {
            const text = main.querySelector('#cfg-io-text');
            try {
                await navigator.clipboard.writeText(text.value);
                this.toast('已复制');
            } catch {
                text.select();
                document.execCommand('copy');
                this.toast('已复制');
            }
        });

        // 解析并加入为新组
        main.querySelector('#cfg-io-load').addEventListener('click', () => {
            const text = main.querySelector('#cfg-io-text');
            const str = text.value.trim();
            if (!str) { this.toast('内容为空'); return; }
            const cfg = this.parseConfig(str);
            if (!cfg) { this.toast('解析失败：缺少 broker 或 topic'); return; }
            // 重名自动加后缀
            const baseName = cfg.name;
            let n = 1;
            while (this.configs.find(c => c.name === cfg.name)) {
                cfg.name = `${baseName} (${++n})`;
            }
            this.configs.push(cfg);
            this.config = cfg;
            this.saveConfigs();
            this.renderConfigList();
            this.fillConfigInputs();
            main.querySelector('#cfg-io').style.display = 'none';
            this.connect();
            this.toast(`已导入「${cfg.name}」`);
        });

        // 关闭导出/导入面板
        main.querySelector('#cfg-io-close').addEventListener('click', () => {
            main.querySelector('#cfg-io').style.display = 'none';
        });

        // 保存配置（应用并重连）
        saveBtn.addEventListener('click', () => {
            this.collectInputsToConfig();
            this.saveConfigs();
            this.renderConfigList();
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

    // 把当前输入框的值写回 this.config
    collectInputsToConfig() {
        const main = document.getElementById('mqtt-chat');
        if (!main) return;
        this.config.broker = main.querySelector('#cfg-broker').value.trim();
        this.config.topic = main.querySelector('#cfg-topic').value.trim();
        this.config.password = main.querySelector('#cfg-pass').value.trim();
    }

    // 用 this.config 填充输入框
    fillConfigInputs() {
        const main = document.getElementById('mqtt-chat');
        if (!main) return;
        main.querySelector('#cfg-broker').value = this.config.broker;
        main.querySelector('#cfg-topic').value = this.config.topic;
        main.querySelector('#cfg-pass').value = this.config.password;
    }

    toast(msg) {
        this.displaySystemMessage(msg);
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
        const channelEl = document.getElementById('mqtt-channel');

        if (statusDot) {
            statusDot.className = 'status-dot';
        }

        // 显示正在连接的服务器
        if (channelEl) {
            const brokerName = this.config.broker.replace(/^wss?:\/\//, '').split('/')[0];
            channelEl.textContent = `连接中: ${brokerName}...`;
            channelEl.style.color = '#f39c12';
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

                // 显示已连接的服务器和频道
                if (channelEl) {
                    const brokerName = this.config.broker.replace(/^wss?:\/\//, '').split('/')[0];
                    channelEl.textContent = `${brokerName} | ${this.config.topic}`;
                    channelEl.style.color = 'rgba(255, 255, 255, 0.7)';
                }

                // 订阅 topic 本身及其所有子路径
                // （MQTT 通配符 # 按 spec 也应匹配 topic 本身，但部分 broker 行为不一致，
                //   所以同时订阅 [t, t/#] 两条；重复消息由 handleMessage 去重）
                const t = this.config.topic.replace(/\/+$/, '');
                const topics = t.includes('#') || t.includes('+') ? [t] : [t, t + '/#'];
                this.client.subscribe(topics, { qos: 1 });
                this.displaySystemMessage(`✅ 已连接到 ${this.config.broker}`);
            });

            this.client.on('message', (topic, payload) => {
                this.handleMessage(payload.toString());
            });

            this.client.on('close', () => {
                const status = document.getElementById('mqtt-status');
                if (status) status.className = 'status-dot';
                if (channelEl) {
                    channelEl.textContent = '已断开';
                    channelEl.style.color = '#e74c3c';
                }
            });

            this.client.on('error', (err) => {
                this.displaySystemMessage('❌ 连接错误: ' + err.message);
                if (channelEl) {
                    channelEl.textContent = '连接失败';
                    channelEl.style.color = '#e74c3c';
                }
            });

            this.client.on('reconnect', () => {
                if (channelEl) {
                    channelEl.textContent = '重新连接中...';
                    channelEl.style.color = '#f39c12';
                }
            });

        } catch (err) {
            console.error('[MQTT] Connection failed:', err);
            if (channelEl) {
                channelEl.textContent = '连接异常';
                channelEl.style.color = '#e74c3c';
            }
        }
    }

    handleMessage(rawData) {
        try {
            // 同一密文可能因订阅 [t, t/#] 两条而被收到两次，按密文哈希去重
            const sig = CryptoJS.MD5(rawData).toString();
            if (this.seenMessages.has(sig)) return;
            this.seenMessages.add(sig);
            setTimeout(() => this.seenMessages.delete(sig), 10000);

            // 密码为空则按明文解析，否则 AES 解密
            const raw = this.config.password
                ? CryptoJS.AES.decrypt(rawData, this.config.password).toString(CryptoJS.enc.Utf8)
                : rawData;
            if (!raw) return;

            const data = JSON.parse(raw);
            if (data.id === this.clientId) return;
            if (data.msgId && this.pendingMessages.has(data.msgId)) return;

            // 提取除已知字段外的其他字段
            const extra = {};
            for (const k of Object.keys(data)) {
                if (!KNOWN_FIELDS.includes(k)) extra[k] = data[k];
            }
            const hasExtra = Object.keys(extra).length > 0;

            this.displayMessage(data.user, data.msg, false, hasExtra ? extra : null);
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

        // 密码为空则不加密，直接发 JSON 明文
        const json = JSON.stringify(payload);
        const out = this.config.password
            ? CryptoJS.AES.encrypt(json, this.config.password).toString()
            : json;

        // 检查长度
        if (out.length > 60000) {
            this.displaySystemMessage('⚠️ 消息过长');
            return;
        }

        this.pendingMessages.add(msgId);
        setTimeout(() => this.pendingMessages.delete(msgId), 5000);

        this.client.publish(this.config.topic, out, { qos: 1 });
        this.displayMessage('我', msg, true);
    }

    displayMessage(user, msg, isSelf, extra) {
        const msgBox = document.getElementById('mqtt-msgs');
        if (!msgBox) return;

        const msgEl = document.createElement('div');
        msgEl.className = `msg-item ${isSelf ? 'msg-right' : 'msg-left'}`;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // 扩展字段：气泡下方逐行显示 key: value
        let extraHtml = '';
        if (extra) {
            const lines = Object.entries(extra).map(([k, v]) => {
                const val = typeof v === 'string' ? v : JSON.stringify(v);
                return `${this.escapeHtml(k)}: ${this.escapeHtml(String(val))}`;
            });
            extraHtml = `<div class="msg-extra">${lines.join('<br>')}</div>`;
        }

        msgEl.innerHTML = `
            <div class="msg-meta">${user} · ${time}</div>
            <div class="bubble-container">
                <div class="msg-bubble">${this.escapeHtml(msg).replace(/\n/g, '<br>')}</div>
                <button class="copy-btn" title="复制">📋</button>
            </div>
            ${extraHtml}
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

    // 用于 HTML 属性值的转义
    escapeAttr(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }
}

export default MQTTChat;
