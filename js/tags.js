/**
 * ===================================================================
 * MyPoems - 索引管理逻辑脚本 (tags.js) - 批量增强版
 * ===================================================================
 */

(function() {
    let allPoems = [];
    let tagStats = [];
    
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
            <div class="tag-list-item ${isActive ? 'active' : ''}" data-key="${key}">
                <span class="tag-name" style="${t.isNoTag ? 'color:var(--color-text-muted);font-style:italic;' : ''}">
                    ${t.name}
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
            poemListEl.innerHTML = `<div class="empty-state" style="padding:40px;">没有匹配作品</div>`;
        } else {
            poemListEl.innerHTML = filteredPoems.map(poem => {
                // 生成标签 HTML (带删除按钮)
                let tagsHtml = '';
                if (poem.tags && poem.tags.length > 0) {
                    tagsHtml = `<div class="poem-inline-tags">` + 
                        poem.tags.map(t => 
                            `<span class="inline-tag">
                                ${t}
                                <span class="remove-tag-btn" onclick="event.stopPropagation(); window.removeTagFromPoem('${poem.filename}', '${t}')">&times;</span>
                            </span>`
                        ).join('') + 
                    `</div>`;
                }

                return `
                <div class="related-poem-item" data-filename="${poem.filename}" onclick="window.togglePoemSelection('${poem.filename}')">
                    <div class="poem-item-left">
                        <input type="checkbox" class="poem-checkbox" ${selectedPoems.has(poem.filename) ? 'checked' : ''}>
                        <div class="poem-info">
                            <span class="related-poem-title" onclick="event.stopPropagation(); window.App.openPoemByFilename('${poem.filename}')">${poem.title || '无题'}</span>
                            ${tagsHtml}
                        </div>
                    </div>
                    <span class="related-poem-date">${poem.creationDate || ''}</span>
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
        if (!confirm(`确定从该作品中移除标签 "${tag}" 吗？`)) return;
        
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
        const newName = prompt(`请输入"${currentTag}"的新名称：`, currentTag);
        if (newName && newName.trim() !== '' && newName !== currentTag) {
            await executeBatchUpdate(currentTag, newName.trim());
        }
    }

    async function handleDelete() {
        const currentTag = Array.from(selectedTags)[0];
        if (confirm(`确定移除标签 "${currentTag}" 吗？`)) {
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
        btnRename.addEventListener('click', handleRename);
        btnDelete.addEventListener('click', handleDelete);
    }

    initialize();
})();