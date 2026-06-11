class MaterialsPageImpl extends PageState {
    constructor() {
        super({
            pageTitle: '🧪 材料管理',
            initialState: {
                activeTab: 'fibers',
                fibers: [],
                sizingAgents: [],
                fillers: [],
                _importModal: null,
            },
        });
    }

    setPage() {
        this.setActions(this._renderActions());
        UIKit.setPage(this.pageTitle, this.pageActions, '');
    }

    _renderActions() {
        return `
            <button class="btn btn-primary" onclick="MaterialsPage.openImportModal()">
                📥 批量导入
            </button>
            <button class="btn btn-success" onclick="MaterialsPage.openCreateModal()">
                ➕ 新增材料
            </button>
        `;
    }

    async loadData() {
        [this._state.fibers, this._state.sizingAgents, this._state.fillers] = await NewAPI.materials.loadAll();
    }

    render() {
        const { activeTab, fibers, sizingAgents, fillers } = this._state;

        const tabs = [
            { id: 'fibers', name: '纤维来源', icon: '🌾', count: fibers.length },
            { id: 'sizing', name: '胶料', icon: '🧴', count: sizingAgents.length },
            { id: 'fillers', name: '矿物填料', icon: '💎', count: fillers.length },
        ];

        const content = `
            <div class="mb-6 flex gap-2 border-b border-gray-200">
                ${tabs.map(tab => `
                    <button 
                        class="px-6 py-3 font-medium transition-colors relative ${activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}"
                        onclick="MaterialsPage.switchTab('${tab.id}')"
                    >
                        ${tab.icon} ${tab.name} <span class="text-xs text-gray-400">(${tab.count})</span>
                    </button>
                `).join('')}
            </div>
            ${this._renderTable()}
        `;

        this.setContent(content);
    }

    _renderTable() {
        const { activeTab, fibers, sizingAgents, fillers } = this._state;

        let data, columns, typeField;
        if (activeTab === 'fibers') {
            data = fibers;
            columns = ['名称', '纤维类型', '产地', '备注', '创建时间', '操作'];
            typeField = 'fiber_type';
        } else if (activeTab === 'sizing') {
            data = sizingAgents;
            columns = ['名称', '胶料类型', '备注', '创建时间', '操作'];
            typeField = 'agent_type';
        } else {
            data = fillers;
            columns = ['名称', '填料类型', '备注', '创建时间', '操作'];
            typeField = 'filler_type';
        }

        if (data.length === 0) {
            return this.empty('暂无数据，请点击右上角新增材料', '🧪');
        }

        return `
            <div class="card overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            ${columns.map(col => `<th class="px-4 py-3 text-left text-sm font-medium text-gray-600">${col}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${data.map(item => `
                            <tr class="border-b border-gray-100">
                                <td class="px-4 py-3 font-medium text-gray-800">${item.name}</td>
                                <td class="px-4 py-3">
                                    <span class="badge badge-blue">${item[typeField]}</span>
                                </td>
                                ${activeTab === 'fibers' ? `<td class="px-4 py-3 text-gray-600">${item.origin || '-'}</td>` : ''}
                                <td class="px-4 py-3 text-gray-600 max-w-xs truncate" title="${item.notes || ''}">${item.notes || '-'}</td>
                                <td class="px-4 py-3 text-gray-500 text-sm">${UIKit.formatDateTime(item.created_at)}</td>
                                <td class="px-4 py-3">
                                    <div class="flex gap-1">
                                        <button class="btn btn-sm btn-outline" onclick="MaterialsPage.openEditModal(${item.id})">编辑</button>
                                        <button class="btn btn-sm btn-outline" onclick="MaterialsPage.viewImages(${item.id})">📷 图片</button>
                                        <button class="btn btn-sm btn-danger" onclick="MaterialsPage.deleteItem(${item.id})">删除</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    switchTab(tabId) {
        this._state.activeTab = tabId;
        this.render();
    }

    _getTabConfig() {
        const { activeTab } = this._state;
        const configs = {
            fibers: {
                typeLabel: '纤维来源',
                typeField: 'fiber_type',
                typeLabelText: '纤维类型',
                api: NewAPI.fibers,
            },
            sizing: {
                typeLabel: '胶料',
                typeField: 'agent_type',
                typeLabelText: '胶料类型',
                api: NewAPI.sizingAgents,
            },
            fillers: {
                typeLabel: '矿物填料',
                typeField: 'filler_type',
                typeLabelText: '填料类型',
                api: NewAPI.fillers,
            },
        };
        return configs[activeTab];
    }

    _getFields(config, isEdit = false) {
        const fields = [
            { name: 'name', key: 'name', label: '名称', type: 'text', placeholder: '请输入名称', required: true, gridCols: 2 },
            { name: config.typeField, key: config.typeField, label: config.typeLabelText, type: 'text', placeholder: `请输入${config.typeLabelText}`, required: true, gridCols: 2 },
        ];
        if (this._state.activeTab === 'fibers') {
            fields.push({ name: 'origin', key: 'origin', label: '产地', type: 'text', placeholder: '请输入产地', gridCols: 2 });
        }
        fields.push({ name: 'notes', key: 'notes', label: '备注', type: 'textarea', placeholder: '请输入备注', gridCols: 2 });
        return fields;
    }

    _getRules(config) {
        const rules = {
            name: { required: true, label: '名称', maxLength: 100 },
            [config.typeField]: { required: true, label: config.typeLabelText, maxLength: 50 },
        };
        if (this._state.activeTab === 'fibers') {
            rules.origin = { maxLength: 200, label: '产地' };
        }
        return rules;
    }

    _findCurrentItem(id) {
        const { activeTab, fibers, sizingAgents, fillers } = this._state;
        if (activeTab === 'fibers') return fibers.find(f => f.id === id);
        if (activeTab === 'sizing') return sizingAgents.find(s => s.id === id);
        return fillers.find(f => f.id === id);
    }

    openCreateModal() {
        const config = this._getTabConfig();
        const fields = this._getFields(config);
        const rules = this._getRules(config);

        FormManager.createCreate({
            title: `新增${config.typeLabel}`,
            width: '500px',
            submitText: '保存',
            fields,
            rules,
            api: config.api,
            apiMethod: config.api.create,
            successMsg: `${config.typeLabel}创建成功`,
            errorMsg: '创建失败',
            onSuccess: async () => {
                await this._refreshData();
            },
        });
    }

    openEditModal(id) {
        const config = this._getTabConfig();
        const fields = this._getFields(config, true);
        const rules = this._getRules(config);
        const existingData = this._findCurrentItem(id);
        if (!existingData) return;

        FormManager.createEdit(
            {
                title: `编辑${config.typeLabel}`,
                width: '500px',
                submitText: '保存',
                fields,
                rules,
                api: config.api,
                apiMethod: config.api.update,
                successMsg: `${config.typeLabel}更新成功`,
                errorMsg: '更新失败',
                onSuccess: async () => {
                    await this._refreshData();
                },
            },
            id,
            existingData
        );
    }

    async deleteItem(id) {
        const config = this._getTabConfig();
        const doDelete = async () => {
            try {
                await this.safeCall(config.api.delete(id), {
                    successMsg: `${config.typeLabel}删除成功`,
                    errorMsg: '删除失败',
                });
                await this._refreshData();
            } catch (_) {}
        };

        UIKit.confirm(
            `确定要删除该${config.typeLabel}吗？此操作不可恢复。`,
            doDelete,
            { title: `删除${config.typeLabel}`, confirmText: '确认删除', type: 'danger' }
        );
    }

    openImportModal() {
        const content = `
            <div class="space-y-4">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 class="font-medium text-blue-800 mb-2">📋 导入说明</h4>
                    <p class="text-sm text-blue-700 mb-2">请按照以下JSON格式准备数据，支持批量导入纤维、胶料、填料：</p>
                    <pre class="bg-white p-3 rounded text-xs overflow-auto text-gray-700">{
  "fibers": [
    { "name": "苎麻", "fiber_type": "韧皮纤维", "origin": "四川", "notes": "优质苎麻" }
  ],
  "sizingAgents": [
    { "name": "明矾", "agent_type": "沉淀剂", "notes": "传统胶料" }
  ],
  "fillers": [
    { "name": "滑石粉", "filler_type": "硅酸盐", "notes": "提高平滑度" }
  ]
}</pre>
                </div>
                <div>
                    <label class="label">粘贴JSON数据 *</label>
                    <textarea id="import-data" class="textarea" rows="10" placeholder='{"fibers": [...], "sizingAgents": [...], "fillers": [...]}'></textarea>
                </div>
                <div id="import-errors" class="hidden bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"></div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="button" class="btn btn-primary" onclick="MaterialsPage.doImport()">开始导入</button>
                </div>
            </div>
        `;

        const { modal, close } = UIKit.modal(content, { title: '📥 批量导入材料', width: '600px' });
        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        this._state._importModal = { modal, close };
    }

    async doImport() {
        const { modal, close } = this._state._importModal;
        const textarea = modal.querySelector('#import-data');
        const errorDiv = modal.querySelector('#import-errors');
        const raw = textarea.value.trim();

        if (!raw) {
            errorDiv.textContent = '请输入要导入的JSON数据';
            errorDiv.classList.remove('hidden');
            return;
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            errorDiv.textContent = 'JSON格式错误: ' + e.message;
            errorDiv.classList.remove('hidden');
            return;
        }

        const errors = [];
        let successCount = 0;

        const validateItem = (item, type, index) => {
            const prefix = `[${type} 第${index + 1}条]`;
            if (!item.name) {
                errors.push(`${prefix} 名称不能为空`);
                return false;
            }
            if (type === 'fibers' && !item.fiber_type) {
                errors.push(`${prefix} 纤维类型不能为空`);
                return false;
            }
            if (type === 'sizingAgents' && !item.agent_type) {
                errors.push(`${prefix} 胶料类型不能为空`);
                return false;
            }
            if (type === 'fillers' && !item.filler_type) {
                errors.push(`${prefix} 填料类型不能为空`);
                return false;
            }
            return true;
        };

        for (const type of ['fibers', 'sizingAgents', 'fillers']) {
            const items = parsed[type] || [];
            for (let i = 0; i < items.length; i++) {
                if (validateItem(items[i], type, i)) {
                    try {
                        if (type === 'fibers') await NewAPI.fibers.create(items[i]);
                        else if (type === 'sizingAgents') await NewAPI.sizingAgents.create(items[i]);
                        else await NewAPI.fillers.create(items[i]);
                        successCount++;
                    } catch (e) {
                        errors.push(`[${type} 第${i + 1}条] ${e.message}`);
                    }
                }
            }
        }

        if (errors.length > 0) {
            errorDiv.innerHTML = `<div class="font-medium mb-1">导入校验提示 (${errors.length}条)：</div>${errors.map(e => `<div>• ${e}</div>`).join('')}`;
            errorDiv.classList.remove('hidden');
        }

        if (successCount > 0) {
            UIKit.toast(`成功导入 ${successCount} 条材料`, 'success');
            await this._refreshData();
        }

        if (successCount > 0 && errors.length === 0) {
            close();
        }
    }

    viewImages(itemId) {
        const { activeTab, fibers, sizingAgents, fillers } = this._state;

        const itemName = activeTab === 'fibers'
            ? (fibers.find(f => f.id === itemId)?.name || '')
            : activeTab === 'sizing'
            ? (sizingAgents.find(s => s.id === itemId)?.name || '')
            : (fillers.find(f => f.id === itemId)?.name || '');

        const options = {
            title: `${itemName} - 图片管理`,
            defaultCategory: 'raw_material',
        };

        if (activeTab === 'fibers') {
            options.fiberSourceId = itemId;
        } else if (activeTab === 'sizing') {
            options.sizingAgentId = itemId;
        } else {
            options.mineralFillerId = itemId;
        }

        ImagesPage.openImageManager(options);
    }

    async _refreshData() {
        try {
            await this.loadData();
            this.setActions(this._renderActions());
            this.render();
        } catch (error) {
            this.handleError(error, '刷新数据失败');
        }
    }
}

window.MaterialsPage = new MaterialsPageImpl();
