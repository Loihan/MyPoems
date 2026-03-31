/**
 * ===================================================================
 * MyPoems - 作品管理逻辑脚本 (manage.js) - 体裁显示修复版
 * ===================================================================
 */

(function() {
    let allPoems = [];
    
    // --- DOM元素 ---
    const listContainer = document.getElementById('manage-poems-list'); // tbody
    const searchInput = document.getElementById('manage-search-input');
    const filterTypeSelect = document.getElementById('manage-filter-type');
    const counter = document.getElementById('manage-poem-counter');
    
    // 模态框相关
    const modal = document.getElementById('edit-modal');
    const closeModalBtn = document.getElementById('modal-close-btn');
    const editForm = document.getElementById('edit-poem-form');
    let tagInputInstance;

    // 精句相关
    const editQuoteInput = document.getElementById('edit-quote-input');
    const editAddQuoteBtn = document.getElementById('edit-btn-add-quote');
    const editQuoteListEl = document.getElementById('edit-quote-list');
    let editCurrentQuotes = []; 

    // --- 标签组件逻辑 ---
    function initializeTagInput(componentId, hiddenInputId, cloudContainerId) {
        const component = document.getElementById(componentId);
        const hiddenInput = document.getElementById(hiddenInputId);
        const cloudContainer = document.getElementById(cloudContainerId);

        if (!component || !hiddenInput) {
            return { setTags: () => {}, destroy: () => {} };
        }

        const tagList = component.querySelector('.tag-list');
        const input = component.querySelector('.tag-input');
        const suggestions = component.nextElementSibling;
        
        let allTags = [];
        let selectedTags = [];
        let eventListeners = [];

        fetch('/api/tags').then(res => res.json()).then(data => { 
            allTags = data; 
            renderTagCloud();
        });

        function renderSelectedTags() {
            tagList.innerHTML = selectedTags.map(tag => `<li class="tag-item">${tag}<span class="remove-tag" data-tag="${tag}">&times;</span></li>`).join('');
            hiddenInput.value = selectedTags.join(',');
            renderTagCloud();
        }

        function renderTagCloud() {
            if (!cloudContainer) return;
            const availableTags = allTags.filter(tag => !selectedTags.includes(tag));
            if (availableTags.length === 0) {
                cloudContainer.innerHTML = '<span style="font-size:0.8rem;color:#999;">暂无更多可选标签</span>';
                return;
            }
            cloudContainer.innerHTML = availableTags.map(tag => 
                `<div class="tag-cloud-item" data-tag="${tag}">${tag}</div>`
            ).join('');
        }

        function renderSuggestions(query) {
            if (!query) { suggestions.style.display = 'none'; return; }
            const filtered = allTags.filter(tag => tag.toLowerCase().includes(query.toLowerCase()) && !selectedTags.includes(tag));
            if (filtered.length > 0) {
                suggestions.innerHTML = filtered.map(tag => `<li data-tag="${tag}">${tag}</li>`).join('');
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

        const handleInput = () => renderSuggestions(input.value);
        const handleKeydown = e => { if ((e.key === 'Enter' || e.key === ',') && input.value) { e.preventDefault(); addTag(input.value); } };
        const handleSuggestionClick = e => { if (e.target.tagName === 'LI') { addTag(e.target.dataset.tag); } };
        const handleRemoveTag = e => { if (e.target.classList.contains('remove-tag')) { const tagToRemove = e.target.dataset.tag; selectedTags = selectedTags.filter(t => t !== tagToRemove); renderSelectedTags(); } };
        const handleContainerClick = (e) => { if (e.target !== input) input.focus(); };
        const handleDocumentClick = e => { if (!component.contains(e.target) && !suggestions.contains(e.target)) { suggestions.style.display = 'none'; } };
        const handleCloudClick = e => { if (e.target.classList.contains('tag-cloud-item')) { addTag(e.target.dataset.tag); } };

        input.addEventListener('input', handleInput); eventListeners.push({ el: input, type: 'input', handler: handleInput });
        input.addEventListener('keydown', handleKeydown); eventListeners.push({ el: input, type: 'keydown', handler: handleKeydown });
        suggestions.addEventListener('click', handleSuggestionClick); eventListeners.push({ el: suggestions, type: 'click', handler: handleSuggestionClick });
        tagList.addEventListener('click', handleRemoveTag); eventListeners.push({ el: tagList, type: 'click', handler: handleRemoveTag });
        component.addEventListener('click', handleContainerClick); eventListeners.push({ el: component, type: 'click', handler: handleContainerClick });
        document.addEventListener('click', handleDocumentClick); eventListeners.push({ el: document, type: 'click', handler: handleDocumentClick });
        if (cloudContainer) {
            cloudContainer.addEventListener('click', handleCloudClick);
            eventListeners.push({ el: cloudContainer, type: 'click', handler: handleCloudClick });
        }

        return {
            setTags: (tagsArray) => {
                selectedTags = [...(tagsArray || [])];
                renderSelectedTags();
            },
            destroy: () => {
                eventListeners.forEach(({ el, type, handler }) => el.removeEventListener(type, handler));
                tagList.innerHTML = '';
                suggestions.innerHTML = '';
                suggestions.style.display = 'none';
                if(cloudContainer) cloudContainer.innerHTML = '';
            }
        };
    }

    // --- 精句渲染 ---
    function renderEditQuotes() {
        if (!editQuoteListEl) return;
        editQuoteListEl.innerHTML = editCurrentQuotes.map((quote, index) => `
            <li class="quote-list-item">
                <span>${quote}</span>
                <span class="remove-quote" data-index="${index}">&times;</span>
            </li>
        `).join('');
    }
    
    async function initialize() {
        if (!listContainer || !modal || !editForm) { return; }
        await loadAllPoems();
        renderPoems(allPoems);
        addEventListeners();
    }

    async function loadAllPoems() {
        try {
            const response = await fetch('/api/poems');
            const poemFiles = await response.json();
            allPoems = await Promise.all(
                poemFiles.map(async filename => {
                    const res = await fetch(`/api/poems/${filename}`);
                    const poemData = await res.json();
                    return { filename, ...poemData };
                })
            );
            allPoems.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
        } catch (error) {
            console.error('加载出错:', error);
            listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">加载作品列表失败</td></tr>';
        }
    }

    // 【修改】渲染表格行 - 修复体裁显示逻辑
    function renderPoems(poemsToRender) {
        if (!poemsToRender || poemsToRender.length === 0) {
            listContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:#888;">没有找到匹配的作品</td></tr>';
        } else {
            listContainer.innerHTML = poemsToRender.map(poem => {
                const typeClass = `type-${poem.type || '其他'}`;
                const tagsHTML = (poem.tags && poem.tags.length) 
                    ? poem.tags.map(t => `<span class="mini-tag">${t}</span>`).join('') 
                    : '<span style="color:#ccc;font-size:0.8rem;">无标签</span>';
                
                // 【核心修复】只有当类型是 诗 或 词 时，才显示体裁
                let genreText = '';
                if ((poem.type === '诗' || poem.type === '词') && poem.genre) {
                    genreText = ` / ${poem.genre}`;
                }

                return `
                <tr>
                    <td><strong>${poem.title || '无标题'}</strong></td>
                    <td><span class="badge ${typeClass}">${poem.type || '未知'}</span>${genreText}</td>
                    <td>${tagsHTML}</td>
                    <td>${poem.creationDate || '-'}</td>
                    <td class="text-right">
                        <div class="action-btn-group">
                            <button class="action-link edit-action edit-btn" data-filename="${poem.filename}" title="编辑">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                                编辑
                            </button>
                            <button class="action-link delete-action delete-btn" data-filename="${poem.filename}" title="删除">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                                </svg>
                                删除
                            </button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }
        updateCounter(poemsToRender.length, allPoems.length);
    }
    
    function updateCounter(displayed, total) {
        if(counter) {
            counter.innerHTML = `<span>展示 <strong>${displayed}</strong></span> / <span>共 <strong>${total}</strong></span>`;
        }
    }

    function updateEditGenreFieldUI() {
        const type = editForm.querySelector('[name="type"]').value;
        const genreGroup = editForm.querySelector('#edit-genre-group');
        const genreLabel = editForm.querySelector('#edit-genre-label');
        let currentGenreField = editForm.querySelector('[name="genre"]');

        if (type === '诗') {
            genreGroup.style.display = 'block';
            genreLabel.textContent = '体裁:';
            if (currentGenreField.tagName !== 'SELECT') {
                const newSelect = document.createElement('select');
                newSelect.id = 'edit-genre';
                newSelect.name = 'genre';
                newSelect.innerHTML = `<option value="五言">五言</option><option value="七言">七言</option>`;
                currentGenreField.replaceWith(newSelect);
            }
        } else if (type === '词') {
            genreGroup.style.display = 'block';
            genreLabel.textContent = '词牌名:';
            if (currentGenreField.tagName !== 'INPUT') {
                const newInput = document.createElement('input');
                newInput.type = 'text';
                newInput.id = 'edit-genre';
                newInput.name = 'genre';
                newInput.required = true;
                currentGenreField.replaceWith(newInput);
            }
        } else {
            genreGroup.style.display = 'none';
        }
    }

    function openEditModal(filename) {
        const poemData = allPoems.find(p => p.filename === filename);
        if (!poemData) return;
        
        editForm.elements['filename'].value = filename;
        editForm.elements['title'].value = poemData.title || '';
        editForm.elements['creationDate'].value = poemData.creationDate || '';
        editForm.elements['type'].value = poemData.type || '诗';
        editForm.elements['preface'].value = poemData.preface || '';
        editForm.elements['content'].value = poemData.content || '';
        editForm.elements['notes'].value = poemData.notes || '';
        
        tagInputInstance = initializeTagInput('edit-tag-input-component', 'tags', 'edit-tag-cloud');
        tagInputInstance.setTags(poemData.tags || []);
        
        editCurrentQuotes = Array.isArray(poemData.quotes) ? [...poemData.quotes] : [];
        renderEditQuotes();

        updateEditGenreFieldUI();
        if (poemData.genre) {
            editForm.elements['genre'].value = poemData.genre;
        }
        
        editForm.elements['content'].classList.remove('poem-body-left', 'poem-body-center');
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        editForm.reset();
        if (tagInputInstance && tagInputInstance.destroy) {
            tagInputInstance.destroy();
        }
    }

    function performFilter() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        const filterType = filterTypeSelect.value; 

        const filtered = allPoems.filter(p => {
            const matchesSearch = (p.title || '').toLowerCase().includes(searchTerm);
            const matchesType = (filterType === 'all') || (p.type === filterType);
            return matchesSearch && matchesType;
        });

        renderPoems(filtered);
    }

    function addEventListeners() {
        searchInput.addEventListener('input', performFilter);
        
        if (filterTypeSelect) {
            filterTypeSelect.addEventListener('change', performFilter);
        }

        listContainer.addEventListener('click', async (event) => {
            const target = event.target.closest('button');
            if (!target) return;
            const filename = target.dataset.filename;
            if (!filename) return;

            if (target.classList.contains('edit-btn')) {
                openEditModal(filename);
            }

            if (target.classList.contains('delete-btn')) {
                if (confirm(`确定要删除作品《${(filename.replace('.json', ''))}》吗？`)) {
                    try {
                        const response = await fetch(`/api/poems/${filename}`, { method: 'DELETE' });
                        if (response.ok) {
                            showNotification('作品已删除', 'success');
                            await loadAllPoems();
                            performFilter(); 
                        } else { showNotification('删除失败', 'error'); }
                    } catch (error) { console.error('删除出错:', error); showNotification('删除时出错', 'error'); }
                }
            }
        });
        
        closeModalBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => { if (event.target === modal) { closeModal(); } });
        document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modal.style.display === 'flex') { closeModal(); } });
        
        editForm.elements['type'].addEventListener('change', updateEditGenreFieldUI);
        
        editForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(editForm);
            const originalFilename = formData.get('filename');
            formData.delete('filename');
            const poemData = Object.fromEntries(formData.entries());
            poemData.quotes = editCurrentQuotes;

            // 【核心修复】保存数据时，如果类型不是诗或词，清空体裁字段，防止脏数据
            if (poemData.type !== '诗' && poemData.type !== '词') {
                poemData.genre = '';
            }

            try {
                const response = await fetch(`/api/poems/${originalFilename}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(poemData)
                });
                if (response.ok) {
                    showNotification('作品已成功更新！', 'success');
                    closeModal();
                    await loadAllPoems();
                    performFilter();
                } else { showNotification('更新失败', 'error'); }
            } catch(error) { console.error('更新时出错:', error); showNotification('更新时出错', 'error'); }
        });

        editForm.querySelector('#cancel-edit').addEventListener('click', closeModal);

        if (editAddQuoteBtn && editQuoteInput && editQuoteListEl) {
            editAddQuoteBtn.addEventListener('click', () => {
                const text = editQuoteInput.value.trim();
                if (text && !editCurrentQuotes.includes(text)) {
                    editCurrentQuotes.push(text);
                    renderEditQuotes();
                }
                editQuoteInput.value = '';
                editQuoteInput.focus();
            });

            editQuoteInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    editAddQuoteBtn.click();
                }
            });

            editQuoteListEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('remove-quote')) {
                    const index = parseInt(e.target.dataset.index);
                    editCurrentQuotes.splice(index, 1);
                    renderEditQuotes();
                }
            });
        }
    }

    initialize();
})();