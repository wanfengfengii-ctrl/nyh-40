const CATEGORY_MAP = {
    raw_material: { name: '原料', icon: '🌾', color: 'bg-green-100 text-green-800' },
    wet_paper: { name: '湿纸页', icon: '💧', color: 'bg-blue-100 text-blue-800' },
    dry_paper: { name: '成纸', icon: '📄', color: 'bg-amber-100 text-amber-800' },
    microscopy: { name: '显微结构', icon: '🔬', color: 'bg-purple-100 text-purple-800' },
};

function getCategoryInfo(category) {
    return CATEGORY_MAP[category] || { name: category, icon: '📷', color: 'bg-gray-100 text-gray-800' };
}

const ImagesPage = {
    images: [],
    batches: [],
    fibers: [],
    sizingAgents: [],
    fillers: [],
    filterCategory: '',
    filterBatchId: '',
    includeHidden: false,
    selectedImageIds: new Set(),
    viewMode: 'grid',
    compareMode: false,

    async mount() {
        App.setPageTitle('📷 实验图片管理');
        App.setPageActions(`
            <label class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" id="img-show-hidden" onchange="ImagesPage.toggleShowHidden()" ${this.includeHidden ? 'checked' : ''}>
                <span class="text-sm text-gray-600">显示隐藏</span>
            </label>
            <button class="btn btn-outline" onclick="ImagesPage.enterCompareMode()">
                ⚖️ 图片对比
            </button>
            <button class="btn btn-success" onclick="ImagesPage.openUploadModal()">
                ➕ 上传图片
            </button>
        `);
        loading(true);
        await this.loadAllData();
        this.render();
    },

    async loadAllData() {
        try {
            [this.batches, this.fibers, this.sizingAgents, this.fillers] = await Promise.all([
                API.batches.list(),
                API.fibers.list(),
                API.sizingAgents.list(),
                API.fillers.list(),
            ]);
            await this.loadImages();
        } catch (error) {
            showToast('加载数据失败: ' + error.message, 'error');
        }
    },

    async loadImages() {
        try {
            const params = {};
            if (this.filterCategory) params.category = this.filterCategory;
            if (this.filterBatchId) params.batch_id = this.filterBatchId;
            if (this.includeHidden) params.include_hidden = 'true';
            params.limit = 200;
            this.images = await API.images.list(params);
        } catch (error) {
            showToast('加载图片列表失败: ' + error.message, 'error');
            this.images = [];
        }
    },

    render() {
        const content = `
            <div class="space-y-4">
                ${this.renderFilters()}
                ${this.compareMode ? this.renderCompareBar() : ''}
                ${this.images.length === 0 ? emptyState('暂无图片，请点击右上角上传图片', '📷') : ''}
                ${this.viewMode === 'grid' ? this.renderGrid() : this.renderList()}
            </div>
        `;
        App.setPageContent(content);
    },

    renderFilters() {
        return `
            <div class="card p-4">
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-600">分类：</label>
                        <select class="select w-36" onchange="ImagesPage.onFilterCategory(this.value)">
                            <option value="">全部分类</option>
                            ${Object.entries(CATEGORY_MAP).map(([key, val]) => `
                                <option value="${key}" ${this.filterCategory === key ? 'selected' : ''}>${val.icon} ${val.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-sm text-gray-600">批次：</label>
                        <select class="select w-48" onchange="ImagesPage.onFilterBatch(this.value)">
                            <option value="">全部批次</option>
                            ${this.batches.map(b => `
                                <option value="${b.id}" ${this.filterBatchId === String(b.id) ? 'selected' : ''}>${b.batch_no}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div class="flex-1"></div>
                    <div class="flex bg-gray-100 rounded-lg p-1">
                        <button class="px-3 py-1 rounded-md text-sm ${this.viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}"
                                onclick="ImagesPage.switchView('grid')">▦ 网格</button>
                        <button class="px-3 py-1 rounded-md text-sm ${this.viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-600'}"
                                onclick="ImagesPage.switchView('list')">☰ 列表</button>
                    </div>
                    <span class="text-sm text-gray-500">共 ${this.images.length} 张图片</span>
                </div>
            </div>
        `;
    },

    renderCompareBar() {
        const count = this.selectedImageIds.size;
        return `
            <div class="card p-4 bg-blue-50 border-blue-200">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-sm text-blue-700">对比模式：已选择 <strong>${count}</strong> 张图片（2-4张）</span>
                        ${count >= 2 ? `<button class="btn btn-sm btn-primary" onclick="ImagesPage.doCompare()">开始对比</button>` : ''}
                        <button class="btn btn-sm btn-outline" onclick="ImagesPage.exitCompareMode()">退出对比</button>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="ImagesPage.clearSelection()">清空选择</button>
                </div>
            </div>
        `;
    },

    renderGrid() {
        return `
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                ${this.images.map(img => this.renderImageCard(img)).join('')}
            </div>
        `;
    },

    renderImageCard(img) {
        const cat = getCategoryInfo(img.category);
        const isSelected = this.selectedImageIds.has(img.id);
        return `
            <div class="card overflow-hidden ${img.is_hidden ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}">
                <div class="relative group cursor-pointer" onclick="${this.compareMode ? `ImagesPage.toggleSelectImage(${img.id})` : `ImagesPage.openImageDetail(${img.id})`}">
                    <div class="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                        <img src="${API.images.getFileUrl(img.id)}" 
                             alt="${img.title || img.file_name}" 
                             class="w-full h-full object-cover"
                             onerror="this.parentElement.innerHTML='<span class=\\'text-4xl text-gray-300\\'>📷</span>'">
                    </div>
                    <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                        ${this.compareMode ? `
                            <div class="w-8 h-8 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-white bg-opacity-70'} flex items-center justify-center">
                                ${isSelected ? '<span class="text-white text-sm">✓</span>' : ''}
                            </div>
                        ` : ''}
                    </div>
                    ${img.is_typical ? '<div class="absolute top-2 left-2 bg-yellow-400 text-white text-xs px-2 py-0.5 rounded-full">典型</div>' : ''}
                    ${img.is_hidden ? '<div class="absolute top-2 right-2 bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">隐藏</div>' : ''}
                </div>
                <div class="p-3">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="chip ${cat.color} text-xs">${cat.icon} ${cat.name}</span>
                    </div>
                    <p class="text-sm font-medium text-gray-800 truncate" title="${img.title || img.file_name}">${img.title || img.file_name}</p>
                    ${img.description ? `<p class="text-xs text-gray-500 mt-1 line-clamp-2">${img.description}</p>` : ''}
                    <div class="flex items-center justify-between mt-2">
                        <span class="text-xs text-gray-400">${formatDateTime(img.created_at)}</span>
                        <div class="flex gap-1">
                            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); ImagesPage.openImageDetail(${img.id})" title="详情">👁</button>
                            <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); ImagesPage.toggleHidden(${img.id})" title="${img.is_hidden ? '显示' : '隐藏'}">${img.is_hidden ? '👁' : '👁‍🗨'}</button>
                            <button class="btn btn-xs btn-danger" onclick="event.stopPropagation(); ImagesPage.deleteImage(${img.id})" title="删除">✕</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderList() {
        return `
            <div class="card overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            ${this.compareMode ? '<th class="px-4 py-3 text-left text-sm font-medium text-gray-600 w-10">选择</th>' : ''}
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">缩略图</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">分类</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">标题</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">描述</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">创建时间</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.images.map(img => this.renderImageRow(img)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    renderImageRow(img) {
        const cat = getCategoryInfo(img.category);
        const isSelected = this.selectedImageIds.has(img.id);
        return `
            <tr class="border-b border-gray-100 ${img.is_hidden ? 'opacity-60' : ''} ${isSelected ? 'bg-blue-50' : ''}">
                ${this.compareMode ? `
                    <td class="px-4 py-2">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="ImagesPage.toggleSelectImage(${img.id})">
                    </td>
                ` : ''}
                <td class="px-4 py-2">
                    <div class="w-12 h-12 rounded bg-gray-100 overflow-hidden cursor-pointer" onclick="ImagesPage.openImageDetail(${img.id})">
                        <img src="${API.images.getFileUrl(img.id)}" class="w-full h-full object-cover"
                             onerror="this.parentElement.innerHTML='<span class=\\'text-2xl text-gray-300\\'>📷</span>'">
                    </div>
                </td>
                <td class="px-4 py-2"><span class="chip ${cat.color} text-xs">${cat.icon} ${cat.name}</span></td>
                <td class="px-4 py-2 font-medium text-gray-800 cursor-pointer" onclick="ImagesPage.openImageDetail(${img.id})">${img.title || img.file_name}</td>
                <td class="px-4 py-2 text-sm text-gray-600 max-w-xs truncate">${img.description || '-'}</td>
                <td class="px-4 py-2">
                    <div class="flex gap-1">
                        ${img.is_typical ? '<span class="badge badge-yellow">典型</span>' : ''}
                        ${img.is_hidden ? '<span class="badge badge-gray">隐藏</span>' : ''}
                    </div>
                </td>
                <td class="px-4 py-2 text-sm text-gray-500">${formatDateTime(img.created_at)}</td>
                <td class="px-4 py-2">
                    <div class="flex gap-1">
                        <button class="btn btn-xs btn-outline" onclick="ImagesPage.openImageDetail(${img.id})">详情</button>
                        <button class="btn btn-xs btn-outline" onclick="ImagesPage.toggleHidden(${img.id})">${img.is_hidden ? '显示' : '隐藏'}</button>
                        <button class="btn btn-xs btn-danger" onclick="ImagesPage.deleteImage(${img.id})">删除</button>
                    </div>
                </td>
            </tr>
        `;
    },

    async onFilterCategory(value) {
        this.filterCategory = value;
        loading(true);
        await this.loadImages();
        this.render();
    },

    async onFilterBatch(value) {
        this.filterBatchId = value;
        loading(true);
        await this.loadImages();
        this.render();
    },

    async toggleShowHidden() {
        this.includeHidden = document.getElementById('img-show-hidden').checked;
        loading(true);
        await this.loadImages();
        this.render();
    },

    switchView(mode) {
        this.viewMode = mode;
        this.render();
    },

    enterCompareMode() {
        this.compareMode = true;
        this.selectedImageIds.clear();
        this.render();
    },

    exitCompareMode() {
        this.compareMode = false;
        this.selectedImageIds.clear();
        this.render();
    },

    toggleSelectImage(imageId) {
        if (this.selectedImageIds.has(imageId)) {
            this.selectedImageIds.delete(imageId);
        } else {
            if (this.selectedImageIds.size >= 4) {
                showToast('最多选择4张图片进行对比', 'warning');
                return;
            }
            this.selectedImageIds.add(imageId);
        }
        this.render();
    },

    clearSelection() {
        this.selectedImageIds.clear();
        this.render();
    },

    async doCompare() {
        if (this.selectedImageIds.size < 2) {
            showToast('请至少选择2张图片', 'warning');
            return;
        }
        try {
            const ids = Array.from(this.selectedImageIds);
            const images = await API.images.compare(ids);
            this.openCompareModal(images);
        } catch (error) {
            showToast('加载对比数据失败: ' + error.message, 'error');
        }
    },

    openCompareModal(images) {
        const content = `
            <div class="space-y-4">
                <div class="grid grid-cols-${images.length} gap-4">
                    ${images.map(img => {
                        const cat = getCategoryInfo(img.category);
                        return `
                            <div class="border border-gray-200 rounded-lg overflow-hidden">
                                <div class="aspect-square bg-gray-100 overflow-hidden">
                                    <img src="${API.images.getFileUrl(img.id)}" class="w-full h-full object-contain" 
                                         onerror="this.parentElement.innerHTML='<span class=\\'text-4xl text-gray-300\\'>📷</span>'">
                                </div>
                                <div class="p-3">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="chip ${cat.color} text-xs">${cat.icon} ${cat.name}</span>
                                    </div>
                                    <p class="text-sm font-medium text-gray-800">${img.title || img.file_name}</p>
                                    ${img.description ? `<p class="text-xs text-gray-500 mt-1">${img.description}</p>` : ''}
                                    ${img.annotations && img.annotations.length > 0 ? `
                                        <div class="mt-2 text-xs text-gray-500">
                                            📌 ${img.annotations.length} 个标注
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        showModal(content, { title: `⚖️ 图片对比 (${images.length}张)`, width: '90vw' });
    },

    openUploadModal(presetBatchId, presetCategory, presetFiberSourceId, presetRecordId, presetObservationId, presetSizingAgentId, presetMineralFillerId) {
        const content = `
            <form id="image-upload-form" class="space-y-4">
                <div>
                    <label class="label">选择图片 *</label>
                    <input type="file" id="image-file" name="file" accept=".jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp" multiple 
                           class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100">
                    <p class="text-xs text-gray-400 mt-1">支持 JPG/PNG/GIF/BMP/TIFF/WebP，单文件最大 10MB，可多选批量上传</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label">图片分类 *</label>
                        <select name="category" class="select" id="upload-category">
                            ${Object.entries(CATEGORY_MAP).map(([key, val]) => `
                                <option value="${key}" ${presetCategory === key ? 'selected' : ''}>${val.icon} ${val.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="label">关联批次</label>
                        <select name="batch_id" class="select" id="upload-batch">
                            <option value="">不关联</option>
                            ${this.batches.map(b => `
                                <option value="${b.id}" ${presetBatchId === b.id || presetBatchId === String(b.id) ? 'selected' : ''}>${b.batch_no}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="label">关联纤维原料</label>
                        <select name="fiber_source_id" class="select" id="upload-fiber">
                            <option value="">不关联</option>
                            ${this.fibers.map(f => `
                                <option value="${f.id}" ${presetFiberSourceId === f.id || presetFiberSourceId === String(f.id) ? 'selected' : ''}>${f.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="label">关联胶料</label>
                        <select name="sizing_agent_id" class="select" id="upload-sizing">
                            <option value="">不关联</option>
                            ${this.sizingAgents.map(s => `
                                <option value="${s.id}" ${presetSizingAgentId === s.id || presetSizingAgentId === String(s.id) ? 'selected' : ''}>${s.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="label">关联矿物填料</label>
                        <select name="mineral_filler_id" class="select" id="upload-filler">
                            <option value="">不关联</option>
                            ${this.fillers.map(f => `
                                <option value="${f.id}" ${presetMineralFillerId === f.id || presetMineralFillerId === String(f.id) ? 'selected' : ''}>${f.name}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="label">标题</label>
                    <input type="text" name="title" class="input" placeholder="请输入图片标题" maxlength="200">
                </div>
                <div>
                    <label class="label">描述</label>
                    <textarea name="description" class="textarea" placeholder="请输入图片描述" rows="3"></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label">拍摄时间</label>
                        <input type="datetime-local" name="captured_at" class="input">
                    </div>
                    <div>
                        <label class="label">拍摄人</label>
                        <input type="text" name="captured_by" class="input" placeholder="请输入拍摄人">
                    </div>
                </div>
                <div id="microscope-settings-section" class="hidden">
                    <label class="label">显微镜参数 (JSON)</label>
                    <textarea name="microscope_settings" class="textarea" rows="2" 
                              placeholder='例如: {"magnification": 200, "light_source": "LED"}'></textarea>
                </div>
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2">
                        <input type="checkbox" name="is_typical" value="true">
                        <span class="text-sm text-gray-600">标记为典型图例</span>
                    </label>
                    <label class="flex items-center gap-2">
                        <input type="checkbox" name="is_hidden" value="true">
                        <span class="text-sm text-gray-600">隐藏（不参与公开展示）</span>
                    </label>
                </div>
                ${presetFiberSourceId ? `<input type="hidden" name="fiber_source_id_override" value="${presetFiberSourceId}">` : ''}
                ${presetSizingAgentId ? `<input type="hidden" name="sizing_agent_id_override" value="${presetSizingAgentId}">` : ''}
                ${presetMineralFillerId ? `<input type="hidden" name="mineral_filler_id_override" value="${presetMineralFillerId}">` : ''}
                ${presetRecordId ? `<input type="hidden" name="record_id_override" value="${presetRecordId}">` : ''}
                ${presetObservationId ? `<input type="hidden" name="observation_id_override" value="${presetObservationId}">` : ''}
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary" id="upload-submit-btn">上传</button>
                </div>
                <div id="upload-progress" class="hidden">
                    <div class="progress-bar">
                        <div class="progress-fill bg-blue-500" id="upload-progress-bar" style="width: 0%"></div>
                    </div>
                    <p class="text-sm text-gray-500 mt-1" id="upload-progress-text">上传中...</p>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '📷 上传实验图片', width: '650px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);

        modal.querySelector('#upload-category').addEventListener('change', (e) => {
            const section = modal.querySelector('#microscope-settings-section');
            section.classList.toggle('hidden', e.target.value !== 'microscopy');
        });

        modal.querySelector('#image-upload-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const fileInput = modal.querySelector('#image-file');
            const files = fileInput.files;
            if (!files || files.length === 0) {
                showToast('请选择要上传的图片', 'error');
                return;
            }

            const formData = new FormData(e.target);
            const submitBtn = modal.querySelector('#upload-submit-btn');
            const progressDiv = modal.querySelector('#upload-progress');
            const progressBar = modal.querySelector('#upload-progress-bar');
            const progressText = modal.querySelector('#upload-progress-text');
            submitBtn.disabled = true;
            progressDiv.classList.remove('hidden');

            const fiberSourceIdOverride = formData.get('fiber_source_id_override');
            const sizingAgentIdOverride = formData.get('sizing_agent_id_override');
            const mineralFillerIdOverride = formData.get('mineral_filler_id_override');
            const recordIdOverride = formData.get('record_id_override');
            const observationIdOverride = formData.get('observation_id_override');

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < files.length; i++) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', files[i]);
                uploadFormData.append('category', formData.get('category'));
                if (formData.get('title')) uploadFormData.append('title', formData.get('title'));
                if (formData.get('description')) uploadFormData.append('description', formData.get('description'));
                if (formData.get('batch_id')) uploadFormData.append('batch_id', formData.get('batch_id'));
                
                const fiberId = fiberSourceIdOverride || formData.get('fiber_source_id');
                if (fiberId) uploadFormData.append('fiber_source_id', fiberId);
                
                const sizingId = sizingAgentIdOverride || formData.get('sizing_agent_id');
                if (sizingId) uploadFormData.append('sizing_agent_id', sizingId);
                
                const fillerId = mineralFillerIdOverride || formData.get('mineral_filler_id');
                if (fillerId) uploadFormData.append('mineral_filler_id', fillerId);
                
                const recId = recordIdOverride;
                if (recId) uploadFormData.append('record_id', recId);
                
                const obsId = observationIdOverride;
                if (obsId) uploadFormData.append('observation_id', obsId);
                
                if (formData.get('captured_at')) uploadFormData.append('captured_at', formData.get('captured_at'));
                if (formData.get('captured_by')) uploadFormData.append('captured_by', formData.get('captured_by'));
                if (formData.get('microscope_settings')) uploadFormData.append('microscope_settings', formData.get('microscope_settings'));
                if (formData.get('is_typical') === 'true') uploadFormData.append('is_typical', 'true');
                if (formData.get('is_hidden') === 'true') uploadFormData.append('is_hidden', 'true');

                const pct = Math.round(((i + 1) / files.length) * 100);
                progressBar.style.width = pct + '%';
                progressText.textContent = `正在上传 ${i + 1}/${files.length}...`;

                try {
                    await API.images.upload(uploadFormData);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    console.error(`上传第 ${i + 1} 个文件失败:`, error);
                }
            }

            if (successCount > 0) {
                showToast(`成功上传 ${successCount} 张图片${errorCount > 0 ? `，${errorCount} 张失败` : ''}`, successCount > 0 && errorCount === 0 ? 'success' : 'warning');
                close();
                await this.loadImages();
                this.render();
            } else {
                showToast('上传失败', 'error');
                submitBtn.disabled = false;
            }
        });
    },

    openImageDetail(imageId) {
        const img = this.images.find(i => i.id === imageId);
        if (!img) {
            showToast('图片不存在', 'error');
            return;
        }

        const cat = getCategoryInfo(img.category);
        const annotations = img.annotations || [];

        const content = `
            <div class="space-y-4">
                <div class="flex gap-4">
                    <div class="flex-1">
                        <div class="bg-gray-100 rounded-lg overflow-hidden" style="max-height: 500px;">
                            <img src="${API.images.getFileUrl(img.id)}" class="w-full h-full object-contain" 
                                 onerror="this.parentElement.innerHTML='<span class=\\'text-4xl text-gray-300\\'>📷 图片加载失败</span>'">
                        </div>
                    </div>
                    <div class="w-72 space-y-3">
                        <div>
                            <span class="chip ${cat.color}">${cat.icon} ${cat.name}</span>
                            ${img.is_typical ? '<span class="badge badge-yellow ml-1">典型</span>' : ''}
                            ${img.is_hidden ? '<span class="badge badge-gray ml-1">隐藏</span>' : ''}
                        </div>
                        <div>
                            <h4 class="font-semibold text-gray-800">${img.title || img.file_name}</h4>
                            ${img.description ? `<p class="text-sm text-gray-600 mt-1">${img.description}</p>` : ''}
                        </div>
                        <div class="text-sm text-gray-500 space-y-1">
                            <p>📁 文件: ${img.file_name}</p>
                            <p>📏 大小: ${img.file_size ? (img.file_size / 1024).toFixed(1) + ' KB' : '-'}</p>
                            ${img.captured_at ? `<p>📅 拍摄: ${formatDateTime(img.captured_at)}</p>` : ''}
                            ${img.captured_by ? `<p>👤 拍摄人: ${img.captured_by}</p>` : ''}
                            ${img.microscope_settings ? `<p>🔬 显微镜: ${JSON.stringify(img.microscope_settings)}</p>` : ''}
                            <p>🕐 上传: ${formatDateTime(img.created_at)}</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button class="btn btn-sm btn-outline" onclick="ImagesPage.openEditImageModal(${img.id})">✏️ 编辑</button>
                            <button class="btn btn-sm ${img.is_hidden ? 'btn-success' : 'btn-secondary'}" onclick="ImagesPage.toggleHidden(${img.id})">${img.is_hidden ? '👁 显示' : '👁‍🗨 隐藏'}</button>
                            <button class="btn btn-sm ${img.is_typical ? 'btn-warning' : 'btn-outline'}" onclick="ImagesPage.toggleTypical(${img.id})">${img.is_typical ? '⭐ 取消典型' : '⭐ 标记典型'}</button>
                            <button class="btn btn-sm btn-danger" onclick="ImagesPage.deleteImage(${img.id})">🗑 删除</button>
                        </div>
                    </div>
                </div>
                <div class="border-t pt-4">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-medium text-gray-700">📌 关键区域标注 (${annotations.length})</h4>
                        <button class="btn btn-sm btn-primary" onclick="ImagesPage.openAddAnnotationModal(${img.id})">➕ 添加标注</button>
                    </div>
                    ${annotations.length === 0 ? '<p class="text-center text-gray-400 py-4">暂无标注</p>' : `
                        <div class="space-y-2">
                            ${annotations.map(ann => `
                                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                    <div class="w-4 h-4 rounded-full flex-shrink-0" style="background-color: ${ann.color || '#3B82F6'}"></div>
                                    <div class="flex-1">
                                        <span class="font-medium text-gray-800">${ann.label}</span>
                                        ${ann.description ? `<p class="text-sm text-gray-500">${ann.description}</p>` : ''}
                                        ${ann.region_type ? `<span class="text-xs text-gray-400">区域: ${ann.region_type}</span>` : ''}
                                    </div>
                                    <div class="flex gap-1">
                                        <button class="btn btn-xs btn-outline" onclick="ImagesPage.openEditAnnotationModal(${img.id}, ${ann.id})">编辑</button>
                                        <button class="btn btn-xs btn-danger" onclick="ImagesPage.deleteAnnotation(${img.id}, ${ann.id})">删除</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;

        showModal(content, { title: `📷 ${img.title || img.file_name}`, width: '900px' });
    },

    openEditImageModal(imageId) {
        const img = this.images.find(i => i.id === imageId);
        if (!img) return;

        const content = `
            <form id="image-edit-form" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label">图片分类</label>
                        <select name="category" class="select">
                            ${Object.entries(CATEGORY_MAP).map(([key, val]) => `
                                <option value="${key}" ${img.category === key ? 'selected' : ''}>${val.icon} ${val.name}</option>
                            `).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="label">关联批次</label>
                        <select name="batch_id" class="select">
                            <option value="">不关联</option>
                            ${this.batches.map(b => `
                                <option value="${b.id}" ${img.batch_id === b.id ? 'selected' : ''}>${b.batch_no}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="label">标题</label>
                    <input type="text" name="title" class="input" value="${img.title || ''}" maxlength="200">
                </div>
                <div>
                    <label class="label">描述</label>
                    <textarea name="description" class="textarea" rows="3">${img.description || ''}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label">拍摄时间</label>
                        <input type="datetime-local" name="captured_at" class="input" value="${img.captured_at ? img.captured_at.slice(0, 16) : ''}">
                    </div>
                    <div>
                        <label class="label">拍摄人</label>
                        <input type="text" name="captured_by" class="input" value="${img.captured_by || ''}">
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '编辑图片信息', width: '600px' });
        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#image-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                category: formData.get('category'),
                title: formData.get('title') || null,
                description: formData.get('description') || null,
                batch_id: formData.get('batch_id') ? parseInt(formData.get('batch_id')) : null,
                captured_at: formData.get('captured_at') || null,
                captured_by: formData.get('captured_by') || null,
            };
            try {
                await API.images.update(imageId, data);
                showToast('图片信息已更新', 'success');
                close();
                await this.loadImages();
                this.render();
            } catch (error) {
                showToast('更新失败: ' + error.message, 'error');
            }
        });
    },

    async toggleHidden(imageId) {
        try {
            await API.images.toggleHidden(imageId);
            showToast('图片显示状态已更新', 'success');
            await this.loadImages();
            this.render();
        } catch (error) {
            showToast('操作失败: ' + error.message, 'error');
        }
    },

    async toggleTypical(imageId) {
        try {
            await API.images.toggleTypical(imageId);
            showToast('典型标记已更新', 'success');
            await this.loadImages();
            this.render();
        } catch (error) {
            showToast('操作失败: ' + error.message, 'error');
        }
    },

    async deleteImage(imageId) {
        showConfirmModal(
            '确定要删除该图片吗？此操作不可恢复，图片文件将被永久删除。',
            async () => {
                try {
                    await API.images.delete(imageId);
                    showToast('图片已删除', 'success');
                    await this.loadImages();
                    this.render();
                } catch (error) {
                    showToast('删除失败: ' + error.message, 'error');
                }
            },
            { title: '删除图片', confirmText: '确认删除', type: 'danger' }
        );
    },

    openAddAnnotationModal(imageId) {
        const content = `
            <form id="annotation-form" class="space-y-4">
                <div>
                    <label class="label">标注名称 *</label>
                    <input type="text" name="label" class="input" placeholder="例如：纤维束、裂纹区域" required maxlength="100">
                </div>
                <div>
                    <label class="label">描述</label>
                    <textarea name="description" class="textarea" placeholder="对该区域的详细说明" rows="2"></textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label">区域类型</label>
                        <select name="region_type" class="select">
                            <option value="">无区域</option>
                            <option value="rect">矩形</option>
                            <option value="circle">圆形</option>
                            <option value="point">点</option>
                            <option value="polygon">多边形</option>
                        </select>
                    </div>
                    <div>
                        <label class="label">标注颜色</label>
                        <input type="color" name="color" value="#3B82F6" class="w-full h-10 rounded border border-gray-200 cursor-pointer">
                    </div>
                </div>
                <div>
                    <label class="label">区域数据 (JSON)</label>
                    <textarea name="region_data" class="textarea" rows="2" 
                              placeholder='例如: {"x": 10, "y": 20, "width": 50, "height": 30}'></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">添加标注</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '添加关键区域标注', width: '500px' });
        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#annotation-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                label: formData.get('label'),
                description: formData.get('description') || null,
                region_type: formData.get('region_type') || null,
                region_data: formData.get('region_data') ? JSON.parse(formData.get('region_data')) : null,
                color: formData.get('color'),
            };
            try {
                await API.images.addAnnotation(imageId, data);
                showToast('标注已添加', 'success');
                close();
                await this.loadImages();
                this.openImageDetail(imageId);
            } catch (error) {
                showToast('添加失败: ' + error.message, 'error');
            }
        });
    },

    openEditAnnotationModal(imageId, annotationId) {
        const img = this.images.find(i => i.id === imageId);
        if (!img) return;
        const ann = (img.annotations || []).find(a => a.id === annotationId);
        if (!ann) return;

        const content = `
            <form id="annotation-edit-form" class="space-y-4">
                <div>
                    <label class="label">标注名称 *</label>
                    <input type="text" name="label" class="input" value="${ann.label}" required maxlength="100">
                </div>
                <div>
                    <label class="label">描述</label>
                    <textarea name="description" class="textarea" rows="2">${ann.description || ''}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label">区域类型</label>
                        <select name="region_type" class="select">
                            <option value="">无区域</option>
                            <option value="rect" ${ann.region_type === 'rect' ? 'selected' : ''}>矩形</option>
                            <option value="circle" ${ann.region_type === 'circle' ? 'selected' : ''}>圆形</option>
                            <option value="point" ${ann.region_type === 'point' ? 'selected' : ''}>点</option>
                            <option value="polygon" ${ann.region_type === 'polygon' ? 'selected' : ''}>多边形</option>
                        </select>
                    </div>
                    <div>
                        <label class="label">标注颜色</label>
                        <input type="color" name="color" value="${ann.color || '#3B82F6'}" class="w-full h-10 rounded border border-gray-200 cursor-pointer">
                    </div>
                </div>
                <div>
                    <label class="label">区域数据 (JSON)</label>
                    <textarea name="region_data" class="textarea" rows="2">${ann.region_data ? JSON.stringify(ann.region_data) : ''}</textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '编辑标注', width: '500px' });
        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#annotation-edit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                label: formData.get('label'),
                description: formData.get('description') || null,
                region_type: formData.get('region_type') || null,
                region_data: formData.get('region_data') ? JSON.parse(formData.get('region_data')) : null,
                color: formData.get('color'),
            };
            try {
                await API.images.updateAnnotation(annotationId, data);
                showToast('标注已更新', 'success');
                close();
                await this.loadImages();
                this.openImageDetail(imageId);
            } catch (error) {
                showToast('更新失败: ' + error.message, 'error');
            }
        });
    },

    async deleteAnnotation(imageId, annotationId) {
        showConfirmModal(
            '确定要删除该标注吗？',
            async () => {
                try {
                    await API.images.deleteAnnotation(annotationId);
                    showToast('标注已删除', 'success');
                    await this.loadImages();
                    this.openImageDetail(imageId);
                } catch (error) {
                    showToast('删除失败: ' + error.message, 'error');
                }
            },
            { title: '删除标注', confirmText: '确认删除', type: 'danger' }
        );
    },

    async ensureDataLoaded() {
        if (this.batches.length === 0 || this.fibers.length === 0) {
            await this.loadAllData();
        }
    },

    async openImageManager(options) {
        await this.ensureDataLoaded();
        const {
            title = '图片管理',
            batchId = null,
            fiberSourceId = null,
            sizingAgentId = null,
            mineralFillerId = null,
            recordId = null,
            observationId = null,
            allowUpload = true,
            defaultCategory = null,
            onUploadComplete = null,
        } = options;

        const state = {
            images: [],
            filterCategory: '',
            includeHidden: true,
            selectedImageIds: new Set(),
            compareMode: false,
        };

        const loadImages = async () => {
            try {
                const params = { limit: 200, include_hidden: state.includeHidden ? 'true' : 'false' };
                if (state.filterCategory) params.category = state.filterCategory;
                if (batchId) params.batch_id = batchId;
                if (fiberSourceId) params.fiber_source_id = fiberSourceId;
                if (sizingAgentId) params.sizing_agent_id = sizingAgentId;
                if (mineralFillerId) params.mineral_filler_id = mineralFillerId;
                if (recordId) params.record_id = recordId;
                if (observationId) params.observation_id = observationId;
                state.images = await API.images.list(params);
            } catch (error) {
                showToast('加载图片失败: ' + error.message, 'error');
                state.images = [];
            }
        };

        const renderImageGrid = () => {
            if (state.images.length === 0) {
                return `<div class="text-center py-12 text-gray-400">
                    <div class="text-5xl mb-3">📷</div>
                    <p class="mb-4">暂无关联图片${allowUpload ? '，点击下方按钮上传' : ''}</p>
                    ${allowUpload ? `<button class="btn btn-primary" onclick="window.__imgMgr_upload()">📷 上传图片</button>` : ''}
                </div>`;
            }

            return `
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <select class="select w-36" onchange="window.__imgMgr_filterCategory(this.value)">
                            <option value="">全部类型</option>
                            ${Object.entries(CATEGORY_MAP).map(([key, val]) => `
                                <option value="${key}" ${state.filterCategory === key ? 'selected' : ''}>${val.icon} ${val.name}</option>
                            `).join('')}
                        </select>
                        <label class="flex items-center gap-2 text-sm text-gray-600">
                            <input type="checkbox" ${state.includeHidden ? 'checked' : ''} onchange="window.__imgMgr_toggleHidden(this.checked)">
                            显示隐藏
                        </label>
                        ${state.compareMode ? `
                            <button class="btn btn-sm btn-primary" onclick="window.__imgMgr_doCompare()" ${state.selectedImageIds.size < 2 ? 'disabled' : ''}>
                                对比选中 (${state.selectedImageIds.size})
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="window.__imgMgr_exitCompare()">退出对比</button>
                        ` : `
                            <button class="btn btn-sm btn-outline" onclick="window.__imgMgr_enterCompare()">⚖️ 对比</button>
                        `}
                    </div>
                    <div class="text-sm text-gray-500">共 ${state.images.length} 张</div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                    ${state.images.map(img => {
                        const cat = getCategoryInfo(img.category);
                        const isSelected = state.selectedImageIds.has(img.id);
                        return `
                        <div class="card overflow-hidden ${img.is_hidden ? 'opacity-60' : ''} ${isSelected ? 'ring-2 ring-blue-500' : ''}">
                            <div class="relative group cursor-pointer aspect-square bg-gray-100 overflow-hidden" 
                                 onclick="${state.compareMode ? `window.__imgMgr_toggleSelect(${img.id})` : `window.__imgMgr_detail(${img.id})`}">
                                <img src="${API.images.getFileUrl(img.id)}" class="w-full h-full object-cover"
                                     onerror="this.parentElement.innerHTML='<span class=\\'text-4xl text-gray-300 flex items-center justify-center h-full\\'>📷</span>'">
                                ${img.is_typical ? '<div class="absolute top-1 left-1 bg-yellow-400 text-white text-xs px-2 py-0.5 rounded-full">⭐典型</div>' : ''}
                                ${img.is_hidden ? '<div class="absolute top-1 right-1 bg-gray-500 text-white text-xs px-2 py-0.5 rounded-full">隐藏</div>' : ''}
                                ${state.compareMode && isSelected ? '<div class="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center"><span class="text-white text-2xl">✓</span></div>' : ''}
                            </div>
                            <div class="p-2">
                                <div class="flex items-center gap-1 mb-1">
                                    <span class="chip ${cat.color} text-xs">${cat.icon} ${cat.name}</span>
                                </div>
                                <p class="text-xs font-medium text-gray-800 truncate" title="${img.title || img.file_name}">${img.title || img.file_name}</p>
                                ${img.description ? `<p class="text-xs text-gray-500 truncate">${img.description}</p>` : ''}
                                <div class="flex items-center justify-between mt-2">
                                    <span class="text-xs text-gray-400">${formatDateTime(img.created_at).slice(5)}</span>
                                    <div class="flex gap-0.5">
                                        <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); window.__imgMgr_detail(${img.id})">👁</button>
                                        <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); window.__imgMgr_toggleHiddenImg(${img.id})">${img.is_hidden ? '👁' : '👁‍🗨'}</button>
                                        <button class="btn btn-xs btn-outline" onclick="event.stopPropagation(); window.__imgMgr_toggleTypical(${img.id})">${img.is_typical ? '⭐' : '☆'}</button>
                                        <button class="btn btn-xs btn-danger" onclick="event.stopPropagation(); window.__imgMgr_delete(${img.id})">✕</button>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            `;
        };

        const render = () => {
            container.innerHTML = `
                <div class="space-y-4">
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div class="text-sm text-gray-600">
                            ${batchId ? `<span class="chip bg-blue-100 text-blue-800">批次</span>` : ''}
                            ${fiberSourceId ? `<span class="chip bg-green-100 text-green-800">纤维</span>` : ''}
                            ${sizingAgentId ? `<span class="chip bg-blue-100 text-blue-800">胶料</span>` : ''}
                            ${mineralFillerId ? `<span class="chip bg-purple-100 text-purple-800">填料</span>` : ''}
                            ${recordId ? `<span class="chip bg-amber-100 text-amber-800">抄纸记录</span>` : ''}
                            ${observationId ? `<span class="chip bg-purple-100 text-purple-800">成纸观察</span>` : ''}
                        </div>
                        ${allowUpload ? `
                            <button class="btn btn-success" onclick="window.__imgMgr_upload()">
                                ➕ 上传图片
                            </button>
                        ` : ''}
                    </div>
                    ${renderImageGrid()}
                    <div class="flex justify-end gap-2 pt-2 border-t">
                        <button type="button" class="btn btn-outline modal-close-btn">关闭</button>
                    </div>
                </div>
            `;
        };

        const { modal, close } = showModal('', { title: `📷 ${title}`, width: '900px' });
        const container = modal.querySelector('.modal-body');
        await loadImages();
        render();

        modal.querySelector('.modal-close-btn').addEventListener('click', close);

        window.__imgMgr_upload = () => {
            ImagesPage.openUploadModal(
                batchId, defaultCategory, fiberSourceId, recordId, observationId, sizingAgentId, mineralFillerId
            );
            const checkUploadComplete = setInterval(async () => {
                const uploadModal = document.querySelector('.modal-backdrop:last-child');
                if (!uploadModal || !uploadModal.contains(document.querySelector('#image-upload-form'))) {
                    clearInterval(checkUploadComplete);
                    const oldCount = state.images.length;
                    await loadImages();
                    if (state.images.length > oldCount && onUploadComplete) {
                        onUploadComplete(state.images);
                    }
                    render();
                }
            }, 500);
        };

        window.__imgMgr_filterCategory = async (val) => {
            state.filterCategory = val;
            await loadImages();
            render();
        };

        window.__imgMgr_toggleHidden = async (checked) => {
            state.includeHidden = checked;
            await loadImages();
            render();
        };

        window.__imgMgr_enterCompare = () => {
            state.compareMode = true;
            state.selectedImageIds.clear();
            render();
        };

        window.__imgMgr_exitCompare = () => {
            state.compareMode = false;
            state.selectedImageIds.clear();
            render();
        };

        window.__imgMgr_toggleSelect = (id) => {
            if (state.selectedImageIds.has(id)) {
                state.selectedImageIds.delete(id);
            } else {
                if (state.selectedImageIds.size >= 4) {
                    showToast('最多选择4张图片对比', 'warning');
                    return;
                }
                state.selectedImageIds.add(id);
            }
            render();
        };

        window.__imgMgr_doCompare = async () => {
            if (state.selectedImageIds.size < 2) {
                showToast('请至少选择2张图片', 'warning');
                return;
            }
            try {
                const ids = Array.from(state.selectedImageIds);
                const images = await API.images.compare(ids);
                ImagesPage.openCompareModal(images);
            } catch (error) {
                showToast('加载对比数据失败: ' + error.message, 'error');
            }
        };

        window.__imgMgr_detail = async (imgId) => {
            const currentImages = this.images.slice();
            this.images = state.images;
            ImagesPage.openImageDetail(imgId);
            const checkDetailClose = setInterval(async () => {
                const detailModal = document.querySelector('.modal-backdrop:last-child');
                if (!detailModal || !detailModal.querySelector('button[onclick*="toggleHidden"]')) {
                    clearInterval(checkDetailClose);
                    await loadImages();
                    render();
                }
            }, 500);
        };

        window.__imgMgr_toggleHiddenImg = async (id) => {
            try {
                await API.images.toggleHidden(id);
                showToast('显示状态已更新', 'success');
                await loadImages();
                render();
            } catch (error) {
                showToast('操作失败: ' + error.message, 'error');
            }
        };

        window.__imgMgr_toggleTypical = async (id) => {
            try {
                await API.images.toggleTypical(id);
                showToast('典型标记已更新', 'success');
                await loadImages();
                render();
            } catch (error) {
                showToast('操作失败: ' + error.message, 'error');
            }
        };

        window.__imgMgr_delete = (id) => {
            showConfirmModal('确定删除该图片？', async () => {
                try {
                    await API.images.delete(id);
                    showToast('图片已删除', 'success');
                    await loadImages();
                    render();
                } catch (error) {
                    showToast('删除失败: ' + error.message, 'error');
                }
            }, { title: '删除图片', type: 'danger' });
        };
    },

    unmount() {},
};
