/**
 * ===================================================================
 * MyPoems - 移动端数据层 (js/db-mock.js)
 * ===================================================================
 * 双模数据层：
 *  - 手机上（Capacitor 原生环境）：拦截 fetch('/api/...')，改用
 *    @capacitor/filesystem 原生插件读写 JSON 文件，保持「每首诗一个
 *    .json 文件」的数据形态不变，存于公开可同步目录。
 *  - 电脑上（Electron / 浏览器，无 Capacitor）：立即返回、什么都不做，
 *    继续走原来的 Express 服务（server.js），桌面端功能完全不变。
 * ===================================================================
 */

(function () {
    // 仅当运行在 Capacitor 原生环境（安卓 App 内）时才接管 API
    const isNative = window.Capacitor
        && typeof window.Capacitor.isNativePlatform === 'function'
        && window.Capacitor.isNativePlatform();

    if (!isNative) {
        return; // 桌面/浏览器：保持原样
    }

    /* ------------------------------------------------------------
     * 配置：存储位置
     * directory 取值：'DOCUMENTS'（公开 Documents 目录，可同步）
     *  备选：'EXTERNAL_STORAGE'（App 专属外置目录）、'EXTERNAL'
     * ------------------------------------------------------------ */
    const DIR = 'DOCUMENTS';
    const ROOT = 'MyPoems';          // Documents 下的根目录名
    const POEMS_DIR = ROOT + '/poems';
    const IGNORE_FILE = ROOT + '/ignore_words.json';

    /* ------------------------------------------------------------
     * 底层：调用 Capacitor Filesystem 原生插件
     * （直接用核心桥 nativePromise 调原生方法，无需打包插件 JS）
     * ------------------------------------------------------------ */
    function fs(method, options) {
        return window.Capacitor.nativePromise('Filesystem', method, options);
    }

    async function ensureDirs() {
        try { await fs('mkdir', { path: ROOT, directory: DIR, recursive: true }); } catch (e) {}
        try { await fs('mkdir', { path: POEMS_DIR, directory: DIR, recursive: true }); } catch (e) {}
    }

    async function fileExists(path) {
        try { await fs('stat', { path, directory: DIR }); return true; } catch (e) { return false; }
    }

    async function readText(path) {
        const res = await fs('readFile', { path, directory: DIR, encoding: 'utf8' });
        return res && typeof res.data === 'string' ? res.data : '';
    }

    async function writeText(path, content) {
        await fs('writeFile', { path, directory: DIR, data: content, encoding: 'utf8', recursive: true });
    }

    async function removeFile(path) {
        await fs('deleteFile', { path, directory: DIR });
    }

    /* ------------------------------------------------------------
     * 工具函数（与 server.js 保持一致）
     * ------------------------------------------------------------ */
    function processTags(tagsStr) {
        if (!tagsStr) return [];
        if (Array.isArray(tagsStr)) return tagsStr;
        if (typeof tagsStr !== 'string') return [];
        const tags = tagsStr.split(/[,，\s]+/).map(t => t.trim()).filter(Boolean);
        return [...new Set(tags)];
    }

    function sanitizeFilename(title) {
        return `${title.replace(/[\\?%*:|"<>]/g, '')}.json`;
    }

    function json(data, status) {
        return new Response(JSON.stringify(data), {
            status: status || 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    function text(data, status) {
        return new Response(data, { status: status || 200 });
    }

    /* ------------------------------------------------------------
     * 文件级 CRUD
     * ------------------------------------------------------------ */
    async function listPoemFiles() {
        try {
            const res = await fs('readdir', { path: POEMS_DIR, directory: DIR });
            const files = (res && res.files) || [];
            return files
                .filter(f => f.type !== 'directory' && f.name.endsWith('.json'))
                .map(f => f.name);
        } catch (e) {
            return [];
        }
    }

    async function readPoem(filename) {
        const raw = await readText(POEMS_DIR + '/' + filename);
        return JSON.parse(raw);
    }

    async function writePoem(filename, poem) {
        await writeText(POEMS_DIR + '/' + filename, JSON.stringify(poem, null, 4));
    }

    /* ------------------------------------------------------------
     * 首次启动：把打包内置的诗词 JSON 灌入可写目录
     * 只写「不存在的文件」，绝不覆盖（保证重装/升级/同步不丢数据）。
     * ------------------------------------------------------------ */
    async function seedIfNeeded() {
        try {
            await ensureDirs();
            const seed = window.__MYPOEMS_SEED__;
            if (!seed) return;

            const existing = await listPoemFiles();
            if (existing.length === 0 && seed.poems) {
                for (const name of Object.keys(seed.poems)) {
                    await writePoem(name, seed.poems[name]);
                }
            }

            if (seed.ignoreWords && !(await fileExists(IGNORE_FILE))) {
                await writeText(IGNORE_FILE, JSON.stringify(seed.ignoreWords));
            }
        } catch (e) {
            // 播种失败不阻断应用；后续 CRUD 仍会尝试建目录
            console.error('seedIfNeeded 失败:', e);
        }
    }

    /* ------------------------------------------------------------
     * API 处理器（与 server.js 逐一对齐）
     * ------------------------------------------------------------ */
    async function apiListPoems() {
        await ensureDirs();
        return json(await listPoemFiles());
    }

    async function apiGetPoem(filename) {
        try {
            const poem = await readPoem(filename);
            return json(poem);
        } catch (e) {
            return text('未找到文件', 404);
        }
    }

    async function apiCreatePoem(body) {
        const poemData = body || {};
        if (!poemData.title) return text('标题必填', 400);
        poemData.tags = processTags(poemData.tags);
        const filename = sanitizeFilename(poemData.title);
        await ensureDirs();
        await writePoem(filename, poemData);
        return json({ message: '创建成功', filename }, 201);
    }

    async function apiUpdatePoem(filename, body) {
        const updatedData = body || {};
        updatedData.tags = processTags(updatedData.tags);
        if (!(await fileExists(POEMS_DIR + '/' + filename))) {
            return text('文件不存在', 404);
        }
        await writePoem(filename, updatedData);
        return json({ message: '更新成功' });
    }

    async function apiDeletePoem(filename) {
        if (!(await fileExists(POEMS_DIR + '/' + filename))) {
            return json({ message: '文件已不存在' });
        }
        await removeFile(POEMS_DIR + '/' + filename);
        return json({ message: '删除成功' });
    }

    async function apiListTags() {
        const files = await listPoemFiles();
        const allTags = new Set();
        for (const file of files) {
            try {
                const poem = await readPoem(file);
                if (poem.tags && Array.isArray(poem.tags)) {
                    poem.tags.forEach(t => allTags.add(t));
                }
            } catch (e) {}
        }
        return json(Array.from(allTags).sort());
    }

    async function apiBatchTag(body) {
        const { oldTag, newTag } = (body || {});
        if (!oldTag) return text('必须提供原标签名', 400);
        const files = await listPoemFiles();
        let modifiedCount = 0;
        for (const file of files) {
            try {
                const poem = await readPoem(file);
                if (poem.tags && Array.isArray(poem.tags) && poem.tags.includes(oldTag)) {
                    poem.tags = poem.tags.filter(t => t !== oldTag);
                    if (newTag && newTag.trim() !== '') {
                        if (!poem.tags.includes(newTag)) poem.tags.push(newTag);
                    }
                    await writePoem(file, poem);
                    modifiedCount++;
                }
            } catch (e) {}
        }
        return json({ message: '操作成功', modifiedCount });
    }

    async function apiAddBatchTag(body) {
        const { filenames, tag } = (body || {});
        if (!filenames || !Array.isArray(filenames) || !tag || tag.trim() === '') {
            return text('参数无效', 400);
        }
        const cleanTag = tag.trim();
        let modifiedCount = 0;
        for (const filename of filenames) {
            try {
                const poem = await readPoem(filename);
                if (!poem.tags) poem.tags = [];
                if (!poem.tags.includes(cleanTag)) {
                    poem.tags.push(cleanTag);
                    await writePoem(filename, poem);
                    modifiedCount++;
                }
            } catch (e) {}
        }
        return json({ message: '批量添加成功', modifiedCount });
    }

    async function apiRemoveOneTag(body) {
        const { filename, tag } = (body || {});
        if (!filename || !tag) return text('缺少参数', 400);
        try {
            const poem = await readPoem(filename);
            if (poem.tags && poem.tags.includes(tag)) {
                poem.tags = poem.tags.filter(t => t !== tag);
                await writePoem(filename, poem);
                return json({ message: '标签已移除' });
            }
            return json({ message: '未找到标签' });
        } catch (e) {
            return text('操作失败', 500);
        }
    }

    async function apiRandomQuote() {
        const files = await listPoemFiles();
        if (files.length === 0) return json({ quote: '书斋尚待挥毫处', author: '您' });

        let allLines = [];
        for (const file of files) {
            try {
                const poem = await readPoem(file);
                if (poem.quotes && Array.isArray(poem.quotes) && poem.quotes.length > 0) {
                    poem.quotes.forEach(q => allLines.push({ quote: q, author: poem.title, filename: file }));
                } else if (poem.content) {
                    const lines = poem.content.split(/[\n，。！？]/).map(l => l.trim()).filter(l => l.length > 4);
                    lines.forEach(l => allLines.push({ quote: l, author: poem.title, filename: file }));
                }
            } catch (e) {}
        }

        if (allLines.length === 0) return json({ quote: '笔落似有神', author: '您' });
        return json(allLines[Math.floor(Math.random() * allLines.length)]);
    }

    async function apiGetIgnoreWords() {
        const defaults = ["之", "乎", "者", "也", "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "下"];
        if (!(await fileExists(IGNORE_FILE))) {
            await writeText(IGNORE_FILE, JSON.stringify(defaults));
            return json(defaults);
        }
        try {
            return json(JSON.parse(await readText(IGNORE_FILE)));
        } catch (e) {
            return json([]);
        }
    }

    async function apiSetIgnoreWords(body) {
        if (!Array.isArray(body)) return text('格式错误', 400);
        await writeText(IGNORE_FILE, JSON.stringify(body));
        return json({ message: '屏蔽词已更新' });
    }

    /* ------------------------------------------------------------
     * 路由与 fetch 拦截
     * ------------------------------------------------------------ */
    const seedPromise = seedIfNeeded();

    function route(path, method, body) {
        const seg = path.split('/').filter(Boolean);

        if (seg[0] === 'poems') {
            if (seg.length === 1) {
                if (method === 'GET') return apiListPoems();
                if (method === 'POST') return apiCreatePoem(body);
            } else if (seg.length === 2) {
                const filename = seg.slice(1).join('/');
                if (method === 'GET') return apiGetPoem(filename);
                if (method === 'PUT') return apiUpdatePoem(filename, body);
                if (method === 'DELETE') return apiDeletePoem(filename);
            }
        } else if (seg[0] === 'tags') {
            if (seg.length === 1 && method === 'GET') return apiListTags();
            if (seg.length === 2 && method === 'POST') {
                if (seg[1] === 'batch') return apiBatchTag(body);
                if (seg[1] === 'add-batch') return apiAddBatchTag(body);
                if (seg[1] === 'remove-one') return apiRemoveOneTag(body);
            }
        } else if (seg[0] === 'random-quote' && method === 'GET') {
            return apiRandomQuote();
        } else if (seg[0] === 'imagery' && seg[1] === 'ignore') {
            if (method === 'GET') return apiGetIgnoreWords();
            if (method === 'POST') return apiSetIgnoreWords(body);
        }

        return text('Not Found', 404);
    }

    function extractApiPath(input) {
        let url = typeof input === 'string' ? input : (input && input.url);
        if (typeof url !== 'string') return null;

        let path = url;
        const qi = path.indexOf('?');
        if (qi >= 0) path = path.substring(0, qi);

        const idx = path.indexOf('/api/');
        if (idx < 0) return null;

        path = path.substring(idx + 4); // 去掉 '/api'
        if (path.startsWith('/')) path = path.substring(1);
        try { path = decodeURIComponent(path); } catch (e) {}
        return path;
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = async function (input, init) {
        const path = extractApiPath(input);
        if (path === null) {
            return originalFetch(input, init);
        }

        const method = ((init && init.method) || 'GET').toUpperCase();
        let body = null;
        if (init && typeof init.body === 'string') {
            try { body = JSON.parse(init.body); } catch (e) { body = init.body; }
        }

        try {
            await seedPromise; // 确保首次播种完成后再响应 API
            return await route(path, method, body);
        } catch (e) {
            console.error('移动端 API 处理出错:', path, e);
            return text('服务器内部错误', 500);
        }
    };
})();
