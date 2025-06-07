# 多域名临时邮箱系统

一个完全自主开发的分布式多域名临时邮箱系统，支持管理多个二级域名，提供临时邮箱服务。

🚀 **已部署到 Railway** - 支持实时邮件接收和管理

## 🚀 系统特性

- **多域名支持**: 同时管理10个二级域名
- **分布式架构**: 每个域名独立的SMTP服务器实例
- **负载均衡**: 智能域名轮换和负载分配
- **实时接收**: 实时接收和显示邮件
- **Web界面**: 现代化的响应式Web管理界面
- **自动清理**: 定时清理过期邮件
- **完全自主**: 无第三方框架依赖，纯原生开发

## 📋 系统要求

- Node.js 14.0.0 或更高版本
- Windows/Linux/macOS 系统
- 至少 512MB 可用内存
- 网络端口访问权限

## 🛠️ 安装和配置

### 1. 克隆或下载项目
```bash
git clone <repository-url>
cd Email_Forrt
```

### 2. 配置域名
编辑 `config/domains.json` 文件，将示例域名替换为您的实际域名：

```json
{
  "domains": [
    {
      "id": 1,
      "domain": "your-domain1.com",
      "enabled": true,
      "smtpPort": 2525,
      "maxEmails": 100,
      "currentEmails": 0,
      "lastUsed": null
    }
    // ... 添加您的其他9个域名
  ]
}
```

### 3. 启动系统
```bash
npm start
```

或开发模式：
```bash
npm run dev
```

## 🌐 访问系统

启动后访问: `http://localhost:3000`

## 📊 系统架构

```
主控制器 (server.js)
├── 域名管理器 (domain-manager.js) - 管理10个域名
├── SMTP服务集群 (smtp-server.js) - 每个域名独立实例
├── 邮件分发器 (mail-dispatcher.js) - 邮件路由和存储
└── Web界面 (public/) - 用户前端界面
```

## 🔧 核心模块

### 域名管理器 (DomainManager)
- 动态加载和管理域名配置
- 负载均衡策略（轮询、最少使用）
- 域名健康状态检查
- 邮件计数统计

### SMTP服务器 (SMTPServer)
- 每个域名独立的SMTP监听端口
- 完整的SMTP协议实现
- 邮件接收和解析
- 连接管理和超时处理

### 邮件分发器 (MailDispatcher)
- 邮件存储和检索
- 自动过期清理
- 邮件搜索和过滤
- 统计信息生成

## 🎯 使用方法

### 1. 生成临时邮箱
- 点击"生成随机邮箱"按钮
- 或选择特定域名后生成
- 复制生成的邮箱地址

### 2. 接收邮件
- 系统自动接收发送到生成邮箱的邮件
- 邮件实时显示在收件箱中
- 点击邮件查看详细内容

### 3. 管理邮件
- 搜索邮件内容
- 按域名过滤邮件
- 删除不需要的邮件
- 查看系统统计信息

## ⚙️ 配置说明

### 域名配置 (config/domains.json)
```json
{
  "domains": [
    {
      "id": 1,                    // 域名ID
      "domain": "example.com",    // 域名地址
      "enabled": true,            // 是否启用
      "smtpPort": 2525,          // SMTP端口
      "maxEmails": 100,          // 最大邮件数
      "currentEmails": 0,        // 当前邮件数
      "lastUsed": null           // 最后使用时间
    }
  ],
  "settings": {
    "webPort": 3000,                    // Web端口
    "cleanupInterval": 3600000,         // 清理间隔(毫秒)
    "emailRetentionTime": 86400000,     // 邮件保留时间(毫秒)
    "loadBalanceStrategy": "round-robin" // 负载均衡策略
  }
}
```

## 🔌 API接口

### 获取域名列表
```
GET /api/domains
```

### 生成邮箱地址
```
GET /api/generate-email
GET /api/generate-email?domain=example.com
```

### 获取邮件列表
```
GET /api/emails
GET /api/emails?domain=example.com
GET /api/emails?page=1&limit=20
GET /api/emails?search=keyword
```

### 获取系统统计
```
GET /api/stats
```

## 📁 目录结构

```
Email_Forrt/
├── config/
│   └── domains.json          # 域名配置文件
├── public/
│   ├── index.html           # 主页面
│   ├── style.css            # 样式文件
│   └── script.js            # 前端脚本
├── storage/
│   └── emails.json          # 邮件存储文件
├── domain-manager.js        # 域名管理模块
├── smtp-server.js           # SMTP服务器模块
├── mail-dispatcher.js       # 邮件分发模块
├── server.js                # 主服务器文件
├── package.json             # 项目配置
└── README.md               # 说明文档
```

## 🚀 部署到 Render

### 快速部署步骤：

1. **推送代码到 GitHub**
2. **登录 Render**: 访问 [render.com](https://render.com)
3. **创建新服务**: 选择 "Web Service"
4. **连接仓库**: 选择你的 GitHub 仓库
5. **配置设置**:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `Node`
6. **部署**: 点击 "Create Web Service"

### 部署后配置：

1. **获取服务器IP**: 在 Render 控制台查看
2. **配置DNS**: 为你的域名添加MX记录指向服务器IP
3. **测试**: 访问分配的 Render URL

## 🚨 注意事项

1. **端口配置**: 确保配置的SMTP端口未被占用
2. **域名解析**: 需要将域名的MX记录指向服务器IP
3. **防火墙**: 确保SMTP端口和Web端口可以访问
4. **内存管理**: 定期清理过期邮件以节省内存
5. **安全性**: 建议在生产环境中添加访问控制

## 🔧 故障排除

### SMTP服务器启动失败
- 检查端口是否被占用
- 确认有足够的系统权限
- 查看错误日志信息

### 邮件接收不到
- 检查域名MX记录配置
- 确认SMTP端口可以访问
- 查看域名是否启用

### Web界面无法访问
- 检查Web端口配置
- 确认防火墙设置
- 查看服务器启动日志

## 📈 性能优化

1. **内存优化**: 定期清理过期邮件
2. **连接优化**: 设置合适的连接超时时间
3. **负载均衡**: 使用轮询策略分散负载
4. **缓存策略**: 合理设置邮件保留时间

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 📄 许可证

MIT License

## 📞 支持

如有问题，请创建Issue或联系开发者。
