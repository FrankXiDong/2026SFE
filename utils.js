function parseContributionPage(wikitext) {
    return parseContributionPageWithDetails(wikitext);
}

/**
 * 解析用户的贡献页面 Wikitext 代码，返回详细信息
 * 包括每个项目的原始行、状态、分数和位置
 * 现在返回完整表格行的信息，包括条目名称
 */
function parseContributionPageWithDetails(wikitext) {
    const items = [];
    let entryCount = 0;
    let totalScore = 0;

    // 预处理：移除所有注释（包括多行注释），防止注释中的模板被误统计
    // 使用 [\s\S] 匹配包括换行符在内的所有字符，处理跨行注释
    const cleanedWikitext = wikitext.replace(/<!--[\s\S]*?-->/g, '');

    // 先合并分为多行的表格行，再合并为一行
    const lines = cleanedWikitext.replace(/\\n\|(?!-)/g, '||').replace(/\n\|(?!-)/g, '||').replaceAll('|-|', '|-\n').split('\n');
    let inTable = false;
    let currentLineNumber = 0;
    
    for (const [idx, line] of lines.entries()) {
        // 检测表格开始
        if (line.trim().startsWith('{|')) {
            inTable = true;
            currentLineNumber++;
            continue;
        }
        // 检测表格结束
        if (line.trim().startsWith('|}')) {
            inTable = false;
            currentLineNumber++;
            continue;
        }
        
        if (inTable) {
            // 过滤：排除导入综述行（通常包含 Special:日志 和 type=import）
            if (line.includes('type=import') && (line.includes('Special:日志') || line.includes('Special:Log'))) {
                currentLineNumber++;
                continue;
            }

            // 查找条目名称（通常是表格行的第一列，即 | 符号后的文本）
            let entryName = '';
            const pipeSplit = line.split('|');
            if (pipeSplit.length >= 2) {
                // 第一个分割项可能是空的（如果行以 | 开头），所以取第二个
                entryName = pipeSplit[1] ? pipeSplit[1].trim() : '';
                // 清理可能的标记如 '!' 或其他内容
                if (entryName.startsWith('!')) {
                    entryName = entryName.substring(1).trim();
                }
            }

            // 使用正则查找状态模板，同时记录在行中的位置
            // 模板格式: {{2026SFEditasonStatus|状态|分数(可选)}}
            // 例如: {{2026SFEditasonStatus|pass|5}} 或 {{2026SFEditasonStatus|pass|11.3}}
            const statusRegex = /\{\{2026SFEditasonStatus\|(.*?)(\|([\d.]+))?\}\}/g;
            let match;
            let lineCopy = line; // 复制行内容用于查找匹配位置
            let lastIndex = 0;
            let templateIndex = 0; // 记录当前行中模板的索引
            
            while ((match = statusRegex.exec(lineCopy)) !== null) {
                // 每发现一个状态模板，视为一行有效条目
                entryCount++;
                
                const originalMatch = match[0]; // 完整匹配的模板
                const status = match[1] || ''; // 状态参数
                const score = match[3] || ''; // 分数参数（如果有）
                
                // 计算模板在全文中的绝对位置
                const absolutePosition = cleanedWikitext.indexOf(originalMatch, line.indexOf(originalMatch, lastIndex));
                lastIndex = line.indexOf(originalMatch, lastIndex) + originalMatch.length;
                
                // 如果有分数，累加到总分
                if (score) {
                    const scoreValue = parseFloat(score);
                    // 确保分数是有效数字
                    if (!isNaN(scoreValue)) {
                        totalScore += scoreValue;
                    }
                }
                
                // 添加项目到列表，包含条目名称和行号
                items.push({
                    originalLine: line.trim(),
                    entryName: entryName, // 条目名称
                    status: status,
                    score: score,
                    absolutePosition: absolutePosition,  // 在整个文档中的绝对位置
                    relativePosition: line.indexOf(originalMatch), // 在行内的相对位置
                    lineNumber: idx, // 行号
                    originalTemplate: originalMatch, // 完整的原始模板字符串
                    templateIndex: templateIndex++ // 当前行中模板的索引
                });
            }
        }
        currentLineNumber++;
    }

    return { entryCount, totalScore, items };
}

/**
 * Updates the page content with updated templates
 * 使用更精确的替换方法，基于行号和模板索引，确保模板替换准确无误
 */
function updatePageContentWithTemplates(originalWikitext, updatedItems) {
    const lines = originalWikitext.replace(/\n\|(?!-)/g, '||').replace(/\n\|(?!-)/g, '||').replaceAll('|-|', '|-\n').split('\n').map(line => line.replaceAll('||}','\n|}'));
    const processedLines = [...lines]; // 创建行的副本以进行修改

    const itemsByLine = {};
    updatedItems.forEach(item => {
        if (!itemsByLine[item.lineNumber]) {
            itemsByLine[item.lineNumber] = [];
        }
        itemsByLine[item.lineNumber].push(item);
    });

    for (const [lineNumStr, lineItems] of Object.entries(itemsByLine)) {
        const lineNum = parseInt(lineNumStr);
        if (lineNum < processedLines.length) {
            let currentLine = processedLines[lineNum];

            lineItems.sort((a, b) => (a.templateIndex || 0) - (b.templateIndex || 0));

            for (const item of lineItems) {
                let newTemplate = `{{2026SFEditasonStatus|${item.newStatus}`;
                if (item.newScore !== undefined) { // 添加分数
                    newTemplate += `|${item.newScore}`;
                }
                newTemplate += '}}';

                if (item.newRemark) { // 添加备注
                    const originalTemplate = item.originalTemplate || `{{2026SFEditasonStatus|${item.status}${item.score ? `|${item.score}` : ''}}}`;
                    const pos = currentLine.indexOf(originalTemplate);

                    if (pos !== -1) {
                        const afterTemplate = currentLine.substring(pos + originalTemplate.length);
                        const remarkPattern = /<br\s*\/?>\s*<small>(.*?)<\/small>/;
                        const match = afterTemplate.match(remarkPattern);

                        if (!match) {
                            newTemplate += `<br/><small>（${item.newRemark}）</small>`;
                        }
                    }
                }

                const originalTemplate = item.originalTemplate || `{{2026SFEditasonStatus|${item.status}${item.score ? `|${item.score}` : ''}}}`; // 若无原始模板，则构造一个
                const pos = currentLine.indexOf(originalTemplate); // 使用原始模板进行查找
                if (pos !== -1) {
                    currentLine = currentLine.substring(0, pos) + newTemplate + currentLine.substring(pos + originalTemplate.length);
                }
            }

            processedLines[lineNum] = currentLine;
        }
    }
    return processedLines.join('\n');
}

/**
 * Updates the mbox in the user page wikitext.
 */
function updateUserPageContent(wikitext, count, score) {
    // Target: {{mbox|type=policy|text={{center|已提交条目数：'''0'''目前得分：'''0'''}}}}
    // Regex allows specific flexible whitespace and decimal numbers
    const mboxRegex = /(\{\{mbox\|type=policy\|text=\{\{center\|已提交条目数：''')(\d+)('''\s*目前得分：''')([\d.]+)('''\}\}\}\})/i;
    
    if (mboxRegex.test(wikitext)) {
        return wikitext.replace(mboxRegex, `$1${count}$3${score}$5`);
    } else {
        return wikitext; 
    }
}

/**
 * Checks if a user is a "Veteran" (50+ edits before 2026-02-01).
 * This requires an API call, so it will be in the main bot.
 */

/**
 * Format score to 4 decimal places
 * @param {number} score - The score to format
 * @returns {number} Score rounded to 4 decimal places
 */
function formatScore(score) {
    return Math.round(score * 10000) / 10000;
}

module.exports = {
    parseContributionPage,
    parseContributionPageWithDetails,
    updatePageContentWithTemplates,
    updateUserPageContent,
    formatScore
};