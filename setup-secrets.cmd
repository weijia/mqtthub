@echo off
:: ============================================
:: 设置 GitHub Secrets 脚本
:: 项目名: mqtthub
:: ============================================

set PROJ=mqtthub
set USERNAME=weijia
set ROOT=%USERNAME%/%PROJ%

:: ============================================
:: 请修改以下变量为你的实际值
:: ============================================
set WEBDAV_URL=https://miya.teracloud.jp/dav/
set WEBDAV_USERNAME=你的用户名
set WEBDAV_PASSWORD=你的密码

:: ============================================
:: 设置 Secrets
:: ============================================
echo 正在设置 GitHub Secrets for %ROOT%...

gh secret set WEBDAV_URL --repo %ROOT% --body "%WEBDAV_URL%"
gh secret set WEBDAV_USERNAME --repo %ROOT% --body "%WEBDAV_USERNAME%"
gh secret set WEBDAV_PASSWORD --repo %ROOT% --body "%WEBDAV_PASSWORD%"

echo.
echo ✅ Secrets 设置完成！
echo.
echo 验证 Secrets:
gh secret list --repo %ROOT%

pause
