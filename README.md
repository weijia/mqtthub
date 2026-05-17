# MQTT Hub

支持 WebDAV 和 GitHub Pages 自动发布的示例项目。

## 功能特性

- ✅ 推送到 main/master 分支时自动上传到 WebDAV
- ✅ 打 tag (v*) 时同时发布到 WebDAV 和 GitHub Pages
- ✅ 静态文件使用相对路径，支持非根目录部署

## 目录结构

```
mqtthub/
├── .github/
│   └── workflows/
│       └── publish.yml    # CI/CD 配置
├── src/
│   └── main.js            # 源代码入口
├── index.html             # HTML 入口
├── vite.config.js         # Vite 配置（支持相对路径）
├── package.json
└── README.md
```

## 使用方法

### 1. 创建 GitHub 仓库

```bash
gh repo create mqtthub --public
```

### 2. 配置 Secrets

运行以下命令设置 WebDAV 凭据：

```cmd
:: Windows 命令格式
set PROJ=mqtthub
set USERNAME=xxx
set ROOT=%USERNAME%/%PROJ%
set WEBDAV_PASSWORD=【你的密码】
set WEBDAV_USERNAME=【你的用户名】
set WEBDAV_URL=https://xxx.teracloud.jp/dav/

gh secret set WEBDAV_URL --repo %ROOT% --body %WEBDAV_URL%
gh secret set WEBDAV_USERNAME --repo %ROOT% --body %WEBDAV_USERNAME%
gh secret set WEBDAV_PASSWORD --repo %ROOT% --body %WEBDAV_PASSWORD%
```

### 3. 推送代码

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/weijia/mqtthub.git
git push -u origin main
```

### 4. 发布到 GitHub Pages

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 部署目标

| 触发条件 | WebDAV 路径 | GitHub Pages |
|---------|-------------|--------------|
| push main/master | `online/mqtthub/` | ❌ |
| push tag (v*) | `online/mqtthub/` | ✅ `https://weijia.github.io/mqtthub/` |

## 注意事项

1. **GitHub Pages 设置**：需要在仓库 Settings > Pages 中选择 "GitHub Actions" 作为构建和部署源
2. **相对路径**：WebDAV 部署使用相对路径 `./`，GitHub Pages 使用 `/mqtthub/`
3. **WebDAV 目标**：文件会上传到 `https://miya.teracloud.jp/dav/online/mqtthub/`
