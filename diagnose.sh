#!/bin/bash

# 邮箱系统完整诊断脚本

echo "🔍 开始邮箱系统诊断..."
echo "================================"

# 1. 检查服务状态
echo "1. 检查服务状态:"
if command -v pm2 &> /dev/null; then
    pm2 list | grep email-forrt
    if [ $? -eq 0 ]; then
        echo "✅ PM2 服务正在运行"
    else
        echo "❌ PM2 服务未运行"
    fi
else
    echo "❌ PM2 未安装"
fi

# 2. 检查端口监听
echo -e "\n2. 检查端口监听:"
echo "Web端口 (3000):"
netstat -tlnp | grep :3000 && echo "✅ Web端口正常" || echo "❌ Web端口未监听"

echo "SMTP端口 (2525):"
netstat -tlnp | grep :2525 && echo "✅ SMTP 2525端口正常" || echo "❌ SMTP 2525端口未监听"

echo "SMTP端口 (2526):"
netstat -tlnp | grep :2526 && echo "✅ SMTP 2526端口正常" || echo "❌ SMTP 2526端口未监听"

# 3. 检查防火墙
echo -e "\n3. 检查防火墙:"
if systemctl is-active --quiet firewalld; then
    echo "防火墙状态: 运行中"
    echo "开放的端口:"
    firewall-cmd --list-ports
    
    # 检查必要端口是否开放
    firewall-cmd --list-ports | grep -q "3000/tcp" && echo "✅ 3000端口已开放" || echo "❌ 3000端口未开放"
    firewall-cmd --list-ports | grep -q "2525/tcp" && echo "✅ 2525端口已开放" || echo "❌ 2525端口未开放"
    firewall-cmd --list-ports | grep -q "2526/tcp" && echo "✅ 2526端口已开放" || echo "❌ 2526端口未开放"
else
    echo "防火墙状态: 未运行"
fi

# 4. 测试端口连通性
echo -e "\n4. 测试端口连通性:"
echo "测试本地连接..."

# 测试 Web 端口
timeout 3 bash -c "</dev/tcp/localhost/3000" 2>/dev/null && echo "✅ Web端口连通" || echo "❌ Web端口不通"

# 测试 SMTP 端口
timeout 3 bash -c "</dev/tcp/localhost/2525" 2>/dev/null && echo "✅ SMTP 2525端口连通" || echo "❌ SMTP 2525端口不通"
timeout 3 bash -c "</dev/tcp/localhost/2526" 2>/dev/null && echo "✅ SMTP 2526端口连通" || echo "❌ SMTP 2526端口不通"

# 5. 检查配置文件
echo -e "\n5. 检查配置文件:"
if [ -f "/opt/email-forrt/config/domains.json" ]; then
    echo "✅ 域名配置文件存在"
    ENABLED_DOMAINS=$(cat /opt/email-forrt/config/domains.json | grep -c '"enabled": true')
    echo "启用的域名数量: $ENABLED_DOMAINS"
else
    echo "❌ 域名配置文件不存在"
fi

if [ -f "/opt/email-forrt/storage/emails.json" ]; then
    echo "✅ 邮件存储文件存在"
    EMAIL_COUNT=$(cat /opt/email-forrt/storage/emails.json | jq length 2>/dev/null || echo "0")
    echo "存储的邮件数量: $EMAIL_COUNT"
else
    echo "❌ 邮件存储文件不存在"
fi

# 6. 检查日志
echo -e "\n6. 最近的日志 (最后10行):"
if [ -f "/var/log/email-forrt/combined.log" ]; then
    tail -n 10 /var/log/email-forrt/combined.log
else
    echo "使用 PM2 日志:"
    pm2 logs email-forrt --lines 10 --nostream 2>/dev/null || echo "无法获取日志"
fi

# 7. 检查系统资源
echo -e "\n7. 系统资源:"
echo "内存使用:"
free -h | awk 'NR==2{printf "  使用: %s/%s (%.2f%%)\n", $3,$2,$3*100/$2}'

echo "磁盘使用:"
df -h / | awk 'NR==2{printf "  使用: %s/%s (%s)\n", $3,$2,$5}'

# 8. 网络检查
echo -e "\n8. 网络检查:"
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "获取失败")
echo "公网IP: $PUBLIC_IP"

# 9. DNS检查
echo -e "\n9. DNS检查:"
echo "检查MX记录..."
nslookup -type=mx 184772.so.kg 2>/dev/null | grep "mail exchanger" && echo "✅ 184772.so.kg MX记录正常" || echo "❌ 184772.so.kg MX记录异常"
nslookup -type=mx xnping.nastu.net 2>/dev/null | grep "mail exchanger" && echo "✅ xnping.nastu.net MX记录正常" || echo "❌ xnping.nastu.net MX记录异常"

# 10. 建议修复
echo -e "\n10. 修复建议:"
echo "如果发现问题，请尝试以下修复步骤:"
echo "1. 重启服务: pm2 restart email-forrt"
echo "2. 开放端口: firewall-cmd --permanent --add-port={3000,2525,2526}/tcp && firewall-cmd --reload"
echo "3. 检查云服务器安全组设置"
echo "4. 查看详细日志: pm2 logs email-forrt"
echo "5. 测试SMTP连接: telnet localhost 2525"

echo -e "\n================================"
echo "🔍 诊断完成!"
