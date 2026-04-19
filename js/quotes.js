/**
 * ===================================================================
 * MyPoems - 精句集逻辑脚本 (quotes.js) - 瀑布流增强版
 * ===================================================================
 */

(function() {
    const container = document.getElementById('quotes-masonry-container');
    const refreshBtn = document.getElementById('refresh-quotes-btn');
    let allQuotes = []; 

    async function initialize() {
        await loadAllQuotes();
        displayRandomQuotes();
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                // 添加按钮旋转动画
                const icon = refreshBtn.querySelector('svg');
                if(icon) {
                    icon.style.transition = 'transform 0.5s ease';
                    icon.style.transform = `rotate(${Math.random() * 360 + 360}deg)`;
                }
                displayRandomQuotes();
            });
        }
    }

    async function loadAllQuotes() {
        try {
            const response = await fetch('/api/poems');
            if (!response.ok) throw new Error();
            const poemFiles = await response.json();

            // 并发加载所有作品
            const poems = await Promise.all(
                poemFiles.map(async filename => {
                    const res = await fetch(`/api/poems/${filename}`);
                    return { ...(await res.json()), filename }; // 保留 filename 用于跳转
                })
            );

            allQuotes = [];
            poems.forEach(poem => {
                if (poem.quotes && Array.isArray(poem.quotes)) {
                    poem.quotes.forEach(quote => {
                        allQuotes.push({
                            quote: quote,
                            author: poem.title,
                            filename: poem.filename // 绑定文件名
                        });
                    });
                }
            });

        } catch (error) {
            if (container) container.innerHTML = '<p style="text-align:center;color:#888;">暂无精句或加载失败。</p>';
        }
    }

    function displayRandomQuotes() {
        if (!container) return;

        if (allQuotes.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="column-span: all; text-align: center; padding: 40px;">
                    <h3>书斋清冷</h3>
                    <p>暂无摘录。请前往“添加新篇”或“作品管理”<br>记录您心爱的诗句。</p>
                </div>`;
            if (refreshBtn) refreshBtn.style.display = 'none';
            return;
        }

        if (refreshBtn) refreshBtn.style.display = 'flex';

        // Fisher-Yates 洗牌
        const shuffled = [...allQuotes];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        // 随机取 8-12 个，数量随机让瀑布流看起来更自然
        const count = Math.floor(Math.random() * 5) + 8; 
        const selectedQuotes = shuffled.slice(0, count);

        // 生成 HTML
        container.innerHTML = selectedQuotes.map((item, index) => `
            <div class="masonry-card" style="animation-delay: ${index * 0.05}s">
                <div class="masonry-actions">
                    <button class="action-btn copy-btn" data-text="${item.quote}" title="复制">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                </div>
                <div class="masonry-quote-content" data-filename="${item.filename}">
                    ${item.quote}
                </div>
                <div class="masonry-quote-author">
                    —— 《${item.author}》
                </div>
            </div>
        `).join('');

        // 绑定事件（跳转与复制）
        bindCardEvents();
    }

    function bindCardEvents() {
        // 1. 点击正文跳转
        const contents = container.querySelectorAll('.masonry-quote-content');
        contents.forEach(el => {
            el.addEventListener('click', () => {
                const filename = el.dataset.filename;
                if (window.App && window.App.openPoemByFilename) {
                    window.App.openPoemByFilename(filename);
                }
            });
        });

        // 2. 点击复制
        const copyBtns = container.querySelectorAll('.copy-btn');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止触发跳转
                const text = btn.dataset.text;
                navigator.clipboard.writeText(text).then(() => {
                    // 临时的视觉反馈
                    const originalIcon = btn.innerHTML;
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    setTimeout(() => {
                        btn.innerHTML = originalIcon;
                    }, 1500);
                    if(window.showNotification) showNotification('已复制到剪贴板', 'success');
                }).catch(() => {
                    if(window.showNotification) showNotification('复制失败', 'error');
                });
            });
        });
    }

    initialize();
})();