const { Mwn } = require('mwn');
const fs = require('fs');
const config = require('./config');
const utils = require('./utils');
const pc = require('picocolors');
const { spawn } = require('child_process');
const path = require('path');

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

/**
 * 更新单个页面的内容
 */
async function updatePageContent(bot, pageTitle, updatedItems, summary) {
    try {
        // 先读取页面当前内容
        const content = await bot.read(pageTitle);
        const wikitext = content.revisions[0].content;
        
        // 应用更新到页面内容
        const updatedWikitext = utils.updatePageContentWithTemplates(wikitext, updatedItems);
        
        // 保存更新后的内容
        await bot.save(pageTitle, updatedWikitext, summary);
        console.log(pc.green(`[SUCCESS] 页面已更新: ${pageTitle}`));
        return true;
    } catch (err) {
        console.error(pc.red(`[ERROR] 更新页面失败 ${pageTitle}:`), err);
        return false;
    }
}

/**
 * 从API获取所有贡献页面
 */
async function getAllContributionPages(bot) {
    const prefix = 'Qiuwen:2026年春节编辑松/提交/';
    const pages = await bot.request({
        action: 'query',
        list: 'allpages',
        apprefix: '2026年春节编辑松/提交/',
        apnamespace: 4, // 4 代表 Project 命名空间 (即 Qiuwen:)
        aplimit: 'max',
        apfilterredir: 'nonredirects' // 仅获取非重定向页面，防止处理已移动留下的重定向页
    }).then(data => data.query.allpages);

    return pages.filter(page => page.title.endsWith('的贡献'));
}

/**
 * 查找所有待审核的项目并保存到JSON文件
 */
async function findPendingReviews(bot) {
    const pages = await getAllContributionPages(bot);
    const pendingData = [];

    for (const page of pages) {
        const username = page.title.replace('Qiuwen:2026年春节编辑松/提交/', '').replace('的贡献', '');
        console.log(pc.dim(`[INFO] 正在处理用户: ${username}...`));

        try {
            const content = await bot.read(page.title);
            const wikitext = content.revisions[0].content;
            
            const result = utils.parseContributionPageWithDetails(wikitext);
            const pendingItems = result.items.filter(item =>
                ['pending', '待审核', 'doing', '审核中'].includes(item.status.toLowerCase()) ||
                (['pass', '通过'].includes(item.status.toLowerCase()) && !item.score)
            ); // 筛选出待审核项目或通过但无得分的项目

            for (const item of pendingItems) {
                pendingData.push({
                    page: page.title,
                    user: username,
                    originalLine: item.originalLine,
                    entryName: item.entryName, // 添加条目名称
                    status: item.status,
                    score: item.score,
                    absolutePosition: item.absolutePosition,
                    relativePosition: item.relativePosition,
                    lineNumber: item.lineNumber,
                    templateIndex: item.templateIndex,
                    originalTemplate: item.originalTemplate
                });
            }
        } catch (err) {
            console.error(pc.red(`[ERROR] 处理页面 ${page.title} 时出错:`), err);
        }
    }

    // 保存待审核数据到JSON文件
    fs.writeFileSync('pending_data.json', JSON.stringify(pendingData, null, 2), 'utf8');
    console.log(pc.green(`[SUCCESS] 已将 ${pendingData.length} 个待审核项目保存到 pending_data.json 文件`));

    return pendingData;
}

/**
 * 从JSON文件读取更新数据并更新页面
 */
async function updatePagesFromJson(bot,content) {

    const updatedPages = JSON.parse(content);
    
    for (const pageData of updatedPages) {
        //console.log(pageData);
        console.log(pc.cyan(`[INFO] 正在更新页面: ${pageData.title}`));
        await updatePageContent(
            bot, 
            pageData.title, 
            pageData.items, 
            pageData.summary || '快速审核（2026年春节编辑松小工具）'
        );
    }
    
    console.log(pc.green('[SUCCESS] 所有页面更新完成'));
    return true;
}

/**
 * 自动打开浏览器并启动审核流程
 */
async function startReviewProcess() {
    const accessToken = config.oauth2.accessToken || await getOAuth2Token();

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

    bot.requestOptions.headers = {
        ...bot.requestOptions.headers,
        'Authorization': `Bearer ${accessToken}`
    };

    try {
        console.log(pc.blue('[INFO] 验证登录状态并获取编辑令牌...'));
        await bot.getTokens();
        
        const user = await bot.userinfo();
        console.log(pc.green(`[INFO] 登录成功，当前身份: ${user.name}`));

        // 查找待审核项目
        return await findPendingReviews(bot);

        // 启动审核页面
        console.log(pc.cyan('[INFO] 启动审核页面...'));
        
    } catch (e) {
        console.error(pc.red('[FATAL] 初始化失败或认证无效:'), e);
        process.exit(1);
    }
    return {};
}

/**
 * 完成审核并更新页面
 */
async function finishReviewProcess(content) {
    const accessToken = config.oauth2.accessToken || await getOAuth2Token();

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
            this.requestOptions.headers.Authorization = this.requestOptions.headers.Authorization.replace(/[^\x00-\x7F]/g, '');
        }
        return originalRequest.call(this, params);
    };

    bot.requestOptions.headers = {
        ...bot.requestOptions.headers,
        'Authorization': `Bearer ${accessToken}`
    };

    try {
        console.log(pc.blue('[INFO] 验证登录状态并获取编辑令牌...'));
        await bot.getTokens();
        
        const user = await bot.userinfo();
        console.log(pc.green(`[INFO] 登录成功，当前身份: ${user.name}`));

        console.log(pc.blue('[INFO] 开始更新页面内容...'));


        // 检查贡献页顶端信息并更新
        const { entryCount, totalScore } = utils.parseContributionPage(content);
        const formattedScore = utils.formatScore(totalScore);// 格式化分数到小数点后两位
        const newContent = utils.updateUserPageContent(content, entryCount, formattedScore);// 检查并更新用户的贡献页头部信息
        if (newContent !== content) {
            console.log(pc.yellow(`[ACTION] 更新页面 ${username}: 条目数=${entryCount}, 得分=${formattedScore}`));// 如果统计数据更新，输出日志
        }

        await updatePagesFromJson(bot, newContent);

        console.log(pc.green('[SUCCESS] 所有页面更新完成，开始更新总排行榜...'));
        HYYY_bot.main().catch(e => {
            console.error(pc.red('[FATAL] 总排行榜更新失败:'), e);
            process.exit(1);
        });// 运行HYYY_bot代码

    } catch (e) {
        console.error(pc.red('[FATAL] 完成审核过程失败:'), e);
        process.exit(1);
    }
}


const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时
//导入express
const express = require('express')
//创建web服务器
const app=express()
app.use(express.static('public'));
//将文件部署到服务器
// 通过app.listen进行服务器的配置，并启动服务器，接收两个配置参数，一个是对应的端口号，一个是启动成功的回调函数
//get接口的开发
app.use(express.json());
const bot = new Mwn({
    apiUrl: config.apiUrl,
    userAgent: config.userAgent,
    defaultParams: {
        assert: 'user', // 强制要求登录状态
        maxlag: 5 
    }
});
app.get('/api/list',async (err,res)=>{
    const data = await startReviewProcess();
    res.send({
        code:200,
        data:JSON.stringify(data, null, 2)
    })
})
app.post('/api/push', async (req, res) => {
    try {
        const inp = req.body['content'];

        // 验证输入内容是否存在
        if (!inp) {
            console.error('[ERROR] 请求体中缺少 content 字段');
            return res.status(400).send({
                code: 400,
                message: '请求体中缺少 content 字段'
            });
        }

        console.log('[INFO] 接收到的内容:', inp);

        // 调用 finishReviewProcess 并传递内容
        await finishReviewProcess(inp);

        res.send({
            code: 200,
            message: '审核完成并成功推送'
        });
    } catch (error) {
        console.error('[ERROR] 推送审核数据时发生错误:', error);
        res.status(500).send({
            code: 500,
            message: '服务器内部错误'
        });
    }
});
app.get('/',)

app.listen(2026,()=>{
    console.log('服务器启动成功，运行于http://localhost:2026');
    // 尝试打开浏览器
    const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    const child = spawn(openCmd, ['http://localhost:2026'], { shell: true });
    
    child.on('error', (err) => {
        console.log(pc.yellow('[WARN] 自动打开浏览器失败，手动打开 http://localhost:2026'));
    });
})