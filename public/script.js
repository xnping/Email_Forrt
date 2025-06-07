class MultiDomainEmailClient {
    constructor() {
        this.currentEmail = '';
        this.currentPage = 1;
        this.totalPages = 1;
        this.emails = [];
        this.domains = [];
        this.refreshInterval = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadInitialData();
        this.startAutoRefresh();
    }

    // 初始化DOM元素
    initializeElements() {
        this.elements = {
            generateBtn: document.getElementById('generate-btn'),
            domainSelect: document.getElementById('domain-select'),
            currentEmail: document.getElementById('current-email'),
            copyBtn: document.getElementById('copy-btn'),
            searchInput: document.getElementById('search-input'),
            refreshBtn: document.getElementById('refresh-btn'),
            filterDomain: document.getElementById('filter-domain'),
            emailItems: document.getElementById('email-items'),
            prevPage: document.getElementById('prev-page'),
            nextPage: document.getElementById('next-page'),
            pageInfo: document.getElementById('page-info'),
            modal: document.getElementById('email-modal'),
            closeModal: document.getElementById('close-modal'),
            closeModalBtn: document.getElementById('close-modal-btn'),
            deleteEmail: document.getElementById('delete-email'),
            domainCount: document.getElementById('domain-count'),
            emailCount: document.getElementById('email-count'),
            serverStatus: document.getElementById('server-status'),
            domainStatus: document.getElementById('domain-status'),
            emailStats: document.getElementById('email-stats'),
            systemInfo: document.getElementById('system-info')
        };
    }

    // 绑定事件
    bindEvents() {
        this.elements.generateBtn.addEventListener('click', () => this.generateEmail());
        this.elements.copyBtn.addEventListener('click', () => this.copyEmail());
        this.elements.refreshBtn.addEventListener('click', () => this.loadEmails());
        this.elements.searchInput.addEventListener('input', () => this.searchEmails());
        this.elements.filterDomain.addEventListener('change', () => this.filterEmails());
        this.elements.prevPage.addEventListener('click', () => this.previousPage());
        this.elements.nextPage.addEventListener('click', () => this.nextPage());
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
        this.elements.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.elements.deleteEmail.addEventListener('click', () => this.deleteCurrentEmail());

        // 点击模态框外部关闭
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.closeModal();
            }
        });

        // ESC键关闭模态框
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.modal.style.display === 'block') {
                this.closeModal();
            }
        });
    }

    // 加载初始数据
    async loadInitialData() {
        await this.loadDomains();
        await this.loadEmails();
        await this.loadStats();
    }

    // 开始自动刷新
    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            this.loadEmails();
            this.loadStats();
        }, 30000); // 30秒刷新一次
    }

    // 停止自动刷新
    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // API请求封装
    async apiRequest(endpoint, options = {}) {
        try {
            const response = await fetch(`/api/${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API请求失败 (${endpoint}):`, error);
            this.showError(`请求失败: ${error.message}`);
            throw error;
        }
    }

    // 加载域名列表
    async loadDomains() {
        try {
            const data = await this.apiRequest('domains');
            this.domains = data.domains;
            this.updateDomainSelects();
            this.elements.serverStatus.textContent = '状态: 已连接';
            this.elements.serverStatus.style.color = '#48bb78';
        } catch (error) {
            this.elements.serverStatus.textContent = '状态: 连接失败';
            this.elements.serverStatus.style.color = '#f56565';
        }
    }

    // 更新域名选择框
    updateDomainSelects() {
        const enabledDomains = this.domains.filter(d => d.enabled);
        
        // 更新生成器域名选择
        this.elements.domainSelect.innerHTML = '<option value="">随机选择域名</option>';
        enabledDomains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain.domain;
            option.textContent = domain.domain;
            this.elements.domainSelect.appendChild(option);
        });

        // 更新过滤器域名选择
        this.elements.filterDomain.innerHTML = '<option value="">所有域名</option>';
        enabledDomains.forEach(domain => {
            const option = document.createElement('option');
            option.value = domain.domain;
            option.textContent = domain.domain;
            this.elements.filterDomain.appendChild(option);
        });
    }

    // 生成邮箱地址
    async generateEmail() {
        try {
            this.elements.generateBtn.disabled = true;
            this.elements.generateBtn.textContent = '生成中...';

            const selectedDomain = this.elements.domainSelect.value;
            let endpoint = 'generate-email';
            
            if (selectedDomain) {
                endpoint += `?domain=${encodeURIComponent(selectedDomain)}`;
            }

            const data = await this.apiRequest(endpoint);
            this.currentEmail = data.email;
            this.elements.currentEmail.value = this.currentEmail;
            
            this.showSuccess(`已生成邮箱: ${this.currentEmail}`);
        } catch (error) {
            this.showError('生成邮箱失败');
        } finally {
            this.elements.generateBtn.disabled = false;
            this.elements.generateBtn.textContent = '生成随机邮箱';
        }
    }

    // 复制邮箱地址
    async copyEmail() {
        if (!this.currentEmail) {
            this.showError('请先生成邮箱地址');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.currentEmail);
            this.showSuccess('邮箱地址已复制到剪贴板');
        } catch (error) {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = this.currentEmail;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('邮箱地址已复制');
        }
    }

    // 加载邮件列表
    async loadEmails() {
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 20
            });

            const filterDomain = this.elements.filterDomain.value;
            if (filterDomain) {
                params.append('domain', filterDomain);
            }

            const searchQuery = this.elements.searchInput.value.trim();
            if (searchQuery) {
                params.append('search', searchQuery);
            }

            const data = await this.apiRequest(`emails?${params}`);
            this.emails = data.emails;
            this.totalPages = data.totalPages || 1;
            
            this.renderEmails();
            this.updatePagination();
        } catch (error) {
            this.showError('加载邮件失败');
        }
    }

    // 渲染邮件列表
    renderEmails() {
        if (this.emails.length === 0) {
            this.elements.emailItems.innerHTML = `
                <div class="empty-state">
                    <p>📭 暂无邮件</p>
                    <p>生成邮箱地址后，收到的邮件将显示在这里</p>
                </div>
            `;
            return;
        }

        const emailsHtml = this.emails.map(email => {
            const date = new Date(email.receivedAt);
            const timeStr = date.toLocaleString('zh-CN');
            const unreadClass = email.read ? '' : 'unread';
            
            return `
                <div class="email-item ${unreadClass}" data-email-id="${email.id}">
                    <div class="email-header">
                        <div class="email-subject">${this.escapeHtml(email.subject)}</div>
                        <div class="email-time">${timeStr}</div>
                    </div>
                    <div class="email-meta">
                        <span>发件人: ${this.escapeHtml(email.from)}</span>
                        <span>收件人: ${this.escapeHtml(email.to.join(', '))}</span>
                        <span>域名: ${this.escapeHtml(email.domain)}</span>
                    </div>
                </div>
            `;
        }).join('');

        this.elements.emailItems.innerHTML = emailsHtml;

        // 绑定邮件点击事件
        this.elements.emailItems.querySelectorAll('.email-item').forEach(item => {
            item.addEventListener('click', () => {
                const emailId = item.dataset.emailId;
                this.showEmailModal(emailId);
            });
        });
    }

    // 更新分页
    updatePagination() {
        this.elements.pageInfo.textContent = `第 ${this.currentPage} 页，共 ${this.totalPages} 页`;
        this.elements.prevPage.disabled = this.currentPage <= 1;
        this.elements.nextPage.disabled = this.currentPage >= this.totalPages;
    }

    // 上一页
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadEmails();
        }
    }

    // 下一页
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadEmails();
        }
    }

    // 搜索邮件
    searchEmails() {
        this.currentPage = 1;
        this.loadEmails();
    }

    // 过滤邮件
    filterEmails() {
        this.currentPage = 1;
        this.loadEmails();
    }

    // 显示邮件详情模态框
    showEmailModal(emailId) {
        const email = this.emails.find(e => e.id === emailId);
        if (!email) return;

        document.getElementById('modal-subject').textContent = email.subject;
        document.getElementById('modal-from').textContent = email.from;
        document.getElementById('modal-to').textContent = email.to.join(', ');
        document.getElementById('modal-time').textContent = new Date(email.receivedAt).toLocaleString('zh-CN');
        document.getElementById('modal-domain').textContent = email.domain;
        document.getElementById('modal-content').textContent = email.body;

        this.elements.modal.style.display = 'block';
        this.elements.deleteEmail.dataset.emailId = emailId;

        // 标记为已读
        if (!email.read) {
            email.read = true;
            this.renderEmails();
        }
    }

    // 关闭模态框
    closeModal() {
        this.elements.modal.style.display = 'none';
    }

    // 删除当前邮件
    async deleteCurrentEmail() {
        const emailId = this.elements.deleteEmail.dataset.emailId;
        if (!emailId) return;

        if (!confirm('确定要删除这封邮件吗？')) return;

        try {
            await this.apiRequest(`emails/${emailId}`, { method: 'DELETE' });
            this.closeModal();
            this.loadEmails();
            this.showSuccess('邮件已删除');
        } catch (error) {
            this.showError('删除邮件失败');
        }
    }

    // 加载统计信息
    async loadStats() {
        try {
            const data = await this.apiRequest('stats');
            
            this.elements.domainCount.textContent = `域名: ${data.domains.enabled}/${data.domains.total}`;
            this.elements.emailCount.textContent = `邮件: ${data.emails.total}`;

            // 更新域名状态
            this.updateDomainStatus(data.domains, data.emails.byDomain);
            
            // 更新邮件统计
            this.updateEmailStats(data.emails);
            
            // 更新系统信息
            this.updateSystemInfo(data.system);
            
        } catch (error) {
            console.error('加载统计信息失败:', error);
        }
    }

    // 更新域名状态显示
    updateDomainStatus(domainStats, emailsByDomain) {
        const enabledDomains = this.domains.filter(d => d.enabled);
        const statusHtml = enabledDomains.map(domain => {
            const emailCount = emailsByDomain[domain.domain] || 0;
            const status = domain.enabled ? '🟢 启用' : '🔴 禁用';
            return `<p>${domain.domain}: ${status} (${emailCount} 封邮件)</p>`;
        }).join('');
        
        this.elements.domainStatus.innerHTML = statusHtml || '<p>暂无域名数据</p>';
    }

    // 更新邮件统计显示
    updateEmailStats(emailStats) {
        const statsHtml = `
            <p>总邮件数: ${emailStats.total}</p>
            <p>未读邮件: ${emailStats.unread}</p>
            <p>已读邮件: ${emailStats.total - emailStats.unread}</p>
        `;
        this.elements.emailStats.innerHTML = statsHtml;
    }

    // 更新系统信息显示
    updateSystemInfo(systemInfo) {
        const uptimeHours = Math.floor(systemInfo.uptime / 3600);
        const uptimeMinutes = Math.floor((systemInfo.uptime % 3600) / 60);
        const memoryMB = Math.round(systemInfo.memory.used / 1024 / 1024);
        
        const infoHtml = `
            <p>运行时间: ${uptimeHours}小时 ${uptimeMinutes}分钟</p>
            <p>内存使用: ${memoryMB} MB</p>
            <p>SMTP服务器: ${systemInfo.smtpServers} 个</p>
        `;
        this.elements.systemInfo.innerHTML = infoHtml;
    }

    // 显示成功消息
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // 显示错误消息
    showError(message) {
        this.showNotification(message, 'error');
    }

    // 显示通知
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#4299e1'};
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;

        document.body.appendChild(notification);
        
        // 动画显示
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // 自动移除
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.emailClient = new MultiDomainEmailClient();
});
