const fs = require('fs');
const path = require('path');
const readline = require('readline');

class SetupWizard {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.domains = [];
        this.configPath = path.join(__dirname, 'config', 'domains.json');
    }

    async start() {
        console.log('🚀 多域名临时邮箱系统 - 配置向导');
        console.log('=====================================\n');

        try {
            await this.welcomeMessage();
            await this.collectDomains();
            await this.configureSettings();
            await this.saveConfiguration();
            await this.showNextSteps();
        } catch (error) {
            console.error('配置过程中出现错误:', error.message);
        } finally {
            this.rl.close();
        }
    }

    async welcomeMessage() {
        console.log('欢迎使用多域名临时邮箱系统配置向导！');
        console.log('此向导将帮助您配置系统所需的域名和设置。\n');
        
        const proceed = await this.question('是否继续配置？(y/n): ');
        if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
            console.log('配置已取消。');
            process.exit(0);
        }
        console.log('');
    }

    async collectDomains() {
        console.log('📧 域名配置');
        console.log('请输入您的域名（最多10个）：\n');

        for (let i = 1; i <= 10; i++) {
            const domain = await this.question(`域名 ${i} (留空跳过): `);
            
            if (domain.trim()) {
                // 验证域名格式
                if (this.isValidDomain(domain.trim())) {
                    this.domains.push({
                        id: i,
                        domain: domain.trim(),
                        enabled: true,
                        smtpPort: 2524 + i,
                        maxEmails: 100,
                        currentEmails: 0,
                        lastUsed: null
                    });
                    console.log(`✅ 已添加域名: ${domain.trim()}`);
                } else {
                    console.log(`❌ 无效的域名格式: ${domain.trim()}`);
                    i--; // 重新输入
                }
            } else {
                break; // 用户跳过，结束输入
            }
        }

        if (this.domains.length === 0) {
            console.log('❌ 至少需要配置一个域名！');
            await this.collectDomains();
        } else {
            console.log(`\n✅ 已配置 ${this.domains.length} 个域名\n`);
        }
    }

    async configureSettings() {
        console.log('⚙️  系统设置配置');
        console.log('');

        const webPort = await this.question('Web服务端口 (默认: 3000): ');
        const cleanupInterval = await this.question('邮件清理间隔(小时) (默认: 1): ');
        const retentionTime = await this.question('邮件保留时间(小时) (默认: 24): ');

        this.settings = {
            webPort: parseInt(webPort) || 3000,
            cleanupInterval: (parseInt(cleanupInterval) || 1) * 3600000,
            emailRetentionTime: (parseInt(retentionTime) || 24) * 3600000,
            loadBalanceStrategy: "round-robin"
        };

        console.log('\n✅ 系统设置已配置\n');
    }

    async saveConfiguration() {
        const config = {
            domains: this.domains,
            settings: this.settings
        };

        try {
            // 确保config目录存在
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // 保存配置
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            console.log('✅ 配置已保存到 config/domains.json\n');
        } catch (error) {
            console.error('❌ 保存配置失败:', error.message);
            throw error;
        }
    }

    async showNextSteps() {
        console.log('🎉 配置完成！');
        console.log('=====================================\n');
        
        console.log('📋 接下来的步骤：');
        console.log('');
        
        console.log('1. 配置域名DNS记录：');
        this.domains.forEach(domain => {
            console.log(`   ${domain.domain} MX记录 -> 您的服务器IP`);
        });
        console.log('');
        
        console.log('2. 开放防火墙端口：');
        console.log(`   - Web端口: ${this.settings.webPort}`);
        console.log('   - SMTP端口:', this.domains.map(d => d.smtpPort).join(', '));
        console.log('');
        
        console.log('3. 启动系统：');
        console.log('   npm start');
        console.log('   或');
        console.log('   node server.js');
        console.log('');
        
        console.log('4. 访问Web界面：');
        console.log(`   http://localhost:${this.settings.webPort}`);
        console.log('');
        
        console.log('📖 更多信息请查看 README.md 文件');
        console.log('');

        const startNow = await this.question('是否现在启动系统？(y/n): ');
        if (startNow.toLowerCase() === 'y' || startNow.toLowerCase() === 'yes') {
            console.log('\n正在启动系统...\n');
            
            // 动态导入并启动服务器
            const MultiDomainEmailServer = require('./server');
            // 注意：这里不会直接启动，因为server.js在导入时就会启动
            console.log('系统启动中，请查看上方的启动日志...');
        }
    }

    isValidDomain(domain) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    }

    question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }
}

// 如果直接运行此脚本，启动配置向导
if (require.main === module) {
    const wizard = new SetupWizard();
    wizard.start().catch(console.error);
}

module.exports = SetupWizard;
