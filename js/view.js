/**
 * ===================================================================
 * MyPoems · 作品总览 (js/view.js)
 * ===================================================================
 */

(function () {
    'use strict';

    let allPoems = [];

    const poemsList = document.getElementById('poems-list');
    const searchInput = document.getElementById('search-input');
    const filters = document.getElementById('filters');
    const poemCounter = document.getElementById('poem-counter');
    const mobileFilterToggle = document.getElementById('mobile-filter-toggle');

    const typeFiltersContainer = document.getElementById('type-filters');
    const genreFiltersContainer = document.getElementById('genre-filters');
    const genreFiltersGroup = document.getElementById('genre-filters-container');
    const yearFilters = document.getElementById('year-filters');
    const monthFilters = document.getElementById('month-filters');
    const tagFilters = document.getElementById('tag-filters');

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    async function initialize() {
        if (!poemsList) return;
        try {
            await loadAllPoems();
            populateAllFilters();
            addEventListeners();
            renderPoems(allPoems);
            applyPendingIntent();
        } catch (error) {
            console.error(error);
        }
    }

    async function loadAllPoems() {
        try {
            const response = await fetch('/api/poems');
            const poemFiles = await response.json();
            const poemPromises = poemFiles.map(async (filename) => {
                try {
                    const res = await fetch(`/api/poems/${encodeURIComponent(filename)}`);
                    const poemData = await res.json();
                    return Object.assign({}, poemData, { filename });
                } catch (e) {
                    return { isError: true };
                }
            });
            const results = await Promise.allSettled(poemPromises);
            allPoems = results
                .filter(r => r.status === 'fulfilled' && r.value && !r.value.isError)
                .map(r => r.value);
            allPoems.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
        } catch (e) {
            console.error(e);
        }
    }

    function populateAllFilters() {
        /* 1. 年份 */
        const yearMap = new Map();
        allPoems.forEach(p => {
            if (!p.creationDate) return;
            const y = p.creationDate.substring(0, 4);
            yearMap.set(y, (yearMap.get(y) || 0) + 1);
        });
        const sortedYears = Array.from(yearMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        if (yearFilters) {
            yearFilters.innerHTML = sortedYears.map(([yr, c]) =>
                `<div class="filter-option">
                    <input type="checkbox" id="year-${esc(yr)}" value="${esc(yr)}">
                    <label for="year-${esc(yr)}">${esc(yr)} <span class="filter-count">${c}</span></label>
                </div>`
            ).join('');
        }

        /* 2. 月份 */
        if (monthFilters) {
            monthFilters.innerHTML = Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, '0');
                return `<div class="filter-option">
                    <input type="checkbox" id="month-${m}" value="${m}">
                    <label for="month-${m}">${i + 1} 月</label>
                </div>`;
            }).join('');
        }

        /* 3. 类型 */
        const typeCounts = allPoems.reduce((acc, p) => {
            if (p.type) acc[p.type] = (acc[p.type] || 0) + 1;
            return acc;
        }, {});
        if (typeFiltersContainer) {
            typeFiltersContainer.innerHTML = Object.entries(typeCounts).map(([t, c]) =>
                `<div class="filter-option">
                    <input type="checkbox" id="type-${esc(t)}" value="${esc(t)}" data-filter="type">
                    <label for="type-${esc(t)}">${esc(t)} <span class="filter-count">${c}</span></label>
                </div>`
            ).join('');
        }

        /* 4. 体裁 / 词牌 */
        const genreCounts = allPoems.reduce((acc, p) => {
            if (p.genre) acc[p.genre] = (acc[p.genre] || 0) + 1;
            return acc;
        }, {});
        if (genreFiltersContainer) {
            genreFiltersContainer.innerHTML = Object.entries(genreCounts).map(([g, c]) => {
                const genreType = ['五言', '七言'].includes(g) ? 'poem' : 'ci';
                return `<div class="filter-option" data-genre-type="${genreType}">
                    <input type="checkbox" id="genre-${esc(g)}" value="${esc(g)}" data-filter="genre">
                    <label for="genre-${esc(g)}">${esc(g)} <span class="filter-count">${c}</span></label>
                </div>`;
            }).join('');
        }

        /* 5. 标签 */
        const tagMap = new Map();
        allPoems.forEach(p => {
            (Array.isArray(p.tags) ? p.tags : []).forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1));
        });
        const sortedTags = Array.from(tagMap.entries()).sort((a, b) => b[1] - a[1]);
        if (tagFilters) {
            tagFilters.innerHTML = sortedTags.map(([t, c]) =>
                `<div class="filter-option">
                    <input type="checkbox" id="tag-${esc(t)}" value="${esc(t)}">
                    <label for="tag-${esc(t)}">${esc(t)} <span class="filter-count">${c}</span></label>
                </div>`
            ).join('');
        }
    }

    function renderPoems(poemsToRender) {
        if (!poemsList) return;

        if (!poemsToRender || poemsToRender.length === 0) {
            poemsList.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state__glyph">空</div>
                    <h3>卷中无字</h3>
                    <p>试着放宽筛选条件，或前往「添加新篇」记下此刻心绪。</p>
                </div>`;
        } else {
            poemsList.innerHTML = poemsToRender.map((poem, index) => {
                const title = poem.title || '无题';
                const content = poem.content || '';
                const charCount = content.replace(/\s/g, '').length + (poem.preface || '').replace(/\s/g, '').length;
                const excerpt = content.replace(/\s+/g, ' ').trim().slice(0, 96);

                const metaParts = [`<span class="badge type-${esc(poem.type || '其他')}">${esc(poem.type || '未分类')}</span>`];
                if (poem.genre) metaParts.push(`<span>${esc(poem.genre)}</span>`);
                metaParts.push('<span class="dot">·</span>');
                metaParts.push(`<span>${charCount} 字</span>`);

                const tags = Array.isArray(poem.tags) ? poem.tags.slice(0, 3) : [];
                const tagsHTML = tags.map(t => `<span class="mini-tag">${esc(t)}</span>`).join('');

                return `
                <article class="poem-card" data-filename="${esc(poem.filename)}" tabindex="0" role="button"
                         aria-label="展读《${esc(title)}》" style="animation-delay:${Math.min(index, 12) * 22}ms">
                    <div class="poem-card__meta">${metaParts.join('')}</div>
                    <h3 class="poem-card__title">${esc(title)}</h3>
                    <p class="poem-card__excerpt">${esc(excerpt)}${content.length > 96 ? '…' : ''}</p>
                    <div class="poem-card__foot">
                        ${tagsHTML || '<span>未贴签</span>'}
                        <span class="poem-card__date">${esc(poem.creationDate || '')}</span>
                    </div>
                </article>`;
            }).join('');
        }

        if (poemCounter) {
            poemCounter.innerHTML = `展示 <strong>${poemsToRender.length}</strong> 篇 &nbsp;/&nbsp; 共 <strong>${allPoems.length}</strong> 篇`;
        }
    }

    function applyFiltersAndSearch() {
        let filtered = allPoems;
        const s = (searchInput && searchInput.value || '').trim().toLowerCase();

        if (s) {
            filtered = filtered.filter(p =>
                (p.title || '').toLowerCase().includes(s) || (p.content || '').toLowerCase().includes(s));
            document.querySelectorAll('#filters input:checked').forEach(c => { c.checked = false; });
            updateGenreFilterVisibility();
        } else {
            const collect = (sel) => Array.from(document.querySelectorAll(sel)).map(c => c.value);
            const years = collect('#year-filters input:checked');
            const months = collect('#month-filters input:checked');
            const types = collect('#type-filters input:checked');
            const genres = collect('#genre-filters input:checked');
            const tags = collect('#tag-filters input:checked');

            if (years.length) filtered = filtered.filter(p => p.creationDate && years.includes(p.creationDate.substring(0, 4)));
            if (months.length) filtered = filtered.filter(p => p.creationDate && months.includes(p.creationDate.substring(5, 7)));
            if (types.length) filtered = filtered.filter(p => types.includes(p.type));
            if (genres.length) filtered = filtered.filter(p => genres.includes(p.genre));
            if (tags.length) filtered = filtered.filter(p => Array.isArray(p.tags) && tags.every(t => p.tags.includes(t)));
        }

        renderPoems(filtered);
    }

    function updateGenreFilterVisibility() {
        const isPoemChecked = document.querySelector('#type-诗') && document.querySelector('#type-诗').checked;
        const isCiChecked = document.querySelector('#type-词') && document.querySelector('#type-词').checked;
        if (!genreFiltersGroup) return;

        let hasVisible = false;
        genreFiltersGroup.querySelectorAll('.filter-option[data-genre-type]').forEach(opt => {
            const type = opt.dataset.genreType;
            if ((type === 'poem' && isPoemChecked) || (type === 'ci' && isCiChecked)) {
                opt.style.display = 'inline-flex';
                hasVisible = true;
            } else {
                opt.style.display = 'none';
                const input = opt.querySelector('input');
                if (input) input.checked = false;
            }
        });

        genreFiltersGroup.style.display = hasVisible ? 'flex' : 'none';
        const row = genreFiltersGroup.closest('.filter-row');
        if (row) row.style.display = hasVisible ? 'flex' : 'none';
    }

    /* 从别的页跳过来时带的条件（体裁分布、词牌、标签点过来的） */
    function applyPendingIntent() {
        const intent = (window.App && window.App.consumePending) ? window.App.consumePending('viewIntent') : null;
        if (!intent) return;

        const sel = (id) => '#' + ((window.CSS && CSS.escape) ? CSS.escape(id) : id);
        const pick = (id) => document.querySelector(sel(id));

        if (intent.search && searchInput) searchInput.value = intent.search;

        if (intent.type) {
            const cb = pick('type-' + intent.type);
            if (cb) cb.checked = true;
        }
        if (intent.genre) {
            const cb = pick('genre-' + intent.genre);
            if (cb) cb.checked = true;
            // 体裁行的显示依赖类型，勾上「词」以让词牌选项露出来
            const typeCb = pick('type-词');
            if (typeCb && document.querySelector('#genre-filters .filter-option[data-genre-type="ci"]')) {
                const isPoemGenre = ['五言', '七言'].includes(intent.genre);
                const owner = pick(isPoemGenre ? 'type-诗' : 'type-词');
                if (owner) owner.checked = true;
            }
        }
        if (intent.tag) {
            const cb = pick('tag-' + intent.tag);
            if (cb) cb.checked = true;
        }

        updateGenreFilterVisibility();
        applyFiltersAndSearch();

        const active = document.querySelectorAll('#filters input:checked').length;
        if (active && window.showNotification) {
            window.showNotification(`已按条件筛出 ${poemsList.querySelectorAll('.poem-card').length} 篇`, 'info');
        }
    }

    function addEventListeners() {
        if (searchInput) searchInput.addEventListener('input', applyFiltersAndSearch);

        if (filters) {
            filters.addEventListener('change', (event) => {
                if (event.target.dataset && event.target.dataset.filter === 'type') updateGenreFilterVisibility();
                applyFiltersAndSearch();
            });
        }

        if (poemsList) {
            const open = (card) => {
                if (card && card.dataset.filename && window.App) window.App.openPoemByFilename(card.dataset.filename);
            };
            poemsList.addEventListener('click', (event) => open(event.target.closest('.poem-card')));
            poemsList.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                const card = event.target.closest('.poem-card');
                if (card) { event.preventDefault(); open(card); }
            });
        }

        if (mobileFilterToggle && filters) {
            mobileFilterToggle.addEventListener('click', () => {
                const isOpen = filters.classList.toggle('open');
                const textSpan = mobileFilterToggle.querySelector('span');
                if (textSpan) textSpan.textContent = isOpen ? '收起筛选' : '展开筛选';
                mobileFilterToggle.setAttribute('aria-expanded', String(isOpen));
            });
        }
    }

    updateGenreFilterVisibility();
    initialize();
})();
