require('dotenv').config();

module.exports = {
    apiUrl: process.env.API_URL || 'https://www.qiuwenbaike.cn/api.php',
    userAgent: process.env.BOT_USER_AGENT || '2026SpringFestivalEditathonTool/1.1 (Node.js/mwn; +https://www.qiuwenbaike.cn/User:叮咚叮咚)',
    apiDelayMs: parseInt(process.env.API_DELAY_MS, 10) || 3000,
    // OAuth 2.0 Credentials
    move_bot: {
        userAgent: process.env.MOVE_BOT_USER_AGENT || process.env.BOT_USER_AGENT,
        clientId: process.env.MOVE_OAUTH2_CLIENT_ID || process.env.OAUTH2_CLIENT_ID,
        clientSecret: process.env.MOVE_OAUTH2_CLIENT_SECRET || process.env.OAUTH2_CLIENT_SECRET,
        accessToken: process.env.OAUTH2_ACCESS_TOKEN,
    },
    // 通用OAuth2配置（供其他脚本使用）
    oauth2: {
        clientId: process.env.OAUTH2_CLIENT_ID,
        clientSecret: process.env.OAUTH2_CLIENT_SECRET,
        accessToken: process.env.OAUTH2_ACCESS_TOKEN
    },
    // Customize rate limits
    requestOptions: {
        retry: {
            limit: 3,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            statusCodes: [408, 413, 429, 500, 502, 503, 504],
        }
    }
};