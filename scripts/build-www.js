/**
 * 组装干净的 www/ 目录，作为 Capacitor 的 webDir。
 * 只包含前端资源（index.html、css/、html/、js/），
 * 排除 node_modules、poems、dist、.git 等。
 *
 * 用法：node scripts/build-www.js   （需先运行 node scripts/make-seed.js）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');

const SEED_FILE = path.join(ROOT, 'js', 'seed-data.js');
if (!fs.existsSync(SEED_FILE)) {
    console.error('缺少 js/seed-data.js，请先运行：node scripts/make-seed.js');
    process.exit(1);
}

// 清空并重建 www
fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

const copy = (src, dest) => {
    if (!fs.existsSync(src)) return;
    fs.cpSync(src, dest, { recursive: true });
};

copy(path.join(ROOT, 'index.html'), path.join(WWW, 'index.html'));
copy(path.join(ROOT, 'css'), path.join(WWW, 'css'));
copy(path.join(ROOT, 'html'), path.join(WWW, 'html'));
copy(path.join(ROOT, 'js'), path.join(WWW, 'js'));

console.log(`已组装 ${WWW}`);
