# 2026年春节编辑松机器人 (2026 Spring Festival Editathon Bot)

这是一个自动化机器人，用于统计参与者在 2026 年春节编辑松中的贡献，并自动更新排行榜。

## 功能

1.  **自动统计**：扫描用户贡献页，统计通过的条目数及积分。
2.  **更新提示板**：更新用户个人贡献页顶部的 `{{mbox}}` 状态。
3.  **排行榜管理**：自动区分“熟练编者”与“新星编者”，并更新总排行榜。

## 运行环境

*   Node.js 18+
*   MediaWiki OAuth 2.0 权限

## 安装与配置

1.  安装依赖：
    ```bash
    pnpm install
    ```

2.  配置环境变量：
    复制 `.env.example` 为 `.env` 并填写配置：
    ```bash
    cp .env.example .env
    ```
    *   `OAUTH2_CLIENT_ID`: OAuth 2.0 客户端 ID
    *   `OAUTH2_CLIENT_SECRET`: OAuth 2.0 客户端密钥

## 运行

### 本地运行
```bash
node bot.js
```

### GitHub Actions
本项目包含自动工作流 `.github/workflows/bot-run.yml`，请在 GitHub 仓库的 Secrets 中配置对应的环境变量即可自动定时运行。
