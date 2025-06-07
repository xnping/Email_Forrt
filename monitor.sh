#!/bin/bash

# 邮箱系统监控脚本
# 用于检查服务状态和系统资源

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  邮箱系统状态监控${NC}"
    echo -e "${BLUE}  $(date)${NC}"
    echo -e "${BLUE}================================${NC}"
}

check_service_status() {
    echo -e "\n${YELLOW}📊 服务状态${NC}"
    echo "----------------------------------------"
    
    # 检查 PM2 进程
    if command -v pm2 &> /dev/null; then
        echo "PM2 进程状态:"
        pm2 list
    else
        echo -e "${RED}PM2 未安装${NC}"
    fi
    
    # 检查端口占用
    echo -e "\n端口占用情况:"
    echo "Web 端口 (3000):"
    netstat -tlnp | grep :3000 || echo "端口 3000 未被占用"
    
    echo "SMTP 端口 (2525):"
    netstat -tlnp | grep :2525 || echo "端口 2525 未被占用"
    
    echo "SMTP 端口 (2526):"
    netstat -tlnp | grep :2526 || echo "端口 2526 未被占用"
}

check_system_resources() {
    echo -e "\n${YELLOW}💻 系统资源${NC}"
    echo "----------------------------------------"
    
    # CPU 使用率
    echo "CPU 使用率:"
    top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print "  使用: " $1 "%"}'
    
    # 内存使用
    echo -e "\n内存使用:"
    free -h | awk 'NR==2{printf "  总计: %s, 已用: %s (%.2f%%), 可用: %s\n", $2,$3,$3*100/$2,$7}'
    
    # 磁盘使用
    echo -e "\n磁盘使用:"
    df -h | grep -E '^/dev/' | awk '{printf "  %s: %s/%s (%s)\n", $1,$3,$2,$5}'
    
    # 系统负载
    echo -e "\n系统负载:"
    uptime | awk -F'load average:' '{print "  " $2}'
}

check_network() {
    echo -e "\n${YELLOW}🌐 网络状态${NC}"
    echo "----------------------------------------"
    
    # 公网 IP
    echo "公网 IP:"
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "获取失败")
    echo "  $PUBLIC_IP"
    
    # 网络连接
    echo -e "\n活跃连接数:"
    netstat -an | grep ESTABLISHED | wc -l | awk '{print "  " $1 " 个连接"}'
}

check_logs() {
    echo -e "\n${YELLOW}📝 最近日志${NC}"
    echo "----------------------------------------"
    
    LOG_FILE="/var/log/email-forrt/combined.log"
    if [ -f "$LOG_FILE" ]; then
        echo "最近 10 条日志:"
        tail -n 10 "$LOG_FILE"
    else
        echo "日志文件不存在: $LOG_FILE"
    fi
}

check_email_stats() {
    echo -e "\n${YELLOW}📧 邮件统计${NC}"
    echo "----------------------------------------"
    
    # 检查邮件存储文件
    EMAIL_FILE="/opt/email-forrt/storage/emails.json"
    if [ -f "$EMAIL_FILE" ]; then
        EMAIL_COUNT=$(cat "$EMAIL_FILE" | jq length 2>/dev/null || echo "0")
        echo "存储的邮件数量: $EMAIL_COUNT"
        
        # 文件大小
        FILE_SIZE=$(du -h "$EMAIL_FILE" | cut -f1)
        echo "邮件文件大小: $FILE_SIZE"
    else
        echo "邮件存储文件不存在"
    fi
}

show_quick_commands() {
    echo -e "\n${YELLOW}🔧 常用命令${NC}"
    echo "----------------------------------------"
    echo "重启服务:     pm2 restart email-forrt"
    echo "查看日志:     pm2 logs email-forrt"
    echo "停止服务:     pm2 stop email-forrt"
    echo "启动服务:     pm2 start email-forrt"
    echo "服务状态:     pm2 status"
    echo "系统监控:     htop"
    echo "网络监控:     netstat -tlnp"
    echo "实时日志:     tail -f /var/log/email-forrt/combined.log"
}

# 主函数
main() {
    print_header
    check_service_status
    check_system_resources
    check_network
    check_logs
    check_email_stats
    show_quick_commands
    echo ""
}

# 如果直接运行脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
