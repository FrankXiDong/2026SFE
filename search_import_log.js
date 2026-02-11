const { Mwn } = require('mwn');
const fs = require('fs');
const config = require('./config');
const utils = require('./utils');
const pc = require('picocolors');

// 全局变量定义
const groupSet = {
    'confirmed' : '确认用户',
    'autoconfirmed' : '自动确认用户',
    'transwiki' : '导入者',
    'autoreviewer' : '巡查豁免者',
    'templateeditor' : '模板编辑员',
    'patroller' : '巡查员',
    'interface-admin' : '界面管理员',
    'sysop' : '管理员',
    'senioreditor' : '资深编者',
    'suppress' : '监督员',
    'steward' : '裁决委员',
};

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
    username = 'Nice Nature';
    namespaces = [0,6,10,206,828];
    let score = 0;
    for (const namespace0 of namespaces) { 
        const defaultJson = {
            "action": "query",
            "format": "json",
            "list": "logevents",
            "formatversion": "2",
            "letype": "import",
            "lestart": "2026-01-31T16:00:00.000Z",
            "leend": new Date().toISOString(),
            "ledir": "newer",
            "leuser": username,
            "lenamespace": namespace0, // 条目命名空间
            "lelimit": "max"
        };

        const signlist = await bot.request(defaultJson).catch((e) => { 
            console.error(pc.red('[FATAL] 获取日志列表失败:'), e);
        });
        const loglist = signlist.query.logevents;

        console.log(pc.blue(`[INFO] 获取 条目命名空间 ${namespace0} 的日志列表成功，共 ${loglist.length} 条日志`));

        if (namespace0 === 0) { 
            score += loglist.length * 0.02;
        }
        else {
            score += loglist.length * 0.01;
        }
    }
    // 保留五位小数
    score = score.toFixed(5);
    console.log(pc.green(`[INFO] 总分: ${score}`));
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(console.error); // 捕获主函数未处理的异常