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

    /* const signlist = await bot.read('Qiuwen:2026年春节编辑松/报名/名单')
    const usernames = extractUsernames(signlist.revisions[0].content); */
    const usernames = [
  "LH44",
  "叮咚叮咚",
  "Hcx2012", 
  "Langqiao",
  "冬梦雨",
  "Nice Nature",
  "Kiss琪亚娜酱~",
  "瀚海狂客",
  "YuChein",
  "キイロピタヤ",
  "羽落零音",
  "Qingwen",
  "没有羽翼的格雷塔",
  "Abigpigeon",
  "神萌虎",
  "千里走单骑",
  "TFX202X",
  "铁桶",
  "知微行远",
  "IntegerSequences",
  "Lemonade",
  "蓝斑鸠",
  "SolidBlock",
  "HHHTBJ",
  "Wa-tim",
  "伞月亭",
  "待春",
  "超威蓝猫",
  "ABCXYZ",
  "Bourbaki",
  "饮泉思源",
  "詹天佑二世",
  "Jdz4045",
  "Kiraclyne",
  "末影橘子",
  "Yui",
  "Diana Katerina Jones",
  "Xigma",
  "A-pigeon",
  "柳麟谔",
  "Yoku",
  "BugCatcher",
  "欧阳狮子",
  "THUargwliu",
  "Studyrat",
  "MeowColumn",
  "Zyz2026",
  "Vikarna",
  "Linxiaonuan",
  "Zhujianfei",
  "冀有陉鲜事儿②",
  "Lily White",
  "SaoMikoto",
  "Gjm",
  "初尘",
  "Mai",
  "敝之鱼",
  "Littleparrot",
  "Luxra",
  "纯爱战神",
  "漆皮先生",
  "4O74Y74L74J7",
  "Jim Zhang",
  "雨幡悬停",
  "希羽岚",
  "MartianReunion",
  "Qinhex",
  "因为重名没有昵称",
  "江左梅郎"
];
    console.log(pc.blue(`[INFO] 提取到 ${usernames.length} 个用户名: ${usernames.join(', ')}`));

    let userlist = [];
    if (usernames.length > 50) {
        // 修复变量重复声明问题
        for (let i = 0; i < Math.ceil(usernames.length / 50); i++) {
            userlist[i] = usernames.slice(i * 50, (i + 1) * 50);
        }
    } else {
        userlist = [usernames];
    }
    
    let userdetails = [];
    for (const usernamesChunk of userlist) {
        const userdetail = await bot.query({
            list: 'users',
            ususers: usernamesChunk.join('|'),
            usprop: 'editcount|registration|groups'
        });
        userdetails.push(...userdetail.query.users); // 扁平化合并结果
    }

    // 构建参与者数据
    const participants = userdetails.map(user => ({
        username: user.name,
        editCount: user.editcount,
        registration: user.registration,
        registrationYear: new Date(user.registration).getFullYear(),
        groups: Array.isArray(user.groups) ? user.groups : [], // 安全检查并提供默认值
        entryCount: 0, // 需要后续获取实际提交数量
        totalScore: 0, // 需要后续计算得分
        isVeteran: false // 需要后续检查资历状态
    }));

    // 计算每一个用户组的人数
    const groupCounts = {};
    for (const userdetail of userdetails) {
        const groups = Array.isArray(userdetail.groups) ? userdetail.groups : []; // 安全检查并提供默认值
        for (const group of groups) {
            if (groupSet[group]) {
                if (!groupCounts[group]) {
                    groupCounts[group] = 0;
                }
                groupCounts[group]++;
            }
        }
    }
    console.log(pc.blue('[INFO] 用户组统计:'), groupCounts);

    // 按编辑次数所处区间，计算各区间人数
    const editCountBuckets = {
        '0-99': 0,
        '100-499': 0,
        '500-999': 0,
        '1000-4999': 0,
        '5000-9999': 0, // 修正逗号为连字符
        '10000+': 0
    };
    
    for (const userdetail of userdetails) {
        const editCount = userdetail.editcount;
        // 修正区间判断逻辑，将字符串转换为数字进行比较
        if (editCount >= 0 && editCount <= 99) {
            editCountBuckets['0-99']++;
        } else if (editCount >= 100 && editCount <= 499) {
            editCountBuckets['100-499']++;
        } else if (editCount >= 500 && editCount <= 999) {
            editCountBuckets['500-999']++;
        } else if (editCount >= 1000 && editCount <= 4999) {
            editCountBuckets['1000-4999']++;
        } else if (editCount >= 5000 && editCount <= 9999) {
            editCountBuckets['5000-9999']++;
        } else if (editCount >= 10000) {
            editCountBuckets['10000+']++;
        }
    }
    console.log(pc.blue('[INFO] 编辑次数区间统计:'), editCountBuckets);

    // 按注册时间区间，计算各区间人数
    const registrationBuckets = {
        '2026': 0,
        '2025': 0,
        '2024': 0,
        '2023': 0,
        '2022': 0
    };
    const currentYear = new Date().getFullYear();
    for (const userdetail of userdetails) {
        const registrationYear = new Date(userdetail.registration).getFullYear();
        if (registrationYear >= currentYear - 4) {
            registrationBuckets[registrationYear.toString()]++;
        }
    }
    console.log(pc.blue('[INFO] 注册时间区间统计:'), registrationBuckets);

    // 写入markdown摘要
    generateGithubSummary(participants, groupCounts);

}

function extractUsernames(wikitext) {
    const pattern = /\[\[(?:User|U|User talk|UT|特殊:用户贡献|特殊:用户页|User_talk|用户):([^\]|#<]+)(?:[^\[\]]*?)\]\]/gi;
    const usernames = new Set();
    let match;
    
    while ((match = pattern.exec(wikitext)) !== null) {
        const username = match[1].trim();
        if (username) {
            usernames.add(username);
        }
    }
    
    return Array.from(usernames).sort();
}

/**
 * 检查用户是否为"熟练编者"
 * 定义：在 2026-02-01 之前已完成 50 次编辑
 */
async function checkVeteranStatus(bot, username) {
    try {
        // API 查询：list=usercontribs
        // ucstart: 从 2026-02-01 开始
        // ucdir: 'older' (默认向旧查询)
        // 含义：查询时间戳早于 2026-02-01 的编辑记录
        const contribs = await bot.request({
            action: 'query',
            list: 'usercontribs',
            ucuser: username,
            ucstart: '2026-02-01T00:00:00Z', // 时间界限
            uclimit: 55, // 获取稍多于 50 条，确认是否满足阈值
            ucdir: 'older'
        });
        
        // 如果返回的列表数 >= 50，说明满足条件
        return contribs.query.usercontribs.length >= 50;
    } catch (err) {
        console.error(pc.yellow(`[WARN] 无法检查用户 ${username} 的资历状态:`), err);
        return false; // 如果检查失败，默认归为新星，避免误判为熟练
    }
}

async function updateLeaderboard(bot, participants) {
    const leaderboardTitle = 'Qiuwen:2026年春节编辑松/提交'; 
    console.log(pc.cyan(`[INFO] 正在更新总排行榜: ${leaderboardTitle}...`));

    try {
        let content = await bot.read(leaderboardTitle).then(res => res.revisions[0].content);

        // 分类排序：
        // 1. 熟练编者 / 新星编者
        // 2. 排序优先级：总分 (降序) -> 条目数 (降序)
        const sortFn = (a, b) => b.totalScore - a.totalScore || b.entryCount - a.entryCount;
        
        const veterans = participants.filter(p => p.isVeteran).sort(sortFn);
        const newStars = participants.filter(p => !p.isVeteran).sort(sortFn);
        const allParticipants = [...participants].sort(sortFn);

        // 生成表格行的辅助函数
        const generateRows = (list, markNewStar = false) => {
            if (list.length === 0) return '|- \n| colspan="5" style="text-align: center;" | 暂无数据\n';
            return list.map((p, index) => {
                let userDisplay = `[[User:${p.username}|${p.username}]]`;
                if (markNewStar && !p.isVeteran) {
                    // 使用显眼的样式标记新星编者
                    userDisplay = `🌱 ${userDisplay}`;
                }

                // 生成一行：| 排名 || 贡献者 || 已提交条数 || 目前得分 || 贡献详情页
                return `|-
| ${index + 1} || ${userDisplay} || ${p.entryCount} || ${p.totalScore} || [[${p.pageTitle}|查看页面]]`;
            }).join('\n');
        };

        const veteranRows = generateRows(veterans);
        const newStarRows = generateRows(newStars);
        const allRows = generateRows(allParticipants, true);

        // 更新时间戳
        content = updateTimestamp(content);

        // 替换页面中的表格内容
        // 注意：这种正则/字符串替换策略依赖于页面结构保持稳定（{{FakeH3|...}} 标题存在）
        content = replaceTableContent(content, '编者总榜', allRows);
        content = replaceTableContent(content, '熟练编者排行榜', veteranRows);
        content = replaceTableContent(content, '新星编者排行榜', newStarRows);

        // 写入更新后的排行榜
        await bot.save(leaderboardTitle, content, '更新排行榜');
        console.log(pc.green('[SUCCESS] 总排行榜已更新。'));

    } catch (err) {
        console.error(pc.red('[ERROR] 更新总排行榜失败:'), err);
    }
}

/**
 * 更新页面中的时间戳
 * 在"（以下排行约每小时更新一次）"之后添加最近更新时间
 */
function updateTimestamp(content) {
    // 获取当前时间并转换为 UTC+8（中国标准时间）
    const now = new Date();
    
    // 正确计算 UTC+8 时间：
    // 直接在 UTC 时间戳基础上增加 8 小时
    const utc8Ms = now.getTime() + (8 * 60 * 60 * 1000);
    const utc8Time = new Date(utc8Ms);
    
    // 格式化时间：xxxx年xx月xx日 xx:xx:xx UTC+8
    const year = utc8Time.getUTCFullYear();
    const month = String(utc8Time.getUTCMonth() + 1).padStart(2, '0');
    const day = String(utc8Time.getUTCDate()).padStart(2, '0');
    const hours = String(utc8Time.getUTCHours()).padStart(2, '0');
    const minutes = String(utc8Time.getUTCMinutes()).padStart(2, '0');
    const seconds = String(utc8Time.getUTCSeconds()).padStart(2, '0');
    
    const timestamp = `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds} UTC+8`;
    const timestampLine = `{{center|（最近更新：${timestamp}）}}`;
    
    // 查找"（以下排行约每小时更新一次）"的位置
    const targetText = '{{center|（以下排行约每小时更新一次）}}';
    const targetIndex = content.indexOf(targetText);
    
    if (targetIndex === -1) {
        console.log(pc.yellow('[WARN] 未找到更新提示文本，跳过时间戳更新'));
        return content;
    }
    
    // 查找目标文本之后的下一行
    const afterTarget = targetIndex + targetText.length;
    const nextLineStart = content.indexOf('\n', afterTarget) + 1;
    
    // 检查是否已存在时间戳行
    // 时间戳搜索范围：在目标文本后的前100个字符内查找
    // 这个范围足够覆盖紧跟目标文本的时间戳行，同时避免误匹配页面其他位置的时间戳
    const TIMESTAMP_SEARCH_RANGE = 100;
    const existingTimestampPattern = /\{\{center\|（最近更新：.*?\）\}\}/;
    const contentAfterTarget = content.substring(nextLineStart);
    const timestampMatch = contentAfterTarget.match(existingTimestampPattern);
    
    if (timestampMatch && contentAfterTarget.indexOf(timestampMatch[0]) < TIMESTAMP_SEARCH_RANGE) {
        // 如果已存在时间戳（在目标文本后100个字符内），则替换它
        const oldTimestampIndex = nextLineStart + contentAfterTarget.indexOf(timestampMatch[0]);
        const oldTimestampEnd = oldTimestampIndex + timestampMatch[0].length;
        return content.substring(0, oldTimestampIndex) + timestampLine + content.substring(oldTimestampEnd);
    } else {
        // 如果不存在，则插入新的时间戳行
        return content.substring(0, nextLineStart) + timestampLine + '\n' + content.substring(nextLineStart);
    }
}

function replaceTableContent(fullText, sectionName, newRows) {
    // 1. Find section
    const sectionIndex = fullText.indexOf(sectionName);
    if (sectionIndex === -1) return fullText;

    // 2. Find start of table after section
    const tableStartIndex = fullText.indexOf('{|', sectionIndex);
    if (tableStartIndex === -1) return fullText;

    // 3. Find end of table
    // We need to match nested tables if any? 
    // Assuming simple structure as per sample.
    const tableEndIndex = fullText.indexOf('|}', tableStartIndex);
    if (tableEndIndex === -1) return fullText;

    // 4. Find the header seperator `|-`? 
    // The sample shows:
    // {| ...
    // ! headers
    // |-
    // | content
    // |}
    // We want to keep headers. The headers usually end with the first `|-` that is NOT followed by `|` or `!` immediately on same line?
    // Actually the standard is `|-` starts a new row.
    // Let's assume the first `|-` after `{|` defines the separation between table decl/headers and body IF headers are used with `!`.
    // BUT the sample:
    // {| class="sf-table"
    // ! style="..." | 排名
    // ...
    // ! style="..." | 贡献详情页
    // |-     <-- Split point
    // | ...
    // |}
    
    const tableContent = fullText.substring(tableStartIndex, tableEndIndex);
    // Find the last header row ending.
    // Usually headers are `! ...`
    // We can assume the *first* `|-` that comes after the last `!` line? 
    // Or just find the first `|-` after the `! ...` block.
    
    // Let's use a standard anchor logic:
    // Look for the header line `! style="width: 20%; text-align:center" | 贡献详情页`
    // The `|-` after that is where we inject.
    
    const headerAnchor = '贡献详情页';
    const headerLoc = tableContent.indexOf(headerAnchor);
    if (headerLoc === -1) return fullText; // Safety
    
    const splitPoint = tableContent.indexOf('|-', headerLoc);
    if (splitPoint === -1) return fullText;
    
    // Construct new table
    const tableHead = tableContent.substring(0, splitPoint);
    const newTable = `${tableHead}${newRows}\n`; // existing part includes start of table up to first |- (exclusive? no |- is start of row)
    
    // Wait, [splitPoint](file://h:\Codes\2026SFE\report.js#L388-L388) is index of `|-`.
    // If I take 0 to splitPoint, I get headers.
    // Then I add `newRows` (which should start with `|-`).
    // Then close with `|}`.
    
    // Let's verify `newRows` format in `generateRows`: it starts with `|-`.
    // So yes.
    
    const preTable = fullText.substring(0, tableStartIndex);
    const postTable = fullText.substring(tableEndIndex);
    
    return `${preTable}${tableHead}${newRows}\n${postTable}`;
}

function generateGithubSummary(participants, groupCounts) {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY || './summary.md';
    let summaryContent = `# 2026年春节编辑松 - 参与者统计报告
总参与者数：${participants.length} 人

按用户组统计：
| 用户组 | 成员数 |
| --- | --- |
${Object.entries(groupCounts).map(([group, count]) => `| ${groupSet[group]} | ${count} |`).join('\n')}


按编辑次数统计：
| 编辑次数区间 | 人数 |
| --- | --- |
| 0-99 | ${participants.filter(p => p.editCount >= 0 && p.editCount <= 99).length} |
| 100-499 | ${participants.filter(p => p.editCount >= 100 && p.editCount <= 499).length} |
| 500-999 | ${participants.filter(p => p.editCount >= 500 && p.editCount <= 999).length} |
| 1000-4999 | ${participants.filter(p => p.editCount >= 1000 && p.editCount <= 4999).length} |
| 5000-9999 | ${participants.filter(p => p.editCount >= 5000 && p.editCount <= 9999).length} |
| 10000+ | ${participants.filter(p => p.editCount >= 10000).length} |

按注册时间统计：
| 注册时间 | 人数 |
| --- | --- |
| 2026年注册 | ${participants.filter(p => p.registrationYear === 2026).length} |
| 2025年注册 | ${participants.filter(p => p.registrationYear === 2025).length} |
| 2024年注册 | ${participants.filter(p => p.registrationYear === 2024).length} |
| 2023年注册 | ${participants.filter(p => p.registrationYear === 2023).length} |
| 2022年及以前注册 | ${participants.filter(p => p.registrationYear <= 2022).length} |

按资历分类：
| 类别 | 人数 |
| --- | --- |
| 熟练编者 | ${participants.filter(p => p.isVeteran).length} |
| 新星编者 | ${participants.filter(p => !p.isVeteran).length} |
`;

    fs.writeFileSync(summaryFile, summaryContent, 'utf8');
    console.log(pc.green(`[SUCCESS] 统计报告已保存到 ${summaryFile}`));
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)); // 礼貌延时

main().catch(console.error); // 捕获主函数未处理的异常