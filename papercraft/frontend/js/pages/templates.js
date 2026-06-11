const TemplatesPage = {
    activeTab: 'list',
    templates: [],
    categories: [],
    batches: [],
    fibers: [],
    selectedCategory: '',
    selectedStatus: 'all',
    currentTemplate: null,
    currentVersions: [],
    recommendParams: {
        targetRating: 7,
        targetConcentration: '',
        preferredFibers: [],
        recommendCount: 5,
    },
    recommendResults: [],

    async mount() {
        App.setPageTitle('📋 实验方案模板');
        loading(true);
        await this.loadAllData();
        this.render();
    },

    async loadAllData() {
        try {
            const params = { category: this.selectedCategory };
            if (this.selectedStatus === 'active') params.is_active = true;
            if (this.selectedStatus === 'inactive') params.is_active = false;
            
            [this.templates, this.categories, this.batches, this.fibers] = await Promise.all([
                API.templates.list(params),
                API.templates.listCategories(),
                API.batches.list(),
                API.fibers.list(),
            ]);
        } catch (error) {
            showToast('加载数据失败: ' + error.message, 'error');
        }
    },

    render() {
        App.setPageActions(this.renderPageActions());
        App.setPageContent(`
            <div class="space-y-4">
                ${this.renderTabs()}
                ${this.activeTab === 'list' ? this.renderTemplateList() : this.renderRecommendTab()}
            </div>
        `);
    },

    renderPageActions() {
        if (this.activeTab === 'list') {
            return `
                <button class="btn btn-success" onclick="TemplatesPage.openCreateFromBatchModal()">
                    📦 从批次创建
                </button>
                <button class="btn btn-primary" onclick="TemplatesPage.openCreateModal()">
                    ➕ 新增模板
                </button>
            `;
        }
        return '';
    },

    renderTabs() {
        return `
            <div class="flex border-b border-gray-200 mb-4">
                <button 
                    class="px-6 py-3 font-medium text-sm border-b-2 transition-colors ${this.activeTab === 'list' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    onclick="TemplatesPage.switchTab('list')"
                >
                    📋 模板列表
                </button>
                <button 
                    class="px-6 py-3 font-medium text-sm border-b-2 transition-colors ${this.activeTab === 'recommend' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}"
                    onclick="TemplatesPage.switchTab('recommend')"
                >
                    🤖 智能推荐
                </button>
            </div>
        `;
    },

    switchTab(tab) {
        this.activeTab = tab;
        this.render();
    },

    renderTemplateList() {
        const filteredTemplates = this.templates.filter(t => {
            if (this.selectedCategory && t.category !== this.selectedCategory) return false;
            if (this.selectedStatus === 'active' && !t.is_active) return false;
            if (this.selectedStatus === 'inactive' && t.is_active) return false;
            return true;
        });

        if (filteredTemplates.length === 0) {
            return emptyState('暂无模板数据，请点击右上角新增模板', '📋');
        }

        return `
            <div class="mb-4 flex flex-wrap gap-4">
                <div class="flex items-center gap-2">
                    <label class="text-sm text-gray-600">分类：</label>
                    <select class="select w-40" onchange="TemplatesPage.onCategoryChange(this.value)">
                        <option value="">全部</option>
                        ${this.categories.map(c => `<option value="${c}" ${this.selectedCategory === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <label class="text-sm text-gray-600">状态：</label>
                    <select class="select w-32" onchange="TemplatesPage.onStatusChange(this.value)">
                        <option value="all" ${this.selectedStatus === 'all' ? 'selected' : ''}>全部</option>
                        <option value="active" ${this.selectedStatus === 'active' ? 'selected' : ''}>启用</option>
                        <option value="inactive" ${this.selectedStatus === 'inactive' ? 'selected' : ''}>停用</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${filteredTemplates.map(t => this.renderTemplateCard(t)).join('')}
            </div>
        `;
    },

    renderTemplateCard(template) {
        const latestVersion = template.latest_version || {};
        return `
            <div class="card hover:shadow-lg transition-shadow">
                <div class="p-4">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="font-semibold text-lg text-gray-800">${template.name}</h3>
                            <span class="chip bg-blue-100 text-blue-800 text-xs mt-1">${template.category}</span>
                        </div>
                        ${template.is_active 
                            ? '<span class="badge badge-green">启用</span>' 
                            : '<span class="badge badge-gray">停用</span>'}
                    </div>
                    
                    <p class="text-sm text-gray-600 mb-3 line-clamp-2">${template.description || '暂无描述'}</p>
                    
                    <div class="space-y-2 text-sm text-gray-500 mb-4">
                        <div class="flex items-center gap-2">
                            <span>📌 最新版本：</span>
                            <span class="font-medium text-gray-700">v${latestVersion.version || '-'} ${latestVersion.version_name || ''}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span>🎯 目标浓度：</span>
                            <span class="font-medium text-gray-700">${latestVersion.target_concentration || '-'}%</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span>🔄 复刻次数：</span>
                            <span class="font-medium text-gray-700">${template.replication_count || 0} 次</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span>📅 创建时间：</span>
                            <span class="font-medium text-gray-700">${formatDate(template.created_at)}</span>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <button class="btn btn-sm btn-outline" onclick="TemplatesPage.viewDetail(${template.id})">详情</button>
                        <button class="btn btn-sm btn-outline" onclick="TemplatesPage.openEditModal(${template.id})">编辑</button>
                        <button class="btn btn-sm btn-primary" onclick="TemplatesPage.openReplicateModal(${template.id})">一键复刻</button>
                        ${template.is_active 
                            ? `<button class="btn btn-sm btn-warning" onclick="TemplatesPage.toggleStatus(${template.id}, false)">停用</button>`
                            : `<button class="btn btn-sm btn-success" onclick="TemplatesPage.toggleStatus(${template.id}, true)">启用</button>`}
                        <button class="btn btn-sm btn-danger" onclick="TemplatesPage.deleteTemplate(${template.id})">删除</button>
                    </div>
                </div>
            </div>
        `;
    },

    onCategoryChange(value) {
        this.selectedCategory = value;
        this.render();
    },

    onStatusChange(value) {
        this.selectedStatus = value;
        this.render();
    },

    async viewDetail(templateId) {
        try {
            this.currentTemplate = await API.templates.get(templateId);
            this.currentVersions = await API.templates.listVersions(templateId);
            this.renderDetailModal();
        } catch (error) {
            showToast('加载模板详情失败: ' + error.message, 'error');
        }
    },

    renderDetailModal() {
        const template = this.currentTemplate;
        const versions = this.currentVersions;

        const content = `
            <div class="space-y-6">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="text-xl font-bold text-gray-800">${template.name}</h3>
                            <span class="chip bg-blue-100 text-blue-800 mt-1">${template.category}</span>
                            ${template.is_active 
                                ? '<span class="badge badge-green ml-2">启用</span>' 
                                : '<span class="badge badge-gray ml-2">停用</span>'}
                        </div>
                        <div class="text-sm text-gray-500">
                            <p>🔄 复刻次数: ${template.replication_count || 0}</p>
                            <p>📅 创建时间: ${formatDate(template.created_at)}</p>
                        </div>
                    </div>
                    <p class="text-gray-600">${template.description || '暂无描述'}</p>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-semibold text-gray-800">📜 版本历史</h4>
                        <button class="btn btn-sm btn-primary" onclick="TemplatesPage.openCreateVersionModal()">
                            ➕ 新增版本
                        </button>
                    </div>
                    ${versions.length === 0 
                        ? '<p class="text-gray-500 text-center py-4">暂无版本记录</p>'
                        : `<div class="space-y-3">${versions.map(v => this.renderVersionCard(v)).join('')}</div>`
                    }
                </div>

                <div class="flex justify-end gap-2 pt-4 border-t">
                    <button type="button" class="btn btn-outline modal-close-btn">关闭</button>
                </div>
            </div>
        `;

        const { modal, close } = showModal(content, { title: '模板详情', width: '800px' });
        this._detailModal = { modal, close };
        modal.querySelector('.modal-close-btn').addEventListener('click', close);
    },

    renderVersionCard(version) {
        const components = version.components || [];
        const componentChips = components.map(comp => {
            const name = this.getMaterialName(comp);
            const colorClass = getMaterialTypeColor(comp.material_type);
            return `<span class="chip ${colorClass} text-xs">${name}: ${comp.ratio}</span>`;
        }).join(' ');

        return `
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <div class="flex items-start justify-between mb-2">
                    <div>
                        <span class="font-bold text-blue-600">v${version.version}</span>
                        <span class="font-medium text-gray-800 ml-2">${version.version_name}</span>
                    </div>
                    <span class="text-sm text-gray-500">${formatDateTime(version.created_at)}</span>
                </div>
                <p class="text-sm text-gray-600 mb-2">${version.change_notes || '无变更说明'}</p>
                <div class="flex items-center gap-2 mb-2 text-sm">
                    <span class="text-gray-500">🎯 目标浓度：</span>
                    <span class="font-medium">${version.target_concentration || '-'}%</span>
                </div>
                ${components.length > 0 ? `
                    <div class="text-sm">
                        <span class="text-gray-500">🧪 成分：</span>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${componentChips}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    openCreateModal() {
        const content = `
            <form id="template-form" class="space-y-4">
                <div>
                    <label class="label">模板名称 *</label>
                    <input type="text" name="name" class="input" placeholder="请输入模板名称" required>
                </div>
                <div>
                    <label class="label">分类 *</label>
                    <select name="category" class="select" required>
                        <option value="">-- 请选择分类 --</option>
                        ${this.categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                        <option value="custom">+ 新建分类</option>
                    </select>
                    <div id="custom-category-input" class="mt-2 hidden">
                        <input type="text" name="custom_category" class="input" placeholder="请输入新分类名称">
                    </div>
                </div>
                <div>
                    <label class="label">描述</label>
                    <textarea name="description" class="textarea" placeholder="请输入模板描述"></textarea>
                </div>
                
                <div class="border-t pt-4 mt-4">
                    <h4 class="font-medium text-gray-800 mb-3">📌 初始版本</h4>
                    <div class="space-y-4 pl-4 border-l-2 border-blue-200">
                        <div>
                            <label class="label">版本名 *</label>
                            <input type="text" name="version_name" class="input" placeholder="例如：初始版本" required>
                        </div>
                        <div>
                            <label class="label">变更说明</label>
                            <textarea name="change_notes" class="textarea" placeholder="请输入变更说明"></textarea>
                        </div>
                        <div>
                            <label class="label">目标浓度 (%) *</label>
                            <input type="number" name="target_concentration" class="input" step="0.01" min="0" placeholder="例如：0.5" required>
                        </div>
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <label class="label mb-0">成分配方</label>
                                <button type="button" class="btn btn-sm btn-outline" onclick="TemplatesPage.addComponentRow()">➕ 添加成分</button>
                            </div>
                            <div id="components-container" class="space-y-2">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">创建模板</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '新增模板', width: '700px' });
        this._currentModal = { modal, close, components: [] };

        modal.querySelector('select[name="category"]').addEventListener('change', (e) => {
            const customInput = modal.querySelector('#custom-category-input');
            customInput.classList.toggle('hidden', e.target.value !== 'custom');
        });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#template-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateSubmit(e);
        });

        this.addComponentRow();
    },

    addComponentRow() {
        const container = this._currentModal.modal.querySelector('#components-container');
        const componentId = Date.now();
        this._currentModal.components.push({
            material_type: 'fiber',
            fiber_source_id: this.fibers[0]?.id || null,
            sizing_agent_id: null,
            mineral_filler_id: null,
            ratio: 0,
            notes: '',
        });

        const rowIndex = this._currentModal.components.length - 1;
        const row = document.createElement('div');
        row.className = 'flex gap-2 items-start p-3 bg-gray-50 rounded-lg';
        row.dataset.componentId = componentId;
        row.innerHTML = `
            <div class="flex-1">
                <label class="label">材料类型</label>
                <select class="select" onchange="TemplatesPage.onMaterialTypeChange(${rowIndex}, this.value)">
                    <option value="fiber">纤维</option>
                    <option value="sizing">胶料</option>
                    <option value="filler">填料</option>
                </select>
            </div>
            <div class="flex-1">
                <label class="label">具体材料</label>
                <select class="select" data-field="materialId" onchange="TemplatesPage.onMaterialChange(${rowIndex}, this.value)">
                    ${this.getMaterialOptions('fiber')}
                </select>
            </div>
            <div class="w-24">
                <label class="label">配比 *</label>
                <input type="number" class="input" step="0.01" min="0" onchange="TemplatesPage.onRatioChange(${rowIndex}, this.value)">
            </div>
            <div class="flex-1">
                <label class="label">备注</label>
                <input type="text" class="input" onchange="TemplatesPage.onNoteChange(${rowIndex}, this.value)">
            </div>
            <div class="pt-6">
                <button type="button" class="btn btn-sm btn-danger" onclick="TemplatesPage.removeComponentRow(${rowIndex}, ${componentId})">✕</button>
            </div>
        `;
        container.appendChild(row);
    },

    getMaterialOptions(type) {
        if (type === 'fiber') {
            return this.fibers.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        } else if (type === 'sizing') {
            return (this.sizingAgents || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        } else {
            return (this.fillers || []).map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        }
    },

    onMaterialTypeChange(index, value) {
        this._currentModal.components[index].material_type = value;
        const row = this._currentModal.modal.querySelectorAll('#components-container > div')[index];
        const select = row.querySelector('[data-field="materialId"]');
        
        if (value === 'fiber') {
            this._currentModal.components[index].fiber_source_id = this.fibers[0]?.id || null;
            this._currentModal.components[index].sizing_agent_id = null;
            this._currentModal.components[index].mineral_filler_id = null;
            select.innerHTML = this.getMaterialOptions('fiber');
        } else if (value === 'sizing') {
            this._currentModal.components[index].fiber_source_id = null;
            this._currentModal.components[index].sizing_agent_id = (this.sizingAgents || [])[0]?.id || null;
            this._currentModal.components[index].mineral_filler_id = null;
            select.innerHTML = this.getMaterialOptions('sizing');
        } else {
            this._currentModal.components[index].fiber_source_id = null;
            this._currentModal.components[index].sizing_agent_id = null;
            this._currentModal.components[index].mineral_filler_id = (this.fillers || [])[0]?.id || null;
            select.innerHTML = this.getMaterialOptions('filler');
        }
    },

    onMaterialChange(index, value) {
        const comp = this._currentModal.components[index];
        if (comp.material_type === 'fiber') {
            comp.fiber_source_id = parseInt(value);
        } else if (comp.material_type === 'sizing') {
            comp.sizing_agent_id = parseInt(value);
        } else {
            comp.mineral_filler_id = parseInt(value);
        }
    },

    onRatioChange(index, value) {
        this._currentModal.components[index].ratio = parseFloat(value) || 0;
    },

    onNoteChange(index, value) {
        this._currentModal.components[index].notes = value || null;
    },

    removeComponentRow(index, componentId) {
        this._currentModal.components.splice(index, 1);
        const row = this._currentModal.modal.querySelector(`[data-component-id="${componentId}"]`);
        if (row) row.remove();
    },

    getMaterialName(comp) {
        if (comp.material_type === 'fiber') {
            const fiber = this.fibers.find(f => f.id === comp.fiber_source_id);
            return fiber ? fiber.name : `纤维#${comp.fiber_source_id}`;
        } else if (comp.material_type === 'sizing') {
            return `胶料#${comp.sizing_agent_id}`;
        } else {
            return `填料#${comp.mineral_filler_id}`;
        }
    },

    async handleCreateSubmit(e) {
        const formData = new FormData(e.target);
        let category = formData.get('category');
        if (category === 'custom') {
            category = formData.get('custom_category');
        }

        const components = this._currentModal.components.filter(c => c.ratio > 0);

        const data = {
            name: formData.get('name'),
            category: category,
            description: formData.get('description') || null,
            initial_version: {
                version_name: formData.get('version_name'),
                change_notes: formData.get('change_notes') || null,
                target_concentration: parseFloat(formData.get('target_concentration')),
                components: components,
            },
        };

        const errors = validateForm(formData, {
            name: { required: true, label: '模板名称' },
            category: { required: true, label: '分类' },
            version_name: { required: true, label: '版本名' },
            target_concentration: { required: true, label: '目标浓度', min: 0 },
        });

        if (category === 'custom' && !formData.get('custom_category')) {
            errors.push('请输入新分类名称');
        }

        if (errors.length > 0) {
            showToast(errors.join('，'), 'error');
            return;
        }

        try {
            await API.templates.create(data);
            showToast('模板创建成功', 'success');
            this._currentModal.close();
            await this.loadAllData();
            this.render();
        } catch (error) {
            showToast('创建失败: ' + error.message, 'error');
        }
    },

    openEditModal(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        const content = `
            <form id="template-form" class="space-y-4">
                <div>
                    <label class="label">模板名称 *</label>
                    <input type="text" name="name" class="input" value="${template.name}" required>
                </div>
                <div>
                    <label class="label">分类 *</label>
                    <select name="category" class="select" required>
                        ${this.categories.map(c => `<option value="${c}" ${template.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="label">描述</label>
                    <textarea name="description" class="textarea">${template.description || ''}</textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">保存修改</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '编辑模板', width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#template-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            const errors = validateForm(formData, {
                name: { required: true, label: '模板名称' },
                category: { required: true, label: '分类' },
            });

            if (errors.length > 0) {
                showToast(errors.join('，'), 'error');
                return;
            }

            try {
                await API.templates.update(templateId, data);
                showToast('模板更新成功', 'success');
                close();
                await this.loadAllData();
                this.render();
            } catch (error) {
                showToast('更新失败: ' + error.message, 'error');
            }
        });
    },

    async toggleStatus(templateId, isActive) {
        try {
            await API.templates.update(templateId, { is_active: isActive });
            showToast(isActive ? '模板已启用' : '模板已停用', 'success');
            await this.loadAllData();
            this.render();
        } catch (error) {
            showToast('操作失败: ' + error.message, 'error');
        }
    },

    async deleteTemplate(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        if (template.replication_count > 0) {
            showToast('该模板已有复刻记录，无法删除。请先停用该模板。', 'warning');
            return;
        }

        showConfirmModal(
            `确定要删除模板 "${template.name}" 吗？此操作不可恢复。`,
            async () => {
                try {
                    await API.templates.delete(templateId);
                    showToast('模板删除成功', 'success');
                    await this.loadAllData();
                    this.render();
                } catch (error) {
                    showToast('删除失败: ' + error.message, 'error');
                }
            },
            { title: '删除模板', confirmText: '确认删除', type: 'danger' }
        );
    },

    openCreateVersionModal() {
        const template = this.currentTemplate;
        const latestVersion = this.currentVersions[0] || {};

        const content = `
            <form id="version-form" class="space-y-4">
                <div class="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <p class="text-sm text-yellow-800">
                        <span class="font-medium">💡 提示：</span>新版本将基于最新版本 v${latestVersion.version || 1} 创建
                    </p>
                </div>
                <div>
                    <label class="label">版本名 *</label>
                    <input type="text" name="version_name" class="input" placeholder="例如：优化配方" required>
                </div>
                <div>
                    <label class="label">变更说明 *</label>
                    <textarea name="change_notes" class="textarea" placeholder="请详细说明本次变更内容" required></textarea>
                </div>
                <div>
                    <label class="label">目标浓度 (%) *</label>
                    <input type="number" name="target_concentration" class="input" step="0.01" min="0" value="${latestVersion.target_concentration || ''}" required>
                </div>
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <label class="label mb-0">成分配方</label>
                        <button type="button" class="btn btn-sm btn-outline" onclick="TemplatesPage.addComponentRow()">➕ 添加成分</button>
                    </div>
                    <div id="components-container" class="space-y-2">
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">创建新版本</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '新增版本', width: '700px' });
        this._currentModal = { modal, close, components: [] };

        const existingComponents = latestVersion.components || [];
        existingComponents.forEach(comp => {
            this._currentModal.components.push({ ...comp });
        });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#version-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleCreateVersionSubmit(e);
        });

        this.renderVersionComponents(existingComponents);
    },

    renderVersionComponents(components) {
        const container = this._currentModal.modal.querySelector('#components-container');
        container.innerHTML = '';

        components.forEach((comp, index) => {
            const componentId = Date.now() + index;
            const row = document.createElement('div');
            row.className = 'flex gap-2 items-start p-3 bg-gray-50 rounded-lg';
            row.dataset.componentId = componentId;
            row.innerHTML = `
                <div class="flex-1">
                    <label class="label">材料类型</label>
                    <select class="select" onchange="TemplatesPage.onMaterialTypeChange(${index}, this.value)">
                        <option value="fiber" ${comp.material_type === 'fiber' ? 'selected' : ''}>纤维</option>
                        <option value="sizing" ${comp.material_type === 'sizing' ? 'selected' : ''}>胶料</option>
                        <option value="filler" ${comp.material_type === 'filler' ? 'selected' : ''}>填料</option>
                    </select>
                </div>
                <div class="flex-1">
                    <label class="label">具体材料</label>
                    <select class="select" data-field="materialId" onchange="TemplatesPage.onMaterialChange(${index}, this.value)">
                        ${this.getMaterialOptions(comp.material_type)}
                    </select>
                </div>
                <div class="w-24">
                    <label class="label">配比 *</label>
                    <input type="number" class="input" step="0.01" min="0" value="${comp.ratio}" onchange="TemplatesPage.onRatioChange(${index}, this.value)">
                </div>
                <div class="flex-1">
                    <label class="label">备注</label>
                    <input type="text" class="input" value="${comp.notes || ''}" onchange="TemplatesPage.onNoteChange(${index}, this.value)">
                </div>
                <div class="pt-6">
                    <button type="button" class="btn btn-sm btn-danger" onclick="TemplatesPage.removeComponentRow(${index}, ${componentId})">✕</button>
                </div>
            `;
            container.appendChild(row);
        });
    },

    async handleCreateVersionSubmit(e) {
        const formData = new FormData(e.target);
        const components = this._currentModal.components.filter(c => c.ratio > 0);

        const data = {
            version_name: formData.get('version_name'),
            change_notes: formData.get('change_notes'),
            target_concentration: parseFloat(formData.get('target_concentration')),
            components: components,
        };

        const errors = validateForm(formData, {
            version_name: { required: true, label: '版本名' },
            change_notes: { required: true, label: '变更说明' },
            target_concentration: { required: true, label: '目标浓度', min: 0 },
        });

        if (errors.length > 0) {
            showToast(errors.join('，'), 'error');
            return;
        }

        try {
            await API.templates.createVersion(this.currentTemplate.id, data);
            showToast('版本创建成功', 'success');
            this._currentModal.close();
            this._detailModal.close();
            await this.loadAllData();
            await this.viewDetail(this.currentTemplate.id);
        } catch (error) {
            showToast('创建失败: ' + error.message, 'error');
        }
    },

    openReplicateModal(templateId) {
        const template = this.templates.find(t => t.id === templateId);
        if (!template) return;

        const content = `
            <form id="replicate-form" class="space-y-4">
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p class="text-sm text-blue-800">
                        <span class="font-medium">📋 模板：</span>${template.name}
                    </p>
                </div>
                <div>
                    <label class="label">选择版本 *</label>
                    <select name="version_id" class="select" id="version-select" required>
                        <option value="">-- 加载中 --</option>
                    </select>
                </div>
                <div id="version-preview" class="hidden bg-gray-50 p-4 rounded-lg">
                </div>
                <div>
                    <label class="label">新批次编号 *</label>
                    <input type="text" name="batch_no" class="input" placeholder="请输入新批次编号" required>
                </div>
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea" placeholder="请输入备注信息"></textarea>
                </div>
                <div>
                    <label class="label">调整说明</label>
                    <textarea name="adjustment_notes" class="textarea" placeholder="请输入本次复刻的调整说明"></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">确认复刻</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '一键复刻', width: '600px' });

        this.loadVersionsForReplicate(templateId, modal);

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#version-select').addEventListener('change', (e) => {
            this.showVersionPreview(e.target.value, modal);
        });
        modal.querySelector('#replicate-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleReplicateSubmit(e, templateId);
        });
    },

    async loadVersionsForReplicate(templateId, modal) {
        try {
            const versions = await API.templates.listVersions(templateId);
            const select = modal.querySelector('#version-select');
            select.innerHTML = `
                <option value="">-- 请选择版本 --</option>
                ${versions.map(v => `<option value="${v.id}">v${v.version} - ${v.version_name}</option>`).join('')}
            `;
        } catch (error) {
            showToast('加载版本列表失败: ' + error.message, 'error');
        }
    },

    async showVersionPreview(versionId, modal) {
        if (!versionId) {
            modal.querySelector('#version-preview').classList.add('hidden');
            return;
        }

        try {
            const version = await API.templates.getVersion(versionId);
            const components = version.components || [];
            const componentChips = components.map(comp => {
                const name = this.getMaterialName(comp);
                const colorClass = getMaterialTypeColor(comp.material_type);
                return `<span class="chip ${colorClass} text-xs">${name}: ${comp.ratio}</span>`;
            }).join(' ');

            const preview = modal.querySelector('#version-preview');
            preview.innerHTML = `
                <h5 class="font-medium text-gray-700 mb-2">版本内容预览</h5>
                <div class="space-y-2 text-sm">
                    <p><span class="text-gray-500">变更说明：</span>${version.change_notes || '无'}</p>
                    <p><span class="text-gray-500">目标浓度：</span>${version.target_concentration || '-'}%</p>
                    ${components.length > 0 ? `
                        <div>
                            <span class="text-gray-500">成分：</span>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${componentChips}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
            preview.classList.remove('hidden');
        } catch (error) {
            showToast('加载版本详情失败: ' + error.message, 'error');
        }
    },

    async handleReplicateSubmit(e, templateId) {
        const formData = new FormData(e.target);
        const data = {
            version_id: parseInt(formData.get('version_id')),
            batch_no: formData.get('batch_no'),
            notes: formData.get('notes') || null,
            adjustment_notes: formData.get('adjustment_notes') || null,
        };

        const errors = validateForm(formData, {
            version_id: { required: true, label: '版本' },
            batch_no: { required: true, label: '批次编号' },
        });

        if (errors.length > 0) {
            showToast(errors.join('，'), 'error');
            return;
        }

        try {
            await API.templates.replicate(templateId, data);
            showToast('复刻成功，已创建新批次', 'success');
            this._currentModal?.close();
            await this.loadAllData();
            this.render();
        } catch (error) {
            showToast('复刻失败: ' + error.message, 'error');
        }
    },

    openCreateFromBatchModal() {
        if (this.batches.length === 0) {
            showToast('暂无可用批次数据', 'warning');
            return;
        }

        const content = `
            <form id="from-batch-form" class="space-y-4">
                <div>
                    <label class="label">选择批次 *</label>
                    <select name="batch_id" class="select" required>
                        <option value="">-- 请选择批次 --</option>
                        ${this.batches.map(b => `<option value="${b.id}">${b.batch_no} ${b.notes ? `(${b.notes})` : ''}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="label">模板名称 *</label>
                    <input type="text" name="name" class="input" placeholder="请输入模板名称" required>
                </div>
                <div>
                    <label class="label">分类 *</label>
                    <select name="category" class="select" required>
                        <option value="">-- 请选择分类 --</option>
                        ${this.categories.map(c => `<option value="${c}">${c}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="label">描述</label>
                    <textarea name="description" class="textarea" placeholder="请输入模板描述"></textarea>
                </div>
                <div>
                    <label class="label">版本名 *</label>
                    <input type="text" name="version_name" class="input" value="从批次创建" required>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">创建模板</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '从批次创建模板', width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#from-batch-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const batchId = parseInt(formData.get('batch_id'));
            const params = {
                name: formData.get('name'),
                category: formData.get('category'),
                description: formData.get('description') || null,
                version_name: formData.get('version_name'),
            };

            const errors = validateForm(formData, {
                batch_id: { required: true, label: '批次' },
                name: { required: true, label: '模板名称' },
                category: { required: true, label: '分类' },
                version_name: { required: true, label: '版本名' },
            });

            if (errors.length > 0) {
                showToast(errors.join('，'), 'error');
                return;
            }

            try {
                await API.templates.createFromBatch(batchId, params);
                showToast('模板创建成功', 'success');
                close();
                await this.loadAllData();
                this.render();
            } catch (error) {
                showToast('创建失败: ' + error.message, 'error');
            }
        });
    },

    renderRecommendTab() {
        return `
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div class="lg:col-span-1">
                    <div class="card p-4">
                        <h3 class="font-semibold text-gray-800 mb-4">🔍 筛选条件</h3>
                        <form id="recommend-form" class="space-y-4">
                            <div>
                                <label class="label">目标评分 (1-10)</label>
                                <input type="range" name="target_rating" class="w-full" min="1" max="10" value="${this.recommendParams.targetRating}" step="1"
                                       oninput="document.getElementById('rating-display').textContent = this.value">
                                <div class="text-center text-xl font-bold text-yellow-500" id="rating-display">${this.recommendParams.targetRating}</div>
                            </div>
                            <div>
                                <label class="label">目标浓度 (%)</label>
                                <input type="number" name="target_concentration" class="input" step="0.01" min="0" value="${this.recommendParams.targetConcentration}" placeholder="例如：0.5">
                            </div>
                            <div>
                                <label class="label">偏好纤维（多选）</label>
                                <div class="space-y-2 max-h-40 overflow-y-auto">
                                    ${this.fibers.map(f => `
                                        <label class="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" name="preferred_fibers" value="${f.id}" 
                                                   ${this.recommendParams.preferredFibers.includes(f.id) ? 'checked' : ''}>
                                            <span class="text-sm">${f.name}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                            <div>
                                <label class="label">推荐数量</label>
                                <select name="recommend_count" class="select">
                                    ${[3, 5, 10].map(n => `<option value="${n}" ${this.recommendParams.recommendCount === n ? 'selected' : ''}>${n} 条</option>`).join('')}
                                </select>
                            </div>
                            <div class="flex gap-2 pt-4">
                                <button type="button" class="btn btn-outline flex-1" onclick="TemplatesPage.resetRecommendForm()">重置</button>
                                <button type="submit" class="btn btn-primary flex-1">开始推荐</button>
                            </div>
                        </form>
                    </div>
                </div>
                <div class="lg:col-span-3">
                    ${this.renderRecommendResults()}
                </div>
            </div>
        `;
    },

    renderRecommendResults() {
        if (this.recommendResults.length === 0) {
            return emptyState('请设置筛选条件后点击"开始推荐"', '🤖');
        }

        return `
            <div class="space-y-4">
                <h3 class="font-semibold text-gray-800">📊 推荐结果 (${this.recommendResults.length} 条)</h3>
                ${this.recommendResults.map((result, index) => this.renderRecommendCard(result, index)).join('')}
            </div>
        `;
    },

    renderRecommendCard(result, index) {
        const reasons = result.recommendation_reasons || [];
        const suggestions = result.adjustment_suggestions || [];
        const components = result.components || [];
        const componentChips = components.map(comp => {
            const name = this.getMaterialName(comp);
            const colorClass = getMaterialTypeColor(comp.material_type);
            return `<span class="chip ${colorClass} text-xs">${name}: ${comp.ratio}</span>`;
        }).join(' ');

        return `
            <div class="card overflow-hidden">
                <div class="bg-gradient-to-r from-blue-50 to-purple-50 p-4">
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center text-xl font-bold">
                                ${index + 1}
                            </div>
                            <div>
                                <h4 class="font-semibold text-lg text-gray-800">${result.batch_no}</h4>
                                <div class="flex items-center gap-4 mt-1">
                                    <span class="text-sm text-gray-600">
                                        🎯 相似度：<span class="font-bold text-blue-600">${(result.similarity_score * 100).toFixed(1)}%</span>
                                    </span>
                                    <span class="text-sm text-gray-600">
                                        ⭐ 平均评分：<span class="font-bold text-yellow-600">${result.overall_rating ? result.overall_rating.toFixed(1) : '-'}</span>
                                    </span>
                                    <span class="text-sm text-gray-600">
                                        🧪 平均浓度：<span class="font-bold text-green-600">${result.avg_concentration ? result.avg_concentration.toFixed(2) : '-'}%</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="TemplatesPage.replicateFromRecommend(${result.batch_id})">
                            🔄 一键复刻为新批次
                        </button>
                    </div>
                </div>

                <div class="p-4 space-y-4">
                    ${reasons.length > 0 ? `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h5 class="font-semibold text-green-800 mb-2">✅ 推荐理由</h5>
                            <ul class="space-y-1">
                                ${reasons.map(r => `<li class="text-sm text-green-700 flex items-start gap-2"><span>•</span><span>${r}</span></li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    ${suggestions.length > 0 ? `
                        <div class="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <h5 class="font-semibold text-orange-800 mb-2">⚠️ 调整建议</h5>
                            <ul class="space-y-1">
                                ${suggestions.map(s => `<li class="text-sm text-orange-700 flex items-start gap-2"><span>•</span><span>${s}</span></li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    ${components.length > 0 ? `
                        <div>
                            <h5 class="font-medium text-gray-700 mb-2">🧪 配方成分</h5>
                            <div class="flex flex-wrap gap-1">
                                ${componentChips}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    resetRecommendForm() {
        this.recommendParams = {
            targetRating: 7,
            targetConcentration: '',
            preferredFibers: [],
            recommendCount: 5,
        };
        this.recommendResults = [];
        this.render();
    },

    async handleRecommendSubmit(formData) {
        const targetRating = parseInt(formData.get('target_rating'));
        const targetConcentration = formData.get('target_concentration') ? parseFloat(formData.get('target_concentration')) : null;
        const preferredFibers = formData.getAll('preferred_fibers').map(id => parseInt(id));
        const recommendCount = parseInt(formData.get('recommend_count'));

        this.recommendParams = {
            targetRating,
            targetConcentration: formData.get('target_concentration'),
            preferredFibers,
            recommendCount,
        };

        const data = {
            target_rating: targetRating,
            target_concentration: targetConcentration,
            fiber_preferences: preferredFibers.length > 0 ? preferredFibers : null,
            top_k: recommendCount,
        };

        loading(true);
        try {
            this.recommendResults = await API.templates.recommend(data);
            showToast(`找到 ${this.recommendResults.length} 条推荐结果`, 'success');
            loading(false);
            this.render();
        } catch (error) {
            loading(false);
            showToast('推荐失败: ' + error.message, 'error');
        }
    },

    replicateFromRecommend(batchId) {
        const batch = this.batches.find(b => b.id === batchId);
        if (!batch) {
            showToast('未找到该批次', 'error');
            return;
        }

        const content = `
            <form id="recommend-replicate-form" class="space-y-4">
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p class="text-sm text-blue-800">
                        <span class="font-medium">📦 来源批次：</span>${batch.batch_no}
                    </p>
                </div>
                <div>
                    <label class="label">新批次编号 *</label>
                    <input type="text" name="batch_no" class="input" placeholder="请输入新批次编号" required>
                </div>
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea" placeholder="请输入备注信息"></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">确认复刻</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '复刻为新批次', width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#recommend-replicate-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            try {
                await API.templates.createFromBatch(batchId, {
                    name: `${batch.batch_no} - 复刻`,
                    category: '复刻',
                    version_name: '从推荐复刻',
                });
                showToast('复刻成功，已创建新批次', 'success');
                close();
                await this.loadAllData();
                this.render();
            } catch (error) {
                showToast('复刻失败: ' + error.message, 'error');
            }
        });
    },

    unmount() {},
};

document.addEventListener('click', (e) => {
    if (e.target.closest('#recommend-form') && e.target.type === 'submit') {
        e.preventDefault();
        const form = document.getElementById('recommend-form');
        if (form) {
            const formData = new FormData(form);
            TemplatesPage.handleRecommendSubmit(formData);
        }
    }
});
