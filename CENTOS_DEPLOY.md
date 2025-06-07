# CentOS 7.9 部署指南

## 🚀 快速部署

### 方法一：自动部署脚本（推荐）

```bash
# 1. 下载部署脚本
wget https://raw.githubusercontent.com/xnping/Email_Forrt/main/deploy.sh

# 2. 给脚本执行权限
chmod +x deploy.sh

# 3. 运行部署脚本
sudo ./deploy.sh
```

### 方法二：手动部署

#### 1. 更新系统
```bash
sudo yum update -y
sudo yum install -y epel-release
```

#### 2. 安装 Node.js 18.x
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

#### 3. 安装 PM2 和 Git
```bash
sudo npm install -g pm2
sudo yum install -y git
```

#### 4. 克隆项目
```bash
sudo git clone https://github.com/xnping/Email_Forrt.git /opt/email-forrt
cd /opt/email-forrt
sudo npm install --production
```

#### 5. 配置防火墙
```bash
# 启动防火墙
sudo systemctl start firewalld
sudo systemctl enable firewalld

# 开放端口
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=2525/tcp
sudo firewall-cmd --permanent --add-port=2526/tcp
sudo firewall-cmd --reload
```

#### 6. 创建日志目录
```bash
sudo mkdir -p /var/log/email-forrt
sudo chown -R $(whoami):$(whoami) /var/log/email-forrt
```

#### 7. 启动服务
```bash
cd /opt/email-forrt
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔧 服务管理

### PM2 常用命令
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs email-forrt

# 重启服务
pm2 restart email-forrt

# 停止服务
pm2 stop email-forrt

# 删除服务
pm2 delete email-forrt
```

### 系统服务命令
```bash
# 查看防火墙状态
sudo firewall-cmd --list-all

# 查看端口占用
netstat -tlnp | grep -E '(3000|2525|2526)'

# 查看系统资源
top
free -h
df -h
```

## 🌐 访问测试

部署完成后：

1. **获取服务器IP**：
   ```bash
   curl ifconfig.me
   ```

2. **访问Web界面**：
   ```
   http://你的服务器IP:3000
   ```

3. **检查SMTP端口**：
   ```bash
   telnet 你的服务器IP 2525
   telnet 你的服务器IP 2526
   ```

## 📧 DNS 配置

为你的域名添加 MX 记录：

```
xnping.nastu.net.     IN MX 10 你的服务器IP
184772.so.kg.         IN MX 10 你的服务器IP
```

## 🔍 故障排除

### 1. 服务无法启动
```bash
# 检查 Node.js 版本
node -v

# 检查端口占用
netstat -tlnp | grep 3000

# 查看详细日志
pm2 logs email-forrt --lines 50
```

### 2. 防火墙问题
```bash
# 检查防火墙状态
sudo systemctl status firewalld

# 查看开放的端口
sudo firewall-cmd --list-ports

# 临时关闭防火墙测试
sudo systemctl stop firewalld
```

### 3. 权限问题
```bash
# 修改项目目录权限
sudo chown -R $(whoami):$(whoami) /opt/email-forrt

# 修改日志目录权限
sudo chown -R $(whoami):$(whoami) /var/log/email-forrt
```

## 📊 监控脚本

使用监控脚本检查系统状态：

```bash
# 运行监控脚本
./monitor.sh

# 或者设置定时监控
crontab -e
# 添加：*/5 * * * * /opt/email-forrt/monitor.sh >> /var/log/email-forrt/monitor.log
```

## 🔒 安全建议

1. **修改默认端口**（可选）
2. **设置 Nginx 反向代理**
3. **配置 SSL 证书**
4. **定期更新系统**
5. **监控日志文件**

## 📞 技术支持

如果遇到问题：

1. 查看日志：`pm2 logs email-forrt`
2. 检查系统状态：`./monitor.sh`
3. 查看防火墙：`sudo firewall-cmd --list-all`
4. 检查端口：`netstat -tlnp`
