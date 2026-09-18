/**
 * ===================================================================
 * MyPoems · 笔耕录 (js/stats.js)
 *   全期聚合画像：总量 / 累计字数 / 篇长分布 / 月份偏好 / 创作节律 / 之最 / 排行
 *   逐年趋势已移交编年史，这里不再画"每年篇数"，改为"累计"与"分布"。
 * ===================================================================
 */

(function () {
    'use strict';

    let allPoems = [];
    let stats = null;
    const charts = {};      // { cumulative, length }

    /* 十二月的雅称（正月起，与节气对应） */
    const MONTH_NAMES = ['孟春', '仲春', '季春', '孟夏', '仲夏', '季夏', '孟秋', '仲秋', '季秋', '孟冬', '仲冬', '季冬'];

    const TYPE_COLORS = {
        '诗': '#35597f', '词': '#a43a6b', '文言文': '#a06a2c',
        '现代文': '#2f7d6a', '随笔': '#6b5aa8', '其他': '#7b7266'
    };

    function charCount(s) { return (s || '').replace(/\s/g, '').length; }
    function titleOf(p) { return p.title || '无题'; }
    function fmt(n) { return Number(n).toLocaleString(); }
    function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ------------------------------------------------------------------
     * 启动
     * ---------------------------------------------------------------- */
    async function initialize() {
        await loadAllPoems();
        stats = computeStats();

        renderOverview();
        renderCumulative();
        renderLengthChart();
        renderMonthBars();
        renderRhythm();
        renderTypeDistribution();
        renderRecords();
        renderCipaiList();
        renderTagRanking();

        document.addEventListener('mypoems:themechange', () => {
            if (window.App && typeof window.App.getCurrentPage === 'function' && window.App.getCurrentPage() !== 'stats') return;
            renderCumulative();
            renderLengthChart();
        });
    }

    async function loadAllPoems() {
        try {
            const response = await fetch('/api/poems');
            const poemFiles = await response.json();
            allPoems = await Promise.all(poemFiles.map(async filename => {
                const res = await fetch(`/api/poems/${encodeURIComponent(filename)}`);
                return Object.assign({}, await res.json(), { filename });
            }));
        } catch (error) { console.error(error); }
    }

    /* ------------------------------------------------------------------
     * 一次性算出全期指标
     * ---------------------------------------------------------------- */
    function computeStats() {
        const dated = allPoems
            .filter(p => p.creationDate)
            .sort((a, b) => a.creationDate.localeCompare(b.creationDate));

        const totalChars = allPoems.reduce((s, p) => s + charCount(p.content), 0);
        const lengths = allPoems.map(p => charCount(p.content));

        // 动笔天数 / 单日最多
        const byDay = {};
        dated.forEach(p => { byDay[p.creationDate] = (byDay[p.creationDate] || 0) + 1; });
        const days = Object.keys(byDay).sort();
        let busiestDay = null, busiestDayCount = 0;
        Object.entries(byDay).forEach(([d, c]) => { if (c > busiestDayCount) { busiestDayCount = c; busiestDay = d; } });

        // 最长沉默（相邻两篇之间）
        let gap = { days: 0 };
        for (let i = 1; i < dated.length; i++) {
            const d = daysBetween(dated[i - 1].creationDate, dated[i].creationDate);
            if (d > gap.days) {
                gap = { days: d, from: dated[i - 1].creationDate, to: dated[i].creationDate,
                        fromTitle: titleOf(dated[i - 1]), toTitle: titleOf(dated[i]) };
            }
        }

        // 平均间隔（只在有作品的日子之间）
        let avgGap = 0;
        if (days.length > 1) {
            const span = daysBetween(days[0], days[days.length - 1]);
            avgGap = Math.round(span / (days.length - 1));
        }

        // 月份偏好
        const months = new Array(12).fill(0);
        dated.forEach(p => {
            const m = parseInt(p.creationDate.substring(5, 7), 10);
            if (m >= 1 && m <= 12) months[m - 1]++;
        });
        const monthMax = Math.max(1, ...months);
        const bestMonth = months.indexOf(Math.max(...months));

        // 最密的一个月
        const byMonth = {};
        dated.forEach(p => { const k = p.creationDate.substring(0, 7); byMonth[k] = (byMonth[k] || 0) + 1; });
        let busiestMonth = '', busiestMonthCount = 0;
        Object.entries(byMonth).forEach(([k, c]) => { if (c > busiestMonthCount) { busiestMonthCount = c; busiestMonth = k; } });

        // 累计字数（按日）
        const cumulative = [];
        let run = 0;
        const byDate = new Map();
        dated.forEach(p => {
            const k = p.creationDate;
            byDate.set(k, (byDate.get(k) || 0) + charCount(p.content));
        });
        Array.from(byDate.keys()).sort().forEach(k => {
            run += byDate.get(k);
            cumulative.push({ date: k, total: run });
        });

        // 篇长分箱
        const bins = [
            { label: '≤32', min: 0, max: 32 },
            { label: '33–64', min: 33, max: 64 },
            { label: '65–100', min: 65, max: 100 },
            { label: '101–150', min: 101, max: 150 },
            { label: '151–250', min: 151, max: 250 },
            { label: '>250', min: 251, max: Infinity }
        ];
        bins.forEach(b => { b.count = 0; b.types = {}; });
        allPoems.forEach(p => {
            const len = charCount(p.content);
            const bin = bins.find(b => len >= b.min && len <= b.max);
            if (!bin) return;
            bin.count++;
            const t = p.type || '其他';
            bin.types[t] = (bin.types[t] || 0) + 1;
        });

        return {
            total: allPoems.length,
            totalChars,
            activeDays: days.length,
            avgLen: Math.round(totalChars / (allPoems.length || 1)),
            first: dated[0], last: dated[dated.length - 1],
            busiestDay, busiestDayCount,
            busiestMonth, busiestMonthCount,
            longestGap: gap,
            avgGap,
            months, monthMax, bestMonth,
            cumulative, bins,
            shortest: allPoems.length ? allPoems.reduce((a, b) => charCount(a.content) <= charCount(b.content) ? a : b) : null,
            longest: allPoems.length ? allPoems.reduce((a, b) => charCount(a.content) >= charCount(b.content) ? a : b) : null
        };
    }

    /* ------------------------------------------------------------------
     * 1. 概览
     * ---------------------------------------------------------------- */
    function renderOverview() {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('stat-total-poems', stats.total);
        set('stat-total-chars', fmt(stats.totalChars));
        set('stat-active-days', stats.activeDays);
        set('stat-avg-len', stats.avgLen);
    }

    /* ------------------------------------------------------------------
     * 2. 累计字数曲线
     * ---------------------------------------------------------------- */
    function chartColors() {
        const isDark = document.body.classList.contains('dark-theme');
        return {
            isDark,
            accent: isDark ? '#e0705f' : '#b23a2c',
            accentBg: isDark ? 'rgba(224,112,95,.16)' : 'rgba(178,58,44,.10)',
            grid: isDark ? 'rgba(242,236,224,.08)' : 'rgba(29,25,19,.08)',
            tick: isDark ? '#8e8778' : '#8a7e6d'
        };
    }

    function destroyChart(key, canvas) {
        if (charts[key]) { try { charts[key].destroy(); } catch (e) { /* 已销毁 */ } charts[key] = null; }
        if (canvas && window.Chart && typeof window.Chart.getChart === 'function') {
            const leftover = window.Chart.getChart(canvas);
            if (leftover) leftover.destroy();
        }
    }

    function renderCumulative() {
        const canvas = document.getElementById('cumulative-chart');
        if (!canvas || !stats) return;
        const noteEl = document.getElementById('cumulative-note');
        if (stats.cumulative.length < 2) {
            canvas.parentElement.innerHTML = '<span class="stat-empty">数据还太少，暂时画不出坡度</span>';
            return;
        }
        if (noteEl) {
            noteEl.textContent = `每一次落笔累加一次：从 ${stats.first.creationDate} 的第 1 篇，到如今 ${fmt(stats.totalChars)} 字。`;
        }

        const c = chartColors();
        destroyChart('cumulative', canvas);

        charts.cumulative = new Chart(canvas, {
            type: 'line',
            data: {
                labels: stats.cumulative.map(d => d.date),
                datasets: [{
                    label: '累计字数',
                    data: stats.cumulative.map(d => d.total),
                    borderColor: c.accent,
                    backgroundColor: c.accentBg,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: c.accent
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => items[0].label,
                            label: (ctx) => ` 累计 ${fmt(ctx.parsed.y)} 字`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: c.tick, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: c.grid },
                        ticks: { color: c.tick, callback: (v) => fmt(v) }
                    }
                }
            }
        });
    }

    /* ------------------------------------------------------------------
     * 3. 篇长分布
     * ---------------------------------------------------------------- */
    function renderLengthChart() {
        const canvas = document.getElementById('length-chart');
        if (!canvas || !stats) return;
        const noteEl = document.getElementById('length-note');

        const peak = stats.bins.reduce((a, b) => b.count > a.count ? b : a, stats.bins[0]);
        if (noteEl) {
            const poetry = allPoems.filter(p => p.type === '诗' || p.type === '词');
            const avgPoetry = poetry.length
                ? Math.round(poetry.reduce((s, p) => s + charCount(p.content), 0) / poetry.length) : 0;
            noteEl.textContent = `最常见的是 ${peak.label} 字（${peak.count} 篇）；诗与词的平均长度约 ${avgPoetry} 字。`;
        }

        const c = chartColors();
        destroyChart('length', canvas);

        charts.length = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: stats.bins.map(b => b.label + ' 字'),
                datasets: [{
                    label: '篇数',
                    data: stats.bins.map(b => b.count),
                    backgroundColor: stats.bins.map(b => {
                        const top = Object.entries(b.types).sort((x, y) => y[1] - x[1])[0];
                        const color = TYPE_COLORS[top ? top[0] : '其他'] || TYPE_COLORS['其他'];
                        return color + (c.isDark ? '99' : 'aa');
                    }),
                    borderColor: stats.bins.map(b => {
                        const top = Object.entries(b.types).sort((x, y) => y[1] - x[1])[0];
                        return TYPE_COLORS[top ? top[0] : '其他'] || TYPE_COLORS['其他'];
                    }),
                    borderWidth: 1,
                    borderRadius: 6,
                    maxBarThickness: 52
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const bin = stats.bins[ctx.dataIndex];
                                const detail = Object.entries(bin.types)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([t, n]) => `${t} ${n}`).join(' · ');
                                return [` ${bin.count} 篇`, detail ? ' ' + detail : ''].filter(Boolean);
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: c.tick } },
                    y: { beginAtZero: true, grid: { color: c.grid }, ticks: { color: c.tick, precision: 0 } }
                }
            }
        });
    }

    /* ------------------------------------------------------------------
     * 4. 全期月份偏好（纯 CSS 柱）
     * ---------------------------------------------------------------- */
    function renderMonthBars() {
        const el = document.getElementById('month-bars');
        if (!el || !stats) return;
        const noteEl = document.getElementById('month-note');

        const maxIdx = stats.bestMonth;
        el.innerHTML = stats.months.map((count, i) => {
            const h = Math.round(count / stats.monthMax * 100);
            return `
            <div class="month-bar${i === maxIdx ? ' is-peak' : ''}" title="${i + 1} 月 · ${count} 篇">
                <span class="month-bar__num">${count || ''}</span>
                <span class="month-bar__fill" style="height:${Math.max(count ? 6 : 0, h)}%"></span>
                <span class="month-bar__label">${i + 1}</span>
            </div>`;
        }).join('');

        if (noteEl) {
            const top = stats.months.map((c, i) => [i, c]).sort((a, b) => b[1] - a[1]).slice(0, 3);
            const bottom = stats.months.map((c, i) => [i, c]).sort((a, b) => a[1] - b[1]).slice(0, 2);
            noteEl.textContent =
                `最常动笔：${top.map(([i, c]) => `${i + 1} 月 ${MONTH_NAMES[i]} ${c} 篇`).join('、')}；` +
                `最少：${bottom.map(([i, c]) => `${i + 1} 月 ${c} 篇`).join('、')}。`;
        }
    }

    /* ------------------------------------------------------------------
     * 5. 创作节律
     * ---------------------------------------------------------------- */
    function renderRhythm() {
        const el = document.getElementById('rhythm-grid');
        if (!el || !stats) return;

        const items = [
            { label: '平均间隔', value: stats.avgGap ? stats.avgGap + ' 天' : '—',
              desc: stats.avgGap ? '两个动笔日之间的平均间隔' : '至少需要两天的记录' },
            { label: '动笔天数', value: stats.activeDays + ' 天',
              desc: stats.first ? `跨度 ${daysBetween(stats.first.creationDate, stats.last.creationDate)} 天` : '' },
            { label: '单日最多', value: stats.busiestDayCount ? stats.busiestDayCount + ' 篇' : '—',
              desc: stats.busiestDay || '' },
            { label: '最密一月', value: stats.busiestMonthCount ? stats.busiestMonthCount + ' 篇' : '—',
              desc: stats.busiestMonth || '' },
            { label: '最长沉默', value: stats.longestGap.days ? stats.longestGap.days + ' 天' : '—',
              desc: stats.longestGap.days ? `${stats.longestGap.from} → ${stats.longestGap.to}` : '' }
        ];

        el.innerHTML = items.map(it => `
            <div class="rhythm-item">
                <span class="rhythm-item__label">${esc(it.label)}</span>
                <span class="rhythm-item__value">${esc(it.value)}</span>
                <span class="rhythm-item__desc">${esc(it.desc)}</span>
            </div>`).join('');
    }

    /* ------------------------------------------------------------------
     * 6. 体裁分布（点击 → 作品总览筛选）
     * ---------------------------------------------------------------- */
    function renderTypeDistribution() {
        const container = document.getElementById('type-distribution');
        if (!container) return;
        const typeCounts = {};
        allPoems.forEach(p => { const t = p.type || '其他'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
        const total = allPoems.length;
        if (!total) { container.innerHTML = '<span class="stat-empty">暂无数据</span>'; return; }

        container.innerHTML = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => `
                <button type="button" class="dist-item dist-item--clickable" data-type="${esc(type)}"
                        title="在作品总览中只看「${esc(type)}」">
                    <span class="dist-label"><span>${esc(type)}</span><span>${count} · ${Math.round(count / total * 100)}%</span></span>
                    <span class="dist-bar-bg"><span class="dist-bar-fill" style="width:${count / total * 100}%;background-color:${TYPE_COLORS[type] || TYPE_COLORS['其他']}"></span></span>
                </button>`).join('');

        container.addEventListener('click', (e) => {
            const item = e.target.closest('[data-type]');
            if (item && window.App && window.App.openView) window.App.openView({ type: item.dataset.type });
        });
    }

    /* ------------------------------------------------------------------
     * 7. 创作之最
     * ---------------------------------------------------------------- */
    function renderRecords() {
        const el = document.getElementById('records-grid');
        if (!el || !stats) return;
        const records = [];

        if (stats.longest) records.push({ label: '最长的一篇', value: `《${titleOf(stats.longest)}》 ${charCount(stats.longest.content)} 字` });
        if (stats.shortest && stats.shortest !== stats.longest) records.push({ label: '最短的一篇', value: `《${titleOf(stats.shortest)}》 ${charCount(stats.shortest.content)} 字` });
        if (stats.first) records.push({ label: '最早的一篇', value: `《${titleOf(stats.first)}》 ${stats.first.creationDate}` });
        if (stats.last) records.push({ label: '最近的一篇', value: `《${titleOf(stats.last)}》 ${stats.last.creationDate}` });

        const byYear = {};
        allPoems.forEach(p => { const y = (p.creationDate || '').substring(0, 4); if (y) byYear[y] = (byYear[y] || 0) + 1; });
        const topYear = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0];
        if (topYear) records.push({ label: '最高产的一年', value: `${topYear[0]} 年 · ${topYear[1]} 篇` });

        if (stats.busiestMonth) {
            const [y, m] = stats.busiestMonth.split('-');
            records.push({ label: '最高产的一月', value: `${y} 年 ${parseInt(m, 10)} 月 · ${stats.busiestMonthCount} 篇` });
        }
        if (stats.busiestDay) records.push({ label: '单日最多', value: `${stats.busiestDay} · ${stats.busiestDayCount} 篇` });
        if (stats.longestGap.days) {
            records.push({ label: '最长的一次沉默', value: `${stats.longestGap.days} 天（${stats.longestGap.from} → ${stats.longestGap.to}）` });
        }

        const typeCount = {};
        allPoems.forEach(p => { const t = p.type || '其他'; typeCount[t] = (typeCount[t] || 0) + 1; });
        const topType = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];
        if (topType) records.push({ label: '最常用的体裁', value: `${topType[0]} · ${topType[1]} 篇` });

        el.innerHTML = records.map(r => `
            <div class="record-card">
                <span class="record-label">${esc(r.label)}</span>
                <span class="record-value">${esc(r.value)}</span>
            </div>`).join('');
    }

    /* ------------------------------------------------------------------
     * 8. 词牌 / 主题（点击 → 作品总览筛选）
     * ---------------------------------------------------------------- */
    function renderCipaiList() {
        const el = document.getElementById('cipai-list');
        if (!el) return;
        const cipai = {};
        allPoems.forEach(p => { if (p.type === '词' && p.genre) cipai[p.genre] = (cipai[p.genre] || 0) + 1; });
        const entries = Object.entries(cipai).sort((a, b) => b[1] - a[1]);
        if (!entries.length) { el.innerHTML = '<span class="stat-empty">暂无词牌</span>'; return; }

        el.innerHTML = entries.map(([name, count]) =>
            `<button type="button" class="stat-chip stat-chip--clickable" data-genre="${esc(name)}"
                     title="在作品总览中筛选词牌「${esc(name)}」">${esc(name)}<em>×${count}</em></button>`).join('');

        el.onclick = (e) => {
            const chip = e.target.closest('[data-genre]');
            if (chip && window.App && window.App.openView) window.App.openView({ genre: chip.dataset.genre });
        };
    }

    function renderTagRanking() {
        const el = document.getElementById('tag-ranking');
        if (!el) return;
        const tags = {};
        allPoems.forEach(p => {
            (Array.isArray(p.tags) ? p.tags : []).forEach(t => { tags[t] = (tags[t] || 0) + 1; });
        });
        const entries = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 20);
        if (!entries.length) { el.innerHTML = '<span class="stat-empty">暂无标签</span>'; return; }

        el.innerHTML = entries.map(([name, count]) =>
            `<button type="button" class="stat-chip stat-chip--clickable" data-tag="${esc(name)}"
                     title="在作品总览中筛选标签「${esc(name)}」">${esc(name)}<em>×${count}</em></button>`).join('');

        el.onclick = (e) => {
            const chip = e.target.closest('[data-tag]');
            if (chip && window.App && window.App.openView) window.App.openView({ tag: chip.dataset.tag });
        };
    }

    initialize();
})();
