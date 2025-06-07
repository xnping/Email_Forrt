#!/bin/bash

# 邮箱系统重新部署脚本 - 删除旧版本，部署新版本
# 适用于 CentOS 7.9

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 项目配置
PROJECT_DIR="/opt/email-forrt"
BACKUP_DIR="/opt/email-forrt-backup-$(date +%Y%m%d_%H%M%S)"
REPO_URL="https://github.com/xnping/Email_Forrt.git"

print_info "🚀 开始重新部署邮箱系统..."
echo "================================"

# 1. 停止现有服务
stop_services() {
    print_info "1. 停止现有服务..."
    
    if command -v pm2 &> /dev/null; then
        print_info "停止 PM2 服务..."
        pm2 stop email-forrt 2>/dev/null || true
        pm2 delete email-forrt 2>/dev/null || true
        print_success "PM2 服务已停止"
    fi
    
    # 杀死可能残留的 Node.js 进程
    print_info "清理残留进程..."
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "email-forrt" 2>/dev/null || true
    
    print_success "服务停止完成"
}

# 2. 备份旧版本
backup_old_version() {
    print_info "2. 备份旧版本..."
    
    if [ -d "$PROJECT_DIR" ]; then
        print_info "备份现有项目到: $BACKUP_DIR"
        
        # 创建备份目录
        mkdir -p "$BACKUP_DIR"
        
        # 备份重要文件
        if [ -f "$PROJECT_DIR/storage/emails.json" ]; then
            cp "$PROJECT_DIR/storage/emails.json" "$BACKUP_DIR/"
            print_success "邮件数据已备份"
        fi
        
        if [ -f "$PROJECT_DIR/config/domains.json" ]; then
            cp "$PROJECT_DIR/config/domains.json" "$BACKUP_DIR/"
            print_success "域名配置已备份"
        fi
        
        # 备份整个项目（可选）
        cp -r "$PROJECT_DIR" "$BACKUP_DIR/full_backup" 2>/dev/null || true
        
        print_success "备份完成: $BACKUP_DIR"
    else
        print_warning "未找到现有项目目录"
    fi
}

# 3. 删除旧版本
remove_old_version() {
    print_info "3. 删除旧版本..."
    
    if [ -d "$PROJECT_DIR" ]; then
        print_warning "删除项目目录: $PROJECT_DIR"
        rm -rf "$PROJECT_DIR"
        print_success "旧版本删除完成"
    else
        print_info "项目目录不存在，跳过删除"
    fi
    
    # 清理 PM2 配置
    if command -v pm2 &> /dev/null; then
        pm2 flush 2>/dev/null || true
        print_info "PM2 日志已清理"
    fi
}

# 4. 克隆新版本
clone_new_version() {
    print_info "4. 克隆新版本..."
    
    print_info "从 GitHub 克隆最新代码..."
    git clone "$REPO_URL" "$PROJECT_DIR"
    
    cd "$PROJECT_DIR"
    print_success "新版本克隆完成"
    
    # 显示最新提交信息
    print_info "最新提交信息:"
    git log --oneline -5
}

# 5. 恢复配置和数据
restore_data() {
    print_info "5. 恢复配置和数据..."
    
    # 恢复邮件数据
    if [ -f "$BACKUP_DIR/emails.json" ]; then
        mkdir -p "$PROJECT_DIR/storage"
        cp "$BACKUP_DIR/emails.json" "$PROJECT_DIR/storage/"
        print_success "邮件数据已恢复"
    else
        # 创建空的邮件存储文件
        mkdir -p "$PROJECT_DIR/storage"
        echo "[]" > "$PROJECT_DIR/storage/emails.json"
        print_info "创建新的邮件存储文件"
    fi
    
    # 恢复域名配置（如果需要）
    if [ -f "$BACKUP_DIR/domains.json" ]; then
        print_warning "发现备份的域名配置，是否恢复？(y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            cp "$BACKUP_DIR/domains.json" "$PROJECT_DIR/config/"
            print_success "域名配置已恢复"
        else
            print_info "使用新版本的域名配置"
        fi
    fi
}

# 6. 安装依赖
install_dependencies() {
    print_info "6. 安装项目依赖..."
    
    cd "$PROJECT_DIR"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装，请先安装 npm"
        exit 1
    fi
    
    print_info "安装 npm 依赖..."
    npm install --production
    
    print_success "依赖安装完成"
}

# 7. 配置权限
set_permissions() {
    print_info "7. 配置文件权限..."
    
    # 设置项目目录权限
    chown -R $(whoami):$(whoami) "$PROJECT_DIR"
    
    # 设置可执行权限
    chmod +x "$PROJECT_DIR"/*.sh 2>/dev/null || true
    
    # 创建日志目录
    mkdir -p /var/log/email-forrt
    chown -R $(whoami):$(whoami) /var/log/email-forrt
    
    print_success "权限配置完成"
}

# 8. 启动新服务
start_services() {
    print_info "8. 启动新服务..."
    
    cd "$PROJECT_DIR"
    
    # 检查 PM2
    if ! command -v pm2 &> /dev/null; then
        print_info "安装 PM2..."
        npm install -g pm2
    fi
    
    # 启动服务
    print_info "启动邮箱服务..."
    pm2 start ecosystem.config.js
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置开机自启（如果还没设置）
    pm2 startup 2>/dev/null || true
    
    print_success "服务启动完成"
}

# 9. 验证部署
verify_deployment() {
    print_info "9. 验证部署..."
    
    sleep 3
    
    # 检查 PM2 状态
    print_info "PM2 服务状态:"
    pm2 status
    
    # 检查端口
    print_info "检查端口监听:"
    netstat -tlnp | grep -E "(3000|2525|2526)" || print_warning "部分端口未监听"
    
    # 检查日志
    print_info "最近的服务日志:"
    pm2 logs email-forrt --lines 10 --nostream
    
    print_success "部署验证完成"
}

# 10. 显示部署信息
show_deployment_info() {
    echo ""
    echo "🎉 重新部署完成！"
    echo "================================"
    echo "📋 服务信息:"
    echo "  项目目录: $PROJECT_DIR"
    echo "  备份目录: $BACKUP_DIR"
    echo "  Web界面: http://$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP'):3000"
    echo "  SMTP端口: 2525, 2526"
    echo ""
    echo "🔧 管理命令:"
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs email-forrt"
    echo "  重启服务: pm2 restart email-forrt"
    echo "  停止服务: pm2 stop email-forrt"
    echo ""
    echo "🧪 测试命令:"
    echo "  运行测试: cd $PROJECT_DIR && node test-email-send.js"
    echo "  运行诊断: cd $PROJECT_DIR && ./diagnose.sh"
    echo ""
    echo "📁 备份位置: $BACKUP_DIR"
    echo ""
}

# 主函数
main() {
    # 检查是否为 root 或有 sudo 权限
    if [[ $EUID -ne 0 ]] && ! sudo -n true 2>/dev/null; then
        print_error "此脚本需要 root 权限或 sudo 权限"
        exit 1
    fi
    
    print_warning "⚠️  警告: 此操作将删除现有版本并重新部署"
    print_warning "⚠️  确保已备份重要数据"
    echo ""
    print_info "是否继续？(y/n)"
    read -r response
    
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_info "部署已取消"
        exit 0
    fi
    
    stop_services
    backup_old_version
    remove_old_version
    clone_new_version
    restore_data
    install_dependencies
    set_permissions
    start_services
    verify_deployment
    show_deployment_info
    
    print_success "🎉 重新部署完成！"
}

# 执行主函数
main "$@"
