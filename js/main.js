/**
 * ===================================================================
 * MyPoems - 主逻辑脚本 (js/main.js) - 路径重构 & UI修复版
 * ===================================================================
 */

(function(window) {
    window.App = window.App || {};

    document.addEventListener('DOMContentLoaded', () => {
        
        // --- 深色模式逻辑 ---
        const themeBtn = document.getElementById('theme-toggle-btn');
        const moonIcon = document.getElementById('theme-icon-moon');
        const sunIcon = document.getElementById('theme-icon-sun');
        const body = document.body;
        const savedTheme = localStorage.getItem('mypoems-theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) { enableDarkMode(); }

        function enableDarkMode() {
            body.classList.add('dark-theme');
            if(moonIcon) moonIcon.style.display = 'none';
            if(sunIcon) sunIcon.style.display = 'block';
            localStorage.setItem('mypoems-theme', 'dark');
        }

        function disableDarkMode() {
            body.classList.remove('dark-theme');
            if(moonIcon) moonIcon.style.display = 'block';
            if(sunIcon) sunIcon.style.display = 'none';
            localStorage.setItem('mypoems-theme', 'light');
        }

        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                if (body.classList.contains('dark-theme')) { disableDarkMode(); } else { enableDarkMode(); }
            });
        }

        // --- 页面路由逻辑 (路径已更新) ---
        const contentArea = document.getElementById('content');
        const navLinks = document.querySelectorAll('.sidebar-nav a');

        const loadPage = async (pageName) => {
            try {
                navLinks.forEach(l => l.classList.remove('active'));
                const activeLink = document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`);
                if (activeLink) activeLink.classList.add('active');

                // 【修改】去 html/ 文件夹找
                const htmlResponse = await fetch(`html/${pageName}.html`);
                if (!htmlResponse.ok) throw new Error(`无法加载 html/${pageName}.html`);
                contentArea.innerHTML = await htmlResponse.text();

                // 【修改】去 js/ 文件夹找
                const scriptResponse = await fetch(`js/${pageName}.js`);
                if (scriptResponse.ok) {
                    const scriptText = await scriptResponse.text();
                    new Function(scriptText)();
                }
            } catch (error) {
                console.error('加载页面时出错:', error);
                contentArea.innerHTML = '<p>加载页面出错，请检查文件结构 (html/ 和 js/ 文件夹)。</p>';
            }
        };
        window.App.loadPage = loadPage;

        navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                loadPage(link.getAttribute('data-page'));
            });
        });

        // --- 右侧阅读栏逻辑 ---
        const readingPanel = document.getElementById('reading-panel');
        const panelContentArea = document.getElementById('panel-content-area');
        const closePanelBtn = document.getElementById('close-panel-btn');

        function closePanel() {
            if (readingPanel) readingPanel.classList.remove('open');
        }
        if (closePanelBtn) {
            closePanelBtn.addEventListener('click', closePanel);
        }

        // 渲染作品到右侧栏 (UI 修复逻辑)
        window.App.renderPoemInPanel = function(poem) {
            if (!readingPanel || !panelContentArea) return;

            const safePoem = {
                title: poem.title || '无标题',
                type: poem.type || '未知',
                genre: poem.genre || '',
                creationDate: poem.creationDate,
                preface: poem.preface || '',
                content: poem.content || '',
                notes: poem.notes || '',
                tags: Array.isArray(poem.tags) ? poem.tags : [],
                quotes: Array.isArray(poem.quotes) ? poem.quotes : [] 
            };

            let genreInfo = (safePoem.type === '诗') ? `体裁: ${safePoem.genre}` : (safePoem.type === '词') ? `词牌: ${safePoem.genre}` : '';
            const alignmentClass = getAlignmentClass(safePoem);
            const wordCount = (safePoem.content || '').length + (safePoem.preface || '').length;

            let quotesHTML = '';
            if (safePoem.quotes.length > 0) {
                quotesHTML = `
                    <div class="panel-quotes-section">
                        <div style="margin-bottom:8px;font-weight:600;">—— 摘录 ——</div>
                        ${safePoem.quotes.map(q => `<div class="panel-single-quote">${q}</div>`).join('')}
                    </div>
                `;
            }

            // 【核心修复】根据内容动态添加 CSS 类
            panelContentArea.innerHTML = `
                <h2 class="panel-poem-title">${safePoem.title}</h2>
                <div class="panel-poem-meta">
                    <span class="panel-meta-item">${safePoem.type}</span>
                    ${genreInfo ? `<span class="panel-meta-item">${genreInfo}</span>` : ''}
                    <span class="panel-meta-item">${wordCount} 字</span>
                    ${safePoem.creationDate ? `<span class="panel-meta-item">${safePoem.creationDate}</span>` : ''}
                </div>
                
                ${safePoem.preface ? 
                    `<div class="panel-section panel-preface">
                        <h4>序言</h4>
                        <div class="panel-section-content">${safePoem.preface.replace(/\n/g, '<br>')}</div>
                    </div>` : ''}
                
                <div class="panel-section panel-body-container">
                    <pre class="panel-poem-body ${alignmentClass}">${safePoem.content}</pre>
                </div>
                
                ${safePoem.notes ? 
                    `<div class="panel-section panel-notes">
                        <h4>注释</h4>
                        <div class="panel-section-content">${safePoem.notes.replace(/\n/g, '<br>')}</div>
                    </div>` : ''}
                
                ${quotesHTML}
            `;

            readingPanel.classList.add('open');
        };

        window.App.openPoemByFilename = async (filename) => {
            if (!filename) return;
            try {
                const res = await fetch(`/api/poems/${filename}`);
                if (res.ok) {
                    const poem = await res.json();
                    window.App.renderPoemInPanel({ ...poem, filename });
                }
            } catch (e) { console.error('加载作品失败', e); }
        };

        function getAlignmentClass(poem) { 
            switch (poem.type) { 
                case '诗': return 'poem-body-center'; 
                case '词': 
                    const c = (poem.content || '').replace(/\s/g, '').length; 
                    return c < 100 ? 'poem-body-center' : 'poem-body-left'; 
                default: return 'poem-body-left'; 
            } 
        }

        loadPage('view');
        loadDailyQuote();
    });

    window.showNotification = function(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        notification.textContent = message;
        notification.className = '';
        notification.classList.add(type, 'show');
        setTimeout(() => { notification.classList.remove('show'); }, 3000);
    };

    async function loadDailyQuote() {
        const container = document.getElementById('daily-quote-container');
        if (!container) return;
        try {
            const response = await fetch('/api/random-quote');
            if (response.ok) {
                const data = await response.json();
                container.innerHTML = `<div class="daily-quote-content">${data.quote}</div><div class="daily-quote-author">${data.author}</div>`;
                container.onclick = () => window.App.openPoemByFilename(data.filename);
            }
        } catch (error) {}
    }

})(window);