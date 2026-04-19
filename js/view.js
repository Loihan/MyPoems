/**
 * ===================================================================
 * MyPoems - 作品总览逻辑脚本 (view.js) - 筛选计数优化版
 * ===================================================================
 */

(function() {
    let allPoems = [];
    
    const poemsList = document.getElementById('poems-list');
    const searchInput = document.getElementById('search-input');
    const filters = document.getElementById('filters');
    const poemCounter = document.getElementById('poem-counter');
    
    const typeFiltersContainer = document.getElementById('type-filters');
    const genreFiltersContainer = document.getElementById('genre-filters');
    const genreFiltersGroup = document.getElementById('genre-filters-container');
    const yearFilters = document.getElementById('year-filters');
    const monthFilters = document.getElementById('month-filters');
    const tagFilters = document.getElementById('tag-filters');

    async function initialize() {
        if (!poemsList) return;
        try {
            await loadAllPoems();
            populateAllFilters();
            addEventListeners();
            renderPoems(allPoems);
        } catch (error) { console.error(error); }
    }

    async function loadAllPoems() {
        try {
            const response = await fetch('/api/poems');
            const poemFiles = await response.json();
            const poemPromises = poemFiles.map(async (filename) => {
                try {
                    const res = await fetch(`/api/poems/${filename}`);
                    const poemData = await res.json();
                    return { ...poemData, filename };
                } catch (e) { return { title: '加载失败', isError: true }; }
            });
            const results = await Promise.allSettled(poemPromises);
            allPoems = results.filter(r => r.status === 'fulfilled' && !r.value.isError).map(r => r.value);
            allPoems.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
        } catch (e) { console.error(e); }
    }

    function populateAllFilters() {
        // 1. 年份
        const yearMap = new Map();
        allPoems.forEach(p => { if (p.creationDate) yearMap.set(p.creationDate.substring(0, 4), (yearMap.get(p.creationDate.substring(0, 4)) || 0) + 1); });
        const sortedYears = [...yearMap.entries()].sort((a, b) => b[0] - a[0]);
        if(yearFilters) {
            yearFilters.innerHTML = sortedYears.map(([yr, c]) => 
                `<div class="filter-option">
                    <input type="checkbox" id="year-${yr}" value="${yr}">
                    <label for="year-${yr}">${yr} <span class="filter-count">${c}</span></label>
                </div>`
            ).join('');
        }

        // 2. 月份 (保持不变，通常不需要计数或计数意义不大，这里简化处理)
        if(monthFilters) {
            monthFilters.innerHTML = Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, '0');
                return `<div class="filter-option"><input type="checkbox" id="month-${m}" value="${m}"><label for="month-${m}">${i + 1}月</label></div>`;
            }).join('');
        }

        // 3. 类型
        const typeCounts = allPoems.reduce((acc, p) => { if(p.type) acc[p.type] = (acc[p.type] || 0) + 1; return acc; }, {});
        if(typeFiltersContainer) {
            typeFiltersContainer.innerHTML = Object.entries(typeCounts).map(([t, c]) => 
                `<div class="filter-option">
                    <input type="checkbox" id="type-${t}" value="${t}" data-filter="type">
                    <label for="type-${t}">${t} <span class="filter-count">${c}</span></label>
                </div>`
            ).join('');
        }

        // 4. 体裁
        const genreCounts = allPoems.reduce((acc, p) => { if (p.genre) acc[p.genre] = (acc[p.genre] || 0) + 1; return acc; }, {});
        if(genreFiltersContainer) {
            genreFiltersContainer.innerHTML = Object.entries(genreCounts).map(([g, c]) => {
                const genreType = ['五言', '七言'].includes(g) ? 'poem' : 'ci';
                return `<div class="filter-option" data-genre-type="${genreType}">
                    <input type="checkbox" id="genre-${g}" value="${g}" data-filter="genre">
                    <label for="genre-${g}">${g} <span class="filter-count">${c}</span></label>
                </div>`;
            }).join('');
        }

        // 5. 标签
        const tagMap = new Map();
        allPoems.forEach(p => { (Array.isArray(p.tags) ? p.tags : []).forEach(t => tagMap.set(t, (tagMap.get(t) || 0) + 1)); });
        const sortedTags = [...tagMap.entries()].sort((a, b) => b[1] - a[1]);
        if (tagFilters) {
            tagFilters.innerHTML = sortedTags.map(([t, c]) => 
                `<div class="filter-option">
                    <input type="checkbox" id="tag-${t}" value="${t}">
                    <label for="tag-${t}">${t} <span class="filter-count">${c}</span></label>
                </div>`
            ).join('');
        }
    }

    function renderPoems(poemsToRender) {
        if (!poemsToRender || poemsToRender.length === 0) {
            poemsList.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align:center; padding:40px; color:#888;"><h3>暂无作品</h3></div>`;
        } else {
            poemsList.innerHTML = poemsToRender.map(poem => {
                const safeTitle = poem.title || '无标题';
                const safeContent = poem.content || '';
                const wordCount = (safeContent.length) + (poem.preface || '').length;
                const typeInfo = poem.genre ? `${poem.type} · ${poem.genre}` : poem.type;
                const metaHTML = `<div class="meta"><span>${typeInfo}</span><span>&middot;</span> <span>${wordCount} 字</span></div>`;
                return `<div class="poem-card" data-filename="${poem.filename}">${metaHTML}<h3>${safeTitle}</h3><pre>${safeContent.substring(0, 100).replace(/\n/g, ' ')}...</pre></div>`;
            }).join('');
        }
        if(poemCounter) poemCounter.innerHTML = `<span>展示 ${poemsToRender.length}</span> / <span>共 ${allPoems.length}</span>`;
    }

    function applyFiltersAndSearch() {
        let filtered = allPoems;
        const s = searchInput.value.trim().toLowerCase();
        if (s) {
            filtered = filtered.filter(p => (p.title || '').toLowerCase().includes(s) || (p.content || '').toLowerCase().includes(s));
            document.querySelectorAll('#filters input:checked').forEach(c => c.checked = false);
            updateGenreFilterVisibility();
        } else {
            const years = Array.from(document.querySelectorAll('#year-filters input:checked')).map(c => c.value);
            const months = Array.from(document.querySelectorAll('#month-filters input:checked')).map(c => c.value);
            const types = Array.from(document.querySelectorAll('#type-filters input:checked')).map(c => c.value);
            const genres = Array.from(document.querySelectorAll('#genre-filters input:checked')).map(c => c.value);
            const tags = Array.from(document.querySelectorAll('#tag-filters input:checked')).map(c => c.value);

            if (years.length > 0) filtered = filtered.filter(p => p.creationDate && years.includes(p.creationDate.substring(0, 4)));
            if (months.length > 0) filtered = filtered.filter(p => p.creationDate && months.includes(p.creationDate.substring(5, 7)));
            if (types.length > 0) filtered = filtered.filter(p => types.includes(p.type));
            if (genres.length > 0) filtered = filtered.filter(p => genres.includes(p.genre));
            if (tags.length > 0) filtered = filtered.filter(p => p.tags && Array.isArray(p.tags) && tags.every(t => p.tags.includes(t)));
        }
        renderPoems(filtered);
    }

    function updateGenreFilterVisibility() {
        const isPoemChecked = document.querySelector('#type-诗')?.checked;
        const isCiChecked = document.querySelector('#type-词')?.checked;
        if(genreFiltersGroup) {
            let hasVisible = false;
            genreFiltersGroup.querySelectorAll('.filter-option[data-genre-type]').forEach(opt => {
                const type = opt.dataset.genreType;
                if ((type === 'poem' && isPoemChecked) || (type === 'ci' && isCiChecked)) {
                    opt.style.display = 'flex'; hasVisible = true;
                } else {
                    opt.style.display = 'none'; opt.querySelector('input').checked = false;
                }
            });
            genreFiltersGroup.style.display = hasVisible ? 'flex' : 'none';
        }
    }

    function addEventListeners() {
        searchInput.addEventListener('input', applyFiltersAndSearch);
        filters.addEventListener('change', (event) => {
            if (event.target.dataset.filter === 'type') updateGenreFilterVisibility();
            applyFiltersAndSearch();
        });
        poemsList.addEventListener('click', (event) => {
            const card = event.target.closest('.poem-card');
            if (card && card.dataset.filename) window.App.openPoemByFilename(card.dataset.filename);
        });
    }

    initialize();
})();