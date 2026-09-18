/**
 * ===================================================================
 * MyPoems · 精句集 (js/quotes.js)
 *   今日一句 · 案头收藏(服务端 favorites.json) · 横轴吸附卡组 · 分组精句墙
 * ===================================================================
 */

(function () {
    'use strict';

    /* ---------------- DOM ---------------- */
    const track = document.getElementById('quotes-rail-track');
    const refreshBtn = document.getElementById('refresh-quotes-btn');
    const randomBtn = document.getElementById('random-quote-btn');
    const prevBtn = document.getElementById('quotes-prev');
    const nextBtn = document.getElementById('quotes-next');
    const counterEl = document.getElementById('quotes-counter');
    const railNowEl = document.getElementById('rail-now');
    const railCopyBtn = document.getElementById('rail-copy');
    const railPinBtn = document.getElementById('rail-pin');
    const railOpenBtn = document.getElementById('rail-open');

    const heroEl = document.getElementById('quote-hero');
    const heroLabelEl = document.getElementById('hero-label');
    const heroTextEl = document.getElementById('hero-text');
    const heroSourceEl = document.getElementById('hero-source');
    const heroFactsEl = document.getElementById('hero-facts');
    const heroShuffleBtn = document.getElementById('hero-shuffle');
    const heroPinBtn = document.getElementById('hero-pin');
    const heroOpenBtn = document.getElementById('hero-open');

    const deskEl = document.getElementById('quote-desk');
    const deskListEl = document.getElementById('desk-list');
    const deskCountEl = document.getElementById('desk-count');

    const wallStatsEl = document.getElementById('wall-stats');
    const wallDimEl = document.getElementById('wall-dimension');
    const wallGroupsEl = document.getElementById('wall-groups');
    const wallGridEl = document.getElementById('wall-grid');
    const wallMoreBtn = document.getElementById('wall-more');

    if (!track) return;

    /* ---------------- 状态 ---------------- */
    const NEAR = 8;
    const SETTLE = 130;
    const COPIES = 3;
    const WALL_LIMIT = 24;

    let allQuotes = [];       // 卡组/精句墙用（每次进入打乱）
    let heroPool = [];        // 今日一句用（固定顺序，保证"今天打开永远是同一句"）
    let favorites = [];
    let centers = [];
    let pitch = 0;
    let viewWidth = 0;
    let maxScroll = 0;
    let activeIndex = 0;
    let rafId = 0;
    let settleTimer = 0;
    let lastWindow = { lo: 0, hi: -1 };
    let heroIndex = -1;
    let wallDim = 'year';
    let wallGroup = 'all';
    let wallExpanded = false;

    /* ---------------- 小工具 ---------------- */
    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function qkey(filename, quote) { return filename + '\u0000' + quote; }

    function shuffle(list) {
        const out = [...list];
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        return out;
    }

    function typeBadge(type) {
        return `<span class="badge type-${esc(type || '其他')}">${esc(type || '未分类')}</span>`;
    }

    /* ---------------- 启动 ---------------- */
    async function initialize() {
        await Promise.all([loadAllQuotes(), loadFavorites()]);

        renderHero();
        renderDesk();
        render();
        renderWall();

        // 从编年史点"摘录 N 句"跳过来：切到精句墙的该年份分组
        const pendingYear = (window.App && window.App.consumePending) ? window.App.consumePending('quotesYear') : null;
        if (pendingYear) {
            wallDim = 'year';
            wallGroup = pendingYear;
            wallExpanded = false;
            if (wallDimEl) {
                wallDimEl.querySelectorAll('button[data-dim]').forEach(b =>
                    b.classList.toggle('is-active', b.dataset.dim === 'year'));
            }
            renderWall();
            const wall = document.querySelector('.quote-wall');
            if (wall) wall.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const icon = refreshBtn.querySelector('svg');
                if (icon) {
                    icon.style.transition = 'transform .6s cubic-bezier(.2,0,0,1)';
                    icon.style.transform = `rotate(${Math.random() * 360 + 360}deg)`;
                }
                allQuotes = shuffle(allQuotes);
                render();
                renderWall();     // 顺序变了，墙上的索引要跟着重排
            });
        }

        if (randomBtn) randomBtn.addEventListener('click', randomJump);
        if (prevBtn) prevBtn.addEventListener('click', () => step(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => step(1));

        /* 今日一句 */
        if (heroShuffleBtn) heroShuffleBtn.addEventListener('click', () => {
            heroIndex = pickOtherHero(heroIndex);
            renderHero(true);
        });
        if (heroOpenBtn) heroOpenBtn.addEventListener('click', () => openHero());
        if (heroPinBtn) heroPinBtn.addEventListener('click', () => {
            const q = heroQuote();
            if (q) togglePin(q);
        });

        /* 卡组底部动作：作用于当前居中的那一句 */
        if (railCopyBtn) railCopyBtn.addEventListener('click', () => {
            const q = allQuotes[deckBaseIndex()];
            if (q) copyQuote(q);
        });
        if (railPinBtn) railPinBtn.addEventListener('click', () => {
            const q = allQuotes[deckBaseIndex()];
            if (q) togglePin(q);
        });
        if (railOpenBtn) railOpenBtn.addEventListener('click', () => {
            const q = allQuotes[deckBaseIndex()];
            if (q && window.App && window.App.openPoemByFilename) window.App.openPoemByFilename(q.filename);
        });

        /* 精句墙 */
        if (wallDimEl) {
            wallDimEl.addEventListener('click', (e) => {
                const btn = e.target.closest('button[data-dim]');
                if (!btn || btn.dataset.dim === wallDim) return;
                wallDim = btn.dataset.dim;
                wallGroup = 'all';
                wallExpanded = false;
                wallDimEl.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === btn));
                renderWall();
            });
        }
        if (wallGroupsEl) {
            wallGroupsEl.addEventListener('click', (e) => {
                const chip = e.target.closest('.wall-chip');
                if (!chip) return;
                wallGroup = chip.dataset.group;
                wallExpanded = false;
                renderWall();
            });
        }
        if (wallMoreBtn) {
            wallMoreBtn.addEventListener('click', () => {
                wallExpanded = !wallExpanded;
                renderWall();
            });
        }
        if (wallGridEl) {
            wallGridEl.addEventListener('click', (e) => {
                const pin = e.target.closest('[data-act="pin"]');
                const card = e.target.closest('.wall-card');
                if (!card) return;
                const q = allQuotes[Number(card.dataset.index)];
                if (!q) return;
                if (pin) { e.stopPropagation(); togglePin(q); return; }
                if (window.App && window.App.openPoemByFilename) window.App.openPoemByFilename(q.filename);
            });
        }
        if (deskListEl) {
            deskListEl.addEventListener('click', (e) => {
                const card = e.target.closest('.desk-card');
                if (!card) return;
                const fav = favorites[Number(card.dataset.favIndex)];
                if (!fav) return;
                if (e.target.closest('[data-act="unpin"]')) {
                    e.stopPropagation();
                    togglePin({ filename: fav.filename, quote: fav.quote, title: fav.title });
                    return;
                }
                if (window.App && window.App.openPoemByFilename) window.App.openPoemByFilename(fav.filename);
            });
        }

        /* 卡组交互 */
        track.addEventListener('scroll', onScroll, { passive: true });
        track.addEventListener('keydown', onKeydown);
        track.addEventListener('click', onClick);
        window.addEventListener('resize', () => { measure(); paintFocus(true); });
    }

    /* ---------------- 数据 ---------------- */
    async function loadAllQuotes() {
        try {
            const response = await fetch('/api/poems');
            if (!response.ok) throw new Error('bad response');
            const poemFiles = await response.json();

            const poems = await Promise.all(poemFiles.map(async filename => {
                const res = await fetch(`/api/poems/${encodeURIComponent(filename)}`);
                return Object.assign({}, await res.json(), { filename });
            }));

            const list = [];
            poems.forEach(poem => {
                if (!Array.isArray(poem.quotes)) return;
                poem.quotes.forEach(q => {
                    if (!q || !String(q).trim()) return;
                    list.push({
                        quote: q,
                        title: poem.title || '无题',
                        filename: poem.filename,
                        type: poem.type || '',
                        genre: poem.genre || '',
                        year: (poem.creationDate || '').slice(0, 4) || '未知',
                        tag: (Array.isArray(poem.tags) && poem.tags[0]) || ''
                    });
                });
            });
            allQuotes = shuffle(list);
            // 今日一句要稳定：按「文件名 + 句子」排序后按日期取，跨刷新不变
            heroPool = [...list].sort((a, b) =>
                (a.filename + a.quote).localeCompare(b.filename + b.quote, 'zh'));
        } catch (error) {
            allQuotes = [];
        }
    }

    async function loadFavorites() {
        try {
            const res = await fetch('/api/favorites');
            favorites = res.ok ? await res.json() : [];
            if (!Array.isArray(favorites)) favorites = [];
        } catch (e) {
            favorites = [];
        }
    }

    async function togglePin(q) {
        if (!q) return;
        try {
            const res = await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle', filename: q.filename, quote: q.quote, title: q.title })
            });
            if (!res.ok) throw new Error('bad response');
            const data = await res.json();
            favorites = Array.isArray(data.favorites) ? data.favorites : favorites;
            syncPinStates();
            renderDesk();
            if (window.showNotification) {
                window.showNotification(data.pinned ? '已钉到案头' : '已从案头取下', 'success');
            }
        } catch (e) {
            if (window.showNotification) window.showNotification('案头保存失败，请检查本地服务', 'error');
        }
    }

    /* ---------------- 今日一句 ---------------- */
    function todaySeed() {
        const d = new Date();
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }

    function pickOtherHero(current) {
        if (heroPool.length <= 1) return 0;
        let next = current;
        while (next === current) next = Math.floor(Math.random() * heroPool.length);
        return next;
    }

    function heroQuote() { return heroPool[heroIndex]; }

    function renderHero(isRandom) {
        if (!heroPool.length) {
            if (heroTextEl) heroTextEl.textContent = '书斋清冷，暂无摘录。';
            if (heroSourceEl) heroSourceEl.textContent = '';
            if (heroFactsEl) heroFactsEl.innerHTML = '';
            if (heroEl) delete heroEl.dataset.qkey;
            return;
        }
        if (heroIndex < 0) {
            // 以日期为种子：今天打开永远是同一句
            const seed = todaySeed();
            heroIndex = ((seed * 2654435761) % heroPool.length + heroPool.length) % heroPool.length;
        }
        const q = heroQuote();
        if (!q) return;

        if (heroLabelEl) heroLabelEl.textContent = isRandom ? '随手一句' : '今日一句';
        if (heroTextEl) heroTextEl.textContent = q.quote;
        if (heroSourceEl) heroSourceEl.textContent = `—— 《${q.title}》`;
        if (heroFactsEl) {
            heroFactsEl.innerHTML = [q.year, q.type, q.genre].filter(Boolean)
                .map((t, i) => `${i ? '<i>·</i>' : ''}<span>${esc(t)}</span>`).join('');
        }
        if (heroEl) heroEl.dataset.qkey = qkey(q.filename, q.quote);
        syncPinStates();
    }

    function openHero() {
        const q = heroQuote();
        if (q && window.App && window.App.openPoemByFilename) window.App.openPoemByFilename(q.filename);
    }

    /* ---------------- 案头 ---------------- */
    function renderDesk() {
        if (!deskEl || !deskListEl) return;
        const count = favorites.length;
        deskEl.hidden = count === 0;
        if (deskCountEl) deskCountEl.textContent = count ? `共 ${count} 句` : '';
        if (!count) { deskListEl.innerHTML = ''; return; }

        deskListEl.innerHTML = favorites.map((f, i) => `
            <article class="desk-card" data-fav-index="${i}">
                <button type="button" class="desk-card__unpin" data-act="unpin" title="从案头取下" aria-label="从案头取下">×</button>
                <p class="desk-card__text">${esc(f.quote)}</p>
                <p class="desk-card__src">—— 《${esc(f.title || '无题')}》</p>
            </article>
        `).join('');
    }

    function syncPinStates() {
        const pinned = new Set(favorites.map(f => qkey(f.filename, f.quote)));

        document.querySelectorAll('[data-qkey]').forEach(el => {
            const on = pinned.has(el.dataset.qkey);
            if (el.classList.contains('is-pinned') !== on) {
                el.classList.toggle('is-pinned', on);
                el.setAttribute('aria-pressed', String(on));
            }
        });

        // 卡组底部按钮反映当前居中的那一句
        const current = allQuotes[deckBaseIndex()];
        if (railPinBtn && current) {
            const on = pinned.has(qkey(current.filename, current.quote));
            railPinBtn.textContent = on ? '从案头取下' : '钉到案头';
            railPinBtn.classList.toggle('is-on', on);
        }
        if (heroPinBtn && heroQuote()) {
            const hq = heroQuote();
            const on = pinned.has(qkey(hq.filename, hq.quote));
            heroPinBtn.textContent = on ? '已钉 · 取下' : '钉到案头';
        }
        if (railNowEl) {
            const cur = allQuotes[deckBaseIndex()];
            railNowEl.textContent = cur ? cur.quote : '';
        }
        // 墙上卡片
        wallGridEl && wallGridEl.querySelectorAll('.wall-card').forEach(card => {
            const q = allQuotes[Number(card.dataset.index)];
            if (!q) return;
            card.classList.toggle('is-pinned', pinned.has(qkey(q.filename, q.quote)));
        });
    }

    /* ---------------- 卡组 ---------------- */
    function render() {
        if (allQuotes.length === 0) {
            track.classList.add('is-empty');
            track.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__glyph">句</div>
                    <h3>书斋清冷</h3>
                    <p>暂无摘录。请前往「添加新篇」或「作品管理」记下心爱的诗句。</p>
                </div>`;
            if (refreshBtn) refreshBtn.style.display = 'none';
            if (counterEl) counterEl.textContent = '';
            if (prevBtn) prevBtn.hidden = true;
            if (nextBtn) nextBtn.hidden = true;
            return;
        }

        track.classList.remove('is-empty');
        if (refreshBtn) refreshBtn.style.display = '';
        if (prevBtn) prevBtn.hidden = false;
        if (nextBtn) nextBtn.hidden = false;

        const base = allQuotes.length;
        const deck = [];
        for (let c = 0; c < COPIES; c++) {
            for (let i = 0; i < base; i++) deck.push({ item: allQuotes[i], deckIndex: c * base + i, no: i + 1 });
        }

        track.innerHTML = deck.map(d => `
            <figure class="quote-card" data-filename="${esc(d.item.filename)}" data-index="${d.deckIndex}"
                    data-qkey="${esc(qkey(d.item.filename, d.item.quote))}"
                    role="button" tabindex="0" style="--d:${NEAR};--s:0"
                    aria-label="第 ${d.no} 句：${esc(d.item.quote)}">
                <div class="quote-card__top">
                    ${typeBadge(d.item.type)}
                    <span class="quote-card__year">${esc(d.item.year)}</span>
                    <span class="quote-card__spacer"></span>
                    <span class="quote-card__ord">${String(d.no).padStart(2, '0')}</span>
                </div>
                <blockquote class="quote-card__text">${esc(d.item.quote)}</blockquote>
                <figcaption class="quote-card__by">—— 《${esc(d.item.title)}》</figcaption>
            </figure>
        `).join('');

        if (counterEl) counterEl.textContent = `共 ${base} 句 · 循环`;

        measure();
        activeIndex = base + Math.floor(base / 2);
        lastWindow = { lo: 0, hi: -1 };
        scrollInstant(centerOffset(activeIndex));
        paintFocus(true);
        syncPinStates();
    }

    function measure() {
        const cards = track.children;
        centers = [];
        for (let i = 0; i < cards.length; i++) {
            centers.push(cards[i].offsetLeft + cards[i].offsetWidth / 2);
        }
        pitch = centers.length > 1 ? (centers[1] - centers[0]) : (cards[0] ? cards[0].offsetWidth : 1);
        if (!pitch || pitch < 1) pitch = 1;
        viewWidth = track.clientWidth;
        maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    }

    function clampScroll(value) { return Math.max(0, Math.min(maxScroll, value)); }

    function centerOffset(i) {
        if (!centers.length) return 0;
        return clampScroll(centers[i] - viewWidth / 2);
    }

    function scrollInstant(value) {
        track.style.scrollBehavior = 'auto';
        void track.offsetWidth;
        track.scrollLeft = clampScroll(value);
        track.style.scrollBehavior = '';
    }

    function recenterIfNeeded(index) {
        const base = allQuotes.length;
        if (!base || centers.length !== base * COPIES || !pitch) return index;
        let shift = 0;
        if (index < base) shift = base;
        else if (index >= base * 2) shift = -base;
        if (!shift) return index;
        scrollInstant(track.scrollLeft + shift * pitch);
        return index + shift;
    }

    /* 当前居中的那句在 allQuotes 里的下标 */
    function deckBaseIndex() {
        const base = allQuotes.length;
        if (!base) return 0;
        return ((activeIndex % base) + base) % base;
    }

    function step(dir) {
        if (!centers.length) return;
        const next = Math.max(0, Math.min(centers.length - 1, activeIndex + dir));
        if (next === activeIndex) return;
        track.scrollTo({ left: centerOffset(next), behavior: 'smooth' });
    }

    function randomJump() {
        if (!centers.length) return;
        const base = allQuotes.length;
        const target = base + Math.floor(Math.random() * base);   // 中联里随机
        track.scrollTo({ left: centerOffset(target), behavior: 'smooth' });
    }

    function onClick(event) {
        const card = event.target.closest('.quote-card');
        if (!card) return;
        const index = Number(card.dataset.index);
        if (index !== activeIndex) {
            track.scrollTo({ left: centerOffset(index), behavior: 'smooth' });
            return;
        }
        const filename = card.dataset.filename;
        if (filename && window.App && window.App.openPoemByFilename) window.App.openPoemByFilename(filename);
    }

    function onKeydown(event) {
        if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); return; }
        if (event.key === 'ArrowRight') { event.preventDefault(); step(1); return; }
        if (event.key === 'Enter' || event.key === ' ') {
            const card = event.target.closest('.quote-card');
            if (card) { event.preventDefault(); card.click(); }
        }
    }

    function onScroll() {
        if (rafId) return;
        rafId = window.requestAnimationFrame(() => { rafId = 0; paintFocus(false); });

        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
            const nearest = activeIndex;
            if (Math.abs(track.scrollLeft - centerOffset(nearest)) > 2) {
                track.scrollTo({ left: centerOffset(nearest), behavior: 'smooth' });
            }
        }, SETTLE);
    }

    function nearestIndex(viewCenter) {
        let lo = 0, hi = centers.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (centers[mid] < viewCenter) lo = mid + 1; else hi = mid;
        }
        if (lo > 0 && Math.abs(centers[lo - 1] - viewCenter) <= Math.abs(centers[lo] - viewCenter)) return lo - 1;
        return lo;
    }

    function paintFocus(force) {
        if (!centers.length) return;

        const viewCenter = track.scrollLeft + viewWidth / 2;
        let index = nearestIndex(viewCenter);
        index = recenterIfNeeded(index);

        const cards = track.children;
        const changed = index !== activeIndex || force;

        if (changed) {
            if (cards[activeIndex]) cards[activeIndex].classList.remove('is-active');
            activeIndex = index;
            if (cards[activeIndex]) cards[activeIndex].classList.add('is-active');
        }

        const lo = Math.max(0, activeIndex - NEAR);
        const hi = Math.min(cards.length - 1, activeIndex + NEAR);

        for (let i = lastWindow.lo; i <= lastWindow.hi; i++) {
            if ((i < lo || i > hi) && cards[i]) {
                cards[i].style.setProperty('--d', NEAR);
                cards[i].style.setProperty('--s', 0);
            }
        }
        for (let i = lo; i <= hi; i++) {
            if (!cards[i]) continue;
            const diff = i - activeIndex;
            cards[i].style.setProperty('--d', Math.abs(diff));
            cards[i].style.setProperty('--s', Math.sign(diff));
        }
        lastWindow = { lo, hi };

        if (changed) syncPinStates();
    }

    function copyQuote(q) {
        if (!q) return;
        navigator.clipboard.writeText(q.quote).then(() => {
            if (window.showNotification) window.showNotification('已复制到剪贴板', 'success');
        }).catch(() => {
            if (window.showNotification) window.showNotification('复制失败', 'error');
        });
    }

    /* ---------------- 精句墙 ---------------- */
    function groupOf(q) {
        if (wallDim === 'year') return q.year || '未知';
        if (wallDim === 'tag') return q.tag || '未贴签';
        return q.type === '词' ? (q.genre || '未标词牌') : (q.type || '其他');
    }

    function renderWall() {
        if (!wallGridEl) return;
        const total = allQuotes.length;
        const poems = new Set(allQuotes.map(q => q.filename)).size;
        if (wallStatsEl) {
            const years = allQuotes.map(q => q.year).filter(y => /^\d{4}$/.test(y)).sort();
            const span = years.length ? `${years[0]}–${years[years.length - 1]}` : '—';
            wallStatsEl.innerHTML = `共 <strong>${total}</strong> 句 · 覆盖 <strong>${poems}</strong> 篇 · ${span}`;
        }

        // 分组统计
        const map = new Map();
        allQuotes.forEach(q => {
            const g = groupOf(q);
            map.set(g, (map.get(g) || 0) + 1);
        });
        let groups = Array.from(map.entries());
        if (wallDim === 'year') groups.sort((a, b) => String(b[0]).localeCompare(String(a[0])));
        else groups.sort((a, b) => b[1] - a[1]);

        if (wallGroupsEl) {
            wallGroupsEl.innerHTML =
                `<button type="button" class="wall-chip${wallGroup === 'all' ? ' is-active' : ''}" data-group="all">全部<em>${total}</em></button>` +
                groups.map(([g, n]) =>
                    `<button type="button" class="wall-chip${wallGroup === g ? ' is-active' : ''}" data-group="${esc(g)}">${esc(g)}<em>${n}</em></button>`
                ).join('');
        }

        const filtered = wallGroup === 'all' ? allQuotes : allQuotes.filter(q => groupOf(q) === wallGroup);
        const shown = wallExpanded ? filtered : filtered.slice(0, WALL_LIMIT);

        if (!shown.length) {
            wallGridEl.innerHTML = `<div class="empty-state"><div class="empty-state__glyph">句</div><h3>此组无句</h3><p>换一个分组看看。</p></div>`;
        } else {
            wallGridEl.innerHTML = shown.map(q => `
                <article class="wall-card" data-index="${allQuotes.indexOf(q)}" tabindex="0" role="button"
                         aria-label="展读《${esc(q.title)}》">
                    <p class="wall-card__text">${esc(q.quote)}</p>
                    <div class="wall-card__foot">
                        <span class="wall-card__src">《${esc(q.title)}》</span>
                        <span class="wall-card__meta">${esc(q.year)} · ${esc(q.type || '—')}${q.genre ? ' · ' + esc(q.genre) : ''}</span>
                        <button type="button" class="wall-card__pin" data-act="pin" title="钉到案头" aria-label="钉到案头">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 2.5 21.5 9.5l-2.1 2.1-1.4-1.4-3.5 3.5.7 3.5-1.4 1.4-4.2-4.2-4.6 4.6-1.4-1.4 4.6-4.6-4.2-4.2 1.4-1.4 3.5.7 3.5-3.5-1.4-1.4z"/></svg>
                        </button>
                    </div>
                </article>
            `).join('');
        }

        if (wallMoreBtn) {
            const rest = filtered.length - shown.length;
            wallMoreBtn.hidden = filtered.length <= WALL_LIMIT;
            wallMoreBtn.textContent = wallExpanded
                ? `收起（只留前 ${WALL_LIMIT} 句）`
                : `展开全部 ${filtered.length} 句${rest > 0 ? `（还有 ${rest} 句）` : ''}`;
        }

        syncPinStates();
    }

    initialize();
})();
