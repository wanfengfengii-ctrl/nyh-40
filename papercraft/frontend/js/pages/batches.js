const BatchesPage = {
    batches: [],
    fibers: [],
    sizingAgents: [],
    fillers: [],
    showHidden: false,

    async mount() {
        App.setPageTitle('📦 配浆批次管理');
        App.setPageActions(`
            <label class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" id="show-hidden" onchange="BatchesPage.toggleShowHidden()" ${this.showHidden ? 'checked' : ''}>
                <span class="text-sm text-gray-600">显示隐藏批次</span>
            </label>
            <button class="btn btn-success" onclick="BatchesPage.openCreateModal()">
                ➕ 新增批次
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
        } catch (error) {
            showToast('加载数据失败: ' + error.message, 'error');
        }
    },

    render() {
        let displayBatches = this.batches;
        if (!this.showHidden) {
            displayBatches = this.batches.filter(b => !b.hidden);
        }

        if (displayBatches.length === 0) {
            App.setPageContent(emptyState('暂无批次数据，请点击右上角新增批次', '📦'));
            return;
        }

        App.setPageContent(`
            <div class="card overflow-hidden">
                <table class="w-full">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">批次编号</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">配方成分</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">备注</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">创建时间</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">更新时间</th>
                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayBatches.map(batch => this.renderBatchRow(batch)).join('')}
                    </tbody>
                </table>
            </div>
        `);
    },

    renderBatchRow(batch) {
        const components = batch.components || [];
        const totalRatio = components.reduce((sum, c) => sum + c.ratio, 0);
        const componentChips = components.map(comp => {
            const name = this.getMaterialName(comp);
            const colorClass = getMaterialTypeColor(comp.material_type);
            return `<span class="chip ${colorClass}">${name}: ${comp.ratio}</span>`;
        }).join(' ');

        return `
            <tr class="border-b border-gray-100 ${batch.hidden ? 'opacity-60 bg-gray-50' : ''}">
                <td class="px-4 py-3 font-medium text-gray-800">${batch.batch_no}</td>
                <td class="px-4 py-3">${getStatusBadge(batch.is_sealed, batch.hidden)}</td>
                <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1 max-w-md">
                        ${componentChips || '<span class="text-gray-400 text-sm">暂无成分</span>'}
                        ${totalRatio > 0 ? `<div class="text-xs text-gray-500 w-full mt-1">总计: ${totalRatio.toFixed(2)}</div>` : ''}
                    </div>
                </td>
                <td class="px-4 py-3 text-gray-600 max-w-xs truncate" title="${batch.notes || ''}">${batch.notes || '-'}</td>
                <td class="px-4 py-3 text-gray-500 text-sm">${formatDateTime(batch.created_at)}</td>
                <td class="px-4 py-3 text-gray-500 text-sm">${formatDateTime(batch.updated_at)}</td>
                <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                        <button class="btn btn-sm btn-outline" onclick="BatchesPage.viewDetail(${batch.id})">详情</button>
                        <button class="btn btn-sm btn-outline" onclick="BatchesPage.viewBatchImages(${batch.id})">📷 图片</button>
                        ${!batch.is_sealed ? `
                            <button class="btn btn-sm btn-outline" onclick="BatchesPage.openEditModal(${batch.id})">编辑</button>
                            <button class="btn btn-sm btn-primary" onclick="BatchesPage.manageComponents(${batch.id})">成分</button>
                            <button class="btn btn-sm btn-success" onclick="BatchesPage.sealBatch(${batch.id})">封存</button>
                        ` : `
                            <button class="btn btn-sm btn-warning" onclick="BatchesPage.unsealBatch(${batch.id})">解封</button>
                        `}
                        <button class="btn btn-sm ${batch.hidden ? 'btn-success' : 'btn-secondary'}" onclick="BatchesPage.toggleHidden(${batch.id})">
                            ${batch.hidden ? '显示' : '隐藏'}
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="BatchesPage.deleteBatch(${batch.id})">删除</button>
                    </div>
                </td>
            </tr>
        `;
    },

    getMaterialName(comp) {
        if (comp.material_type === 'fiber') {
            const fiber = this.fibers.find(f => f.id === comp.fiber_source_id);
            return fiber ? fiber.name : `纤维#${comp.fiber_source_id}`;
        } else if (comp.material_type === 'sizing') {
            const agent = this.sizingAgents.find(s => s.id === comp.sizing_agent_id);
            return agent ? agent.name : `胶料#${comp.sizing_agent_id}`;
        } else {
            const filler = this.fillers.find(f => f.id === comp.mineral_filler_id);
            return filler ? filler.name : `填料#${comp.mineral_filler_id}`;
        }
    },

    getMaterialOptions(type) {
        if (type === 'fiber') {
            return this.fibers.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        } else if (type === 'sizing') {
            return this.sizingAgents.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        } else {
            return this.fillers.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        }
    },

    toggleShowHidden() {
        this.showHidden = document.getElementById('show-hidden').checked;
        this.render();
    },

    openCreateModal() {
        const content = `
            <form id="batch-form" class="space-y-4">
                <div>
                    <label class="label">批次编号 *</label>
                    <input type="text" name="batch_no" class="input" placeholder="请输入批次编号" required>
                </div>
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea" placeholder="请输入备注"></textarea>
                </div>
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <label class="label mb-0">配方成分</label>
                        <button type="button" class="btn btn-sm btn-outline" onclick="BatchesPage.addComponentRow()">➕ 添加成分</button>
                    </div>
                    <div id="components-container" class="space-y-2">
                    </div>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">创建批次</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '新增配浆批次', width: '700px' });
        this._currentModal = { modal, close, components: [] };

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#batch-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                batch_no: formData.get('batch_no'),
                notes: formData.get('notes') || null,
                components: this._currentModal.components,
            };

            if (!data.batch_no || data.batch_no.trim() === '') {
                showToast('批次编号不能为空', 'error');
                return;
            }

            try {
                await API.batches.create(data);
                showToast('批次创建成功', 'success');
                close();
                await this.loadAllData();
                this.render();
            } catch (error) {
                showToast('创建失败: ' + error.message, 'error');
            }
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
                <select class="select" onchange="BatchesPage.onMaterialTypeChange(${rowIndex}, this.value)">
                    <option value="fiber">纤维</option>
                    <option value="sizing">胶料</option>
                    <option value="filler">填料</option>
                </select>
            </div>
            <div class="flex-1">
                <label class="label">具体材料</label>
                <select class="select" data-field="materialId" onchange="BatchesPage.onMaterialChange(${rowIndex}, this.value)">
                    ${this.getMaterialOptions('fiber')}
                </select>
            </div>
            <div class="w-24">
                <label class="label">配比 *</label>
                <input type="number" class="input" step="0.01" min="0" onchange="BatchesPage.onRatioChange(${rowIndex}, this.value)">
            </div>
            <div class="flex-1">
                <label class="label">备注</label>
                <input type="text" class="input" onchange="BatchesPage.onNoteChange(${rowIndex}, this.value)">
            </div>
            <div class="pt-6">
                <button type="button" class="btn btn-sm btn-danger" onclick="BatchesPage.removeComponentRow(${rowIndex}, ${componentId})">✕</button>
            </div>
        `;
        container.appendChild(row);
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
            this._currentModal.components[index].sizing_agent_id = this.sizingAgents[0]?.id || null;
            this._currentModal.components[index].mineral_filler_id = null;
            select.innerHTML = this.getMaterialOptions('sizing');
        } else {
            this._currentModal.components[index].fiber_source_id = null;
            this._currentModal.components[index].sizing_agent_id = null;
            this._currentModal.components[index].mineral_filler_id = this.fillers[0]?.id || null;
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

    openEditModal(id) {
        const batch = this.batches.find(b => b.id === id);
        if (!batch) return;

        const content = `
            <form id="batch-form" class="space-y-4">
                <div>
                    <label class="label">批次编号 *</label>
                    <input type="text" name="batch_no" class="input" value="${batch.batch_no}" required>
                </div>
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea">${batch.notes || ''}</textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">保存</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '编辑批次', width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#batch-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            try {
                await API.batches.update(id, data);
                showToast('批次更新成功', 'success');
                close();
                await this.loadAllData();
                this.render();
            } catch (error) {
                showToast('更新失败: ' + error.message, 'error');
            }
        });
    },

    manageComponents(batchId) {
        const batch = this.batches.find(b => b.id === batchId);
        if (!batch) return;

        const content = `
            <div class="space-y-4">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-medium text-gray-800 mb-2">批次: ${batch.batch_no}</h4>
                    <p class="text-sm text-gray-600">当前成分数量: ${batch.components?.length || 0}</p>
                </div>
                <div id="existing-components" class="space-y-2">
                    ${this.renderExistingComponents(batch)}
                </div>
                <div class="border-t pt-4">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="font-medium text-gray-700">添加新成分</h5>
                    </div>
                    <div id="new-components" class="space-y-2"></div>
                    <button type="button" class="btn btn-sm btn-outline mt-2" onclick="BatchesPage.addNewComponentRow()">➕ 添加成分</button>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">关闭</button>
                    <button type="button" class="btn btn-primary" onclick="BatchesPage.saveNewComponents(${batchId})">保存新增</button>
                </div>
            </div>
        `;

        const { modal, close } = showModal(content, { title: '管理配浆成分', width: '800px' });
        this._componentModal = { modal, close, batchId, newComponents: [] };

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
    },

    renderExistingComponents(batch) {
        if (!batch.components || batch.components.length === 0) {
            return '<p class="text-gray-500 text-center py-4">暂无成分</p>';
        }

        return batch.components.map(comp => {
            const name = this.getMaterialName(comp);
            const colorClass = getMaterialTypeColor(comp.material_type);
            return `
                <div class="flex gap-2 items-center p-3 bg-white border border-gray-200 rounded-lg">
                    <span class="chip ${colorClass}">${getMaterialTypeName(comp.material_type)}</span>
                    <span class="font-medium">${name}</span>
                    <span class="text-gray-500">配比: ${comp.ratio}</span>
                    ${comp.notes ? `<span class="text-gray-400 text-sm">(${comp.notes})</span>` : ''}
                    <div class="flex-1"></div>
                    <button class="btn btn-sm btn-danger" onclick="BatchesPage.deleteComponent(${batch.id}, ${comp.id})">删除</button>
                </div>
            `;
        }).join('');
    },

    addNewComponentRow() {
        const container = this._componentModal.modal.querySelector('#new-components');
        const rowIndex = this._componentModal.newComponents.length;
        this._componentModal.newComponents.push({
            material_type: 'fiber',
            fiber_source_id: this.fibers[0]?.id || null,
            sizing_agent_id: null,
            mineral_filler_id: null,
            ratio: 0,
            notes: '',
        });

        const row = document.createElement('div');
        row.className = 'flex gap-2 items-start p-3 bg-green-50 border border-green-200 rounded-lg';
        row.dataset.rowIndex = rowIndex;
        row.innerHTML = `
            <div class="flex-1">
                <select class="select" onchange="BatchesPage.onNewMaterialTypeChange(${rowIndex}, this.value)">
                    <option value="fiber">纤维</option>
                    <option value="sizing">胶料</option>
                    <option value="filler">填料</option>
                </select>
            </div>
            <div class="flex-1">
                <select class="select" data-field="materialId" onchange="BatchesPage.onNewMaterialChange(${rowIndex}, this.value)">
                    ${this.getMaterialOptions('fiber')}
                </select>
            </div>
            <div class="w-24">
                <input type="number" class="input" step="0.01" min="0" placeholder="配比" onchange="BatchesPage.onNewRatioChange(${rowIndex}, this.value)">
            </div>
            <div class="flex-1">
                <input type="text" class="input" placeholder="备注" onchange="BatchesPage.onNewNoteChange(${rowIndex}, this.value)">
            </div>
            <div>
                <button type="button" class="btn btn-sm btn-danger" onclick="BatchesPage.removeNewComponentRow(${rowIndex})">✕</button>
            </div>
        `;
        container.appendChild(row);
    },

    onNewMaterialTypeChange(index, value) {
        this._componentModal.newComponents[index].material_type = value;
        const row = this._componentModal.modal.querySelectorAll('#new-components > div')[index];
        const select = row.querySelector('[data-field="materialId"]');
        
        if (value === 'fiber') {
            this._componentModal.newComponents[index].fiber_source_id = this.fibers[0]?.id || null;
            select.innerHTML = this.getMaterialOptions('fiber');
        } else if (value === 'sizing') {
            this._componentModal.newComponents[index].sizing_agent_id = this.sizingAgents[0]?.id || null;
            select.innerHTML = this.getMaterialOptions('sizing');
        } else {
            this._componentModal.newComponents[index].mineral_filler_id = this.fillers[0]?.id || null;
            select.innerHTML = this.getMaterialOptions('filler');
        }
    },

    onNewMaterialChange(index, value) {
        const comp = this._componentModal.newComponents[index];
        if (comp.material_type === 'fiber') comp.fiber_source_id = parseInt(value);
        else if (comp.material_type === 'sizing') comp.sizing_agent_id = parseInt(value);
        else comp.mineral_filler_id = parseInt(value);
    },

    onNewRatioChange(index, value) {
        this._componentModal.newComponents[index].ratio = parseFloat(value) || 0;
    },

    onNewNoteChange(index, value) {
        this._componentModal.newComponents[index].notes = value || null;
    },

    removeNewComponentRow(index) {
        this._componentModal.newComponents.splice(index, 1);
        const row = this._componentModal.modal.querySelector(`[data-row-index="${index}"]`);
        if (row) row.remove();
    },

    async saveNewComponents(batchId) {
        const components = this._componentModal.newComponents.filter(c => c.ratio > 0);
        if (components.length === 0) {
            showToast('请至少添加一个有效成分', 'warning');
            return;
        }

        try {
            for (const comp of components) {
                await API.batches.addComponent(batchId, comp);
            }
            showToast(`成功添加 ${components.length} 个成分`, 'success');
            this._componentModal.close();
            await this.loadAllData();
            this.render();
        } catch (error) {
            showToast('保存失败: ' + error.message, 'error');
        }
    },

    async deleteComponent(batchId, compId) {
        showConfirmModal(
            '确定要删除该成分吗？',
            async () => {
                try {
                    await API.batches.deleteComponent(batchId, compId);
                    showToast('成分删除成功', 'success');
                    await this.loadAllData();
                    const batch = this.batches.find(b => b.id === batchId);
                    if (batch) {
                        const container = this._componentModal?.modal?.querySelector('#existing-components');
                        if (container) {
                            container.innerHTML = this.renderExistingComponents(batch);
                        }
                    }
                    this.render();
                } catch (error) {
                    showToast('删除失败: ' + error.message, 'error');
                }
            },
            { title: '删除成分', confirmText: '确认删除' }
        );
    },

    async sealBatch(id) {
        showConfirmModal(
            '确定要封存该批次吗？封存后将无法修改配浆成分。',
            async () => {
                try {
                    await API.batches.seal(id);
                    showToast('批次已封存', 'success');
                    await this.loadAllData();
                    this.render();
                } catch (error) {
                    showToast('封存失败: ' + error.message, 'error');
                }
            },
            { title: '封存批次', confirmText: '确认封存', type: 'warning' }
        );
    },

    async unsealBatch(id) {
        showConfirmModal(
            '确定要解封该批次吗？解封后可以继续修改配浆成分。',
            async () => {
                try {
                    await API.batches.unseal(id);
                    showToast('批次已解封', 'success');
                    await this.loadAllData();
                    this.render();
                } catch (error) {
                    showToast('解封失败: ' + error.message, 'error');
                }
            },
            { title: '解封批次', confirmText: '确认解封', type: 'primary' }
        );
    },

    async toggleHidden(id) {
        try {
            await API.batches.toggleHidden(id);
            showToast('状态更新成功', 'success');
            await this.loadAllData();
            this.render();
        } catch (error) {
            showToast('操作失败: ' + error.message, 'error');
        }
    },

    async deleteBatch(id) {
        const batch = this.batches.find(b => b.id === id);
        if (!batch) return;

        const hasObservations = await this.checkHasObservations(id);
        let message = `确定要删除批次 "${batch.batch_no}" 吗？此操作不可恢复。`;
        let needSecondaryConfirm = false;

        if (hasObservations) {
            message = `⚠️ 批次 "${batch.batch_no}" 已有关联的成纸观察记录！\n\n删除将同时清除所有相关的抄纸记录和观察数据。\n\n请再次确认是否要删除？`;
            needSecondaryConfirm = true;
        }

        showConfirmModal(
            message,
            async () => {
                if (needSecondaryConfirm) {
                    showConfirmModal(
                        '这是二次确认！你真的确定要删除该批次及其所有关联数据吗？',
                        async () => {
                            try {
                                await API.batches.delete(id, true);
                                showToast('批次删除成功', 'success');
                                await this.loadAllData();
                                this.render();
                            } catch (error) {
                                showToast('删除失败: ' + error.message, 'error');
                            }
                        },
                        { title: '二次确认删除', confirmText: '彻底删除', type: 'danger' }
                    );
                } else {
                    try {
                        await API.batches.delete(id, false);
                        showToast('批次删除成功', 'success');
                        await this.loadAllData();
                        this.render();
                    } catch (error) {
                        showToast('删除失败: ' + error.message, 'error');
                    }
                }
            },
            { title: '删除批次', confirmText: '确认删除', type: 'danger' }
        );
    },

    async checkHasObservations(batchId) {
        try {
            const records = await API.records.listBatchPapermaking(batchId);
            for (const record of records) {
                const observations = await API.records.listObservations(record.id);
                if (observations.length > 0) return true;
            }
            return false;
        } catch {
            return false;
        }
    },

    viewDetail(batchId) {
        window.location.hash = `#/compare?batchId=${batchId}`;
    },

    viewBatchImages(batchId) {
        const batch = this.batches.find(b => b.id === batchId);
        if (!batch) return;
        window.location.hash = `#/compare?batchId=${batchId}`;
        setTimeout(() => {
            if (ComparePage.viewMode !== 'imageTimeline') {
                ComparePage.switchViewMode('imageTimeline');
            }
        }, 500);
    },

    unmount() {},
};
