const net = require('net');
const crypto = require('crypto');

class SMTPServer {
    constructor(domain, port, mailDispatcher) {
        this.domain = domain;
        this.port = port;
        this.mailDispatcher = mailDispatcher;
        this.server = null;
        this.connections = new Set();
    }

    // 启动SMTP服务器
    start() {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this.handleConnection(socket);
            });

            this.server.listen(this.port, (err) => {
                if (err) {
                    console.error(`SMTP服务器启动失败 ${this.domain.domain}:${this.port}`, err);
                    reject(err);
                } else {
                    console.log(`SMTP服务器已启动: ${this.domain.domain}:${this.port}`);
                    resolve();
                }
            });

            this.server.on('error', (err) => {
                console.error(`SMTP服务器错误 ${this.domain.domain}:`, err);
            });
        });
    }

    // 停止SMTP服务器
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                // 关闭所有连接
                this.connections.forEach(socket => {
                    socket.destroy();
                });
                this.connections.clear();

                this.server.close(() => {
                    console.log(`SMTP服务器已停止: ${this.domain.domain}:${this.port}`);
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // 处理客户端连接
    handleConnection(socket) {
        this.connections.add(socket);
        
        let sessionData = {
            from: null,
            to: [],
            data: '',
            state: 'GREETING'
        };

        console.log(`新的SMTP连接: ${socket.remoteAddress} -> ${this.domain.domain}`);

        // 发送欢迎消息
        socket.write('220 ' + this.domain.domain + ' ESMTP Ready\r\n');

        socket.on('data', (data) => {
            this.handleSMTPCommand(socket, data.toString(), sessionData);
        });

        socket.on('close', () => {
            this.connections.delete(socket);
            console.log(`SMTP连接关闭: ${socket.remoteAddress} -> ${this.domain.domain}`);
        });

        socket.on('error', (err) => {
            console.error(`SMTP连接错误: ${this.domain.domain}`, err);
            this.connections.delete(socket);
        });

        // 设置超时
        socket.setTimeout(300000); // 5分钟超时
        socket.on('timeout', () => {
            socket.write('421 Timeout\r\n');
            socket.end();
        });
    }

    // 处理SMTP命令
    handleSMTPCommand(socket, data, sessionData) {
        const lines = data.split('\r\n').filter(line => line.length > 0);
        
        for (const line of lines) {
            const command = line.split(' ')[0].toUpperCase();
            const args = line.substring(command.length).trim();

            console.log(`SMTP命令 [${this.domain.domain}]: ${line}`);

            switch (command) {
                case 'HELO':
                case 'EHLO':
                    socket.write(`250-${this.domain.domain} Hello\r\n`);
                    socket.write('250-SIZE 10240000\r\n');
                    socket.write('250 OK\r\n');
                    sessionData.state = 'READY';
                    break;

                case 'MAIL':
                    if (args.toUpperCase().startsWith('FROM:')) {
                        sessionData.from = this.extractEmail(args.substring(5));
                        socket.write('250 OK\r\n');
                        sessionData.state = 'MAIL';
                    } else {
                        socket.write('501 Syntax error\r\n');
                    }
                    break;

                case 'RCPT':
                    if (args.toUpperCase().startsWith('TO:')) {
                        const toEmail = this.extractEmail(args.substring(3));
                        if (this.isValidRecipient(toEmail)) {
                            sessionData.to.push(toEmail);
                            socket.write('250 OK\r\n');
                            sessionData.state = 'RCPT';
                        } else {
                            socket.write('550 Mailbox unavailable\r\n');
                        }
                    } else {
                        socket.write('501 Syntax error\r\n');
                    }
                    break;

                case 'DATA':
                    if (sessionData.state === 'RCPT') {
                        socket.write('354 Start mail input; end with <CRLF>.<CRLF>\r\n');
                        sessionData.state = 'DATA';
                        sessionData.data = '';
                    } else {
                        socket.write('503 Bad sequence of commands\r\n');
                    }
                    break;

                case 'QUIT':
                    socket.write('221 Bye\r\n');
                    socket.end();
                    break;

                case 'RSET':
                    sessionData = { from: null, to: [], data: '', state: 'READY' };
                    socket.write('250 OK\r\n');
                    break;

                default:
                    if (sessionData.state === 'DATA') {
                        if (line === '.') {
                            // 邮件数据结束
                            this.processEmail(sessionData);
                            socket.write('250 OK Message accepted\r\n');
                            sessionData = { from: null, to: [], data: '', state: 'READY' };
                        } else {
                            sessionData.data += line + '\r\n';
                        }
                    } else {
                        socket.write('500 Command not recognized\r\n');
                    }
                    break;
            }
        }
    }

    // 提取邮件地址
    extractEmail(str) {
        const match = str.match(/<(.+?)>/);
        return match ? match[1] : str.trim();
    }

    // 验证收件人是否有效
    isValidRecipient(email) {
        const domain = email.split('@')[1];
        return domain === this.domain.domain;
    }

    // 处理接收到的邮件
    processEmail(sessionData) {
        const emailData = {
            id: crypto.randomUUID(),
            from: sessionData.from,
            to: sessionData.to,
            domain: this.domain.domain,
            subject: this.extractSubject(sessionData.data),
            body: sessionData.data,
            receivedAt: new Date().toISOString(),
            read: false
        };

        console.log(`收到邮件 [${this.domain.domain}]: ${sessionData.from} -> ${sessionData.to.join(', ')}`);
        
        // 通过邮件分发器处理邮件
        this.mailDispatcher.handleIncomingEmail(emailData);
    }

    // 提取邮件主题
    extractSubject(data) {
        const lines = data.split('\r\n');
        for (const line of lines) {
            if (line.toLowerCase().startsWith('subject:')) {
                return line.substring(8).trim();
            }
        }
        return '(无主题)';
    }
}

module.exports = SMTPServer;
