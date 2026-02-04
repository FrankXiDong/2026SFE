const { Mwn } = require('mwn');
const fs = require('fs');
const config = require('./config');
const utils = require('./utils');
const pc = require('picocolors');

async function getOAuth2Token() {
    // MediaWiki OAuth 2.0 Client Credentials Grant
    // Token endpoint usually: /w/rest.php/oauth2/access_token
    const tokenUrl = config.apiUrl.replace('api.php', 'rest.php/oauth2/access_token');
    
    console.log(pc.cyan(`[INFO] 获取 OAuth 2.0 令牌... (${tokenUrl})`));
    
    try {
        // Use global fetch (Node 18+)
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': config.userAgent
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: config.oauth2.clientId,
                client_secret: config.oauth2.clientSecret
            })
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`OAuth2 Token fetch failed: ${response.status} ${body}`);
        }

        const data = await response.json();
        return data.access_token;
    } catch (e) {
        console.error(pc.red('[FATAL] 无法获取 OAuth 2.0 令牌'), e);
        process.exit(1);
    }
}

// 封装主逻辑，增加错误处理，确保脚本退出状态正确
async function main() {
    // 1. 获取 OAuth 2.0 Token
    // 优先使用直接提供的 Access Token，否则尝试通过 Client Credentials 获取
    const accessToken = config.oauth2.accessToken || await getOAuth2Token();

    // 2. 初始化 bot 实例
    // 使用 new Mwn() 而不是 init()，因为我们手动处理认证
    const bot = new Mwn({
        apiUrl: config.apiUrl,
        userAgent: config.userAgent,
        defaultParams: {
            assert: 'user', // 强制要求登录状态
            maxlag: 5 
        }
    });

    const originalRequest = bot.request;
    bot.request = async function(params) {
        // 确保headers中的Authorization值只包含ASCII字符
        if(this.requestOptions.headers && this.requestOptions.headers.Authorization) {
            const authHeader = this.requestOptions.headers.Authorization;
            const cleanAuthHeader = authHeader.split('').filter(char => 
                char.charCodeAt(0) <= 255
            ).join('');
            this.requestOptions.headers.Authorization = cleanAuthHeader;
        }
        return originalRequest.call(this, params);
    };

    // 3. 注入 Header
    bot.requestOptions.headers = {
        ...bot.requestOptions.headers,
        'Authorization': `Bearer ${accessToken}`
    };

    try {
        // 4. 获取 CSRF Token 等所有需要的 token (edit, delete, etc)
        // Mwn 会自动尝试获取，但我们可以显式调用 getTokens() 确认登录有效
        console.log(pc.blue('[INFO] 验证登录状态并获取编辑令牌...'));
        await bot.getTokens(); // 这会发送一个 meta=tokens 请求，利用 Bearer token 认证
        
        const user = await bot.userinfo();
        console.log(pc.green(`[INFO] 登录成功，当前身份: ${user.name}`));

    } catch (e) {
        console.error(pc.red('[FATAL] 初始化失败或认证无效:'), e);
        process.exit(1);
    }

    // 5. 批量移动页面
    const list1 = [
        '201', '202',
        '203', '204',
        '212', '215',
        '224', '226',
        '227'
    ];
    const prefix1_from = 'Template:PRC admin/data/41/01/22/112/';
    const prefix1_to = 'Template:PRC admin/data/41/01/22/007/';
    
    // 使用正确的 for 循环语法和 move 方法参数
    for (let i = 0; i < list1.length; i++) {
        try {
            const fromTitle = prefix1_from + list1[i];
            const toTitle = prefix1_to + list1[i];
            const summary = '批量移动页面：[[Qiuwen_talk:茶馆/编辑#请求进行批量移动]]';
            
            // 使用正确的命名参数语法
            const result = await bot.move(
                fromTitle,  // fromtitle 参数
                toTitle,    // totitle 参数
                summary,    // reason/summary 参数
                {
                    movesubpages: false,  // 不移动子页面
                    ignorewarnings: false // 不忽略警告
                }
            );
            
            console.log(pc.green(`已将页面 ${fromTitle} 移动到 ${toTitle}`));
            
            // 等待5秒再进行下一次操作（除了最后一次）
            if (i < list1.length - 1) {
                await sleep(5000);
            }
        } catch (error) {
            console.error(pc.red(`移动页面失败 (${prefix1_from + list1[i]}):`), error.message);
            // 继续处理下一个页面，不要中断整个流程
        }
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(error => {
    console.error(pc.red('[FATAL] 脚本执行出错:'), error);
    process.exit(1);
}); // 捕获主函数未处理的异常