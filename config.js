require('dotenv').config();

module.exports = {
    apiUrl: process.env.API_URL || 'https://www.qiuwenbaike.cn/api.php',
    userAgent: process.env.BOT_USER_AGENT || '2026SpringFestivalEditathonBot/1.1 (Node.js/mwn; +https://www.qiuwenbaike.cn/User:Bot)',
    apiDelayMs: parseInt(process.env.API_DELAY_MS, 10) || 2000,
    // OAuth 2.0 Credentials
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
