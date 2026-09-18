/**
 * ===================================================================
 * 正文段落缩进「归零」脚本  (scripts/normalize-poem-text.js)
 * ===================================================================
 * 背景：早期录入时，为了做出首行缩进，正文段落前手打了若干半角空格
 *      （多为 8 个），行尾也常有零星空格。这些空格属于「排版」而非
 *      「内容」，会在竖排显示、复制全文、随机精句等处露出马脚。
 *
 * 本脚本把这些空白从数据里清除，缩进改由前端按需自动生成：
 *   横排 + 左对齐（长词、文言文、现代文、随笔）→ 每段自动缩进两字
 *   竖排 / 居中短篇                              → 不缩进
 *
 * 处理范围：content / preface / notes 三个字段的每一行
 *   · 去掉行首空白（半角空格、制表符、全角空格、不换行空格）
 *   · 去掉行尾空白（竖排下会变成多余的留白）
 *   · 统一换行符为 \n
 *   · 其余内容、键顺序、缩进风格、文件名一律不动
 *
 * 用法：
 *   node scripts/normalize-poem-text.js           # 预演，只报告不改动
 *   node scripts/normalize-poem-text.js --write   # 真正写入
 * ===================================================================
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const POEMS_DIR = path.join(ROOT, 'poems');
const FIELDS = ['content', 'preface', 'notes'];
const WRITE = process.argv.includes('--write');

const LEAD_RE = /^[ \t\u3000\u00a0]+/;
const TRAIL_RE = /[ \t\u3000\u00a0]+$/;

function cleanField(value) {
    if (typeof value !== 'string' || value === '') {
        return { value, leadLines: 0, trailLines: 0, crlf: 0, maxLead: 0, blanked: 0 };
    }

    let leadLines = 0, trailLines = 0, maxLead = 0, blanked = 0;
    const crlf = (value.match(/\r\n/g) || []).length;

    const lines = value.replace(/\r\n?/g, '\n').split('\n').map(line => {
        const leadMatch = line.match(LEAD_RE);
        if (leadMatch) {
            leadLines++;
            maxLead = Math.max(maxLead, leadMatch[0].length);
        }
        let out = line.replace(LEAD_RE, '');
        if (out !== line && out.trim() === '' && line.trim() === '') blanked++; // 整行只有空白 → 变成空行
        const trimmed = out.replace(TRAIL_RE, '');
        if (trimmed !== out) trailLines++;
        return trimmed;
    });

    return { value: lines.join('\n'), leadLines, trailLines, crlf, maxLead, blanked };
}

function detectIndent(raw) {
    const m = raw.match(/^\{\r?\n(\s+)"/);
    return m ? m[1] : '    ';
}

const report = {
    files: 0,
    changedFiles: 0,
    leadLines: 0,
    trailLines: 0,
    crlfFiles: 0,
    blankedLines: 0,
    maxLead: 0,
    details: []
};

const files = fs.readdirSync(POEMS_DIR).filter(f => f.endsWith('.json')).sort();

for (const file of files) {
    report.files++;
    const full = path.join(POEMS_DIR, file);
    const raw = fs.readFileSync(full, 'utf8');
    const hadTrailingNewline = /\n$/.test(raw);
    const indent = detectIndent(raw);

    let poem;
    try { poem = JSON.parse(raw); } catch (e) { console.warn('跳过无法解析:', file, e.message); continue; }

    const detail = { file, fields: [] };
    let fileChanged = false;

    for (const field of FIELDS) {
        if (!(field in poem)) continue;
        const res = cleanField(poem[field]);
        if (res.value !== poem[field]) {
            fileChanged = true;
            detail.fields.push(`${field}: 行首${res.leadLines}行/行尾${res.trailLines}行`);
            report.leadLines += res.leadLines;
            report.trailLines += res.trailLines;
            report.blankedLines += res.blanked;
            report.maxLead = Math.max(report.maxLead, res.maxLead);
            poem[field] = res.value;
        }
        if (res.crlf) { report.crlfFiles++; fileChanged = true; }
    }

    if (fileChanged) {
        report.changedFiles++;
        report.details.push(detail);
        if (WRITE) {
            const out = JSON.stringify(poem, null, indent) + (hadTrailingNewline ? '\n' : '');
            fs.writeFileSync(full, out, 'utf8');
        }
    }
}

console.log('==============================================');
console.log(WRITE ? '模式：写入（--write）' : '模式：预演（不会改动任何文件）');
console.log('==============================================');
console.log(`扫描文件        : ${report.files}`);
console.log(`需要改动        : ${report.changedFiles}`);
console.log(`去掉行首空白的行: ${report.leadLines}`);
console.log(`去掉行尾空白的行: ${report.trailLines}`);
console.log(`最长的一次缩进  : ${report.maxLead} 个空白字符`);
console.log(`整行空白→空行   : ${report.blankedLines}`);
console.log(`含 CRLF 的文件  : ${report.crlfFiles}`);
console.log('----------------------------------------------');
report.details.slice(0, 15).forEach(d => console.log(`  ${d.file}  [${d.fields.join(' | ')}]`));
if (report.details.length > 15) console.log(`  … 另有 ${report.details.length - 15} 个文件`);
console.log('==============================================');
if (!WRITE) console.log('确认无误后请加 --write 执行写入。');
