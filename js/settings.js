/**
 * ===================================================================
 * MyPoems · 设置 (js/settings.js)
 * 外观：预设配色选择器（颜色直接从 CSS 令牌里读，避免两处维护）
 * 阅读：右侧推出 / 浮层模态
 * ===================================================================
 */

(function () {
    'use strict';

    const picker = document.getElementById('theme-picker');
    const modesBox = document.getElementById('reader-modes');
    const countEl = document.getElementById('theme-count');
    const lightCountEl = document.getElementById('theme-light-count');
    const darkCountEl = document.getElementById('theme-dark-count');

    if (!window.App || !Array.isArray(window.App.THEMES)) return;

    const THEMES = window.App.THEMES;
    const AUTO = window.App.AUTO_THEME || { id: 'auto', name: '跟随系统', tone: 'auto', note: '' };

    /* 探针：借它把某个主题的令牌算出来做色卡，避免在 JS 里重复写颜色。
       挂在内容区里，切页时随内容一起销毁。 */
    const probe = document.createElement('div');
    probe.className = 'theme-probe';
    probe.setAttribute('aria-hidden', 'true');
    (document.getElementById('content') || document.body).appendChild(probe);

    function swatchOf(themeId) {
        const resolved = themeId === 'auto' ? window.App.getResolvedTheme() : themeId;
        const dark = !!(THEMES.find(t => t.id === resolved) || {}).tone === 'dark';
        probe.dataset.theme = resolved;
        if (dark) probe.classList.add('dark-theme');
        else probe.classList.remove('dark-theme');

        const cs = getComputedStyle(probe);
        const read = (name) => cs.getPropertyValue(name).trim() || 'transparent';
        return {
            paper: read('--paper'),
            raise: read('--paper-raise'),
            accent: read('--cinnabar'),
            ink: read('--ink'),
            line: read('--line-strong')
        };
    }

    function cardHTML(theme, isAuto) {
        const sw = swatchOf(theme.id);
        return `
        <button type="button" class="theme-card${isAuto ? ' theme-card--auto' : ''}"
                data-theme-id="${theme.id}" role="radio" aria-checked="false"
                style="--sw-paper:${sw.paper};--sw-raise:${sw.raise};--sw-accent:${sw.accent};--sw-ink:${sw.ink};--sw-line:${sw.line}">
            <span class="theme-card__swatch" aria-hidden="true">
                <i class="sw-line"></i>
                <i class="sw-card"></i>
                <i class="sw-dot"></i>
            </span>
            <span class="theme-card__meta">
                <span class="theme-card__name">${theme.name}</span>
                <span class="theme-card__note">${theme.note || (theme.tone === 'dark' ? '深色' : '浅色')}</span>
            </span>
            <span class="theme-card__check" aria-hidden="true">
                <svg viewBox="0 0 20 20"><path d="M8.2 14.3 4.5 10.6l-1.3 1.3 5 5 9-9-1.3-1.3z"/></svg>
            </span>
        </button>`;
    }

    function renderPicker() {
        const lights = THEMES.filter(t => t.tone === 'light');
        const darks = THEMES.filter(t => t.tone === 'dark');

        picker.innerHTML = `
            <div class="theme-group">
                <p class="theme-group__label">跟随系统</p>
                <div class="theme-grid theme-grid--single">${cardHTML(AUTO, true)}</div>
            </div>
            <div class="theme-group">
                <p class="theme-group__label">浅色 · 纸</p>
                <div class="theme-grid">${lights.map(t => cardHTML(t, false)).join('')}</div>
            </div>
            <div class="theme-group">
                <p class="theme-group__label">深色 · 墨</p>
                <div class="theme-grid">${darks.map(t => cardHTML(t, false)).join('')}</div>
            </div>`;

        if (countEl) countEl.textContent = String(THEMES.length);
        if (lightCountEl) lightCountEl.textContent = String(lights.length);
        if (darkCountEl) darkCountEl.textContent = String(darks.length);
    }

    function syncThemeCards() {
        const current = window.App.getThemeChoice();
        picker.querySelectorAll('.theme-card').forEach(card => {
            const active = card.dataset.themeId === current;
            card.classList.toggle('is-active', active);
            card.setAttribute('aria-checked', active ? 'true' : 'false');
        });
        const autoCard = picker.querySelector('.theme-card--auto');
        if (autoCard) {
            const resolved = window.App.getResolvedTheme();
            const theme = THEMES.find(t => t.id === resolved);
            const note = autoCard.querySelector('.theme-card__note');
            if (note) note.textContent = '当前随系统：' + (theme ? theme.name : resolved);
        }
    }

    function syncModeCards() {
        const mode = window.App.getReaderMode();
        modesBox.querySelectorAll('.mode-card').forEach(card => {
            const active = card.dataset.mode === mode;
            card.classList.toggle('is-active', active);
            card.setAttribute('aria-checked', active ? 'true' : 'false');
        });

        // 窄屏下"推出"实际会是浮层，提示一下
        const narrow = window.matchMedia('(max-width: 1024px)').matches;
        modesBox.classList.toggle('is-narrow', narrow);
    }

    picker.addEventListener('click', (event) => {
        const card = event.target.closest('.theme-card');
        if (!card) return;
        window.App.setTheme(card.dataset.themeId);
        syncThemeCards();
        if (window.showNotification) {
            const theme = card.dataset.themeId === 'auto'
                ? AUTO
                : THEMES.find(t => t.id === card.dataset.themeId);
            window.showNotification('已换用「' + (theme ? theme.name : card.dataset.themeId) + '」配色', 'success');
        }
    });

    modesBox.addEventListener('click', (event) => {
        const card = event.target.closest('.mode-card');
        if (!card) return;
        window.App.setReaderMode(card.dataset.mode);
        syncModeCards();
        if (window.showNotification) {
            window.showNotification(card.dataset.mode === 'push'
                ? '阅读栏将以「右侧推出」的方式出现'
                : '阅读栏将以「浮层模态」的方式出现', 'success');
        }
    });

    document.addEventListener('mypoems:themechange', syncThemeCards);
    document.addEventListener('mypoems:readermodechange', syncModeCards);
    window.addEventListener('resize', syncModeCards);

    renderPicker();
    syncThemeCards();
    syncModeCards();
})();
