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
            rankList.innerHTML = '<div style="text-align:center;width:100%;">暂无数据</div>';
            return;
        }

        rankList.innerHTML = wordStats.map((item, index) => `
            <div class="word-card" onclick="window.selectImagery('${item.word}')">
                <span class="rank-num">${index + 1}</span>
                <span class="word-text">${item.word}</span>
                <span class="word-count">${item.count}次</span>
            </div>
        `).join('');
    }

    // --- 详情交互 ---
    
    window.selectImagery = function(word) {
        const data = wordStats.find(w => w.word === word);
        if (!data) return;

        wrapper.classList.add('split-view');
        
        // 渲染田字格
        renderTianzi(word);
        
        // 渲染两个图表
        // 延迟一点以确保容器尺寸正确
        setTimeout(() => {
            renderFreqChart(word, data.years);
            renderRatioChart(word, data.years);
        }, 300);

        // 【新增】默认展示最新一年的数据
        const sortedYears = Object.keys(data.years).sort();
        if (sortedYears.length > 0) {
            const latestYear = sortedYears[sortedYears.length - 1];
            showPoemsByYear(word, latestYear, data.years[latestYear]);
        } else {
            poemListContainer.style.display = 'none';
        }
        
        // 高亮左侧
        const cards = rankList.querySelectorAll('.word-card');
        cards.forEach(c => c.classList.remove('active'));
        const activeCard = Array.from(cards).find(c => c.querySelector('.word-text').textContent === word);
        if(activeCard) activeCard.classList.add('active');
    };

    function closeDetailPanel() {
        wrapper.classList.remove('split-view');
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
        const ctx = document.getElementById('usage-chart').getContext('2d');
        const sortedYears = Object.keys(yearsData).sort();
        
        if (freqChartInstance) freqChartInstance.destroy();
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
    }

    // --- 图表 2: 占比图 (新增) ---
    function renderRatioChart(word, yearsData) {
        const ctx = document.getElementById('ratio-chart').getContext('2d');
        const sortedYears = Object.keys(yearsData).sort();
        
        if (ratioChartInstance) ratioChartInstance.destroy();
        if (sortedYears.length === 0) return;

        // 计算百分比: (该词出现篇数 / 当年总篇数) * 100
        const ratios = sortedYears.map(y => {
            const wordCount = yearsData[y].size;
            const totalCount = yearTotalCounts[y] || 1; // 防止除以0
            return ((wordCount / totalCount) * 100).toFixed(1);
        });

        const { color, bgColor, gridColor } = getChartColors();
        // 占比图用不同的颜色 (紫色系)
        const ratioColor = '#8b5cf6'; 
        const ratioBg = document.body.classList.contains('dark-theme') ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)';

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
    }

    // 辅助: 获取图表配置
    function getChartColors() {
        const isDark = document.body.classList.contains('dark-theme');
        return {
            color: isDark ? '#60a5fa' : '#3b82f6',
            bgColor: isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            gridColor: isDark ? '#3f3f46' : '#eee'
        };
    }

    function getChartOptions(gridColor, clickHandler, isPercent = false) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { color: gridColor }, 
                    ticks: { 
                        stepSize: isPercent ? null : 1,
                        callback: function(value) { return value + (isPercent ? '%' : '') }
                    } 
                },
                x: { grid: { display: false } }
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
            <div class="result-poem-card" onclick="window.App.openPoemByFilename('${p.filename}')">
                <span class="result-title">${p.title}</span>
                <span class="result-excerpt">${getExcerpt(p.content, word)}</span>
            </div>
        `).join('');

        poemListContainer.style.display = 'block';
        // 不再自动滚动到底部，避免打断用户查看图表
        // 如果需要，可以恢复 scrollIntoView
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
        if(closeDetailBtn) closeDetailBtn.addEventListener('click', closeDetailPanel);
    }

    function renderIgnoreCloud() {
        ignoreCloud.innerHTML = ignoreList.map(word => `
            <span class="ignore-tag">${word}<span class="remove-ignore" onclick="window.removeIgnore('${word}')">&times;</span></span>
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