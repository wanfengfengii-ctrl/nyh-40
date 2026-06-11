class RecordsPageImpl extends PageState {
    constructor() {
        super({
            pageTitle: '📝 抄纸记录与成纸观察',
            initialState: {
                batches: [],
                selectedBatchId: null,
                papermakingRecords: [],
                expandedRecordIds: new Set(),
                observationsMap: new Map(),
            },
        });
    }

    setPage() {
        this.setActions(this._renderActions());
        UIKit.setPage(this.pageTitle, this.pageActions, '');
    }

    _renderActions() {
        const { batches, selectedBatchId } = this._state;
        const hasBatch = !!selectedBatchId;

        const batchOptions = batches.map(b => `
            <option value="${b.id}" ${b.id === selectedBatchId ? 'selected' : ''} ${b.hidden ? 'class="text-gray-400"' : ''}>
                ${b.batch_no} ${b.hidden ? '(已隐藏)' : ''}
            </option>
        `).join('');

        return `
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                    <label class="text-sm text-gray-600">选择批次：</label>
                    <select id="batch-selector" class="select w-48" onchange="RecordsPage.onBatchChange(this.value)">
                        <option value="">-- 请选择批次 --</option>
                        ${batchOptions}
                    </select>
                </div>
                <button id="add-record-btn" class="btn btn-success" onclick="RecordsPage.openCreateRecordModal()" ${hasBatch ? '' : 'disabled'}>
                    ➕ 新增抄纸记录
                </button>
            </div>
        `;
    }

    async loadData() {
        const batches = await NewAPI.batches.list();
        this._state.batches = batches;

        const { selectedBatchId, expandedRecordIds } = this._state;
        if (selectedBatchId) {
            await this._loadRecordsAndObservations(selectedBatchId, expandedRecordIds);
        }
    }

    async _loadRecordsAndObservations(batchId, expandedIds) {
        this._state.papermakingRecords = await NewAPI.records.listBatchPapermaking(batchId);

        const loadPromises = [];
        for (const record of this._state.papermakingRecords) {
            if (expandedIds.has(record.id) && !this._state.observationsMap.has(record.id)) {
                loadPromises.push(this._loadObservationsIntoMap(record.id));
            }
        }
        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }
    }

    async _loadObservationsIntoMap(recordId) {
        try {
            const observations = await NewAPI.records.listObservations(recordId);
            this._state.observationsMap.set(recordId, observations);
        } catch (error) {
            this.handleError(error, '加载成纸观察失败');
        }
    }

    async onBatchChange(batchId) {
        const parsedId = batchId ? parseInt(batchId) : null;
        this._state.selectedBatchId = parsedId;

        if (parsedId) {
            try {
                UIKit.loading(true);
                this._state.observationsMap = new Map();
                this._state.expandedRecordIds = new Set();
                await this._loadRecordsAndObservations(parsedId, this._state.expandedRecordIds);
            } catch (error) {
                this.handleError(error, '加载抄纸记录失败');
            } finally {
                UIKit.loading(false);
            }
        } else {
            this._state.papermakingRecords = [];
            this._state.expandedRecordIds.clear();
            this._state.observationsMap.clear();
        }

        this.setActions(this._renderActions());
        this.render();
    }

    async toggleExpand(recordId) {
        const { expandedRecordIds, observationsMap } = this._state;
        if (expandedRecordIds.has(recordId)) {
            expandedRecordIds.delete(recordId);
        } else {
            expandedRecordIds.add(recordId);
            if (!observationsMap.has(recordId)) {
                await this._loadObservationsIntoMap(recordId);
            }
        }
        this.render();
    }

    render() {
        const { selectedBatchId, papermakingRecords } = this._state;

        if (!selectedBatchId) {
            this.setContent(this.empty('请先选择一个批次以查看抄纸记录', '📋'));
            return;
        }

        if (papermakingRecords.length === 0) {
            this.setContent(this.empty('暂无抄纸记录，请点击右上角新增抄纸记录', '📝'));
            return;
        }

        const content = this._renderCards();
        this.setContent(content);
    }

    _renderCards() {
        return `
            <div class="space-y-3">
                ${this._state.papermakingRecords.map(record => this._renderRecordCard(record)).join('')}
            </div>
        `;
    }

    _renderRecordCard(record) {
        const { expandedRecordIds, observationsMap } = this._state;
        const isExpanded = expandedRecordIds.has(record.id);
        const observations = observationsMap.get(record.id) || [];
        const avgRating = observations.length > 0
            ? (observations.reduce((sum, o) => sum + (o.overall_rating || 0), 0) / observations.length).toFixed(1)
            : null;

        return `
            <div class="card overflow-hidden">
                <div class="p-4" onclick="RecordsPage.toggleExpand(${record.id})" style="cursor: pointer;">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="text-2xl">${isExpanded ? '▼' : '▶'}</div>
                            <div>
                                <div class="flex items-center gap-3">
                                    <span class="font-medium text-gray-800">📅 ${UIKit.formatDate(record.paper_date)}</span>
                                    <span class="text-gray-600">👤 ${record.operator || '-'}</span>
                                    ${avgRating ? `<span class="text-yellow-500">${UIKit.getRatingStars(parseFloat(avgRating))}</span>` : ''}
                                </div>
                                ${record.notes ? `<p class="text-sm text-gray-500 mt-1">${record.notes}</p>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2" onclick="event.stopPropagation()">
                            <span class="text-sm text-gray-400">${observations.length} 条观察</span>
                            <button class="btn btn-sm btn-outline" onclick="RecordsPage.viewRecordImages(${record.id})">📷 图片</button>
                            <button class="btn btn-sm btn-outline" onclick="RecordsPage.openEditRecordModal(${record.id})">编辑</button>
                            <button class="btn btn-sm btn-danger" onclick="RecordsPage.deleteRecord(${record.id})">删除</button>
                        </div>
                    </div>
                </div>
                ${isExpanded ? this._renderObservationSection(record.id, observations) : ''}
            </div>
        `;
    }

    _renderObservationSection(recordId, observations) {
        const content = this._renderObservationsTable(recordId, observations);
        return `
            <div class="border-t border-gray-100 bg-gray-50">
                <div class="p-4">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-medium text-gray-700">🔍 成纸观察记录</h4>
                        <button class="btn btn-sm btn-primary" onclick="RecordsPage.openCreateObservationModal(${recordId})">
                            ➕ 新增观察
                        </button>
                    </div>
                    ${content}
                </div>
            </div>
        `;
    }

    _renderObservationsTable(recordId, observations) {
        if (observations.length === 0) {
            return '<p class="text-center text-gray-500 py-8">暂无观察记录</p>';
        }

        return `
            <div class="overflow-x-auto">
                <table class="w-full bg-white rounded-lg overflow-hidden">
                    <thead class="bg-gray-100">
                        <tr>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">厚度(mm)</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">抗张强度(kN/m)</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">吸墨性</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">颜色</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">纹理</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">综合评分</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">备注</th>
                            <th class="px-3 py-2 text-left text-xs font-medium text-gray-600">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${observations.map(obs => `
                            <tr class="border-t border-gray-100 hover:bg-gray-50">
                                <td class="px-3 py-2 text-sm text-gray-700">${obs.thickness || '-'}</td>
                                <td class="px-3 py-2 text-sm text-gray-700">${obs.tensile_strength || '-'}</td>
                                <td class="px-3 py-2 text-sm text-gray-700">${obs.absorbency || '-'}</td>
                                <td class="px-3 py-2 text-sm text-gray-700">${obs.color || '-'}</td>
                                <td class="px-3 py-2 text-sm text-gray-700">${obs.texture || '-'}</td>
                                <td class="px-3 py-2 text-sm">
                                    ${obs.overall_rating ? `<span class="text-yellow-500">${UIKit.getRatingStars(obs.overall_rating)}</span>` : '-'}
                                </td>
                                <td class="px-3 py-2 text-sm text-gray-600 max-w-xs truncate" title="${obs.notes || ''}">${obs.notes || '-'}</td>
                                <td class="px-3 py-2">
                                    <div class="flex gap-1">
                                        <button class="btn btn-xs btn-outline" onclick="RecordsPage.viewObservationImages(${recordId}, ${obs.id})">📷</button>
                                        <button class="btn btn-xs btn-outline" onclick="RecordsPage.openEditObservationModal(${recordId}, ${obs.id})">编辑</button>
                                        <button class="btn btn-xs btn-danger" onclick="RecordsPage.deleteObservation(${recordId}, ${obs.id})">删除</button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    _getRecordFields() {
        const today = new Date().toISOString().split('T')[0];
        return [
            { name: 'paper_date', key: 'paper_date', label: '抄纸日期', type: 'date', required: true, value: today },
            { name: 'operator', key: 'operator', label: '操作人员', type: 'text', placeholder: '请输入操作人员姓名', required: true },
            { name: 'notes', key: 'notes', label: '备注', type: 'textarea', placeholder: '请输入备注信息' },
        ];
    }

    _getRecordRules() {
        return {
            paper_date: { required: true, label: '抄纸日期' },
            operator: { required: true, label: '操作人员' },
        };
    }

    openCreateRecordModal() {
        const { selectedBatchId } = this._state;
        if (!selectedBatchId) {
            UIKit.toast('请先选择批次', 'warning');
            return;
        }

        FormManager.createCreate({
            title: '新增抄纸记录',
            width: '500px',
            submitText: '创建记录',
            fields: this._getRecordFields(),
            rules: this._getRecordRules(),
            api: NewAPI.records,
            apiMethod: (data) => NewAPI.records.createPapermaking(selectedBatchId, data),
            successMsg: '抄纸记录创建成功',
            errorMsg: '创建失败',
            onSuccess: async () => {
                await this._refreshRecords();
            },
        });
    }

    openEditRecordModal(recordId) {
        const record = this._state.papermakingRecords.find(r => r.id === recordId);
        if (!record) return;

        FormManager.createEdit(
            {
                title: '编辑抄纸记录',
                width: '500px',
                submitText: '保存修改',
                fields: this._getRecordFields().filter(f => f.value === undefined || f.key !== 'paper_date'),
                rules: this._getRecordRules(),
                api: NewAPI.records,
                apiMethod: (id, data) => NewAPI.records.updatePapermaking(id, data),
                successMsg: '抄纸记录更新成功',
                errorMsg: '更新失败',
                onSuccess: async () => {
                    await this._refreshRecords();
                },
            },
            recordId,
            record
        );
    }

    async deleteRecord(recordId) {
        const record = this._state.papermakingRecords.find(r => r.id === recordId);
        if (!record) return;

        const observations = this._state.observationsMap.get(recordId) || [];
        const doDelete = async () => {
            try {
                await this.safeCall(NewAPI.records.deletePapermaking(recordId), {
                    successMsg: '抄纸记录删除成功',
                    errorMsg: '删除失败',
                });
                this._state.expandedRecordIds.delete(recordId);
                this._state.observationsMap.delete(recordId);
                await this._refreshRecords();
            } catch (_) {
            }
        };

        if (observations.length > 0) {
            UIKit.confirmWithSecondary(
                `⚠️ 该抄纸记录已关联 ${observations.length} 条成纸观察记录！\n\n删除将同时清除所有相关观察数据。\n\n请再次确认是否要删除？`,
                '这是二次确认！你真的确定要删除该记录及其所有关联观察数据吗？',
                doDelete,
                { title: '删除抄纸记录', confirmText: '确认删除', secondaryConfirmText: '彻底删除' }
            );
        } else {
            UIKit.confirm(
                '确定要删除这条抄纸记录吗？此操作不可恢复。',
                doDelete,
                { title: '删除抄纸记录', confirmText: '确认删除', type: 'danger' }
            );
        }
    }

    _getObservationFields() {
        return [
            { name: 'thickness', key: 'thickness', label: '厚度 (mm)', type: 'number', step: 0.01, min: 0, placeholder: '例如: 0.15', gridCols: 1 },
            { name: 'tensile_strength', key: 'tensile_strength', label: '抗张强度 (kN/m)', type: 'number', step: 0.01, min: 0, placeholder: '例如: 2.5', gridCols: 1 },
            { name: 'absorbency', key: 'absorbency', label: '吸墨性', type: 'number', step: 0.01, min: 0, placeholder: '例如: 0.8', gridCols: 1 },
            { name: 'color', key: 'color', label: '颜色', type: 'text', placeholder: '例如: 米白色', gridCols: 1 },
            { name: 'texture', key: 'texture', label: '纹理', type: 'text', placeholder: '例如: 细腻', gridCols: 1 },
            { name: 'overall_rating', key: 'overall_rating', label: '综合评分 (1-10)', type: 'range', min: 1, max: 10, step: 1, value: 5, required: true },
            { name: 'notes', key: 'notes', label: '备注', type: 'textarea', placeholder: '请输入备注信息' },
        ];
    }

    _getObservationRules() {
        return {
            overall_rating: { required: true, label: '综合评分' },
        };
    }

    openCreateObservationModal(recordId) {
        const fields = this._getObservationFields();
        FormManager.open({
            title: '新增成纸观察',
            width: '600px',
            submitText: '创建观察',
            layout: 'grid',
            fields,
            rules: this._getObservationRules(),
            onSubmit: async (data, { close }) => {
                await this.safeCall(NewAPI.records.createObservation(recordId, data), {
                    successMsg: '成纸观察创建成功',
                    errorMsg: '创建失败',
                });
                close();
                await this._refreshObservations(recordId);
            },
        });
    }

    openEditObservationModal(recordId, observationId) {
        const observations = this._state.observationsMap.get(recordId) || [];
        const observation = observations.find(o => o.id === observationId);
        if (!observation) return;

        const fields = this._getObservationFields();
        FormManager.open({
            title: '编辑成纸观察',
            width: '600px',
            submitText: '保存修改',
            layout: 'grid',
            fields,
            rules: this._getObservationRules(),
            initialValues: observation,
            onSubmit: async (data, { close }) => {
                await this.safeCall(NewAPI.records.updateObservation(observationId, data), {
                    successMsg: '成纸观察更新成功',
                    errorMsg: '更新失败',
                });
                close();
                await this._refreshObservations(recordId);
            },
        });
    }

    async deleteObservation(recordId, observationId) {
        UIKit.confirm(
            '确定要删除这条成纸观察记录吗？此操作不可恢复。',
            async () => {
                try {
                    await this.safeCall(NewAPI.records.deleteObservation(observationId), {
                        successMsg: '成纸观察删除成功',
                        errorMsg: '删除失败',
                    });
                    await this._refreshObservations(recordId);
                } catch (_) {
                }
            },
            { title: '删除成纸观察', confirmText: '确认删除', type: 'danger' }
        );
    }

    viewRecordImages(recordId) {
        if (typeof ImagesPage === 'undefined' || !ImagesPage.openImageManager) {
            UIKit.toast('图片管理模块未加载', 'warning');
            return;
        }
        ImagesPage.openImageManager({
            title: `抄纸记录 #${recordId} - 图片管理`,
            recordId: recordId,
            batchId: this._state.selectedBatchId,
            defaultCategory: 'wet_paper',
        });
    }

    viewObservationImages(recordId, observationId) {
        if (typeof ImagesPage === 'undefined' || !ImagesPage.openImageManager) {
            UIKit.toast('图片管理模块未加载', 'warning');
            return;
        }
        ImagesPage.openImageManager({
            title: `成纸观察 #${observationId} - 图片管理`,
            observationId: observationId,
            recordId: recordId,
            batchId: this._state.selectedBatchId,
            defaultCategory: 'microscopy',
        });
    }

    async _refreshRecords() {
        const { selectedBatchId, expandedRecordIds } = this._state;
        if (!selectedBatchId) return;
        try {
            await this._loadRecordsAndObservations(selectedBatchId, expandedRecordIds);
        } catch (error) {
            this.handleError(error, '加载抄纸记录失败');
        }
        this.setActions(this._renderActions());
        this.render();
    }

    async _refreshObservations(recordId) {
        this._state.observationsMap.delete(recordId);
        if (this._state.expandedRecordIds.has(recordId)) {
            await this._loadObservationsIntoMap(recordId);
        }
        this.render();
    }
}

window.RecordsPage = new RecordsPageImpl();
