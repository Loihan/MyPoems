/**
 * 生成 js/seed-data.js
 * 读取 poems/*.json 与 ignore_words.json，打包为一个 JS 全局变量，
 * 供移动端首次启动时灌入可写目录（不覆盖已有文件）。
 *
 * 用法：node scripts/make-seed.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POEMS_DIR = path.join(ROOT, 'poems');
const IGNORE_FILE = path.join(ROOT, 'ignore_words.json');
const OUT_FILE = path.join(ROOT, 'js', 'seed-data.js');

const poems = {};
if (fs.existsSync(POEMS_DIR)) {
    const files = fs.readdirSync(POEMS_DIR).filter(f => f.endsWith('.json'));
    for (const f of files) {
        try {
            poems[f] = JSON.parse(fs.readFileSync(path.join(POEMS_DIR, f), 'utf8'));
        } catch (e) {
            console.warn(`跳过无法解析的文件: ${f}`);
        }
    }
}

let ignoreWords = [];
if (fs.existsSync(IGNORE_FILE)) {
    try {
        ignoreWords = JSON.parse(fs.readFileSync(IGNORE_FILE, 'utf8'));
    } catch (e) {
        console.warn('ignore_words.json 解析失败，使用空数组');
    }
}

const seed = { poems, ignoreWords };
const content =
    '/* 本文件由 scripts/make-seed.js 自动生成，请勿手改 */\n' +
    'window.__MYPOEMS_SEED__ = ' + JSON.stringify(seed) + ';\n';

fs.writeFileSync(OUT_FILE, content, 'utf8');
console.log(`已生成 ${OUT_FILE}（${Object.keys(poems).length} 首诗，${ignoreWords.length} 个屏蔽词）`);
