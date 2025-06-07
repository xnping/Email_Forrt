const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 简化版的域名管理器（用于 Vercel）
class SimpleDomainManager {
    constructor() {
        this.domains = [
            {
                id: 1,
                domain: "xnping.nastu.net",
                enabled: true,
                smtpPort: 2525,
                maxEmails: 100,
                currentEmails: 0
            },
            {
                id: 2,
                domain: "184772.so.kg",
                enabled: true,
                smtpPort: 2526,
                maxEmails: 100,
                currentEmails: 0
            }
        ];
        this.settings = {
            webPort: 3000,
            cleanupInterval: 3600000,
            emailRetentionTime: 86400000,
            loadBalanceStrategy: "round-robin"
        };
    }

    getAllDomains() {
        return this.domains;
    }

    getEnabledDomains() {
        return this.domains.filter(d => d.enabled);
    }

    getNextDomain() {
        const enabled = this.getEnabledDomains();
        if (enabled.length === 0) return null;
        
        // 简单轮询
        const index = Math.floor(Math.random() * enabled.length);
        return enabled[index];
    }

    getDomainStats() {
        return {
            total: this.domains.length,
            enabled: this.getEnabledDomains().length,
            disabled: this.domains.length - this.getEnabledDomains().length
        };
    }
}

// 简化版的邮件分发器（用于 Vercel）
class SimpleMailDispatcher {
    constructor() {
        this.emails = [];
    }

    generateRandomEmail(domain) {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${result}@${domain}`;
    }

    getAllEmails(page = 1, limit = 20) {
        const start = (page - 1) * limit;
        const end = start + limit;
        return {
            emails: this.emails.slice(start, end),
            total: this.emails.length,
            page: page,
            totalPages: Math.ceil(this.emails.length / limit)
        };
    }

    getEmailsByDomain(domain, limit = 20) {
        return this.emails.filter(email => email.domain === domain).slice(0, limit);
    }

    getEmailsByRecipient(recipient, limit = 20) {
        return this.emails.filter(email => 
            email.to.some(to => to.includes(recipient))
        ).slice(0, limit);
    }

    searchEmails(query, domain = null) {
        let filtered = this.emails;
        
        if (domain) {
            filtered = filtered.filter(email => email.domain === domain);
        }
        
        return filtered.filter(email => 
            email.subject.toLowerCase().includes(query.toLowerCase()) ||
            email.body.toLowerCase().includes(query.toLowerCase()) ||
            email.from.toLowerCase().includes(query.toLowerCase())
        );
    }

    getEmailStats() {
        return {
            total: this.emails.length,
            unread: this.emails.filter(e => !e.read).length,
            domains: [...new Set(this.emails.map(e => e.domain))].length
        };
    }
}

// 全局实例
const domainManager = new SimpleDomainManager();
const mailDispatcher = new SimpleMailDispatcher();

// 处理请求的主函数
module.exports = (req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    console.log(`${method} ${pathname}`);

    // 路由处理
    if (pathname === '/' || pathname === '/index.html') {
        serveStaticFile(res, 'public/index.html');
    } else if (pathname.startsWith('/api/')) {
        handleAPIRequest(req, res, pathname, parsedUrl.query);
    } else if (pathname.startsWith('/public/')) {
        serveStaticFile(res, pathname.substring(1));
    } else {
        send404(res);
    }
};

// 处理API请求
function handleAPIRequest(req, res, pathname, query) {
    const apiPath = pathname.substring(5); // 移除 '/api/'

    switch (apiPath) {
        case 'domains':
            handleDomainsAPI(req, res, query);
            break;
        case 'emails':
            handleEmailsAPI(req, res, query);
            break;
        case 'stats':
            handleStatsAPI(req, res);
            break;
        case 'generate-email':
            handleGenerateEmailAPI(req, res, query);
            break;
        default:
            sendJSON(res, { error: 'API endpoint not found' }, 404);
    }
}

// 处理域名API
function handleDomainsAPI(req, res, query) {
    if (req.method === 'GET') {
        const domains = domainManager.getAllDomains();
        sendJSON(res, { domains });
    } else {
        sendJSON(res, { error: 'Method not allowed' }, 405);
    }
}

// 处理邮件API
function handleEmailsAPI(req, res, query) {
    if (req.method === 'GET') {
        const { domain, recipient, page = 1, limit = 20, search } = query;
        
        let result;
        if (search) {
            const emails = mailDispatcher.searchEmails(search, domain);
            result = { emails, total: emails.length };
        } else if (recipient) {
            const emails = mailDispatcher.getEmailsByRecipient(recipient, parseInt(limit));
            result = { emails, total: emails.length };
        } else if (domain) {
            const emails = mailDispatcher.getEmailsByDomain(domain, parseInt(limit));
            result = { emails, total: emails.length };
        } else {
            result = mailDispatcher.getAllEmails(parseInt(page), parseInt(limit));
        }
        
        sendJSON(res, result);
    } else {
        sendJSON(res, { error: 'Method not allowed' }, 405);
    }
}

// 处理统计API
function handleStatsAPI(req, res) {
    if (req.method === 'GET') {
        const domainStats = domainManager.getDomainStats();
        const emailStats = mailDispatcher.getEmailStats();
        
        sendJSON(res, {
            domains: domainStats,
            emails: emailStats,
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                smtpServers: 0, // Vercel 不支持 SMTP 服务器
                platform: 'Vercel Serverless'
            }
        });
    } else {
        sendJSON(res, { error: 'Method not allowed' }, 405);
    }
}

// 处理生成邮箱API
function handleGenerateEmailAPI(req, res, query) {
    if (req.method === 'GET') {
        const domain = domainManager.getNextDomain();
        if (domain) {
            const email = mailDispatcher.generateRandomEmail(domain.domain);
            sendJSON(res, { 
                email, 
                domain: domain.domain,
                note: 'SMTP服务器在Vercel上不可用，这只是演示界面'
            });
        } else {
            sendJSON(res, { error: 'No available domains' }, 503);
        }
    } else {
        sendJSON(res, { error: 'Method not allowed' }, 405);
    }
}

// 发送JSON响应
function sendJSON(res, data, statusCode = 200) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// 服务静态文件
function serveStaticFile(res, filePath) {
    const fullPath = path.join(process.cwd(), filePath);
    
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            send404(res);
            return;
        }

        const ext = path.extname(filePath);
        const contentType = getContentType(ext);
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 获取内容类型
function getContentType(ext) {
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
function send404(res) {
    res.writeHead(404, { 'Content-Type': 'text/html' });
    res.end('<h1>404 Not Found</h1>');
}
