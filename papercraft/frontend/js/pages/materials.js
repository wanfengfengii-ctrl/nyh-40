const MaterialsPage = {
    activeTab: 'fibers',
    fibers: [],
    sizingAgents: [],
    fillers: [],

    async mount() {
        App.setPageTitle('🧪 材料管理');
        App.setPageActions(`
            <button class="btn btn-primary" onclick="MaterialsPage.openImportModal()">
                📥 批量导入
            </button>
            <button class="btn btn-success" onclick="MaterialsPage.openCreateModal()">
                ➕ 新增材料
            </button>
        `);
        loading(true);
        await this.loadAllData();
        this.render();
    },

    async loadAllData() {
        try {
            [this.fibers, this.sizingAgents, this.fillers] = await Promise.all([
                API.fibers.list(),
                API.sizingAgents.list(),
                API.fillers.list(),
            ]);
        } catch (error) {
            showToast('加载数据失败: ' + error.message, 'error');
        }
    },

    render() {
        const tabs = [
            { id: 'fibers', name: '纤维来源', icon: '🌾', count: this.fibers.length },
            { id: 'sizing', name: '胶料', icon: '🧴', count: this.sizingAgents.length },
            { id: 'fillers', name: '矿物填料', icon: '💎', count: this.fillers.length },
        ];

        App.setPageContent(`
            <div class="mb-6 flex gap-2 border-b border-gray-200">
                ${tabs.map(tab => `
                    <button 
                        class="px-6 py-3 font-medium transition-colors relative ${this.activeTab === tab.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}"
                        onclick="MaterialsPage.switchTab('${tab.id}')"
                    >
                        ${tab.icon} ${tab.name} <span class="text-xs text-gray-400">(${tab.count})</span>
                    </button>
                `).join('')}
            </div>
            ${this.renderTable()}
        `);
    },

    renderTable() {
        let data, columns, typeField;
        if (this.activeTab === 'fibers') {
            data = this.fibers;
            columns = ['名称', '纤维类型', '产地', '备注', '创建时间', '操作'];
            typeField = 'fiber_type';
        } else if (this.activeTab === 'sizing') {
            data = this.sizingAgents;
            columns = ['名称', '胶料类型', '备注', '创建时间', '操作'];
            typeField = 'agent_type';
        } else {
            data = this.fillers;
            columns = ['名称', '填料类型', '备注', '创建时间', '操作'];
            typeField = 'filler_type';
        }

        if (data.length === 0) {
            return emptyState('暂无数据，请点击右上角新增材料', '🧪');
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
                                ${this.activeTab === 'fibers' ? `<td class="px-4 py-3 text-gray-600">${item.origin || '-'}</td>` : ''}
                                <td class="px-4 py-3 text-gray-600 max-w-xs truncate" title="${item.notes || ''}">${item.notes || '-'}</td>
                                <td class="px-4 py-3 text-gray-500 text-sm">${formatDateTime(item.created_at)}</td>
                                <td class="px-4 py-3">
                                    <div class="flex gap-1">
                                        <button class="btn btn-sm btn-outline" onclick="MaterialsPage.openEditModal(${item.id})">编辑</button>
                                        <button class="btn btn-sm btn-danger" onclick="MaterialsPage.deleteItem(${item.id})">删除</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    switchTab(tabId) {
        this.activeTab = tabId;
        this.render();
    },

    getCurrentApi() {
        if (this.activeTab === 'fibers') return API.fibers;
        if (this.activeTab === 'sizing') return API.sizingAgents;
        return API.fillers;
    },

    openCreateModal() {
        const typeLabels = {
            fibers: '纤维来源',
            sizing: '胶料',
            filler: '矿物填料',
        };
        const typeLabel = typeLabels[this.activeTab];
        const typeField = this.activeTab === 'fibers' ? 'fiber_type' : this.activeTab === 'sizing' ? 'agent_type' : 'filler_type';
        const typeLabelText = this.activeTab === 'fibers' ? '纤维类型' : this.activeTab === 'sizing' ? '胶料类型' : '填料类型';

        const content = `
            <form id="material-form" class="space-y-4">
                <div>
                    <label class="label">名称 *</label>
                    <input type="text" name="name" class="input" placeholder="请输入名称" required>
                </div>
                <div>
                    <label class="label">${typeLabelText} *</label>
                    <input type="text" name="${typeField}" class="input" placeholder="请输入${typeLabelText}" required>
                </div>
                ${this.activeTab === 'fibers' ? `
                <div>
                    <label class="label">产地</label>
                    <input type="text" name="origin" class="input" placeholder="请输入产地">
                </div>
                ` : ''}
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea" placeholder="请输入备注"></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: `新增${typeLabel}`, width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#material-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            const typeFieldName = this.activeTab === 'fibers' ? 'fiber_type' : this.activeTab === 'sizing' ? 'agent_type' : 'filler_type';
            data[typeFieldName] = formData.get(typeFieldName);

            const rules = {
                name: { required: true, label: '名称', maxLength: 100 },
                [typeFieldName]: { required: true, label: typeLabelText, maxLength: 50 },
            };
            if (this.activeTab === 'fibers') {
                rules.origin = { maxLength: 200, label: '产地' };
            }

            const errors = validateForm(formData, rules);
            if (errors.length > 0) {
                showToast(errors[0], 'error');
                return;
            }

            try {
                await this.getCurrentApi().create(data);
                showToast(`${typeLabel}创建成功`, 'success');
                close();
                await this.loadAllData();
                this.render();
            } catch (error) {
                showToast('创建失败: ' + error.message, 'error');
            }
        });
    },

    openEditModal(id) {
        const typeLabels = {
            fibers: '纤维来源',
            sizing: '胶料',
            filler: '矿物填料',
        };
        const typeLabel = typeLabels[this.activeTab];
        const typeField = this.activeTab === 'fibers' ? 'fiber_type' : this.activeTab === 'sizing' ? 'agent_type' : 'filler_type';
        const typeLabelText = this.activeTab === 'fibers' ? '纤维类型' : this.activeTab === 'sizing' ? '胶料类型' : '填料类型';

        const currentData = this.activeTab === 'fibers'
            ? this.fibers.find(f => f.id === id)
            : this.activeTab === 'sizing'
            ? this.sizingAgents.find(s => s.id === id)
            : this.fillers.find(f => f.id === id);

        if (!currentData) return;

        const content = `
            <form id="material-form" class="space-y-4">
                <div>
                    <label class="label">名称 *</label>
                    <input type="text" name="name" class="input" value="${currentData.name}" required>
                </div>
                <div>
                    <label class="label">${typeLabelText} *</label>
                    <input type="text" name="${typeField}" class="input" value="${currentData[typeField]}" required>
                </div>
                ${this.activeTab === 'fibers' ? `
                <div>
                    <label class="label">产地</label>
                    <input type="text" name="origin" class="input" value="${currentData.origin || ''}">
                </div>
                ` : ''}
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea">${currentData.notes || ''}</textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: `编辑${typeLabel}`, width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#material-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
                await this.getCurrentApi().update(id, data);
                showToast(`${typeLabel}更新成功`, 'success');
                close();
                await this.loadAllData();
                this.render();
            } catch (error) {
                showToast('更新失败: ' + error.message, 'error');
            }
        });
    },

    deleteItem(id) {
        const typeLabels = {
            fibers: '纤维来源',
            sizing: '胶料',
            filler: '矿物填料',
        };
        const typeLabel = typeLabels[this.activeTab];

        showConfirmModal(
            `确定要删除该${typeLabel}吗？此操作不可恢复。`,
            async () => {
                try {
                    await this.getCurrentApi().delete(id);
                    showToast(`${typeLabel}删除成功`, 'success');
                    await this.loadAllData();
                    this.render();
                } catch (error) {
                    showToast('删除失败: ' + error.message, 'error');
                }
            },
            { title: `删除${typeLabel}`, confirmText: '确认删除' }
        );
    },

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

        const { modal, close } = showModal(content, { title: '📥 批量导入材料', width: '600px' });
        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        this._importModal = { modal, close };
    },

    async doImport() {
        const textarea = this._importModal.modal.querySelector('#import-data');
        const errorDiv = this._importModal.modal.querySelector('#import-errors');
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
                        if (type === 'fibers') await API.fibers.create(items[i]);
                        else if (type === 'sizingAgents') await API.sizingAgents.create(items[i]);
                        else await API.fillers.create(items[i]);
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
            showToast(`成功导入 ${successCount} 条材料`, 'success');
            await this.loadAllData();
            this.render();
        }

        if (successCount > 0 && errors.length === 0) {
            this._importModal.close();
        }
    },

    unmount() {},
};
