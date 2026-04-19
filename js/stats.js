/**
 * ===================================================================
 * MyPoems - 笔耕录逻辑脚本 (stats.js) - 洞察增强版
 * ===================================================================
 */

(function() {
    let allPoems = [];

    // 月份雅称 (用于时节洞察)
    const monthNames = {
        '01': '孟春', '02': '仲春', '03': '季春',
        '04': '孟夏', '05': '仲夏', '06': '季夏',
        '07': '孟秋', '08': '仲秋', '09': '季秋',
        '10': '孟冬', '11': '仲冬', '12': '季冬'
    };

    async function initialize() {
        await loadAllPoems();
        renderOverview();
        calculateInsights(); // 【新增】计算洞察指标
        renderHeatmap();
        renderTypeDistribution();
    }

    async function loadAllPoems() {
        try {
            const response = await fetch('/api/poems');
            const poemFiles = await response.json();
            allPoems = await Promise.all(
                poemFiles.map(async filename => {
                    const res = await fetch(`/api/poems/${filename}`);
                    return res.json();
                })
            );
        } catch (error) { console.error(error); }
    }

    // 1. 概览
    function renderOverview() {
        const totalPoems = allPoems.length;
        const totalChars = allPoems.reduce((acc, p) => acc + (p.content || '').replace(/\s/g, '').length, 0);
        const uniqueDays = new Set(allPoems.map(p => p.creationDate)).size;

        document.getElementById('stat-total-poems').textContent = totalPoems;
        document.getElementById('stat-total-chars').textContent = totalChars.toLocaleString();
        document.getElementById('stat-days-active').textContent = uniqueDays;
    }

    // 2. 【核心】计算洞察指标
    function calculateInsights() {
        if (allPoems.length < 2) return;

        // --- A. 最长的沉默 ---
        // 先按时间正序排列
        const sortedByDate = [...allPoems].sort((a, b) => new Date(a.creationDate) - new Date(b.creationDate));
        
        let maxGap = 0;
        let gapStart = null;
        let gapEnd = null;

        for (let i = 1; i < sortedByDate.length; i++) {
            const date1 = new Date(sortedByDate[i - 1].creationDate);
            const date2 = new Date(sortedByDate[i].creationDate);
            
            const diffTime = Math.abs(date2 - date1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

            if (diffDays > maxGap) {
                maxGap = diffDays;
                gapStart = sortedByDate[i - 1].creationDate;
                gapEnd = sortedByDate[i].creationDate;
            }
        }

        if (maxGap > 0) {
            document.getElementById('insight-silence-days').textContent = maxGap;
            // 格式化日期显示为 2021.02 - 2021.04
            const s = gapStart.substring(0, 7).replace('-', '.');
            const e = gapEnd.substring(0, 7).replace('-', '.');
            document.getElementById('insight-silence-period').textContent = `（${s} – ${e}）`;
        }

        // --- B. 最密集的创作期 ---
        const monthCounts = {};
        allPoems.forEach(p => {
            if (p.creationDate) {
                const monthKey = p.creationDate.substring(0, 7); // 2023-10
                monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
            }
        });

        // 找最大值
        let maxMonth = '';
        let maxMonthCount = 0;
        for (const [m, c] of Object.entries(monthCounts)) {
            if (c > maxMonthCount) {
                maxMonthCount = c;
                maxMonth = m;
            }
        }

        if (maxMonth) {
            const [y, m] = maxMonth.split('-');
            document.getElementById('insight-busy-month').textContent = `${y} 年 ${m} 月`;
            document.getElementById('insight-busy-count').textContent = maxMonthCount;
        }

        // --- C. 偏爱的时节 (月份分布) ---
        const seasonCounts = {};
        allPoems.forEach(p => {
            if (p.creationDate) {
                const m = p.creationDate.substring(5, 7); // 01, 10
                seasonCounts[m] = (seasonCounts[m] || 0) + 1;
            }
        });

        let favSeasonKey = '';
        let favSeasonCount = 0;
        for (const [m, c] of Object.entries(seasonCounts)) {
            if (c > favSeasonCount) {
                favSeasonCount = c;
                favSeasonKey = m;
            }
        }

        if (favSeasonKey) {
            document.getElementById('insight-fav-season').textContent = monthNames[favSeasonKey];
        }
    }

    // 3. 热力图
    function renderHeatmap() {
        const container = document.getElementById('calendar-heatmap');
        if (!container) return;
        const dateCountMap = {};
        allPoems.forEach(p => { if (p.creationDate) dateCountMap[p.creationDate] = (dateCountMap[p.creationDate] || 0) + 1; });
        const today = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setDate(today.getDate() - 364);
        let html = '';
        for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const count = dateCountMap[dateStr] || 0;
            let level = 0;
            if (count > 0) level = 1;
            if (count > 1) level = 2;
            if (count > 3) level = 3;
            if (count > 5) level = 4;
            const title = `${dateStr}: ${count} 篇`;
            html += `<div class="heatmap-day level-${level}" title="${title}"></div>`;
        }
        container.innerHTML = html;
    }

    // 4. 分布条
    function renderTypeDistribution() {
        const container = document.getElementById('type-distribution');
        if (!container) return;
        const typeCounts = {};
        allPoems.forEach(p => { typeCounts[p.type || '其他'] = (typeCounts[p.type || '其他'] || 0) + 1; });
        const total = allPoems.length;
        if (total === 0) return;
        const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
        const colors = { '诗': '#3b82f6', '词': '#ec4899', '文言文': '#f59e0b', '现代文': '#10b981', '随笔': '#8b5cf6', '其他': '#9ca3af' };
        let html = '';
        sortedTypes.forEach(([type, count]) => {
            const percentage = (count / total) * 100;
            const color = colors[type] || colors['其他'];
            html += `
                <div class="dist-item">
                    <div class="dist-label"><span>${type}</span><span>${count}</span></div>
                    <div class="dist-bar-bg"><div class="dist-bar-fill" style="width: ${percentage}%; background-color: ${color};"></div></div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    initialize();
})();