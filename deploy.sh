#!/bin/bash

# 多域名临时邮箱系统 - 服务器部署脚本
# 适用于 CentOS 7.9 系统

set -e

echo "🚀 开始部署多域名临时邮箱系统..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印彩色信息
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

# 检查是否为 root 用户
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_warning "检测到 root 用户，建议创建普通用户运行应用"
    fi
}

# 更新系统
update_system() {
    print_info "更新系统包..."
    yum update -y
    yum install -y epel-release
    print_success "系统更新完成"
}

# 安装 Node.js
install_nodejs() {
    print_info "安装 Node.js..."

    # 检查是否已安装 Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_info "Node.js 已安装: $NODE_VERSION"

        # 检查版本是否满足要求 (>= 14.0.0)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -ge 14 ]; then
            print_success "Node.js 版本满足要求"
            return
        else
            print_warning "Node.js 版本过低，需要升级"
        fi
    fi

    # 安装 Node.js 18.x for CentOS
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs

    # 验证安装
    NODE_VERSION=$(node -v)
    NPM_VERSION=$(npm -v)
    print_success "Node.js 安装完成: $NODE_VERSION"
    print_success "npm 版本: $NPM_VERSION"
}

# 安装 PM2
install_pm2() {
    print_info "安装 PM2 进程管理器..."
    npm install -g pm2
    print_success "PM2 安装完成"
}

# 安装 Git
install_git() {
    print_info "安装 Git..."
    yum install -y git
    print_success "Git 安装完成"
}

# 克隆项目
clone_project() {
    print_info "克隆项目代码..."
    
    PROJECT_DIR="/opt/email-forrt"
    
    if [ -d "$PROJECT_DIR" ]; then
        print_warning "项目目录已存在，正在更新..."
        cd $PROJECT_DIR
        git pull
    else
        print_info "克隆项目到 $PROJECT_DIR"
        git clone https://github.com/xnping/Email_Forrt.git $PROJECT_DIR
        cd $PROJECT_DIR
    fi
    
    print_success "项目代码准备完成"
}

# 安装依赖
install_dependencies() {
    print_info "安装项目依赖..."
    cd /opt/email-forrt
    npm install --production
    print_success "依赖安装完成"
}

# 配置防火墙
configure_firewall() {
    print_info "配置防火墙..."

    # CentOS 7 使用 firewalld
    if systemctl is-active --quiet firewalld; then
        print_info "配置 firewalld 防火墙..."

        # 开放必要端口
        firewall-cmd --permanent --add-port=22/tcp      # SSH
        firewall-cmd --permanent --add-port=80/tcp      # HTTP
        firewall-cmd --permanent --add-port=443/tcp     # HTTPS
        firewall-cmd --permanent --add-port=3000/tcp    # Web 界面
        firewall-cmd --permanent --add-port=2525/tcp    # SMTP 1
        firewall-cmd --permanent --add-port=2526/tcp    # SMTP 2

        # 重新加载防火墙规则
        firewall-cmd --reload

        print_success "防火墙配置完成"
    else
        print_info "启动 firewalld..."
        systemctl start firewalld
        systemctl enable firewalld

        # 开放端口
        firewall-cmd --permanent --add-port=22/tcp
        firewall-cmd --permanent --add-port=80/tcp
        firewall-cmd --permanent --add-port=443/tcp
        firewall-cmd --permanent --add-port=3000/tcp
        firewall-cmd --permanent --add-port=2525/tcp
        firewall-cmd --permanent --add-port=2526/tcp
        firewall-cmd --reload

        print_success "防火墙启动并配置完成"
    fi
}

# 创建 PM2 配置文件
create_pm2_config() {
    print_info "创建 PM2 配置文件..."
    
    cat > /opt/email-forrt/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'email-forrt',
    script: 'server.js',
    cwd: '/opt/email-forrt',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/email-forrt/error.log',
    out_file: '/var/log/email-forrt/out.log',
    log_file: '/var/log/email-forrt/combined.log',
    time: true
  }]
};
EOF
    
    # 创建日志目录
    mkdir -p /var/log/email-forrt
    
    print_success "PM2 配置文件创建完成"
}

# 启动服务
start_service() {
    print_info "启动邮箱服务..."
    
    cd /opt/email-forrt
    
    # 停止可能存在的进程
    pm2 delete email-forrt 2>/dev/null || true
    
    # 启动服务
    pm2 start ecosystem.config.js
    
    # 保存 PM2 配置
    pm2 save
    
    # 设置开机自启
    pm2 startup
    
    print_success "服务启动完成"
}

# 显示部署信息
show_deployment_info() {
    echo ""
    echo "🎉 部署完成！"
    echo ""
    echo "📋 服务信息："
    echo "  Web 界面: http://$(curl -s ifconfig.me):3000"
    echo "  SMTP 端口: 2525, 2526"
    echo "  域名: xnping.nastu.net, 184772.so.kg"
    echo ""
    echo "🔧 管理命令："
    echo "  查看状态: pm2 status"
    echo "  查看日志: pm2 logs email-forrt"
    echo "  重启服务: pm2 restart email-forrt"
    echo "  停止服务: pm2 stop email-forrt"
    echo ""
    echo "📝 下一步："
    echo "  1. 配置域名 DNS MX 记录指向服务器 IP: $(curl -s ifconfig.me)"
    echo "  2. 访问 Web 界面测试功能"
    echo "  3. 发送测试邮件验证接收"
    echo ""
}

# 主函数
main() {
    print_info "开始自动部署..."
    
    check_root
    update_system
    install_nodejs
    install_pm2
    install_git
    clone_project
    install_dependencies
    configure_firewall
    create_pm2_config
    start_service
    show_deployment_info
    
    print_success "部署脚本执行完成！"
}

# 执行主函数
main "$@"
