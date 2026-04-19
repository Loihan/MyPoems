/**
 * ===================================================================
 * MyPoems - 后端服务 (server.js) - 全功能最终版
 * 包含：基础API、精句管理、索引批量修改(Batch Update)
 * ===================================================================
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 路径定义
const poemsDirectory = path.join(__dirname, 'poems');

// --- 中间件 ---
app.use(cors());
app.use(express.json()); // 必须有这一行，用于解析 POST 请求的 JSON Body
app.use(express.static(__dirname)); // 托管静态文件

// --- 启动检查 ---
if (!fs.existsSync(poemsDirectory)) {
    console.log(`"poems" 文件夹不存在，正在创建...`);
    fs.mkdirSync(poemsDirectory);
}

// --- 辅助函数 ---
function processTags(tagsStr) {
    if (!tagsStr) return [];
    if (Array.isArray(tagsStr)) return tagsStr; // 如果已经是数组，直接返回
    if (typeof tagsStr !== 'string') return [];
    const tags = tagsStr.split(/[,，\s]+/).map(tag => tag.trim()).filter(Boolean);
    return [...new Set(tags)];
}

// ================= API 路由 =================

// 1. 获取所有标签 (用于标签云)
app.get('/api/tags', async (req, res) => {
    try {
        const files = await fs.promises.readdir(poemsDirectory);
        const jsonFiles = files.filter(file => path.extname(file) === '.json');
        
        const allTags = new Set();

        await Promise.all(jsonFiles.map(async file => {
            const filePath = path.join(poemsDirectory, file);
            try {
                const content = await fs.promises.readFile(filePath, 'utf8');
                const poem = JSON.parse(content);
                if (poem.tags && Array.isArray(poem.tags)) {
                    poem.tags.forEach(tag => allTags.add(tag));
                }
            } catch (e) { } // 忽略损坏文件
        }));
        
        res.json(Array.from(allTags).sort());
    } catch (error) {
        console.error('获取标签出错:', error);
        res.status(500).send('无法获取标签列表');
    }
});

// 2. 批量更新标签 (索引管理核心功能)
app.post('/api/tags/batch', async (req, res) => {
    const { oldTag, newTag } = req.body;
    console.log(`收到标签更新请求: 将 "${oldTag}" 修改为 "${newTag}"`); // 添加日志

    if (!oldTag) {
        return res.status(400).send('必须提供原标签名');
    }

    try {
        const files = await fs.promises.readdir(poemsDirectory);
        const jsonFiles = files.filter(file => path.extname(file) === '.json');
        
        let modifiedCount = 0;

        await Promise.all(jsonFiles.map(async file => {
            const filePath = path.join(poemsDirectory, file);
            const content = await fs.promises.readFile(filePath, 'utf8');
            let poem;
            try {
                poem = JSON.parse(content);
            } catch (e) { return; } 

            // 检查该作品是否包含旧标签
            if (poem.tags && Array.isArray(poem.tags) && poem.tags.includes(oldTag)) {
                // A. 移除旧标签
                poem.tags = poem.tags.filter(t => t !== oldTag);
                
                // B. 如果有新标签 (重命名/合并)，则添加
                if (newTag && newTag.trim() !== '') {
                    // 只有当新标签不存在时才添加 (避免重复)
                    if (!poem.tags.includes(newTag)) {
                        poem.tags.push(newTag);
                    }
                }
                // (如果 newTag 为 null/空字符串，则仅仅是删除逻辑，上面 A 步已完成)

                await fs.promises.writeFile(filePath, JSON.stringify(poem, null, 4));
                modifiedCount++;
            }
        }));

        console.log(`标签更新完成，共修改了 ${modifiedCount} 个文件`);
        res.json({ message: '操作成功', modifiedCount });
    } catch (error) {
        console.error('批量更新标签出错:', error);
        res.status(500).send('服务器内部错误');
    }
});
// === 新增：批量给多个文件添加标签 ===
app.post('/api/tags/add-batch', async (req, res) => {
    const { filenames, tag } = req.body;
    if (!filenames || !Array.isArray(filenames) || !tag || tag.trim() === '') {
        return res.status(400).send('参数无效');
    }

    const cleanTag = tag.trim();
    let modifiedCount = 0;

    try {
        await Promise.all(filenames.map(async filename => {
            const filePath = path.join(poemsDirectory, filename);
            try {
                const content = await fs.promises.readFile(filePath, 'utf8');
                const poem = JSON.parse(content);
                
                if (!poem.tags) poem.tags = [];
                // 只有当标签不存在时才添加
                if (!poem.tags.includes(cleanTag)) {
                    poem.tags.push(cleanTag);
                    await fs.promises.writeFile(filePath, JSON.stringify(poem, null, 4));
                    modifiedCount++;
                }
            } catch (e) { /* 忽略单个文件错误 */ }
        }));
        res.json({ message: '批量添加成功', modifiedCount });
    } catch (error) {
        res.status(500).send('服务器错误');
    }
});

// === 新增：从单个作品中移除指定标签 ===
app.post('/api/tags/remove-one', async (req, res) => {
    const { filename, tag } = req.body;
    if (!filename || !tag) return res.status(400).send('缺少参数');

    const filePath = path.join(poemsDirectory, filename);
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        const poem = JSON.parse(content);
        
        if (poem.tags && poem.tags.includes(tag)) {
            poem.tags = poem.tags.filter(t => t !== tag);
            await fs.promises.writeFile(filePath, JSON.stringify(poem, null, 4));
            res.json({ message: '标签已移除' });
        } else {
            res.json({ message: '未找到标签' });
        }
    } catch (error) {
        res.status(500).send('操作失败');
    }
});

// 3. 获取所有作品列表
app.get('/api/poems', (req, res) => {
    fs.readdir(poemsDirectory, (err, files) => {
        if (err) return res.status(500).send('无法读取文件夹');
        const jsonFiles = files.filter(file => path.extname(file) === '.json');
        res.json(jsonFiles);
    });
});

// 4. 获取单个作品
app.get('/api/poems/:filename', (req, res) => {
    const filePath = path.join(poemsDirectory, req.params.filename);
    res.sendFile(filePath, (err) => {
        if (err) res.status(404).send('未找到文件');
    });
});

// 5. 创建新作品
app.post('/api/poems', (req, res) => {
    try {
        const poemData = req.body;
        if (!poemData.title) return res.status(400).send('标题必填');
        
        poemData.tags = processTags(poemData.tags);
        
        // 文件名处理：去除非法字符
        const filename = `${poemData.title.replace(/[\\?%*:|"<>]/g, '')}.json`;
        const filePath = path.join(poemsDirectory, filename);
        
        fs.writeFile(filePath, JSON.stringify(poemData, null, 4), (err) => {
            if (err) return res.status(500).send('保存失败');
            res.status(201).send({ message: '创建成功', filename });
        });
    } catch (e) {
        res.status(500).send('服务器错误');
    }
});

// 6. 更新作品
app.put('/api/poems/:filename', (req, res) => {
    const filePath = path.join(poemsDirectory, req.params.filename);
    const updatedData = req.body;
    updatedData.tags = processTags(updatedData.tags);
    
    if (!fs.existsSync(filePath)) return res.status(404).send('文件不存在');
    
    fs.writeFile(filePath, JSON.stringify(updatedData, null, 4), (err) => {
        if (err) return res.status(500).send('更新失败');
        res.status(200).send({ message: '更新成功' });
    });
});

// 7. 删除作品
app.delete('/api/poems/:filename', (req, res) => {
    const filePath = path.join(poemsDirectory, req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(200).send({ message: '文件已不存在' });
    
    fs.unlink(filePath, (err) => {
        if (err) return res.status(500).send('删除失败');
        res.status(200).send({ message: '删除成功' });
    });
});

// 8. 随机精句 (用于侧边栏)
app.get('/api/random-quote', async (req, res) => {
    try {
        const files = await fs.promises.readdir(poemsDirectory);
        const jsonFiles = files.filter(file => path.extname(file) === '.json');
        if (jsonFiles.length === 0) return res.json({ quote: '书斋尚待挥毫处', author: '您' });

        let allLines = [];
        await Promise.all(jsonFiles.map(async file => {
            const filePath = path.join(poemsDirectory, file);
            try {
                const content = await fs.promises.readFile(filePath, 'utf8');
                const poem = JSON.parse(content);
                // 优先使用 quotes 字段
                if (poem.quotes && Array.isArray(poem.quotes) && poem.quotes.length > 0) {
                    poem.quotes.forEach(q => allLines.push({ quote: q, author: poem.title, filename: file }));
                } else if (poem.content) {
                    // 降级：从正文中随机抽取短句
                    const lines = poem.content.split(/[\n，。！？]/).map(l => l.trim()).filter(l => l.length > 4);
                    lines.forEach(l => allLines.push({ quote: l, author: poem.title, filename: file }));
                }
            } catch (e) {}
        }));

        if (allLines.length === 0) return res.json({ quote: '笔落似有神', author: '您' });
        const randomItem = allLines[Math.floor(Math.random() * allLines.length)];
        res.json(randomItem);
    } catch (e) {
        res.status(500).send('API Error');
    }
});

// === 新增：屏蔽词管理 (Imagery Ignore List) ===
const ignoreFile = path.join(__dirname, 'ignore_words.json');

// 获取屏蔽词
app.get('/api/imagery/ignore', (req, res) => {
    if (!fs.existsSync(ignoreFile)) {
        // 默认屏蔽一些常见虚词和标点
        const defaults = ["之", "乎", "者", "也", "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一", "一个", "上", "下"];
        fs.writeFileSync(ignoreFile, JSON.stringify(defaults));
        return res.json(defaults);
    }
    fs.readFile(ignoreFile, 'utf8', (err, data) => {
        if (err) return res.json([]);
        try { res.json(JSON.parse(data)); } catch (e) { res.json([]); }
    });
});

// 更新屏蔽词
app.post('/api/imagery/ignore', (req, res) => {
    const list = req.body;
    if (!Array.isArray(list)) return res.status(400).send('格式错误');
    fs.writeFile(ignoreFile, JSON.stringify(list), (err) => {
        if (err) return res.status(500).send('保存失败');
        res.json({ message: '屏蔽词已更新' });
    });
});

// --- 启动服务器 ---
app.listen(PORT, () => {
    console.log(`>>> 服务已启动 http://localhost:${PORT}`);
    console.log(`>>> 正在监视: ${poemsDirectory}`);
});