/**
 * ===================================================================
 * MyPoems - 添加新篇逻辑脚本 (add.js) - 标签云增强版
 * ===================================================================
 */

(function() {
    const form = document.getElementById('add-poem-form');
    if (!form) { return; }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    const DRAFT_STORAGE_KEY = 'addPoemFormDraft';
    const typeSelect = document.getElementById('poem-type');
    const genreGroup = document.getElementById('poem-genre-group');
    const genreLabel = document.getElementById('poem-genre-label');
    const contentTextarea = document.getElementById('poem-content');

    // 界面反馈元素
    const statsEl = document.getElementById('editor-stats');
    const draftChip = document.getElementById('draft-chip');
    const draftTextEl = document.getElementById('draft-text');
    const clearDraftBtn = document.getElementById('btn-clear-draft');
    const prefaceEl = document.getElementById('poem-preface');
    const notesEl = document.getElementById('poem-notes');
    const creationDateInput = document.getElementById('poem-creationDate');

    // 精句相关元素
    const quoteInput = document.getElementById('add-quote-input');
    const addQuoteBtn = document.getElementById('btn-add-quote');
    const quoteListEl = document.getElementById('add-quote-list');
    let currentQuotes = [];

    if (!typeSelect || !genreGroup || !genreLabel || !contentTextarea) {
        console.error('致命错误: add.html 页面缺少关键表单元素。');
        return;
    }

    /* ------------------------------------------------------------------
     * 界面反馈：字数/段数、草稿状态、快捷键
     * ---------------------------------------------------------------- */
    function hhmm() {
        const d = new Date();
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function updateStats() {
        if (!statsEl) return;
        const content = contentTextarea.value || '';
        const chars = content.replace(/\s/g, '').length;
        const segments = content.split('\n').filter(l => l.trim()).length;
        statsEl.textContent = `${chars} 字 · ${segments} 段`;
    }

    function setDraftState(state, text) {
        if (draftChip) draftChip.dataset.state = state;
        if (draftTextEl && text) draftTextEl.textContent = text;
        if (clearDraftBtn) clearDraftBtn.hidden = !sessionStorage.getItem(DRAFT_STORAGE_KEY);
    }

    /**
     * 初始化高级标签输入组件 (带标签云)
     * @param {string} componentId - 组件容器ID
     * @param {string} hiddenInputId - 隐藏输入框ID
     * @param {string} cloudContainerId - [新增] 标签云容器ID
     */
    function initializeTagInput(componentId, hiddenInputId, cloudContainerId) {
        const component = document.getElementById(componentId);
        if (!component) return { setTags: () => {} };

        const tagList = component.querySelector('.tag-list');
        const input = component.querySelector('.tag-input');
        const suggestions = component.nextElementSibling;
        const hiddenInput = document.getElementById(hiddenInputId);
        const cloudContainer = document.getElementById(cloudContainerId);
        
        let allTags = [];
        let selectedTags = [];

        // 获取标签数据
        fetch('/api/tags').then(res => res.json()).then(data => { 
            allTags = data;
            renderTagCloud(); // 获取数据后立即渲染标签云
        });

        // 渲染已选标签
        function renderSelectedTags() {
            tagList.innerHTML = selectedTags.map(tag => `<li class="tag-item">${esc(tag)}<span class="remove-tag" data-tag="${esc(tag)}" role="button" aria-label="移除标签">&times;</span></li>`).join('');
            hiddenInput.value = selectedTags.join(',');
            form.dispatchEvent(new Event('input')); // 触发保存草稿
            renderTagCloud(); // 重新渲染标签云（移除已选的）
        }

        // 渲染标签云 (仅显示未选中的)
        function renderTagCloud() {
            if (!cloudContainer) return;
            // 过滤掉已经选中的标签
            const availableTags = allTags.filter(tag => !selectedTags.includes(tag));
            
            if (availableTags.length === 0) {
                cloudContainer.innerHTML = '<span class="stat-empty">暂无更多可选标签</span>';
                return;
            }

            cloudContainer.innerHTML = availableTags.map(tag => 
                `<div class="tag-cloud-item" data-tag="${esc(tag)}">${esc(tag)}</div>`
            ).join('');
        }

        // 渲染输入联想 (搜索)
        function renderSuggestions(query) {
            if (!query) { suggestions.style.display = 'none'; return; }
            const filtered = allTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase()) && !selectedTags.includes(tag));
            if (filtered.length > 0) {
                suggestions.innerHTML = filtered.map(tag => `<li data-tag="${esc(tag)}">${esc(tag)}</li>`).join('');
                suggestions.style.display = 'block';
            } else {
                suggestions.style.display = 'none';
            }
        }

        function addTag(tag) {
            const trimmed = tag.trim();
            if (trimmed && !selectedTags.includes(trimmed)) {
                selectedTags.push(trimmed);
                renderSelectedTags();
            }
            input.value = '';
            suggestions.style.display = 'none';
            input.focus();
        }

        // 事件监听
        input.addEventListener('input', () => renderSuggestions(input.value));
        input.addEventListener('keydown', e => {
            if ((e.key === 'Enter' || e.key === ',') && input.value) {
                e.preventDefault();
                addTag(input.value);
            }
        });
        
        // 联想菜单点击
        suggestions.addEventListener('click', e => {
            if (e.target.tagName === 'LI') {
                addTag(e.target.dataset.tag);
            }
        });
        
        // 已选标签删除点击
        tagList.addEventListener('click', e => {
            if (e.target.classList.contains('remove-tag')) {
                const tagToRemove = e.target.dataset.tag;
                selectedTags = selectedTags.filter(t => t !== tagToRemove);
                renderSelectedTags();
            }
        });

        // 【新增】标签云点击
        if (cloudContainer) {
            cloudContainer.addEventListener('click', e => {
                if (e.target.classList.contains('tag-cloud-item')) {
                    addTag(e.target.dataset.tag);
                }
            });
        }

        // 交互细节
        component.addEventListener('click', (e) => { if (e.target !== input) input.focus(); });
        document.addEventListener('click', e => {
            if (!component.contains(e.target) && !suggestions.contains(e.target)) {
                suggestions.style.display = 'none';
            }
        });

        return {
            setTags: (tagsArray) => {
                selectedTags = [...(tagsArray || [])];
                renderSelectedTags();
            }
        };
    }

    // --- 精句逻辑 (保持不变) ---
    function renderQuotes() {
        if (!quoteListEl) return;
        quoteListEl.innerHTML = currentQuotes.map((quote, index) => `
            <li class="quote-list-item">
                <span>${esc(quote)}</span>
                <span class="remove-quote" data-index="${index}" role="button" aria-label="删除此句">&times;</span>
            </li>
        `).join('');
    }

    function addQuote() {
        const text = quoteInput.value.trim();
        if (text) {
            if (!currentQuotes.includes(text)) {
                currentQuotes.push(text);
                renderQuotes();
                saveDraft();
            }
            quoteInput.value = '';
            quoteInput.focus();
        }
    }

    // --- 通用逻辑 ---
    function updateGenreField() {
        const type = typeSelect.value;
        let currentGenreField = form.querySelector('[name="genre"]');
        if (type === '诗') {
            genreGroup.style.display = 'block'; genreLabel.textContent = '体裁:';
            if (currentGenreField.tagName !== 'SELECT') { const newSelect = document.createElement('select'); newSelect.id = 'poem-genre'; newSelect.name = 'genre'; newSelect.innerHTML = `<option value="五言">五言</option><option value="七言">七言</option>`; currentGenreField.replaceWith(newSelect); }
        } else if (type === '词') {
            genreGroup.style.display = 'block'; genreLabel.textContent = '词牌名:';
            if (currentGenreField.tagName !== 'INPUT') { const newInput = document.createElement('input'); newInput.type = 'text'; newInput.id = 'poem-genre'; newInput.name = 'genre'; newInput.required = true; currentGenreField.replaceWith(newInput); }
        } else { genreGroup.style.display = 'none'; }
    }
    
    function saveDraft() {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.quotes = currentQuotes;

        // 只有真正写了东西才留草稿（类型/时间等有默认值，不算）
        const meaningful = ['title', 'content', 'preface', 'notes', 'tags']
            .some(k => String(data[k] == null ? '' : data[k]).trim());
        if (!meaningful && currentQuotes.length === 0) {
            sessionStorage.removeItem(DRAFT_STORAGE_KEY);
            updateStats();
            setDraftState('idle', '尚无草稿');
            return;
        }

        sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
        updateStats();
        setDraftState('dirty', `草稿已存 · ${hhmm()}`);
    }

    function loadDraft() {
        const savedData = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (savedData) {
            const data = JSON.parse(savedData);
            for (const key in data) {
                if (form.elements[key] && key !== 'tags' && key !== 'quotes') {
                    if (key === 'creationDate' && !data[key]) continue;
                    form.elements[key].value = data[key];
                }
            }
            if (data.tags) {
                tagInputInstance.setTags(data.tags.split(',').filter(Boolean));
            }
            if (data.quotes && Array.isArray(data.quotes)) {
                currentQuotes = data.quotes;
                renderQuotes();
            }
            updateGenreField();
            setDraftState('saved', '已恢复草稿');
            showNotification('已恢复您上次未完成的草稿。', 'success');
        } else {
            setDraftState('idle', '尚无草稿');
        }
        updateStats();
    }
    
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(form);
        const poemData = Object.fromEntries(formData.entries());
        poemData.quotes = currentQuotes;

        try {
            const response = await fetch('/api/poems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(poemData), });
            if (response.ok) {
                showNotification('作品已成功保存！', 'success');
                form.reset();
                tagInputInstance.setTags([]); 
                currentQuotes = []; 
                renderQuotes();
                sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                if (window.App && typeof window.App.loadPage === 'function') { window.App.loadPage('view'); } else { window.location.reload(); }
            } else { const errorText = await response.text(); showNotification(`保存失败: ${errorText}`, 'error'); }
        } catch (error) { console.error('保存作品时出错:', error); showNotification('保存作品时出错，请检查本地服务', 'error'); }
    });

    typeSelect.addEventListener('change', updateGenreField);
    form.addEventListener('input', saveDraft);

    /* 清空草稿：重置表单并丢弃已存草稿 */
    if (clearDraftBtn) {
        clearDraftBtn.addEventListener('click', async () => {
            const ok = await window.App.confirm({
                tone: 'danger',
                title: '清空草稿',
                message: '已填写的标题、正文、序言、注释、摘句与标签都会一并丢弃。',
                confirmText: '清空',
                cancelText: '继续写'
            });
            if (!ok) return;

            sessionStorage.removeItem(DRAFT_STORAGE_KEY);
            form.reset();
            tagInputInstance.setTags([]);
            currentQuotes = [];
            renderQuotes();
            if (creationDateInput) creationDateInput.value = todayISO();
            updateGenreField();
            sessionStorage.removeItem(DRAFT_STORAGE_KEY);
            updateStats();
            setDraftState('idle', '尚无草稿');
            showNotification('草稿已清空', 'success');
        });
    }

    /* Ctrl / Cmd + S 保存 */
    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 's') {
            event.preventDefault();
            form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    });

    if (addQuoteBtn && quoteInput && quoteListEl) {
        addQuoteBtn.addEventListener('click', addQuote);
        quoteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addQuote(); }
        });
        quoteListEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-quote')) {
                const index = parseInt(e.target.dataset.index);
                currentQuotes.splice(index, 1);
                renderQuotes();
                saveDraft();
            }
        });
    }
    
    // --- 初始化: 传入第三个参数 'add-tag-cloud' ---
    const tagInputInstance = initializeTagInput('add-tag-input-component', 'poem-tags', 'add-tag-cloud');

    if (creationDateInput) creationDateInput.value = todayISO();
    loadDraft();
    updateGenreField();
    updateStats();
})();