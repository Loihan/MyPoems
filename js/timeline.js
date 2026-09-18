/**
 * ===================================================================
 * MyPoems · 编年史 (js/timeline.js)
 *   年表全景轴 · 逐年切片（同比 / 月度小格 / 沉默期 / 新主题 / 新体裁）
 *   · 常用意象 → 意象簿　· 摘录句数 → 精句集（按年）
 * ===================================================================
 */

(function () {
    'use strict';

    const container = document.getElementById('timeline-container');
    const navContainer = document.getElementById('timeline-year-nav');
    const totalsEl = document.getElementById('tl-totals');
    const spanEl = document.getElementById('tl-span');
    const sparkEl = document.getElementById('tl-spark');

    let allPoems = [];
    let ignoreList = [];
    let yearsData = [];        // 逐年聚合结果（按年份倒序）

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function charCount(s) { return (s || '').replace(/\s/g, '').length; }
    function titleOf(p) { return p.title || '无题'; }
    function yearOf(p) { return (p.creationDate || '').substring(0, 4) || '未知'; }
    function monthOf(p) { return (p.creationDate || '').substring(5, 7); }

    function formatMD(dateStr) {
        if (!dateStr || dateStr.length < 10) return '';
        const m = parseInt(dateStr.substring(5, 7), 10);
        const d = parseInt(dateStr.substring(8, 10), 10);
        return (Number.isFinite(m) && Number.isFinite(d)) ? `${m}月${d}日` : '';
    }

    function daysBetween(a, b) {
        return Math.round((new Date(b) - new Date(a)) / 86400000);
    }

    /* ------------------------------------------------------------------
     * 载入
     * ---------------------------------------------------------------- */
    async function initialize() {
        if (!container) return;
        await loadData();
        buildYears();
        renderOverview();
        renderTimeline();
    }

    async function loadData() {
        try {
            const res = await fetch('/api/poems');
            const files = await res.json();
            allPoems = await Promise.all(files.map(async f => {
                const r = await fetch(`/api/poems/${encodeURIComponent(f)}`);
                const d = await r.json();
                return Object.assign({}, d, { filename: f });
            }));
        } catch (e) { allPoems = []; }

        try {
            const r = await fetch('/api/imagery/ignore');
            ignoreList = await r.json();
        } catch (e) { ignoreList = []; }

        allPoems.sort((a, b) => (a.creationDate || '').localeCompare(b.creationDate || ''));
    }

    /* 常用意象 TopN（单字 + 双字，剔除屏蔽词） */
    function imageryTop(poems, topN) {
        const map = new Map();
        const punct = /[^\u4e00-\u9fa5]/g;
        poems.forEach(p => {
            if (!p.content) return;
            const text = p.content.replace(punct, '');
            for (let i = 0; i < text.length; i++) {
                const ch = text[i];
                if (!ignoreList.includes(ch)) map.set(ch, (map.get(ch) || 0) + 1);
                if (i < text.length - 1) {
                    const w = text.substring(i, i + 2);
                    if (!ignoreList.includes(w)) map.set(w, (map.get(w) || 0) + 1);
                }
            }
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, topN).map(e => e[0]);
    }

    /* ------------------------------------------------------------------
     * 逐年聚合
     * ---------------------------------------------------------------- */
    function buildYears() {
        const map = new Map();
        allPoems.forEach(p => {
            const y = yearOf(p);
            if (!map.has(y)) map.set(y, []);
            map.get(y).push(p);
        });

        // 首次出现的体裁 / 主题（用于"那一年首次尝试"）
        const firstType = new Map();
        const firstTag = new Map();
        const firstGenre = new Map();
        allPoems.forEach(p => {
            const y = yearOf(p);
            if (p.type && !firstType.has(p.type)) firstType.set(p.type, y);
            (Array.isArray(p.tags) ? p.tags : []).forEach(t => { if (!firstTag.has(t)) firstTag.set(t, y); });
            if (p.type === '词' && p.genre && !firstGenre.has(p.genre)) firstGenre.set(p.genre, y);
        });

        const sortedYears = Array.from(map.keys()).filter(y => y !== '未知').sort((a, b) => b.localeCompare(a));

        yearsData = sortedYears.map((year, index) => {
            const poems = map.get(year).slice().sort((a, b) => (a.creationDate || '').localeCompare(b.creationDate || ''));
            const prevYear = sortedYears[index + 1];
            const prevCount = prevYear ? map.get(prevYear).length : null;

            const months = new Array(12).fill(0);
            poems.forEach(p => {
                const m = parseInt(monthOf(p), 10);
                if (m >= 1 && m <= 12) months[m - 1]++;
            });
            const monthMax = Math.max(1, ...months);

            let longestGap = 0;
            let gapFrom = null, gapTo = null;
            for (let i = 1; i < poems.length; i++) {
                const d = daysBetween(poems[i - 1].creationDate, poems[i].creationDate);
                if (d > longestGap) { longestGap = d; gapFrom = poems[i - 1]; gapTo = poems[i]; }
            }

            const typeCounts = {};
            poems.forEach(p => { const t = p.type || '其他'; typeCounts[t] = (typeCounts[t] || 0) + 1; });

            const poetry = poems.filter(p => p.type === '诗' || p.type === '词');
            let longest = null, longestChars = 0;
            poetry.forEach(p => { const c = charCount(p.content); if (c > longestChars) { longest = p; longestChars = c; } });

            const totalChars = poems.reduce((s, p) => s + charCount(p.content), 0);
            const quoteCount = poems.reduce((s, p) => s + (Array.isArray(p.quotes) ? p.quotes.length : 0), 0);

            const newGenres = [...new Set(poems.filter(p => p.type === '词' && p.genre && firstGenre.get(p.genre) === year).map(p => p.genre))];
            const newTags = [...new Set(poems.flatMap(p => Array.isArray(p.tags) ? p.tags : []).filter(t => firstTag.get(t) === year))];
            const newTypes = [...new Set(poems.map(p => p.type).filter(t => t && firstType.get(t) === year))];

            return {
                year, poems, months, monthMax, typeCounts, longest, longestChars, totalChars,
                quoteCount, newGenres, newTags, newTypes, longestGap, gapFrom, gapTo,
                avgChars: Math.round(totalChars / poems.length),
                delta: prevCount === null ? null : poems.length - prevCount,
                prevCount,
                topImagery: imageryTop(poetry, 5)
            };
        });
    }

    /* ------------------------------------------------------------------
     * 全景轴
     * ---------------------------------------------------------------- */
    function renderOverview() {
        if (!totalsEl) return;
        const totalChars = allPoems.reduce((s, p) => s + charCount(p.content), 0);
        const dated = allPoems.filter(p => p.creationDate);
        const first = dated[0], last = dated[dated.length - 1];
        const yearCount = yearsData.length;

        totalsEl.innerHTML = `
            <span class="tl-total"><strong>${allPoems.length}</strong> 篇</span>
            <span class="tl-total"><strong>${totalChars.toLocaleString()}</strong> 字</span>
            <span class="tl-total"><strong>${yearCount}</strong> 年</span>
            <span class="tl-total"><strong>${Math.round(totalChars / (allPoems.length || 1))}</strong> 字/篇</span>`;

        if (spanEl) {
            spanEl.textContent = (first && last)
                ? `起于《${titleOf(first)}》${first.creationDate}　止于《${titleOf(last)}》${last.creationDate}`
                : '';
        }

        // 首尾节点的说明，顺手把这块空白用起来
        const nowNode = document.getElementById('tl-node-now');
        const startNode = document.getElementById('tl-node-start');
        if (nowNode && last) {
            nowNode.innerHTML = `<strong>至今</strong> ${allPoems.length} 篇 · ${totalChars.toLocaleString()} 字 · 最近一次落笔 ${esc(last.creationDate)}`;
        }
        if (startNode && first) {
            startNode.innerHTML = `<strong>始于 ${esc(first.creationDate)}</strong> 第一首《${esc(titleOf(first))}》`;
        }

        if (!sparkEl) return;
        const max = Math.max(...yearsData.map(y => y.poems.length), 1);
        const nowYear = String(new Date().getFullYear());
        sparkEl.innerHTML = yearsData.slice().reverse().map(y => {
            const h = Math.max(6, Math.round(y.poems.length / max * 100));
            return `
            <button type="button" class="tl-spark__col${y.year === nowYear ? ' is-now' : ''}" data-year="${esc(y.year)}"
                    title="${esc(y.year)} 年 · ${y.poems.length} 篇">
                <span class="tl-spark__num">${y.poems.length}</span>
                <span class="tl-spark__bar" style="height:${h}%"></span>
                <span class="tl-spark__year">${esc(y.year)}</span>
            </button>`;
        }).join('');

        sparkEl.addEventListener('click', (e) => {
            const col = e.target.closest('.tl-spark__col');
            if (!col) return;
            const target = document.getElementById('year-' + col.dataset.year);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    /* ------------------------------------------------------------------
     * 年卡
     * ---------------------------------------------------------------- */
    function monthCells(y) {
        return `<div class="year-months" role="img" aria-label="${esc(y.year)} 年各月篇数">${
            y.months.map((c, i) => {
                const level = c === 0 ? 0 : Math.min(4, Math.ceil(c / y.monthMax * 4));
                return `<span class="year-month${c ? ' is-on' : ''}" data-level="${level}"
                              data-tip="${i + 1} 月 · ${c} 篇"></span>`;
            }).join('')
        }</div>`;
    }

    function renderTimeline() {
        if (!container) return;

        if (allPoems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__glyph">始</div>
                    <h3>书斋空空</h3>
                    <p>提笔写下第一篇，此处便会有年份生长。</p>
                </div>`;
            if (navContainer) navContainer.style.display = 'none';
            return;
        }

        const nowYear = String(new Date().getFullYear());

        container.innerHTML = yearsData.map(y => {
            const typeBadges = Object.entries(y.typeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([t, c]) => `<span class="badge type-${esc(t)}">${esc(t)} ${c}</span>`)
                .join('');

            const deltaHTML = y.delta === null
                ? '<span class="year-delta is-new">首年</span>'
                : `<span class="year-delta ${y.delta >= 0 ? 'is-up' : 'is-down'}" title="较 ${y.prevCount} 篇">
                       ${y.delta >= 0 ? '▲' : '▼'} ${Math.abs(y.delta)}
                   </span>`;

            const nowHTML = y.year === nowYear ? '<span class="year-ongoing">今年 · 未完</span>' : '';

            const imageryHTML = y.topImagery.length
                ? y.topImagery.map(w => `<button type="button" class="link-chip" data-imagery="${esc(w)}">${esc(w)}</button>`).join('')
                : '<span class="stat-empty">—</span>';

            const typeFilterHTML = Object.keys(y.typeCounts).length > 1
                ? `<div class="year-filter" role="group" aria-label="按类型筛选">
                       <button type="button" class="year-filter__btn is-active" data-type="all">全部 ${y.poems.length}</button>
                       ${Object.entries(y.typeCounts).sort((a, b) => b[1] - a[1])
                           .map(([t, c]) => `<button type="button" class="year-filter__btn" data-type="${esc(t)}">${esc(t)} ${c}</button>`).join('')}
                   </div>`
                : '';

            return `
            <article class="timeline-item" id="year-${esc(y.year)}">
                <div class="timeline-content year-card">
                    <div class="year-card__aside">
                        <div class="year-card-header">
                            <span class="year-num">${esc(y.year)}</span>
                            <span class="year-count">${y.poems.length} 篇</span>
                            ${deltaHTML}
                            ${nowHTML}
                        </div>

                        <div class="year-badges">${typeBadges}</div>

                        <div class="year-months-wrap">
                            ${monthCells(y)}
                            <span class="year-months__label">各月落笔</span>
                        </div>
                    </div>

                    <div class="year-card__main">
                        <div class="year-stats">
                            ${y.newGenres.length ? `<div class="year-stat"><span class="y-label">新用词牌</span>${esc(y.newGenres.join('、'))}</div>` : ''}
                            ${y.newTypes.length ? `<div class="year-stat"><span class="y-label">首次体裁</span>${esc(y.newTypes.join('、'))}</div>` : ''}
                            ${y.newTags.length ? `<div class="year-stat"><span class="y-label">新启主题</span>${esc(y.newTags.join('、'))}</div>` : ''}
                            <div class="year-stat"><span class="y-label">创作跨度</span>首《${esc(titleOf(y.poems[0]))}》${esc(formatMD(y.poems[0].creationDate))} → 末《${esc(titleOf(y.poems[y.poems.length - 1]))}》${esc(formatMD(y.poems[y.poems.length - 1].creationDate))}</div>
                            ${y.longest ? `<div class="year-stat"><span class="y-label">最长篇</span>《${esc(titleOf(y.longest))}》 ${y.longestChars} 字</div>` : ''}
                            <div class="year-stat"><span class="y-label">总字数</span>${y.totalChars} 字 · 平均 ${y.avgChars} 字/篇</div>
                            ${y.longestGap > 0 ? `<div class="year-stat"><span class="y-label">最长间隔</span>${y.longestGap} 天（${esc(formatMD(y.gapFrom.creationDate))} → ${esc(formatMD(y.gapTo.creationDate))}）</div>` : ''}
                            <div class="year-stat">
                                <span class="y-label">摘录</span>
                                ${y.quoteCount
                                    ? `<button type="button" class="link-btn" data-quotes-year="${esc(y.year)}">${y.quoteCount} 句 →</button>`
                                    : '<span class="stat-empty">无</span>'}
                            </div>
                            <div class="year-stat"><span class="y-label">常用意象</span><span class="link-chips">${imageryHTML}</span></div>
                        </div>
                    </div>

                    <div class="year-card__foot">
                        ${typeFilterHTML}

                        <div class="year-poem-list">
                            ${y.poems.map(p => `
                                <div class="year-poem-item" data-filename="${esc(p.filename)}" data-type="${esc(p.type || '')}" role="button" tabindex="0">
                                    <span class="ypi-title">${esc(titleOf(p))}</span>
                                    <span class="ypi-date">${esc(p.creationDate || '')}</span>
                                </div>`).join('')}
                        </div>

                        <div class="year-toggle-hint">展开 ${y.poems.length} 篇作品 ▾</div>
                    </div>

                    <div class="timeline-marker"></div>
                </div>
            </article>`;
        }).join('');

        renderYearNav(yearsData);
        bindEvents();
    }

    function renderYearNav(list) {
        if (!navContainer) return;
        if (list.length < 2) { navContainer.style.display = 'none'; return; }
        navContainer.style.display = 'block';
        navContainer.innerHTML = `<div class="year-nav-sticky-wrapper">${list.map(y => `
            <a href="#year-${esc(y.year)}" class="year-nav-item" data-year="${esc(y.year)}"
               title="${esc(y.year)} 年 · ${y.poems.length} 篇">${esc(y.year)}<em>${y.poems.length}</em></a>
        `).join('')}</div>`;

        navContainer.querySelectorAll('.year-nav-item').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const target = document.getElementById('year-' + link.dataset.year);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });

        // 量出小条一半高度写进变量，让它吸附时正好落在屏幕正中
        syncNavHalf();
        window.addEventListener('resize', syncNavHalf);
    }

    function syncNavHalf() {
        if (!navContainer) return;
        const inner = navContainer.querySelector('.year-nav-sticky-wrapper');
        if (!inner) return;
        navContainer.style.setProperty('--nav-half', Math.round(inner.offsetHeight / 2) + 'px');
    }

    /* ------------------------------------------------------------------
     * 交互
     * ---------------------------------------------------------------- */
    function bindEvents() {
        // 年卡：展开 / 收起（点作品项、按钮则不触发）
        container.querySelectorAll('.year-card').forEach(card => {
            card.setAttribute('tabindex', '0');
            card.setAttribute('role', 'button');

            const toggle = () => {
                const expanded = card.classList.toggle('expanded');
                const hint = card.querySelector('.year-toggle-hint');
                if (hint) {
                    const n = card.querySelectorAll('.year-poem-item').length;
                    hint.textContent = expanded ? `收起 ${n} 篇 ▴` : `展开 ${n} 篇作品 ▾`;
                }
            };

            card.addEventListener('click', (e) => {
                if (e.target.closest('.year-poem-item, button, a')) return;
                toggle();
            });
            card.addEventListener('keydown', (e) => {
                if (e.target !== card) return;
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
            });
        });

        // 作品项：右侧阅读栏
        container.querySelectorAll('.year-poem-item').forEach(item => {
            const open = (e) => {
                e.stopPropagation();
                if (window.App && window.App.openPoemByFilename) window.App.openPoemByFilename(item.dataset.filename);
            };
            item.addEventListener('click', open);
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
            });
        });

        // 年内类型筛选
        container.querySelectorAll('.year-filter').forEach(bar => {
            bar.addEventListener('click', (e) => {
                const btn = e.target.closest('.year-filter__btn');
                if (!btn) return;
                e.stopPropagation();
                const type = btn.dataset.type;
                bar.querySelectorAll('.year-filter__btn').forEach(b => b.classList.toggle('is-active', b === btn));
                const card = bar.closest('.year-card');
                card.querySelectorAll('.year-poem-item').forEach(it => {
                    const show = type === 'all' || it.dataset.type === type;
                    it.classList.toggle('is-hidden', !show);
                });
                // 筛选后自动展开，方便立刻看到结果
                card.classList.add('expanded');
                const hint = card.querySelector('.year-toggle-hint');
                if (hint) {
                    const visible = card.querySelectorAll('.year-poem-item:not(.is-hidden)').length;
                    hint.textContent = `收起 ${visible} 篇 ▴`;
                }
            });
        });

        // 常用意象 → 意象簿
        container.querySelectorAll('[data-imagery]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.App && window.App.openImagery) window.App.openImagery(btn.dataset.imagery);
            });
        });

        // 摘录 → 精句集（按年）
        container.querySelectorAll('[data-quotes-year]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.App && window.App.openQuotesOfYear) window.App.openQuotesOfYear(btn.dataset.quotesYear);
            });
        });

        // 年份导航：↑↓ 切换
        document.addEventListener('keydown', (e) => {
            if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            if (!navContainer || navContainer.style.display === 'none') return;
            const links = Array.from(navContainer.querySelectorAll('.year-nav-item'));
            let idx = links.findIndex(a => a.classList.contains('is-current'));
            idx = e.key === 'ArrowDown' ? Math.min(links.length - 1, idx + 1) : Math.max(0, idx - 1);
            if (idx >= 0 && links[idx]) links[idx].click();
        });

        // 滚动时高亮"当前年份"，顺便给 ↑↓ 一个起点
        let spyRaf = 0;
        const spy = () => {
            if (spyRaf) return;
            spyRaf = window.requestAnimationFrame(() => {
                spyRaf = 0;
                if (!document.body.contains(container)) return;     // 已离开本页
                if (!navContainer || navContainer.style.display === 'none') return;
                const mid = window.innerHeight / 2;
                let best = null, bestDist = Infinity;
                container.querySelectorAll('.timeline-item').forEach(item => {
                    const r = item.getBoundingClientRect();
                    const d = Math.abs((r.top + r.height / 2) - mid);
                    if (d < bestDist) { bestDist = d; best = item.id.replace('year-', ''); }
                });
                navContainer.querySelectorAll('.year-nav-item').forEach(a =>
                    a.classList.toggle('is-current', a.dataset.year === best));
            });
        };
        window.addEventListener('scroll', spy, { passive: true });
        spy();
    }

    initialize();
})();
