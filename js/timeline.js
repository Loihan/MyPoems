/**
 * ===================================================================
 * MyPoems - 编年史逻辑脚本 (timeline.js) - 导航定位修复版
 * ===================================================================
 */

(function() {
    const container = document.getElementById('timeline-container');
    const navContainer = document.getElementById('timeline-year-nav');
    let allPoems = [];

    const monthNames = { '01': '孟春', '02': '仲春', '03': '季春', '04': '孟夏', '05': '仲夏', '06': '季夏', '07': '孟秋', '08': '仲秋', '09': '季秋', '10': '孟冬', '11': '仲冬', '12': '季冬' };

    async function initialize() {
        if (!container) return;
        await loadAllPoems();
        renderTimeline();
    }

    async function loadAllPoems() {
        try {
            const response = await fetch('/api/poems');
            const poemFiles = await response.json();
            allPoems = await Promise.all(
                poemFiles.map(async filename => {
                    const res = await fetch(`/api/poems/${filename}`);
                    const data = await res.json();
                    return { ...data, filename };
                })
            );
            allPoems.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
        } catch (error) {
            container.innerHTML = '<p style="text-align:center;">暂无记录</p>';
        }
    }

    function getFirstSentence(content) {
        if (!content) return '';
        const cleanContent = content.trim();
        const parts = cleanContent.split(/[\n。！？；]/);
        return parts[0] || cleanContent.substring(0, 20);
    }

    function renderTimeline() {
        if (allPoems.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;">书斋空空，提笔写下第一篇吧。</div>';
            return;
        }

        let lastYear = null;
        let yearsList = [];

        const html = allPoems.map((poem, index) => {
            const dateObj = new Date(poem.creationDate);
            const year = dateObj.getFullYear();
            const monthStr = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            const seasonName = monthNames[monthStr] || '时节';
            const excerpt = getFirstSentence(poem.content);
            const direction = index % 2 === 0 ? 'left' : 'right';

            let yearAnchor = '';
            if (year !== lastYear) {
                yearAnchor = `id="year-${year}"`;
                yearsList.push(year);
                lastYear = year;
            }

            return `
            <div class="timeline-item ${direction}" ${yearAnchor} onclick="window.App.openPoemByFilename('${poem.filename}')">
                <div class="timeline-content">
                    <div class="timeline-date">
                        <span class="year">${year}</span>
                        <span class="dot">·</span>
                        <span class="season">${seasonName}</span>
                        <span class="full-date">${monthStr}/${day}</span>
                    </div>
                    <h3 class="timeline-title">${poem.title || '无题'}</h3>
                    <p class="timeline-excerpt">“ ${excerpt} ”</p>
                    <div class="timeline-marker"></div>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = html;
        renderYearNav(yearsList);
    }

    function renderYearNav(years) {
        if (!navContainer || years.length < 2) {
            if(navContainer) navContainer.style.display = 'none';
            return;
        }

        navContainer.style.display = 'block';
        // 【关键修改】添加内部容器 .year-nav-sticky-wrapper
        const listHtml = years.map(year => `
            <a href="#year-${year}" class="year-nav-item" onclick="event.preventDefault(); document.getElementById('year-${year}').scrollIntoView({behavior: 'smooth', block: 'center'});">
                ${year}
            </a>
        `).join('');
        
        navContainer.innerHTML = `<div class="year-nav-sticky-wrapper">${listHtml}</div>`;
    }

    initialize();
})();