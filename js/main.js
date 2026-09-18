/**
 * ===================================================================
 * MyPoems · 主逻辑 (js/main.js)
 * 应用外壳：主题、书签栏、路由、阅览抽屉、每日精句、消息提示
 * ===================================================================
 */

(function (window, document) {
    'use strict';

    window.App = window.App || {};

    /* ------------------------------------------------------------------
     * 页面登记表
     * ---------------------------------------------------------------- */
    const PAGES = {
        view:     { title: '作品总览', hint: '展卷 · 一览旧作' },
        add:      { title: '添加新篇', hint: '研墨 · 录一篇新词' },
        manage:   { title: '作品管理', hint: '校勘 · 增删改易' },
        tags:     { title: '索引管理', hint: '编次 · 以类相从' },
        timeline: { title: '编年史',   hint: '纪年 · 岁月留痕' },
        quotes:   { title: '精句集',   hint: '撷英 · 字字珠玑' },
        imagery:  { title: '意象簿',   hint: '观象 · 字里乾坤' },
        stats:    { title: '笔耕录',   hint: '笔耕 · 日积月累' },
        settings: { title: '设置',     hint: '调校 · 外观与阅读' }
    };

    /* ------------------------------------------------------------------
     * 外观预设（配色由 css/variables.css 中的 [data-theme=...] 定义）
     * ---------------------------------------------------------------- */
    const THEMES = [
        { id: 'paper',     name: '宣纸', tone: 'light', note: '默认 · 温润米纸' },
        { id: 'moonwhite', name: '月白', tone: 'light', note: '冷调浅蓝' },
        { id: 'celadon',   name: '青瓷', tone: 'light', note: '青绿釉色' },
        { id: 'bamboo',    name: '竹影', tone: 'light', note: '竹青草绿' },
        { id: 'cedar',     name: '雪松', tone: 'light', note: '松针墨绿' },
        { id: 'sky',       name: '天青', tone: 'light', note: '雨后青蓝' },
        { id: 'autumn',    name: '秋香', tone: 'light', note: '暖黄赭石' },
        { id: 'sandal',    name: '檀木', tone: 'light', note: '棕褐木色' },
        { id: 'lilac',     name: '藕荷', tone: 'light', note: '紫粉柔调' },
        { id: 'rouge',     name: '胭脂', tone: 'light', note: '绛红胭脂' },
        { id: 'inknight',  name: '墨夜', tone: 'dark',  note: '默认 · 浓墨夜色' },
        { id: 'pineink',   name: '松烟', tone: 'dark',  note: '墨绿烟岚' },
        { id: 'jasper',    name: '黛绿', tone: 'dark',  note: '碧玉深青' },
        { id: 'patina',    name: '苍青', tone: 'dark',  note: '青金锈色' },
        { id: 'midnight',  name: '藏蓝', tone: 'dark',  note: '靛蓝深夜' },
        { id: 'rainnight', name: '夜雨', tone: 'dark',  note: '灰蓝雨色' },
        { id: 'plum',      name: '绛紫', tone: 'dark',  note: '紫气东来' },
        { id: 'rosewood',  name: '绛雪', tone: 'dark',  note: '玫红暗香' },
        { id: 'ember',     name: '焦茶', tone: 'dark',  note: '栗色炭火' },
        { id: 'obsidian',  name: '玄墨', tone: 'dark',  note: '近中性玄黑' }
    ];
    const AUTO_THEME = { id: 'auto', name: '跟随系统', tone: 'auto', note: '随系统日夜自动切换' };

    const THEME_KEY = 'mypoems-theme';
    const THEME_RESOLVED_KEY = 'mypoems-theme-resolved';
    const THEME_DARK_KEY = 'mypoems-theme-dark';
    const READER_KEY = 'mypoems-reader-mode';
    const RAIL_KEY = 'mypoems-rail';
    const LAYOUT_KEY = 'mypoems-layout';

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    window.App.escapeHtml = escapeHtml;

    /* ------------------------------------------------------------------
     * 正文排版工具
     *   对齐：诗居中；词短则居中、长则左；文言文 / 现代文 / 随笔一律左对齐
     *   缩进：横排左对齐时每段自动两字缩进（竖排顶格，符合传统版式）
     * ---------------------------------------------------------------- */
    const INDENT = '\u3000\u3000';

    function alignmentOf(poem) {
        const len = String(poem && poem.content || '').replace(/\s/g, '').length;
        const type = poem && poem.type;
        if (type === '诗') return 'center';
        if (type === '词') return len < 100 ? 'center' : 'left';
        return 'left';
    }

    function indentParagraphs(text, align) {
        if (!text || align !== 'left') return text || '';
        return String(text).split('\n')
            .map(line => (line.trim() ? INDENT + line : line))
            .join('\n');
    }

    window.App.alignmentOf = alignmentOf;
    window.App.indentParagraphs = indentParagraphs;

    /* ------------------------------------------------------------------
     * 对话框：替代浏览器自带的 confirm / prompt
     *   App.confirm({title, message, detail, tone, confirmText, cancelText}) → Promise<boolean>
     *   App.prompt({title, message, detail, value, placeholder, ...})        → Promise<string|null>
     * ---------------------------------------------------------------- */
    const DIALOG_MARKS = {
        danger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 1 21h22L12 2zm1 15h-2v2h2v-2zm0-7h-2v5h2V10z"/></svg>',
        question: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm1.1-6.2-.9.9c-.5.5-.7 1-.7 1.8h-2c0-1.1.3-1.9 1.1-2.7l1-1c.3-.3.5-.7.5-1.2 0-.9-.7-1.6-1.6-1.6s-1.6.7-1.6 1.6H9c0-2 1.6-3.6 3.6-3.6s3.6 1.6 3.6 3.6c0 .7-.3 1.3-.9 1.8z"/></svg>'
    };
    DIALOG_MARKS.info = DIALOG_MARKS.question;

    function openDialog(options) {
        const opts = Object.assign({
            title: '确认',
            message: '',
            detail: '',
            tone: 'info',
            confirmText: '确定',
            cancelText: '取消',
            singleAction: false,   // 只作告知：只留一个「知道了」
            input: null
        }, options || {});

        const askInput = !!opts.input;
        const isDanger = opts.tone === 'danger';
        const lastFocus = document.activeElement;

        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div class="dialog">
                <span class="dialog__mark dialog__mark--${escapeHtml(opts.tone)}">${DIALOG_MARKS[opts.tone] || DIALOG_MARKS.info}</span>
                <h3 class="dialog__title">${escapeHtml(opts.title)}</h3>
                ${opts.message ? `<p class="dialog__message">${escapeHtml(opts.message)}</p>` : ''}
                ${opts.detail ? `<p class="dialog__detail">${escapeHtml(opts.detail)}</p>` : ''}
                ${askInput ? `
                    <div class="dialog__field">
                        <input type="text" class="dialog__input"
                               value="${escapeHtml(opts.input.value || '')}"
                               placeholder="${escapeHtml(opts.input.placeholder || '')}"
                               aria-label="${escapeHtml(opts.title)}">
                    </div>` : ''}
                <div class="dialog__actions">
                    ${opts.singleAction ? '' : `<button type="button" class="btn btn--secondary" data-act="cancel">${escapeHtml(opts.cancelText)}</button>`}
                    <button type="button" class="btn ${isDanger ? 'btn--danger' : 'btn--primary'}" data-act="confirm">${escapeHtml(opts.confirmText)}</button>
                </div>
            </div>`;

        document.body.appendChild(overlay);
        document.body.classList.add('modal-open');

        const inputEl = overlay.querySelector('.dialog__input');
        const cancelBtn = overlay.querySelector('[data-act="cancel"]');
        const confirmBtn = overlay.querySelector('[data-act="confirm"]');

        window.requestAnimationFrame(() => {
            overlay.classList.add('is-open');
            void overlay.offsetWidth;   // 让 visibility 立即生效，否则里面的元素无法聚焦
            // 危险操作把焦点先放在「取消」上，避免顺手一个回车就删了
            if (askInput && inputEl) { inputEl.focus(); inputEl.select(); }
            else if (isDanger && cancelBtn) cancelBtn.focus();
            else confirmBtn.focus();
        });

        let done = false;
        let resolve;
        const promise = new Promise((res) => { resolve = res; });

        function releaseScrollLock() {
            const stillOpen = Array.from(document.querySelectorAll('.modal-overlay'))
                .some(el => window.getComputedStyle(el).display !== 'none');
            if (!stillOpen && !document.querySelector('.dialog-overlay')) {
                document.body.classList.remove('modal-open');
            }
        }

        function close(value) {
            if (done) return;
            done = true;
            document.removeEventListener('keydown', onKey, true);
            overlay.classList.remove('is-open');
            window.setTimeout(() => {
                overlay.remove();
                releaseScrollLock();
                if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
                resolve(value);
            }, 180);
        }

        function confirmValue() {
            return askInput ? (inputEl.value.trim() || null) : true;
        }

        function onKey(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                close(askInput ? null : false);
                return;
            }
            if (event.key === 'Enter' && !event.isComposing) {
                if (event.target && event.target.tagName === 'TEXTAREA') return;
                event.preventDefault();
                const el = document.activeElement;
                if (el === cancelBtn) close(askInput ? null : false);
                else if (el === confirmBtn || (askInput && el === inputEl)) close(confirmValue());
                else close(isDanger ? false : confirmValue());   // 焦点不在按钮上时，危险操作按最安全的处理
                return;
            }
            if (event.key === 'Tab') {
                // 简单焦点环，别让焦点跑到对话框外
                const items = (cancelBtn ? [cancelBtn] : []).concat(confirmBtn).concat(inputEl ? [inputEl] : []);
                const idx = items.indexOf(document.activeElement);
                event.preventDefault();
                const next = event.shiftKey
                    ? items[(idx <= 0 ? items.length : idx) - 1]
                    : items[(idx + 1) % items.length];
                if (next) next.focus();
            }
        }

        document.addEventListener('keydown', onKey, true);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close(askInput ? null : false);
        });
        cancelBtn && cancelBtn.addEventListener('click', () => close(askInput ? null : false));
        confirmBtn.addEventListener('click', () => close(confirmValue()));

        // 危险操作把焦点先放在「取消」上，避免顺手一个回车就删了
        if (askInput && inputEl) { inputEl.focus(); inputEl.select(); }
        else if (isDanger) cancelBtn.focus();
        else confirmBtn.focus();

        return promise;
    }

    window.App.confirm = (options) => openDialog(options);
    window.App.prompt = (options) => openDialog(Object.assign({}, options, {
        input: Object.assign({ value: '', placeholder: '' }, (options || {}).input)
    }));


    /* ------------------------------------------------------------------
     * 消息提示
     * ---------------------------------------------------------------- */
    const TOAST_ICONS = {
        success: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14.4-4.2-4.2 1.4-1.4L11 13.6l5.8-5.8 1.4 1.4L11 16.4z"/></svg>',
        error:   '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
        info:    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
    };

    window.showNotification = function (message, type) {
        const stack = document.getElementById('notification');
        if (!stack) return;
        const kind = TOAST_ICONS[type] ? type : 'success';

        const toast = document.createElement('div');
        toast.className = 'toast toast--' + kind;
        toast.innerHTML = TOAST_ICONS[kind] + '<span></span>';
        toast.querySelector('span').textContent = message;
        stack.appendChild(toast);

        const dismiss = () => {
            if (!toast.isConnected || toast.classList.contains('is-leaving')) return;
            toast.classList.add('is-leaving');
            window.setTimeout(() => toast.remove(), 260);
        };

        toast.addEventListener('click', dismiss);
        window.setTimeout(dismiss, 3200);
    };

    /* ------------------------------------------------------------------
     * DOMContentLoaded
     * ---------------------------------------------------------------- */
    document.addEventListener('DOMContentLoaded', () => {
        const body = document.body;
        const contentArea = document.getElementById('content');
        const navLinks = $$('.rail-nav a[data-page]');

        const readingPanel = document.getElementById('reading-panel');
        const panelContentArea = document.getElementById('panel-content-area');
        const closePanelBtn = document.getElementById('close-panel-btn');
        const readerScrim = document.getElementById('reader-scrim');
        const readerLayoutBtn = document.getElementById('reader-layout-btn');
        const readerCopyBtn = document.getElementById('reader-copy-btn');

        const rail = document.getElementById('rail');
        const railToggle = document.getElementById('rail-toggle');
        const railScrim = document.getElementById('rail-scrim');
        const railCollapseBtn = document.getElementById('rail-collapse-btn');

        /* ==============================================================
         * 一、外观（多种预设配色 · 设置页可选）
         * ============================================================ */
        const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        let themeChoice = 'paper';

        function readStore(key, fallback) {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : v;
            } catch (e) { return fallback; }
        }

        function writeStore(key, value) {
            try { localStorage.setItem(key, value); } catch (e) { /* 隐私模式忽略 */ }
        }

        function normalizeChoice(raw) {
            if (raw === 'auto') return 'auto';
            if (raw === 'light') return 'paper';        // 兼容旧版
            if (raw === 'dark') return 'inknight';      // 兼容旧版
            return THEMES.some(t => t.id === raw) ? raw : 'paper';
        }

        function resolveThemeId(choice) {
            if (choice === 'auto') return (darkQuery && darkQuery.matches) ? 'inknight' : 'paper';
            return normalizeChoice(choice);
        }

        function applyTheme(choice, persist) {
            const normalized = normalizeChoice(choice);
            const resolved = resolveThemeId(normalized);
            const theme = THEMES.find(t => t.id === resolved) || THEMES[0];

            document.body.dataset.theme = theme.id;
            document.body.classList.toggle('dark-theme', theme.tone === 'dark');
            themeChoice = normalized;

            if (persist !== false) {
                writeStore(THEME_KEY, normalized);
                writeStore(THEME_RESOLVED_KEY, theme.id);
                writeStore(THEME_DARK_KEY, theme.tone === 'dark' ? '1' : '0');
            }

            document.dispatchEvent(new CustomEvent('mypoems:themechange', {
                detail: { theme: theme.id, choice: normalized, tone: theme.tone }
            }));
        }

        window.App.THEMES = THEMES;
        window.App.AUTO_THEME = AUTO_THEME;
        window.App.setTheme = (id) => applyTheme(id, true);
        window.App.getThemeChoice = () => themeChoice;
        window.App.getResolvedTheme = () => resolveThemeId(themeChoice);
        window.App.getResolvedThemeNow = (choice) => resolveThemeId(normalizeChoice(choice));

        if (darkQuery && darkQuery.addEventListener) {
            darkQuery.addEventListener('change', () => {
                if (themeChoice === 'auto') applyTheme('auto', false);
            });
        }

        applyTheme(readStore(THEME_KEY, 'paper'), false);

        /* ==============================================================
         * 二、阅读模式：右侧推出（挤压） / 浮层模态
         * ============================================================ */
        let readerMode = 'push';

        function applyReaderMode(mode, persist) {
            readerMode = mode === 'modal' ? 'modal' : 'push';
            document.body.dataset.reader = readerMode;
            if (persist !== false) writeStore(READER_KEY, readerMode);
            document.dispatchEvent(new CustomEvent('mypoems:readermodechange', {
                detail: { mode: readerMode }
            }));
        }

        window.App.setReaderMode = (mode) => applyReaderMode(mode, true);
        window.App.getReaderMode = () => readerMode;

        applyReaderMode(readStore(READER_KEY, 'push'), false);

        /* ==============================================================
         * 三、书签栏：折叠 + 移动端抽屉
         * ============================================================ */
        function setRailCollapsed(collapsed) {
            body.classList.toggle('rail-collapsed', collapsed);
            if (railCollapseBtn) {
                railCollapseBtn.setAttribute('aria-pressed', String(collapsed));
                railCollapseBtn.setAttribute('aria-label', collapsed ? '展开书签栏' : '收起书签栏');
            }
            try { localStorage.setItem(RAIL_KEY, collapsed ? 'collapsed' : 'expanded'); } catch (e) { /* ignore */ }
        }

        let savedRail = null;
        try { savedRail = localStorage.getItem(RAIL_KEY); } catch (e) { /* ignore */ }
        if (savedRail === 'collapsed') setRailCollapsed(true);

        if (railCollapseBtn) {
            railCollapseBtn.addEventListener('click', () => {
                if (window.matchMedia('(max-width: 900px)').matches) {
                    closeRailDrawer();
                } else {
                    setRailCollapsed(!body.classList.contains('rail-collapsed'));
                }
            });
        }

        function openRailDrawer() {
            body.classList.add('rail-open');
            if (railScrim) railScrim.classList.add('show');
            if (railToggle) railToggle.setAttribute('aria-expanded', 'true');
        }

        function closeRailDrawer() {
            body.classList.remove('rail-open');
            if (railScrim) railScrim.classList.remove('show');
            if (railToggle) railToggle.setAttribute('aria-expanded', 'false');
        }

        if (railToggle) {
            railToggle.addEventListener('click', () => {
                if (body.classList.contains('rail-open')) closeRailDrawer();
                else openRailDrawer();
            });
        }
        if (railScrim) railScrim.addEventListener('click', closeRailDrawer);

        /* ==============================================================
         * 四、路由
         * ============================================================ */
        let currentPage = null;
        let pageToken = 0;

        function markActive(pageName) {
            navLinks.forEach(link => {
                const active = link.dataset.page === pageName;
                link.classList.toggle('active', active);
                if (active) link.setAttribute('aria-current', 'page');
                else link.removeAttribute('aria-current');
            });
        }

        function setTopbar(pageName) {
            const cfg = PAGES[pageName] || { title: '', hint: '' };
            const titleEl = document.getElementById('topbar-page');
            const hintEl = document.getElementById('topbar-hint');
            if (titleEl) titleEl.textContent = cfg.title;
            if (hintEl) hintEl.textContent = cfg.hint;
            document.title = (cfg.title ? cfg.title + ' · ' : '') + '詩詞集';
        }

        async function loadPage(pageName) {
            if (!contentArea || !PAGES[pageName]) return;
            const token = ++pageToken;
            currentPage = pageName;
            markActive(pageName);
            setTopbar(pageName);

            contentArea.innerHTML = '<div class="loading-placeholder"><span class="ink-spinner"></span>正在展卷…</div>';

            try {
                const htmlRes = await fetch(`html/${pageName}.html`);
                if (!htmlRes.ok) throw new Error(`无法加载 html/${pageName}.html`);
                const markup = await htmlRes.text();
                if (token !== pageToken) return;   // 已被更新的导航取代，丢弃本次

                // 淡入入场
                contentArea.classList.remove('page-enter');
                contentArea.innerHTML = markup;
                void contentArea.offsetWidth;
                contentArea.classList.add('page-enter');

                window.scrollTo({ top: 0, behavior: 'auto' });
                contentArea.scrollTop = 0;

                const jsRes = await fetch(`js/${pageName}.js`);
                if (jsRes.ok) {
                    const scriptText = await jsRes.text();
                    // 关键：若期间又发生了导航，就不要再执行旧脚本，
                    // 否则会产生两套 document 监听器（图表 canvas 冲突就源于此）
                    if (token !== pageToken) return;
                    new Function(scriptText)();
                }

                if (body.classList.contains('rail-open')) closeRailDrawer();
            } catch (error) {
                if (token !== pageToken) return;
                console.error('加载页面时出错:', error);
                contentArea.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state__glyph">卷</div>
                        <h3>展卷失败</h3>
                        <p>未能载入「${escapeHtml(PAGES[pageName].title)}」，请检查 html/ 与 js/ 目录是否完整。</p>
                    </div>`;
            }
        }
        window.App.loadPage = loadPage;
        window.App.getCurrentPage = () => currentPage;

        /* 跨页联动：先记下"意图"，目标页初始化时自取 */
        const pendingIntent = {};
        window.App.setPending = (key, value) => { pendingIntent[key] = value; };
        window.App.consumePending = (key) => {
            const value = pendingIntent[key];
            delete pendingIntent[key];
            return value;
        };
        window.App.openImagery = (word) => {
            window.App.setPending('imageryWord', word);
            loadPage('imagery');
        };
        window.App.openQuotesOfYear = (year) => {
            window.App.setPending('quotesYear', year);
            loadPage('quotes');
        };
        window.App.openView = (intent) => {
            window.App.setPending('viewIntent', intent || {});
            loadPage('view');
        };

        navLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const page = link.getAttribute('data-page');
                if (location.hash.slice(1) !== page) {
                    location.hash = page;   // 交给 hashchange 统一处理
                } else {
                    loadPage(page);
                }
            });
        });

        window.addEventListener('hashchange', () => {
            const page = location.hash.slice(1);
            if (PAGES[page] && page !== currentPage) loadPage(page);
        });

        /* ==============================================================
         * 五、阅览抽屉
         * ============================================================ */
        let currentPoem = null;

        function openReader() {
            if (!readingPanel) return;
            readingPanel.classList.add('open');
            readingPanel.setAttribute('aria-hidden', 'false');
            body.classList.add('reader-open');
            if (readerScrim) readerScrim.classList.add('show');
            const body0 = panelContentArea;
            if (body0) body0.scrollTop = 0;
        }

        function closeReader() {
            if (!readingPanel) return;
            readingPanel.classList.remove('open');
            readingPanel.setAttribute('aria-hidden', 'true');
            body.classList.remove('reader-open');
            if (readerScrim) readerScrim.classList.remove('show');
        }

        if (closePanelBtn) closePanelBtn.addEventListener('click', closeReader);
        if (readerScrim) readerScrim.addEventListener('click', closeReader);

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            if (readingPanel && readingPanel.classList.contains('open')) closeReader();
            else if (body.classList.contains('rail-open')) closeRailDrawer();
        });

        /* --- 竖排 / 横排 --- */
        function preferredLayout(poem) {
            let saved = null;
            try { saved = localStorage.getItem(LAYOUT_KEY); } catch (e) { /* ignore */ }
            if (saved === 'vertical' || saved === 'horizontal') return saved;

            const len = (poem.content || '').replace(/\s/g, '').length;
            if (poem.type === '诗' && len <= 130) return 'vertical';
            if (poem.type === '词' && len <= 96) return 'vertical';
            return 'horizontal';
        }

        function applyPoemLayout(mode) {
            const pre = panelContentArea && panelContentArea.querySelector('.poem-body');
            if (!pre || !currentPoem) return;
            const vertical = mode === 'vertical';
            const align = pre.dataset.align === 'center' ? 'center' : 'left';

            pre.classList.toggle('poem-body--vertical', vertical);
            pre.classList.toggle('poem-body--center', !vertical && align === 'center');
            pre.classList.toggle('poem-body--left', !vertical && align === 'left');

            // 正文随排版切换：横排左对齐时每段补两字首行缩进，竖排一律顶格
            pre.textContent = vertical
                ? currentPoem.content
                : window.App.indentParagraphs(currentPoem.content, align);

            if (readerLayoutBtn) {
                readerLayoutBtn.dataset.tip = vertical ? '改为横排' : '改为竖排';
                readerLayoutBtn.setAttribute('aria-pressed', String(vertical));
            }
        }

        if (readerLayoutBtn) {
            readerLayoutBtn.addEventListener('click', () => {
                if (!currentPoem) return;
                const pre = panelContentArea && panelContentArea.querySelector('.poem-body');
                const next = pre && pre.classList.contains('poem-body--vertical') ? 'horizontal' : 'vertical';
                try { localStorage.setItem(LAYOUT_KEY, next); } catch (e) { /* ignore */ }
                applyPoemLayout(next);
            });
        }

        /* --- 复制全文 --- */
        if (readerCopyBtn) {
            readerCopyBtn.addEventListener('click', () => {
                if (!currentPoem) return;
                const align = alignmentOf(currentPoem);
                const text = [
                    currentPoem.title || '',
                    currentPoem.preface ? '\n【序】' + currentPoem.preface : '',
                    '\n' + indentParagraphs(currentPoem.content, align),
                    currentPoem.notes ? '\n【注】' + currentPoem.notes : ''
                ].join('');
                navigator.clipboard.writeText(text)
                    .then(() => window.showNotification('已复制《' + (currentPoem.title || '无题') + '》', 'success'))
                    .catch(() => window.showNotification('复制失败', 'error'));
            });
        }

        /* --- 渲染诗词 --- */
        window.App.renderPoemInPanel = function (poem) {
            if (!readingPanel || !panelContentArea || !poem) return;

            const safe = {
                title: poem.title || '无题',
                type: poem.type || '未分类',
                genre: poem.genre || '',
                creationDate: poem.creationDate || '',
                preface: poem.preface || '',
                content: poem.content || '',
                notes: poem.notes || '',
                tags: Array.isArray(poem.tags) ? poem.tags : [],
                quotes: Array.isArray(poem.quotes) ? poem.quotes : []
            };
            currentPoem = safe;

            const charCount = (safe.content.replace(/\s/g, '').length) + (safe.preface.replace(/\s/g, '').length);
            const genreLabel = safe.type === '词' ? '词牌' : '体裁';
            const align = alignmentOf(safe);

            const metaParts = [
                `<span class="panel-meta-item">${escapeHtml(safe.type)}</span>`
            ];
            if (safe.genre) metaParts.push(`<span class="panel-meta-item">${escapeHtml(genreLabel)} · ${escapeHtml(safe.genre)}</span>`);
            metaParts.push(`<span class="panel-meta-item">${charCount} 字</span>`);
            if (safe.creationDate) metaParts.push(`<span class="panel-meta-item">${escapeHtml(safe.creationDate)}</span>`);

            const tagsHTML = safe.tags.length
                ? `<div class="poem-colophon__group">
                       <span class="poem-colophon__key">签</span>
                       <div class="poem-colophon__items poem-colophon__items--inline">
                           ${safe.tags.map(t => `<span class="poem-colophon__tag">${escapeHtml(t)}</span>`).join('')}
                       </div>
                   </div>`
                : '';

            const prefaceHTML = safe.preface
                ? `<section class="poem-section poem-preface">
                       <div class="poem-section__label">序</div>
                       <div class="poem-section__body">${escapeHtml(safe.preface)}</div>
                   </section>`
                : '';

            const notesHTML = safe.notes
                ? `<section class="poem-section">
                       <div class="poem-section__label">注</div>
                       <div class="poem-section__body">${escapeHtml(safe.notes)}</div>
                   </section>`
                : '';

            const quotesHTML = safe.quotes.length
                ? `<div class="poem-colophon__group">
                       <span class="poem-colophon__key">摘</span>
                       <div class="poem-colophon__items">
                           ${safe.quotes.map(q => `<p class="poem-colophon__item">${escapeHtml(q)}</p>`).join('')}
                       </div>
                   </div>`
                : '';

            const colophonHTML = (quotesHTML || tagsHTML)
                ? `<div class="poem-colophon">${quotesHTML}${tagsHTML}</div>`
                : '';

            panelContentArea.innerHTML = `
                <article class="poem-sheet">
                    <div class="poem-sheet__ornament">詩</div>
                    <h2 class="poem-title">${escapeHtml(safe.title)}</h2>
                    <div class="poem-meta">${metaParts.join('')}</div>
                    ${prefaceHTML}
                    <div class="poem-body-wrap">
                        <pre class="poem-body" data-align="${align}">${escapeHtml(safe.content)}</pre>
                    </div>
                    ${notesHTML}
                    ${colophonHTML}
                </article>
            `;

            applyPoemLayout(preferredLayout(safe));
            openReader();
        };

        window.App.openPoemByFilename = async function (filename) {
            if (!filename) return;
            try {
                const res = await fetch(`/api/poems/${encodeURIComponent(filename)}`);
                if (!res.ok) throw new Error('加载失败');
                const poem = await res.json();
                window.App.renderPoemInPanel(Object.assign({}, poem, { filename }));
            } catch (e) {
                console.error('加载作品失败', e);
                window.showNotification('无法打开该作品', 'error');
            }
        };

        window.App.closeReader = closeReader;

        /* ==============================================================
         * 六、顶栏搜索：直达总览页搜索框
         * ============================================================ */
        const topbarSearchBtn = document.getElementById('topbar-search-btn');
        if (topbarSearchBtn) {
            topbarSearchBtn.addEventListener('click', async () => {
                if (currentPage !== 'view') await loadPage('view');
                window.setTimeout(() => {
                    const input = document.getElementById('search-input');
                    if (input) input.focus();
                }, 60);
            });
        }

        /* ==============================================================
         * 七、每日精句
         * ============================================================ */
        async function loadDailyQuote() {
            const container = document.getElementById('daily-quote-container');
            if (!container) return;
            try {
                const response = await fetch('/api/random-quote');
                if (!response.ok) return;
                const data = await response.json();
                if (!data || !data.quote) return;

                container.innerHTML =
                    `<div class="daily-quote-content">${escapeHtml(data.quote)}</div>` +
                    `<div class="daily-quote-author">${escapeHtml(data.author || '')}</div>`;
                container.hidden = false;

                const open = () => { if (data.filename) window.App.openPoemByFilename(data.filename); };
                container.addEventListener('click', open);
                container.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
                });
            } catch (error) {
                container.hidden = true;
            }
        }

        /* ==============================================================
         * 八、启动
         * ============================================================ */
        const initialPage = PAGES[location.hash.slice(1)] ? location.hash.slice(1) : 'view';
        if (!location.hash) {
            try { history.replaceState(null, '', '#' + initialPage); } catch (e) { /* ignore */ }
        }
        loadPage(initialPage);
        loadDailyQuote();

        // 供其它脚本使用的小工具
        window.App.getCurrentPage = () => currentPage;
        window.App.refreshRailQuote = loadDailyQuote;
    });

})(window, document);
