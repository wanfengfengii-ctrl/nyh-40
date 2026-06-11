class BatchesPageImpl extends PageState {
    constructor() {
        super({
            pageTitle: '📦 配浆批次管理',
            initialState: {
                batches: [],
                fibers: [],
                sizingAgents: [],
                fillers: [],
                showHidden: false,
            },
        });
        this._componentModal = null;
    }

    setPage() {
        this.setActions(this._renderActions());
        UIKit.setPage(this.pageTitle, this.pageActions, '');
    }

    _renderActions() {
        const { showHidden } = this._state;
        return `
            <label class="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input type="checkbox" id="show-hidden" onchange="BatchesPage.toggleShowHidden()" ${showHidden ? 'checked' : ''}>
                <span class="text-sm text-gray-600">显示隐藏批次</span>
            </label>
            <button class="btn btn-success" onclick="BatchesPage.openCreateModal()">
                ➕ 新增批次
            </button>
        `;
    }

    async loadData() {
        const [batches, fibers, sizingAgents, fillers] = await Promise.all([
            NewAPI.batches.list(),
            NewAPI.fibers.list(),
            NewAPI.sizingAgents.list(),
            NewAPI.fillers.list(),
        ]);
        this._state.batches = batches;
        this._state.fibers = fibers;
        this._state.sizingAgents = sizingAgents;
        this._state.fillers = fillers;
    }

    async _refreshData() {
        try {
            await this.loadData();
        } catch (error) {
            this.handleError(error, '加载数据失败');
        }
        this.setActions(this._renderActions());
        this.render();
    }

    render() {
        const { batches, showHidden, fibers, sizingAgents, fillers } = this._state;
        let displayBatches = batches;
        if (!showHidden) {
            displayBatches = batches.filter(b => !b.hidden);
        }

        if (displayBatches.length === 0) {
            this.setContent(this.empty('暂无批次数据，请点击右上角新增批次', '📦'));
            return;
        }

        this.setContent(`
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
                        ${displayBatches.map(batch => this._renderBatchRow(batch, fibers, sizingAgents, fillers)).join('')}
                    </tbody>
                </table>
            </div>
        `);
    }

    _renderBatchRow(batch, fibers, sizingAgents, fillers) {
        const components = batch.components || [];
        const totalRatio = components.reduce((sum, c) => sum + c.ratio, 0);
        const componentChips = components.map(comp => {
            const name = NewAPI.materials.getMaterialName(comp, fibers, sizingAgents, fillers);
            const colorClass = UIKit.getMaterialTypeColor(comp.material_type);
            return `<span class="chip ${colorClass}">${name}: ${comp.ratio}</span>`;
        }).join(' ');

        return `
            <tr class="border-b border-gray-100 ${batch.hidden ? 'opacity-60 bg-gray-50' : ''}">
                <td class="px-4 py-3 font-medium text-gray-800">${batch.batch_no}</td>
                <td class="px-4 py-3">${UIKit.getStatusBadge(batch.is_sealed, batch.hidden)}</td>
                <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1 max-w-md">
                        ${componentChips || '<span class="text-gray-400 text-sm">暂无成分</span>'}
                        ${totalRatio > 0 ? `<div class="text-xs text-gray-500 w-full mt-1">总计: ${totalRatio.toFixed(2)}</div>` : ''}
                    </div>
                </td>
                <td class="px-4 py-3 text-gray-600 max-w-xs truncate" title="${batch.notes || ''}">${batch.notes || '-'}</td>
                <td class="px-4 py-3 text-gray-500 text-sm">${UIKit.formatDateTime(batch.created_at)}</td>
                <td class="px-4 py-3 text-gray-500 text-sm">${UIKit.formatDateTime(batch.updated_at)}</td>
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
    }

    toggleShowHidden() {
        this._state.showHidden = document.getElementById('show-hidden').checked;
        this.render();
    }

    _getBatchFields() {
        return [
            { name: 'batch_no', key: 'batch_no', label: '批次编号', type: 'text', placeholder: '请输入批次编号', required: true },
            { name: 'notes', key: 'notes', label: '备注', type: 'textarea', placeholder: '请输入备注' },
        ];
    }

    _getBatchRules() {
        return {
            batch_no: { required: true, label: '批次编号' },
        };
    }

    openCreateModal() {
        const { fibers, sizingAgents, fillers } = this._state;
        let createPicker = null;

        const handlers = FormManager.open({
            title: '新增配浆批次',
            width: '700px',
            submitText: '创建批次',
            fields: this._getBatchFields(),
            rules: this._getBatchRules(),
            extraContent: {
                afterFields: `
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <label class="label mb-0">配方成分</label>
                            <button type="button" class="btn btn-sm btn-outline" id="btn-add-component">➕ 添加成分</button>
                        </div>
                        <div id="components-container" class="space-y-2"></div>
                    </div>
                `,
            },
            onSubmit: async (data, submitHandlers) => {
                const validComponents = createPicker.getValidComponents();
                const createData = {
                    ...data,
                    components: validComponents,
                };
                await this.safeCall(NewAPI.batches.create(createData), {
                    successMsg: '批次创建成功',
                    errorMsg: '创建失败',
                });
                submitHandlers.close();
                await this._refreshData();
            },
        });

        createPicker = MaterialPicker.create({
            container: handlers.modal.querySelector('#components-container'),
            fibers,
            sizingAgents,
            fillers,
            components: [],
            onChange: () => {},
        });
        createPicker.addComponentRow();

        handlers.modal.querySelector('#btn-add-component').addEventListener('click', () => {
            createPicker.addComponentRow();
        });
    }

    openEditModal(id) {
        const batch = this._state.batches.find(b => b.id === id);
        if (!batch) return;

        FormManager.createEdit(
            {
                title: '编辑批次',
                width: '500px',
                submitText: '保存',
                fields: this._getBatchFields(),
                rules: this._getBatchRules(),
                api: NewAPI.batches,
                apiMethod: (bid, data) => NewAPI.batches.update(bid, data),
                successMsg: '批次更新成功',
                errorMsg: '更新失败',
                onSuccess: async () => {
                    await this._refreshData();
                },
            },
            id,
            batch
        );
    }

    manageComponents(batchId) {
        const batch = this._state.batches.find(b => b.id === batchId);
        if (!batch) return;

        const { fibers, sizingAgents, fillers } = this._state;
        let newComponentsPicker = null;

        const content = `
            <div class="space-y-4">
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-medium text-gray-800 mb-2">批次: ${batch.batch_no}</h4>
                    <p class="text-sm text-gray-600">当前成分数量: ${batch.components?.length || 0}</p>
                </div>
                <div id="existing-components" class="space-y-2">
                    ${this._renderExistingComponents(batch)}
                </div>
                <div class="border-t pt-4">
                    <div class="flex items-center justify-between mb-2">
                        <h5 class="font-medium text-gray-700">添加新成分</h5>
                        <button type="button" class="btn btn-sm btn-outline" id="btn-add-new-component">➕ 添加成分</button>
                    </div>
                    <div id="new-components" class="space-y-2"></div>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">关闭</button>
                    <button type="button" class="btn btn-primary" id="btn-save-new-components">保存新增</button>
                </div>
            </div>
        `;

        const { modal, close } = UIKit.modal(content, { title: '管理配浆成分', width: '800px' });
        this._componentModal = { modal, close, batchId };

        newComponentsPicker = MaterialPicker.create({
            container: modal.querySelector('#new-components'),
            fibers,
            sizingAgents,
            fillers,
            components: [],
            onChange: () => {},
        });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);

        modal.querySelector('#btn-add-new-component').addEventListener('click', () => {
            newComponentsPicker.addComponentRow();
        });

        modal.querySelector('#btn-save-new-components').addEventListener('click', async () => {
            await this._saveNewComponents(newComponentsPicker);
        });
    }

    _renderExistingComponents(batch) {
        const { fibers, sizingAgents, fillers } = this._state;
        if (!batch.components || batch.components.length === 0) {
            return '<p class="text-gray-500 text-center py-4">暂无成分</p>';
        }

        return batch.components.map(comp => {
            const name = NewAPI.materials.getMaterialName(comp, fibers, sizingAgents, fillers);
            const colorClass = UIKit.getMaterialTypeColor(comp.material_type);
            return `
                <div class="flex gap-2 items-center p-3 bg-white border border-gray-200 rounded-lg">
                    <span class="chip ${colorClass}">${UIKit.getMaterialTypeName(comp.material_type)}</span>
                    <span class="font-medium">${name}</span>
                    <span class="text-gray-500">配比: ${comp.ratio}</span>
                    ${comp.notes ? `<span class="text-gray-400 text-sm">(${comp.notes})</span>` : ''}
                    <div class="flex-1"></div>
                    <button class="btn btn-sm btn-danger" onclick="BatchesPage.deleteComponent(${batch.id}, ${comp.id})">删除</button>
                </div>
            `;
        }).join('');
    }

    async _saveNewComponents(picker) {
        if (!this._componentModal) return;
        const { batchId, close } = this._componentModal;
        const components = picker.getValidComponents();

        if (components.length === 0) {
            UIKit.toast('请至少添加一个有效成分', 'warning');
            return;
        }

        try {
            for (const comp of components) {
                await NewAPI.batches.addComponent(batchId, comp);
            }
            UIKit.toast(`成功添加 ${components.length} 个成分`, 'success');
            close();
            this._componentModal = null;
            await this._refreshData();
        } catch (error) {
            this.handleError(error, '保存失败');
        }
    }

    async deleteComponent(batchId, compId) {
        UIKit.confirm(
            '确定要删除该成分吗？',
            async () => {
                try {
                    await this.safeCall(NewAPI.batches.deleteComponent(batchId, compId), {
                        successMsg: '成分删除成功',
                        errorMsg: '删除失败',
                    });
                    await this._refreshData();
                    const batch = this._state.batches.find(b => b.id === batchId);
                    if (batch && this._componentModal?.modal) {
                        const container = this._componentModal.modal.querySelector('#existing-components');
                        if (container) {
                            container.innerHTML = this._renderExistingComponents(batch);
                        }
                    }
                } catch (_) {}
            },
            { title: '删除成分', confirmText: '确认删除', type: 'danger' }
        );
    }

    async sealBatch(id) {
        UIKit.confirm(
            '确定要封存该批次吗？封存后将无法修改配浆成分。',
            async () => {
                try {
                    await this.safeCall(NewAPI.batches.seal(id), {
                        successMsg: '批次已封存',
                        errorMsg: '封存失败',
                    });
                    await this._refreshData();
                } catch (_) {}
            },
            { title: '封存批次', confirmText: '确认封存', type: 'warning' }
        );
    }

    async unsealBatch(id) {
        UIKit.confirm(
            '确定要解封该批次吗？解封后可以继续修改配浆成分。',
            async () => {
                try {
                    await this.safeCall(NewAPI.batches.unseal(id), {
                        successMsg: '批次已解封',
                        errorMsg: '解封失败',
                    });
                    await this._refreshData();
                } catch (_) {}
            },
            { title: '解封批次', confirmText: '确认解封', type: 'primary' }
        );
    }

    async toggleHidden(id) {
        try {
            await this.safeCall(NewAPI.batches.toggleHidden(id), {
                successMsg: '状态更新成功',
                errorMsg: '操作失败',
            });
            await this._refreshData();
        } catch (_) {}
    }

    async deleteBatch(id) {
        const batch = this._state.batches.find(b => b.id === id);
        if (!batch) return;

        const hasObservations = await this._checkHasObservations(id);
        const doDelete = async () => {
            try {
                await this.safeCall(NewAPI.batches.delete(id, true), {
                    successMsg: '批次删除成功',
                    errorMsg: '删除失败',
                });
                await this._refreshData();
            } catch (_) {}
        };

        if (hasObservations) {
            UIKit.confirmWithSecondary(
                `⚠️ 批次 "${batch.batch_no}" 已有关联的成纸观察记录！\n\n删除将同时清除所有相关的抄纸记录和观察数据。\n\n请再次确认是否要删除？`,
                '这是二次确认！你真的确定要删除该批次及其所有关联数据吗？',
                doDelete,
                { title: '删除批次', confirmText: '确认删除', secondaryConfirmText: '彻底删除' }
            );
        } else {
            UIKit.confirm(
                `确定要删除批次 "${batch.batch_no}" 吗？此操作不可恢复。`,
                async () => {
                    try {
                        await this.safeCall(NewAPI.batches.delete(id, false), {
                            successMsg: '批次删除成功',
                            errorMsg: '删除失败',
                        });
                        await this._refreshData();
                    } catch (_) {}
                },
                { title: '删除批次', confirmText: '确认删除', type: 'danger' }
            );
        }
    }

    async _checkHasObservations(batchId) {
        try {
            const records = await NewAPI.records.listBatchPapermaking(batchId);
            for (const record of records) {
                const observations = await NewAPI.records.listObservations(record.id);
                if (observations.length > 0) return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    viewDetail(batchId) {
        window.location.hash = `#/compare?batchId=${batchId}`;
    }

    viewBatchImages(batchId) {
        const batch = this._state.batches.find(b => b.id === batchId);
        if (!batch) return;
        window.location.hash = `#/compare?batchId=${batchId}`;
        setTimeout(() => {
            if (ComparePage.viewMode !== 'imageTimeline') {
                ComparePage.switchViewMode('imageTimeline');
            }
        }, 500);
    }
}

window.BatchesPage = new BatchesPageImpl();
