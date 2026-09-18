/**
 * ===================================================================
 * MyPoems - 意象簿逻辑脚本 (imagery.js) - 双图表分析版
 * ===================================================================
 */

(function() {
    let allPoems = [];
    let ignoreList = [];
    let wordStats = [];
    let yearTotalCounts = {}; // {2022: 50, 2023: 80} 用于计算占比分母
    
    // 图表实例
    let freqChartInstance = null;
    let ratioChartInstance = null;
    let currentWord = null;

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* 销毁画布上的图表（含本实例之外的遗留实例，脚本重复执行时也不会冲突） */
    function destroyChart(instance, canvas) {
        if (instance) { try { instance.destroy(); } catch (e) { /* 已销毁 */ } }
        if (canvas && window.Chart && typeof window.Chart.getChart === 'function') {
            const leftover = window.Chart.getChart(canvas);
            if (leftover) leftover.destroy();
        }
    }

    // DOM 元素
    const wrapper = document.getElementById('imagery-content-wrapper');
    const rankList = document.getElementById('word-rank-list');
    const detailPanel = document.getElementById('imagery-detail-panel');
    const closeDetailBtn = document.getElementById('close-detail-btn');
    const tianziWrapper = document.getElementById('tianzi-wrapper');
    const poemListContainer = document.getElementById('chart-poems-list');
    const poemResultGrid = document.getElementById('poems-result-container');
    
    // 屏蔽词 DOM
    const modal = document.getElementById('ignore-modal');
    const btnManage = document.getElementById('btn-manage-ignore');
    const btnCloseModal = document.getElementById('close-ignore-btn');
    const ignoreInput = document.getElementById('ignore-input');
    const btnAddIgnore = document.getElementById('btn-add-ignore');
    const ignoreCloud = document.getElementById('ignore-tags-container');

    async function initialize() {
        await Promise.all([loadPoems(), loadIgnoreList()]);
        analyzeData();
        renderRankList();
        setupEventListeners();

        // 从编年史点"常用意象"跳过来：直接选中那个字
        const pendingWord = (window.App && window.App.consumePending) ? window.App.consumePending('imageryWord') : null;
        if (pendingWord) {
            if (wordStats.some(w => w.word === pendingWord)) {
                window.selectImagery(pendingWord);
            } else if (window.showNotification) {
                window.showNotification(`「${pendingWord}」不在高频词前 50 之内`, 'info');
            }
        }
    }

    async function loadPoems() {
        try {
            const res = await fetch('/api/poems');
            const files = await res.json();
            allPoems = await Promise.all(files.map(async f => {
                const r = await fetch(`/api/poems/${f}`);
                const d = await r.json();
                return { ...d, filename: f };
            }));
        } catch (e) { console.error(e); }
    }

    async function loadIgnoreList() {
        try {
            const res = await fetch('/api/imagery/ignore');
            ignoreList = await res.json();
        } catch (e) { ignoreList = []; }
    }

    function analyzeData() {
        const map = new Map();
        const punctuation = /[^\u4e00-\u9fa5]/g; 
        yearTotalCounts = {}; // 重置年份总数

        allPoems.forEach(poem => {
            const year = poem.creationDate ? poem.creationDate.substring(0, 4) : '未知';
            
            // 统计该年总作品数
            yearTotalCounts[year] = (yearTotalCounts[year] || 0) + 1;

            if (!poem.content) return;
            const text = poem.content.replace(punctuation, '');
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                addCount(map, char, year, poem.filename);
                if (i < text.length - 1) {
                    const word = text.substring(i, i + 2);
                    addCount(map, word, year, poem.filename);
                }
            }
        });

        wordStats = Array.from(map.entries())
            .map(([word, data]) => ({ word, ...data }))
            .filter(item => !ignoreList.includes(item.word))
            .sort((a, b) => b.count - a.count)
            .slice(0, 50);
    }

    function addCount(map, word, year, filename) {
        if (!map.has(word)) map.set(word, { count: 0, years: {} });
        const data = map.get(word);
        data.count++;
        if (!data.years[year]) data.years[year] = new Set();
        data.years[year].add(filename);
    }

    function renderRankList() {
        if (!rankList) return;
        if (wordStats.length === 0) {
            rankList.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state__glyph">象</div>
                    <h3>尚无字象</h3>
                    <p>录入作品后，常用字词会自动聚在这里。</p>
                </div>`;
            return;
        }

        rankList.innerHTML = wordStats.map((item, index) => `
            <div class="word-card" data-word="${esc(item.word)}" role="button" tabindex="0" aria-label="查看「${esc(item.word)}」的历年用例">
                <span class="rank-num">${index + 1}</span>
                <span class="word-text">${esc(item.word)}</span>
                <span class="word-count">${item.count} 次</span>
            </div>
        `).join('');
    }

    // --- 详情交互 ---
    
    window.selectImagery = function(word) {
        const data = wordStats.find(w => w.word === word);
        if (!data) return;

        currentWord = word;
        wrapper.classList.add('split-view');
        const layoutRoot = document.querySelector('.imagery-layout');
        if (layoutRoot) layoutRoot.classList.add('is-split');   // 收紧页头，给详情腾出高度
        
        // 渲染田字格
        renderTianzi(word);
        
        // 渲染两个图表
        // 延迟一点以确保容器尺寸正确
        setTimeout(() => {
            renderFreqChart(word, data.years);
            renderRatioChart(word, data.years);
        }, 300);

        // 默认展示最新一年的数据
        const sortedYears = Object.keys(data.years).sort();
        if (sortedYears.length > 0) {
            const latestYear = sortedYears[sortedYears.length - 1];
            showPoemsByYear(word, latestYear, data.years[latestYear]);
        } else if (poemListContainer) {
            poemListContainer.style.display = 'none';
        }
        
        // 高亮左侧
        const cards = rankList.querySelectorAll('.word-card');
        cards.forEach(c => c.classList.remove('active'));
        const activeCard = Array.from(cards).find(c => c.dataset.word === word);
        if (activeCard) activeCard.classList.add('active');

        // 让左右两栏等高（左栏多显示一行，右栏内部作品列表自己滚）
        window.requestAnimationFrame(syncSplitHeights);
    };

    /* ------------------------------------------------------------------
     * 作品列表滚动：平滑（缓动）滚动 + 降速。
     *   · 每个滚轮事件按比例累加到「目标位置」，再由逐帧缓动追上去，
     *     所以不会一格一跳地卡顿；
     *   · 不做任何自动吸附：停在哪就是哪。
     * ---------------------------------------------------------------- */
    const WHEEL_SCALE = 0.55;     // 每格滚轮走原生距离的比例（1 = 原生）
    const SCROLL_EASE = 0.14;     // 缓动系数：越小越柔、越慢
    let scrollTarget = 0;
    let scrollRaf = 0;

    function handlePoemListWheel(e) {
        const list = poemListContainer;
        if (!list || e.ctrlKey || !e.deltaY) return;          // 缩放/横向滚动不拦
        const max = list.scrollHeight - list.clientHeight;
        if (max <= 2) return;                                 // 没得滚就交给页面

        e.preventDefault();

        // 不同浏览器/设备的 deltaY 单位不同，先归一化到像素
        const line = 16;
        const raw = e.deltaMode === 1 ? e.deltaY * line
                  : e.deltaMode === 2 ? e.deltaY * list.clientHeight
                  : e.deltaY;

        // 动画空闲时以真实位置为准（用户可能刚拖过滚动条）
        if (!scrollRaf) scrollTarget = list.scrollTop;
        scrollTarget = Math.max(0, Math.min(max, scrollTarget + raw * WHEEL_SCALE));

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            list.scrollTop = scrollTarget;
            return;
        }
        if (!scrollRaf) scrollRaf = window.requestAnimationFrame(stepScroll);
    }

    function stepScroll() {
        const list = poemListContainer;
        if (!list || !document.body.contains(list)) { scrollRaf = 0; return; }

        const diff = scrollTarget - list.scrollTop;
        if (Math.abs(diff) < 0.4) {
            list.scrollTop = scrollTarget;
            scrollRaf = 0;
            return;
        }
        list.scrollTop += diff * SCROLL_EASE;
        scrollRaf = window.requestAnimationFrame(stepScroll);
    }

    /* ------------------------------------------------------------------
     * 左右等高：左栏按整行算高并尽量铺到屏幕底部（不留空档），
     * 右栏套用同一高度；面板内的作品列表则在自己的区域里滚轮滚动。
     * ---------------------------------------------------------------- */
    function syncSplitHeights() {
        if (!rankList || !detailPanel) return;

        const stacked = window.matchMedia('(max-width: 900px)').matches;
        if (!wrapper.classList.contains('split-view') || stacked) {
            rankList.style.height = '';
            rankList.style.maxHeight = '';
            detailPanel.style.height = '';
            return;
        }

        const cards = rankList.children;
        const cardH = cards[0] ? cards[0].offsetHeight : 60;
        // 先取每行的首卡 top，再求相邻两行的间距（多列时 cards[1] 与 cards[0] 在同一行）
        const tops = [];
        for (const c of cards) {
            const top = Math.round(c.getBoundingClientRect().top);
            if (!tops.includes(top)) tops.push(top);
            if (tops.length > 1) break;
        }
        let pitch = tops.length > 1 ? (tops[1] - tops[0]) : 0;
        if (!pitch || pitch <= cardH) pitch = cardH + 12;
        const gap = pitch - cardH;

        // 用「文档内偏移」算可用高度：与当前滚动位置无关，不会滚一下就变高
        const chrome = rankList.getBoundingClientRect().top + window.scrollY;
        const available = Math.max(240, window.innerHeight - chrome - 12);
        const rows = Math.max(3, Math.floor((available + gap) / pitch));
        const height = Math.max(500, Math.round(rows * cardH + (rows - 1) * gap));

        rankList.style.height = height + 'px';
        rankList.style.maxHeight = height + 'px';
        detailPanel.style.height = height + 'px';
    }

    function closeDetailPanel() {
        wrapper.classList.remove('split-view');
        const layoutRoot = document.querySelector('.imagery-layout');
        if (layoutRoot) layoutRoot.classList.remove('is-split');
        currentWord = null;
        syncSplitHeights();
        const cards = rankList.querySelectorAll('.word-card');
        cards.forEach(c => c.classList.remove('active'));
    }

    function renderTianzi(word) {
        tianziWrapper.innerHTML = word.split('').map(char => `
            <div class="tianzi-box">
                <span class="hanzi">${char}</span>
                <div class="line horizontal"></div>
                <div class="line vertical"></div>
            </div>
        `).join('');
    }

    // --- 图表 1: 频次图 ---
    function renderFreqChart(word, yearsData) {
        const canvas = document.getElementById('usage-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const sortedYears = Object.keys(yearsData).sort();

        destroyChart(freqChartInstance, canvas);
        freqChartInstance = null;
        if (sortedYears.length === 0) return;

        const counts = sortedYears.map(y => yearsData[y].size);
        const { color, bgColor, gridColor } = getChartColors();

        freqChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedYears,
                datasets: [{
                    label: '出现频次',
                    data: counts,
                    borderColor: color,
                    backgroundColor: bgColor,
                    borderWidth: 2,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: color,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: getChartOptions(gridColor, (e, elements) => {
                if (elements.length > 0) {
                    const year = sortedYears[elements[0].index];
                    showPoemsByYear(word, year, yearsData[year]);
                }
            })
        });
        attachYearOverlay(ctx.canvas, word, sortedYears, yearsData);
    }

    // --- 图表 2: 占比图 ---
    function renderRatioChart(word, yearsData) {
        const canvas = document.getElementById('ratio-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const sortedYears = Object.keys(yearsData).sort();

        destroyChart(ratioChartInstance, canvas);
        ratioChartInstance = null;
        if (sortedYears.length === 0) return;

        // 计算百分比: (该词出现篇数 / 当年总篇数) * 100
        const ratios = sortedYears.map(y => {
            const wordCount = yearsData[y].size;
            const totalCount = yearTotalCounts[y] || 1; // 防止除以0
            return ((wordCount / totalCount) * 100).toFixed(1);
        });

        const { gridColor } = getChartColors();
        // 占比图用竹青系
        const ratioColor = document.body.classList.contains('dark-theme') ? '#6cb5a2' : '#2f6b5c';
        const ratioBg = document.body.classList.contains('dark-theme') ? 'rgba(108, 181, 162, 0.18)' : 'rgba(47, 107, 92, 0.10)';

        ratioChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedYears,
                datasets: [{
                    label: '年度占比 (%)',
                    data: ratios,
                    borderColor: ratioColor,
                    backgroundColor: ratioBg,
                    borderWidth: 2,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: ratioColor,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: getChartOptions(gridColor, (e, elements) => {
                if (elements.length > 0) {
                    const year = sortedYears[elements[0].index];
                    showPoemsByYear(word, year, yearsData[year]);
                }
            }, true) // true 表示是百分比图
        });
        attachYearOverlay(ctx.canvas, word, sortedYears, yearsData);
    }

    // 在图表绘图区上覆盖一层 CSS 布局的年份点击分区（避免 zoom 导致的坐标偏移）
    function attachYearOverlay(canvas, word, sortedYears, yearsData) {
        if (!canvas || !canvas.parentElement) return;
        const container = canvas.parentElement;
        let overlay = container.querySelector('.chart-year-overlay');
        if (overlay) overlay.remove();

        const chart = Chart.getChart(canvas);
        if (!chart || !chart.chartArea) return;

        overlay = document.createElement('div');
        overlay.className = 'chart-year-overlay';
        if (chart.width > 0) {
            overlay.style.left = (chart.chartArea.left / chart.width * 100) + '%';
            overlay.style.width = ((chart.chartArea.right - chart.chartArea.left) / chart.width * 100) + '%';
        }
        sortedYears.forEach(year => {
            const seg = document.createElement('div');
            seg.className = 'cyo-seg';
            seg.setAttribute('title', year);
            seg.addEventListener('click', (ev) => {
                ev.stopPropagation();
                showPoemsByYear(word, year, yearsData[year]);
            });
            overlay.appendChild(seg);
        });
        container.appendChild(overlay);
    }

    // 辅助: 获取图表配置
    function getChartColors() {
        const isDark = document.body.classList.contains('dark-theme');
        return {
            color: isDark ? '#e0705f' : '#b23a2c',
            bgColor: isDark ? 'rgba(224, 112, 95, 0.18)' : 'rgba(178, 58, 44, 0.10)',
            gridColor: isDark ? 'rgba(242,236,224,0.08)' : 'rgba(29,25,19,0.08)',
            tickColor: isDark ? '#8e8778' : '#8a7e6d'
        };
    }

    function getChartOptions(gridColor, clickHandler, isPercent = false) {
        const { tickColor } = getChartColors();
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { 
                        stepSize: isPercent ? null : 1,
                        color: tickColor,
                        callback: function(value) { return value + (isPercent ? '%' : '') }
                    } 
                },
                x: { grid: { display: false }, ticks: { color: tickColor } }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.raw}${isPercent ? '%' : ' 篇'}`
                    }
                }
            },
            onClick: clickHandler
        };
    }

    function showPoemsByYear(word, year, filenamesSet) {
        const filenames = Array.from(filenamesSet);
        const poems = allPoems.filter(p => filenames.includes(p.filename));

        document.getElementById('selected-year-label').textContent = year;
        document.getElementById('selected-word-label').textContent = word;
        
        poemResultGrid.innerHTML = poems.map(p => `
            <div class="result-poem-card" data-filename="${esc(p.filename)}" role="button" tabindex="0">
                <span class="result-title">${esc(p.title || '无题')}</span>
                <span class="result-excerpt">${esc(getExcerpt(p.content, word))}</span>
            </div>
        `).join('');

        poemListContainer.style.display = '';   // 交回 CSS（flex 列，内部滚动）
        scrollTarget = poemListContainer.scrollTop;
        poemListContainer.scrollTop = 0;
    }

    function getExcerpt(content, keyword) {
        if (!content) return '';
        const index = content.indexOf(keyword);
        const start = Math.max(0, index - 5);
        const end = Math.min(content.length, index + keyword.length + 5);
        return '...' + content.substring(start, end).replace(/\n/g, ' ') + '...';
    }

    function setupEventListeners() {
        btnManage.addEventListener('click', () => { renderIgnoreCloud(); modal.style.display = 'flex'; });
        btnCloseModal.addEventListener('click', () => { modal.style.display = 'none'; analyzeData(); renderRankList(); });
        btnAddIgnore.addEventListener('click', addIgnoreWord);
        ignoreInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addIgnoreWord(); });
        if (closeDetailBtn) closeDetailBtn.addEventListener('click', closeDetailPanel);

        // 作品列表滚轮降速（必须 passive: false 才能接管）
        if (poemListContainer) {
            poemListContainer.addEventListener('wheel', handlePoemListWheel, { passive: false });
        }

        /* 高频词卡片：事件委托 + 键盘可达 */
        rankList.addEventListener('click', (e) => {
            const card = e.target.closest('.word-card');
            if (card && card.dataset.word) window.selectImagery(card.dataset.word);
        });
        rankList.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.word-card');
            if (card && card.dataset.word) { e.preventDefault(); window.selectImagery(card.dataset.word); }
        });

        /* 关联作品卡片 */
        poemResultGrid.addEventListener('click', (e) => {
            const card = e.target.closest('.result-poem-card');
            if (card && card.dataset.filename && window.App) window.App.openPoemByFilename(card.dataset.filename);
        });
        poemResultGrid.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const card = e.target.closest('.result-poem-card');
            if (card && card.dataset.filename && window.App) { e.preventDefault(); window.App.openPoemByFilename(card.dataset.filename); }
        });

        /* 屏蔽词：移除按钮事件委托 */
        ignoreCloud.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-ignore');
            if (btn) window.removeIgnore(btn.dataset.word);
        });

        /* 主题切换后重绘当前词汇图表（仅当仍停留在本页且画布尚在时） */
        document.addEventListener('mypoems:themechange', () => {
            if (window.App && typeof window.App.getCurrentPage === 'function' && window.App.getCurrentPage() !== 'imagery') return;
            if (!document.getElementById('usage-chart')) return;
            if (currentWord && wrapper.classList.contains('split-view')) {
                const data = wordStats.find(w => w.word === currentWord);
                if (data) {
                    renderFreqChart(currentWord, data.years);
                    renderRatioChart(currentWord, data.years);
                }
            }
        });

        /* 窗口尺寸变化：重新对齐两栏高度 */
        window.addEventListener('resize', () => {
            if (!document.body.contains(wrapper)) return;
            syncSplitHeights();
        });
    }

    function renderIgnoreCloud() {
        ignoreCloud.innerHTML = ignoreList.map(word => `
            <span class="ignore-tag">${esc(word)}<span class="remove-ignore" data-word="${esc(word)}" role="button" aria-label="移除屏蔽词">&times;</span></span>
        `).join('');
    }

    function addIgnoreWord() {
        const word = ignoreInput.value.trim();
        if (word && !ignoreList.includes(word)) {
            ignoreList.push(word);
            saveIgnoreList();
            renderIgnoreCloud();
            ignoreInput.value = '';
        }
    }

    window.removeIgnore = function(word) {
        ignoreList = ignoreList.filter(w => w !== word);
        saveIgnoreList();
        renderIgnoreCloud();
    };

    async function saveIgnoreList() {
        await fetch('/api/imagery/ignore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ignoreList) });
    }

    initialize();
})();