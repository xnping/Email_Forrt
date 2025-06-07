const fs = require('fs');
const path = require('path');

class DomainManager {
    constructor() {
        this.configPath = path.join(__dirname, 'config', 'domains.json');
        this.domains = [];
        this.settings = {};
        this.currentIndex = 0;
        this.loadConfig();
    }

    // 加载域名配置
    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            const config = JSON.parse(configData);
            this.domains = config.domains;
            this.settings = config.settings;
            console.log(`已加载 ${this.domains.length} 个域名配置`);
        } catch (error) {
            console.error('加载域名配置失败:', error.message);
            this.domains = [];
            this.settings = {};
        }
    }

    // 保存配置到文件
    saveConfig() {
        try {
            const config = {
                domains: this.domains,
                settings: this.settings
            };
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            console.log('域名配置已保存');
        } catch (error) {
            console.error('保存域名配置失败:', error.message);
        }
    }

    // 获取所有域名
    getAllDomains() {
        return this.domains;
    }

    // 获取启用的域名
    getEnabledDomains() {
        return this.domains.filter(domain => domain.enabled);
    }

    // 根据ID获取域名
    getDomainById(id) {
        return this.domains.find(domain => domain.id === id);
    }

    // 根据域名字符串获取域名配置
    getDomainByName(domainName) {
        return this.domains.find(domain => domain.domain === domainName);
    }

    // 负载均衡 - 轮询策略
    getNextDomain() {
        const enabledDomains = this.getEnabledDomains();
        if (enabledDomains.length === 0) {
            return null;
        }

        const domain = enabledDomains[this.currentIndex % enabledDomains.length];
        this.currentIndex++;
        
        // 更新最后使用时间
        domain.lastUsed = new Date().toISOString();
        this.saveConfig();
        
        return domain;
    }

    // 获取最少使用的域名
    getLeastUsedDomain() {
        const enabledDomains = this.getEnabledDomains();
        if (enabledDomains.length === 0) {
            return null;
        }

        return enabledDomains.reduce((least, current) => {
            return current.currentEmails < least.currentEmails ? current : least;
        });
    }

    // 更新域名邮件计数
    updateEmailCount(domainId, increment = 1) {
        const domain = this.getDomainById(domainId);
        if (domain) {
            domain.currentEmails += increment;
            domain.lastUsed = new Date().toISOString();
            this.saveConfig();
        }
    }

    // 启用/禁用域名
    toggleDomain(domainId, enabled) {
        const domain = this.getDomainById(domainId);
        if (domain) {
            domain.enabled = enabled;
            this.saveConfig();
            console.log(`域名 ${domain.domain} 已${enabled ? '启用' : '禁用'}`);
            return true;
        }
        return false;
    }

    // 获取域名统计信息
    getDomainStats() {
        const stats = {
            total: this.domains.length,
            enabled: this.getEnabledDomains().length,
            disabled: this.domains.filter(d => !d.enabled).length,
            totalEmails: this.domains.reduce((sum, d) => sum + d.currentEmails, 0)
        };
        return stats;
    }

    // 清理过期邮件计数
    cleanupEmailCounts() {
        this.domains.forEach(domain => {
            domain.currentEmails = 0;
        });
        this.saveConfig();
        console.log('已清理所有域名的邮件计数');
    }

    // 检查域名健康状态
    checkDomainHealth(domainId) {
        const domain = this.getDomainById(domainId);
        if (!domain) return false;

        // 检查是否超过最大邮件数
        if (domain.currentEmails >= domain.maxEmails) {
            console.warn(`域名 ${domain.domain} 邮件数量已达上限`);
            return false;
        }

        return domain.enabled;
    }
}

module.exports = DomainManager;
