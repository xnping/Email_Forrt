const fs = require('fs');
const path = require('path');

class MailDispatcher {
    constructor(domainManager) {
        this.domainManager = domainManager;
        this.storageDir = path.join(__dirname, 'storage');
        this.emailsFile = path.join(this.storageDir, 'emails.json');
        this.emails = [];
        this.initStorage();
        this.startCleanupTimer();
    }

    // 初始化存储
    initStorage() {
        try {
            // 创建存储目录
            if (!fs.existsSync(this.storageDir)) {
                fs.mkdirSync(this.storageDir, { recursive: true });
            }

            // 加载现有邮件
            if (fs.existsSync(this.emailsFile)) {
                const data = fs.readFileSync(this.emailsFile, 'utf8');
                this.emails = JSON.parse(data);
                console.log(`已加载 ${this.emails.length} 封邮件`);
            }
        } catch (error) {
            console.error('初始化邮件存储失败:', error.message);
            this.emails = [];
        }
    }

    // 保存邮件到文件
    saveEmails() {
        try {
            fs.writeFileSync(this.emailsFile, JSON.stringify(this.emails, null, 2));
        } catch (error) {
            console.error('保存邮件失败:', error.message);
        }
    }

    // 处理接收到的邮件
    handleIncomingEmail(emailData) {
        try {
            // 添加到邮件列表
            this.emails.push(emailData);

            // 更新域名邮件计数
            const domain = this.domainManager.getDomainByName(emailData.domain);
            if (domain) {
                this.domainManager.updateEmailCount(domain.id, 1);
            }

            // 保存到文件
            this.saveEmails();

            console.log(`邮件已存储: ${emailData.id} (${emailData.from} -> ${emailData.to.join(', ')})`);

            // 触发实时通知（如果有WebSocket连接）
            this.notifyNewEmail(emailData);

        } catch (error) {
            console.error('处理邮件失败:', error.message);
        }
    }

    // 获取指定域名的邮件
    getEmailsByDomain(domain, limit = 50) {
        return this.emails
            .filter(email => email.domain === domain)
            .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
            .slice(0, limit);
    }

    // 获取指定收件人的邮件
    getEmailsByRecipient(recipient, limit = 50) {
        return this.emails
            .filter(email => email.to.includes(recipient))
            .sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt))
            .slice(0, limit);
    }

    // 根据ID获取邮件
    getEmailById(id) {
        return this.emails.find(email => email.id === id);
    }

    // 标记邮件为已读
    markEmailAsRead(id) {
        const email = this.getEmailById(id);
        if (email) {
            email.read = true;
            this.saveEmails();
            return true;
        }
        return false;
    }

    // 删除邮件
    deleteEmail(id) {
        const index = this.emails.findIndex(email => email.id === id);
        if (index !== -1) {
            const email = this.emails[index];
            this.emails.splice(index, 1);
            this.saveEmails();

            // 更新域名邮件计数
            const domain = this.domainManager.getDomainByName(email.domain);
            if (domain) {
                this.domainManager.updateEmailCount(domain.id, -1);
            }

            console.log(`邮件已删除: ${id}`);
            return true;
        }
        return false;
    }

    // 清理过期邮件
    cleanupExpiredEmails() {
        const retentionTime = this.domainManager.settings.emailRetentionTime || 86400000; // 默认24小时
        const cutoffTime = new Date(Date.now() - retentionTime);
        
        const initialCount = this.emails.length;
        this.emails = this.emails.filter(email => {
            return new Date(email.receivedAt) > cutoffTime;
        });

        const deletedCount = initialCount - this.emails.length;
        if (deletedCount > 0) {
            this.saveEmails();
            console.log(`已清理 ${deletedCount} 封过期邮件`);
        }

        return deletedCount;
    }

    // 启动定时清理
    startCleanupTimer() {
        const interval = this.domainManager.settings.cleanupInterval || 3600000; // 默认1小时
        setInterval(() => {
            this.cleanupExpiredEmails();
        }, interval);
        
        console.log(`邮件清理定时器已启动，间隔: ${interval / 1000}秒`);
    }

    // 获取邮件统计信息
    getEmailStats() {
        const stats = {
            total: this.emails.length,
            unread: this.emails.filter(email => !email.read).length,
            byDomain: {}
        };

        // 按域名统计
        this.emails.forEach(email => {
            if (!stats.byDomain[email.domain]) {
                stats.byDomain[email.domain] = 0;
            }
            stats.byDomain[email.domain]++;
        });

        return stats;
    }

    // 搜索邮件
    searchEmails(query, domain = null) {
        let results = this.emails;

        // 按域名过滤
        if (domain) {
            results = results.filter(email => email.domain === domain);
        }

        // 按关键词搜索
        if (query) {
            const searchTerm = query.toLowerCase();
            results = results.filter(email => {
                return email.subject.toLowerCase().includes(searchTerm) ||
                       email.from.toLowerCase().includes(searchTerm) ||
                       email.body.toLowerCase().includes(searchTerm) ||
                       email.to.some(to => to.toLowerCase().includes(searchTerm));
            });
        }

        return results.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    }

    // 生成随机邮箱地址
    generateRandomEmail(domain) {
        const randomString = Math.random().toString(36).substring(2, 12);
        return `${randomString}@${domain}`;
    }

    // 实时通知新邮件（预留接口）
    notifyNewEmail(emailData) {
        // 这里可以集成WebSocket或其他实时通信机制
        console.log(`新邮件通知: ${emailData.subject}`);
    }

    // 导出邮件数据
    exportEmails(domain = null, format = 'json') {
        let emails = domain ? this.getEmailsByDomain(domain) : this.emails;
        
        if (format === 'json') {
            return JSON.stringify(emails, null, 2);
        }
        
        // 可以扩展其他格式
        return emails;
    }

    // 获取所有邮件（分页）
    getAllEmails(page = 1, limit = 20) {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        const sortedEmails = this.emails.sort((a, b) => 
            new Date(b.receivedAt) - new Date(a.receivedAt)
        );
        
        return {
            emails: sortedEmails.slice(startIndex, endIndex),
            total: this.emails.length,
            page: page,
            totalPages: Math.ceil(this.emails.length / limit)
        };
    }
}

module.exports = MailDispatcher;
