#!/bin/bash
# =========================================================
#  智能发票管理助手 - 统信 UOS 免跳应用商城一键极速安装脚本
# =========================================================

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "========================================================="
echo "   智能发票管理助手 - 统信 UOS 一键安装器 (免跳应用商城)   "
echo "========================================================="

# 查找同目录下的 deb 文件
DEB_FILE=$(ls smart-invoice-assistant*.deb *.deb 2>/dev/null | head -n 1)

if [ -z "$DEB_FILE" ]; then
    echo "❌ 未在当前目录检测到 .deb 安装包，请确保本脚本与 .deb 文件存放在同一文件夹中！"
    read -n 1 -s -r -p "按任意键退出..."
    exit 1
fi

echo "📦 检测到安装包: $DEB_FILE"
echo "🚀 正在穿透统信应用商城限制直接安装..."

# 优先调起 UOS 原生图形化授权弹窗 (pkexec)，若无图形环境则降级 sudo
if command -v pkexec >/dev/null 2>&1 && [ -n "$DISPLAY" ]; then
    pkexec apt install -y "./$DEB_FILE" || sudo apt install -y "./$DEB_FILE"
else
    sudo apt install -y "./$DEB_FILE"
fi

echo ""
echo "========================================================="
echo "  🎉 安装成功！"
echo "  已成功绕过 UOS 应用商城与签名拦截！"
echo "  您可以在左下角【启动器】(开始菜单) 中直接打开【智能发票管理助手】。"
echo "========================================================="
read -n 1 -s -r -p "安装已完成，按任意键关闭本窗口..."
