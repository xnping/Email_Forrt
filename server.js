const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const DomainManager = require('./domain-manager');
const SMTPServer = require('./smtp-server');
const MailDispatcher = require('./mail-dispatcher');

class MultiDomainEmailServer {
    constructor() {
        this.domainManager = new DomainManager();
        this.mailDispatcher = new MailDispatcher(this.domainManager);
        this.smtpServers = new Map();
        this.httpServer = null;
        this.isRunning = false;
    }

    // 启动所有服务
    async start() {
        try {
            console.log('正在启动多域名临时邮箱系统...');
            
            // 启动SMTP服务器集群
            await this.startSMTPServers();
            
            // 启动HTTP服务器
            await this.startHTTPServer();
            
            this.isRunning = true;
            console.log('系统启动完成！');
            this.printStatus();
            
        } catch (error) {
            console.error('系统启动失败:', error);
            await this.stop();
        }
    }

    // 启动SMTP服务器集群
    async startSMTPServers() {
        const domains = this.domainManager.getEnabledDomains();
        
        for (const domain of domains) {
            try {
                const smtpServer = new SMTPServer(domain, domain.smtpPort, this.mailDispatcher);
                await smtpServer.start();
                this.smtpServers.set(domain.id, smtpServer);
            } catch (error) {
                console.error(`启动SMTP服务器失败 ${domain.domain}:`, error.message);
            }
        }
        
        console.log(`已启动 ${this.smtpServers.size} 个SMTP服务器`);
    }

    // 启动HTTP服务器
    async startHTTPServer() {
        return new Promise((resolve, reject) => {
            this.httpServer = http.createServer((req, res) => {
                this.handleHTTPRequest(req, res);
            });

            const port = process.env.PORT || this.domainManager.settings.webPort || 3000;
            
            this.httpServer.listen(port, '0.0.0.0', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`HTTP服务器已启动: http://0.0.0.0:${port}`);
                    resolve();
                }
            });
        });
    }

    // 处理HTTP请求
    handleHTTPRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const method = req.method;

        // 设置CORS头
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        console.log(`${method} ${pathname}`);

        // 路由处理
        if (pathname === '/' || pathname === '/index.html') {
            this.serveStaticFile(res, 'public/index.html');
        } else if (pathname.startsWith('/api/')) {
            this.handleAPIRequest(req, res, pathname, parsedUrl.query);
        } else if (pathname.startsWith('/public/')) {
            this.serveStaticFile(res, pathname.substring(1));
        } else {
            this.send404(res);
        }
    }

    // 处理API请求
    handleAPIRequest(req, res, pathname, query) {
        const apiPath = pathname.substring(5); // 移除 '/api/'

        switch (apiPath) {
            case 'domains':
                this.handleDomainsAPI(req, res, query);
                break;
            case 'emails':
                this.handleEmailsAPI(req, res, query);
                break;
            case 'stats':
                this.handleStatsAPI(req, res);
                break;
            case 'generate-email':
                this.handleGenerateEmailAPI(req, res, query);
                break;
            default:
                this.sendJSON(res, { error: 'API endpoint not found' }, 404);
        }
    }

    // 处理域名API
    handleDomainsAPI(req, res, query) {
        if (req.method === 'GET') {
            const domains = this.domainManager.getAllDomains();
            this.sendJSON(res, { domains });
        } else {
            this.sendJSON(res, { error: 'Method not allowed' }, 405);
        }
    }

    // 处理邮件API
    handleEmailsAPI(req, res, query) {
        if (req.method === 'GET') {
            const { domain, recipient, page = 1, limit = 20, search } = query;
            
            let result;
            if (search) {
                const emails = this.mailDispatcher.searchEmails(search, domain);
                result = { emails, total: emails.length };
            } else if (recipient) {
                const emails = this.mailDispatcher.getEmailsByRecipient(recipient, parseInt(limit));
                result = { emails, total: emails.length };
            } else if (domain) {
                const emails = this.mailDispatcher.getEmailsByDomain(domain, parseInt(limit));
                result = { emails, total: emails.length };
            } else {
                result = this.mailDispatcher.getAllEmails(parseInt(page), parseInt(limit));
            }
            
            this.sendJSON(res, result);
        } else {
            this.sendJSON(res, { error: 'Method not allowed' }, 405);
        }
    }

    // 处理统计API
    handleStatsAPI(req, res) {
        if (req.method === 'GET') {
            const domainStats = this.domainManager.getDomainStats();
            const emailStats = this.mailDispatcher.getEmailStats();
            
            this.sendJSON(res, {
                domains: domainStats,
                emails: emailStats,
                system: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    smtpServers: this.smtpServers.size
                }
            });
        } else {
            this.sendJSON(res, { error: 'Method not allowed' }, 405);
        }
    }

    // 处理生成邮箱API
    handleGenerateEmailAPI(req, res, query) {
        if (req.method === 'GET') {
            const domain = this.domainManager.getNextDomain();
            if (domain) {
                const email = this.mailDispatcher.generateRandomEmail(domain.domain);
                this.sendJSON(res, { email, domain: domain.domain });
            } else {
                this.sendJSON(res, { error: 'No available domains' }, 503);
            }
        } else {
            this.sendJSON(res, { error: 'Method not allowed' }, 405);
        }
    }

    // 发送JSON响应
    sendJSON(res, data, statusCode = 200) {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    }

    // 服务静态文件
    serveStaticFile(res, filePath) {
        const fullPath = path.join(__dirname, filePath);
        
        fs.readFile(fullPath, (err, data) => {
            if (err) {
                this.send404(res);
                return;
            }

            const ext = path.extname(filePath);
            const contentType = this.getContentType(ext);
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
    }

    // 获取内容类型
    getContentType(ext) {
        const types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon'
        };
        return types[ext] || 'text/plain';
    }

    // 发送404响应
    send404(res) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
    }

    // 停止所有服务
    async stop() {
        console.log('正在停止系统...');
        
        // 停止SMTP服务器
        for (const [id, server] of this.smtpServers) {
            await server.stop();
        }
        this.smtpServers.clear();

        // 停止HTTP服务器
        if (this.httpServer) {
            this.httpServer.close();
        }

        this.isRunning = false;
        console.log('系统已停止');
    }

    // 打印系统状态
    printStatus() {
        console.log('\n=== 系统状态 ===');
        console.log(`HTTP服务器: http://localhost:${this.domainManager.settings.webPort || 3000}`);
        console.log(`SMTP服务器数量: ${this.smtpServers.size}`);
        console.log(`启用域名数量: ${this.domainManager.getEnabledDomains().length}`);
        console.log(`总邮件数量: ${this.mailDispatcher.emails.length}`);
        console.log('================\n');
    }
}

// 启动服务器
const server = new MultiDomainEmailServer();

// 处理进程信号
process.on('SIGINT', async () => {
    console.log('\n收到停止信号，正在关闭服务器...');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n收到终止信号，正在关闭服务器...');
    await server.stop();
    process.exit(0);
});

// 启动服务器
server.start().catch(console.error);

module.exports = MultiDomainEmailServer;
