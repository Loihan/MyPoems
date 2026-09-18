/**
 * ===================================================================
 * MyPoems - 索引管理逻辑脚本 (tags.js) - 批量增强版
 * ===================================================================
 */

(function() {
    let allPoems = [];
    let tagStats = [];

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    
    // 状态管理
    let selectedTags = new Set(); // 左侧选中的标签
    let selectedPoems = new Set(); // 右侧选中的作品(filename)
    const NO_TAG_KEY = '___UNTAGGED___';

    // DOM
    const listContainer = document.getElementById('tags-list-container');
    const searchInput = document.getElementById('tag-search');
    const viewTitle = document.getElementById('current-view-title');
    const viewCount = document.getElementById('current-list-count');
    const poemListEl = document.getElementById('related-poems-list');
    const actionsArea = document.getElementById('tag-actions-area');
    
    // 批量操作相关 DOM
    const batchBar = document.getElementById('batch-tag-bar');
    const batchCountEl = document.getElementById('batch-selected-count');
    const batchInput = document.getElementById('batch-add-input');
    const btnBatchAdd = document.getElementById('btn-batch-add');
    const btnSelectAll = document.getElementById('btn-select-all');

    // 标签本身操作按钮
    const btnRename = document.getElementById('btn-rename-tag');
    const btnDelete = document.getElementById('btn-delete-tag');

    async function initialize() {
        await loadData();
        processTags();
        renderTagList();
        renderRightSide();
        addEventListeners();
    }

    async function loadData() {
        try {
            const response = await fetch('/api/poems');
            const files = await response.json();
            allPoems = await Promise.all(
                files.map(async f => {
                    const res = await fetch(`/api/poems/${f}`);
                    const data = await res.json();
                    return { ...data, filename: f };
                })
            );
        } catch (e) { console.error(e); }
    }

    function processTags() {
        const map = new Map();
        let noTagCount = 0;
        allPoems.forEach(poem => {
            if (poem.tags && Array.isArray(poem.tags) && poem.tags.length > 0) {
                poem.tags.forEach(tag => map.set(tag, (map.get(tag) || 0) + 1));
            } else {
                noTagCount++;
            }
        });
        tagStats = Array.from(map.entries()).map(([name, count]) => ({ name, count }));
        tagStats.sort((a, b) => b.count - a.count);
        if (noTagCount > 0) tagStats.unshift({ name: '无标签', count: noTagCount, isNoTag: true });
    }

    function renderTagList() {
        const query = searchInput.value.trim().toLowerCase();
        let filtered = tagStats.filter(t => {
            if (t.isNoTag) return '无标签'.includes(query);
            return t.name.toLowerCase().includes(query);
        });

        listContainer.innerHTML = filtered.map(t => {
            const key = t.isNoTag ? NO_TAG_KEY : t.name;
            const isActive = selectedTags.has(key);
            return `
            <div class="tag-list-item ${isActive ? 'active' : ''}" data-key="${esc(key)}" role="button" tabindex="0">
                <span class="tag-name"${t.isNoTag ? ' style="color:var(--ink-muted);font-style:italic;"' : ''}>
                    ${esc(t.name)}
                </span>
                <span class="tag-badge">${t.count}</span>
            </div>
        `;}).join('');
    }

    function toggleTagSelection(key) {
        if (selectedTags.has(key)) selectedTags.delete(key); else selectedTags.add(key);
        renderTagList();
        renderRightSide();
    }

    // --- 右侧渲染 (含标签展示与复选框) ---
    function renderRightSide() {
        // 重置作品选中状态
        selectedPoems.clear();
        updateBatchBar();

        let filteredPoems = [];
        let titleText = '';

        if (selectedTags.size === 0) {
            filteredPoems = allPoems;
            titleText = '所有作品';
            actionsArea.style.display = 'none';
        } else {
            const tagsArray = Array.from(selectedTags);
            const displayNames = tagsArray.map(k => k === NO_TAG_KEY ? '无标签' : k);
            titleText = displayNames.join(' + ');
            
            filteredPoems = allPoems.filter(poem => {
                return tagsArray.every(key => {
                    if (key === NO_TAG_KEY) return !poem.tags || poem.tags.length === 0;
                    return poem.tags && poem.tags.includes(key);
                });
            });

            if (selectedTags.size === 1 && !selectedTags.has(NO_TAG_KEY)) {
                actionsArea.style.display = 'flex';
            } else {
                actionsArea.style.display = 'none';
            }
        }

        viewTitle.textContent = titleText;
        viewCount.textContent = filteredPoems.length;

        if (filteredPoems.length === 0) {
            poemListEl.innerHTML = `<div class="empty-state"><div class="empty-state__glyph">无</div><h3>没有匹配作品</h3><p>换一个标签，或为作品补上签条。</p></div>`;
        } else {
            poemListEl.innerHTML = filteredPoems.map(poem => {
                let tagsHtml = '';
                if (poem.tags && poem.tags.length > 0) {
                    tagsHtml = `<div class="poem-inline-tags">` +
                        poem.tags.map(t =>
                            `<span class="inline-tag" data-tag="${esc(t)}">
                                ${esc(t)}
                                <span class="remove-tag-btn" data-action="untag" role="button" aria-label="移除标签" title="移除标签">&times;</span>
                            </span>`
                        ).join('') +
                    `</div>`;
                }

                return `
                <div class="related-poem-item ${selectedPoems.has(poem.filename) ? 'selected' : ''}"
                     data-filename="${esc(poem.filename)}" role="button" tabindex="0">
                    <div class="poem-item-left">
                        <input type="checkbox" class="poem-checkbox" tabindex="-1" ${selectedPoems.has(poem.filename) ? 'checked' : ''} aria-label="选择此作品">
                        <div class="poem-info">
                            <span class="related-poem-title" data-action="open">${esc(poem.title || '无题')}</span>
                            ${tagsHtml}
                        </div>
                    </div>
                    <span class="related-poem-date">${esc(poem.creationDate || '')}</span>
                </div>
            `;}).join('');
        }
    }

    // --- 批量操作逻辑 ---

    // 切换单个作品选中
    window.togglePoemSelection = function(filename) {
        if (selectedPoems.has(filename)) selectedPoems.delete(filename); else selectedPoems.add(filename);
        
        // 更新 UI 选中状态
        const item = document.querySelector(`.related-poem-item[data-filename="${filename}"]`);
        if(item) {
            const checkbox = item.querySelector('.poem-checkbox');
            if(checkbox) checkbox.checked = selectedPoems.has(filename);
            if(selectedPoems.has(filename)) item.classList.add('selected'); else item.classList.remove('selected');
        }
        updateBatchBar();
    };

    // 全选/反选
    btnSelectAll.addEventListener('click', () => {
        const allVisible = Array.from(poemListEl.querySelectorAll('.related-poem-item')).map(el => el.dataset.filename);
        if (selectedPoems.size === allVisible.length) {
            selectedPoems.clear(); // 全部取消
        } else {
            allVisible.forEach(f => selectedPoems.add(f)); // 全选
        }
        // 重新渲染复选框状态（为了简单直接重绘，或者手动更新DOM）
        // 这里手动更新 DOM 性能更好
        const items = poemListEl.querySelectorAll('.related-poem-item');
        items.forEach(item => {
            const f = item.dataset.filename;
            const cb = item.querySelector('.poem-checkbox');
            cb.checked = selectedPoems.has(f);
            if(selectedPoems.has(f)) item.classList.add('selected'); else item.classList.remove('selected');
        });
        updateBatchBar();
    });

    function updateBatchBar() {
        batchCountEl.textContent = selectedPoems.size;
        if (selectedPoems.size > 0) {
            batchBar.classList.add('show');
        } else {
            batchBar.classList.remove('show');
        }
    }

    // 执行批量添加
    btnBatchAdd.addEventListener('click', async () => {
        const tag = batchInput.value.trim();
        if (!tag) return showNotification('请输入标签名', 'error');
        if (selectedPoems.size === 0) return;

        try {
            const res = await fetch('/api/tags/add-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filenames: Array.from(selectedPoems), tag })
            });
            if (res.ok) {
                const data = await res.json();
                showNotification(`成功为 ${data.modifiedCount} 篇作品添加 "${tag}"`, 'success');
                batchInput.value = '';
                await loadData();
                processTags(); // 刷新左侧计数
                renderTagList();
                renderRightSide(); // 刷新右侧列表
            }
        } catch (e) { showNotification('批量添加失败', 'error'); }
    });

    // --- 单个删除逻辑 (暴露给全局) ---
    window.removeTagFromPoem = async function(filename, tag) {
        const poem = allPoems.find(p => p.filename === filename) || {};
        const ok = await window.App.confirm({
            tone: 'danger',
            title: '移除标签',
            message: '只从这一篇作品上取下这个签条，标签本身仍会保留。',
            detail: `「${tag}」 · 《${poem.title || '无题'}》`,
            confirmText: '移除',
            cancelText: '取消'
        });
        if (!ok) return;

        try {
            const res = await fetch('/api/tags/remove-one', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, tag })
            });
            if (res.ok) {
                showNotification('标签已移除', 'success');
                // 局部刷新数据
                await loadData();
                processTags(); // 更新左侧计数
                renderTagList();
                renderRightSide(); // 重新渲染列表以移除那个标签丸子
            }
        } catch (e) { showNotification('移除失败', 'error'); }
    };

    // --- 标签重命名/删除 (保持原有逻辑) ---
    async function handleRename() {
        if (selectedTags.size !== 1) return;
        const currentTag = Array.from(selectedTags)[0];

        if (currentTag === NO_TAG_KEY) {
            await window.App.confirm({
                tone: 'info',
                title: '这是一组「未贴签」的作品',
                message: '「无标签」只是尚未贴签的作品集合，不是真正的标签，因此不能重命名。先给它们贴上具体签条即可。',
                singleAction: true,
                confirmText: '知道了'
            });
            return;
        }

        const newName = await window.App.prompt({
            tone: 'info',
            title: '重命名 / 合并标签',
            message: '若已存在同名标签，两者会自动合并。',
            detail: `当前：${currentTag}`,
            input: { value: currentTag, placeholder: '输入新的标签名' },
            confirmText: '重命名',
            cancelText: '取消'
        });
        if (newName && newName !== currentTag) {
            await executeBatchUpdate(currentTag, newName);
        }
    }

    async function handleDelete() {
        if (selectedTags.size !== 1) return;
        const currentTag = Array.from(selectedTags)[0];

        if (currentTag === NO_TAG_KEY) {
            await window.App.confirm({
                tone: 'info',
                title: '无法删除「无标签」',
                message: '它不是真正的标签，只是「尚未贴签」的作品集合，无需也无法删除。',
                singleAction: true,
                confirmText: '知道了'
            });
            return;
        }

        const count = (tagStats.find(t => t.name === currentTag) || {}).count || 0;
        const ok = await window.App.confirm({
            tone: 'danger',
            title: '删除标签',
            message: `将从${count ? '这 ' + count + ' 篇' : '所有'}作品上移除该签条，作品本身不受影响。`,
            detail: `「${currentTag}」`,
            confirmText: '删除',
            cancelText: '取消'
        });
        if (ok) {
            await executeBatchUpdate(currentTag, null);
        }
    }

    async function executeBatchUpdate(oldTag, newTag) {
        try {
            const res = await fetch('/api/tags/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldTag, newTag })
            });
            if (res.ok) {
                const data = await res.json();
                showNotification(`操作成功`, 'success');
                selectedTags.clear();
                if (newTag) selectedTags.add(newTag);
                await loadData();
                processTags();
                renderTagList();
                renderRightSide();
            }
        } catch (e) {}
    }

    function addEventListeners() {
        searchInput.addEventListener('input', renderTagList);

        listContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.tag-list-item');
            if (item) toggleTagSelection(item.dataset.key);
        });

        listContainer.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const item = e.target.closest('.tag-list-item');
            if (item) { e.preventDefault(); toggleTagSelection(item.dataset.key); }
        });

        /* 关联作品：事件委托（避免 innerHTML 内联 onclick 的转义问题） */
        poemListEl.addEventListener('click', (e) => {
            const item = e.target.closest('.related-poem-item');
            if (!item) return;
            const filename = item.dataset.filename;

            const untagBtn = e.target.closest('[data-action="untag"]');
            if (untagBtn) {
                const tagEl = untagBtn.closest('.inline-tag');
                if (tagEl) window.removeTagFromPoem(filename, tagEl.dataset.tag);
                return;
            }

            if (e.target.closest('[data-action="open"]')) {
                if (window.App && window.App.openPoemByFilename) window.App.openPoemByFilename(filename);
                return;
            }

            window.togglePoemSelection(filename);
        });

        poemListEl.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            const item = e.target.closest('.related-poem-item');
            if (item) { e.preventDefault(); window.togglePoemSelection(item.dataset.filename); }
        });

        btnRename.addEventListener('click', handleRename);
        btnDelete.addEventListener('click', handleDelete);
    }

    initialize();
})();