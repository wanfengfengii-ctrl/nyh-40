const RecordsPage = {
    batches: [],
    selectedBatchId: null,
    papermakingRecords: [],
    expandedRecordIds: new Set(),
    observationsMap: new Map(),

    async mount() {
        App.setPageTitle('📝 抄纸记录与成纸观察');
        App.setPageActions(`
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                    <label class="text-sm text-gray-600">选择批次：</label>
                    <select id="batch-selector" class="select w-48" onchange="RecordsPage.onBatchChange(this.value)">
                        <option value="">-- 请选择批次 --</option>
                    </select>
                </div>
                <button id="add-record-btn" class="btn btn-success" onclick="RecordsPage.openCreateRecordModal()" disabled>
                    ➕ 新增抄纸记录
                </button>
            </div>
        `);
        loading(true);
        await this.loadBatches();
    },

    async loadBatches() {
        try {
            this.batches = await API.batches.list();
            this.renderBatchSelector();
            loading(false);
            this.renderEmptyState();
        } catch (error) {
            showToast('加载批次列表失败: ' + error.message, 'error');
            loading(false);
        }
    },

    renderBatchSelector() {
        const selector = document.getElementById('batch-selector');
        if (!selector) return;
        
        selector.innerHTML = `
            <option value="">-- 请选择批次 --</option>
            ${this.batches.map(b => `
                <option value="${b.id}" ${b.hidden ? 'class="text-gray-400"' : ''}>
                    ${b.batch_no} ${b.hidden ? '(已隐藏)' : ''}
                </option>
            `).join('')}
        `;
    },

    async onBatchChange(batchId) {
        this.selectedBatchId = batchId ? parseInt(batchId) : null;
        const addBtn = document.getElementById('add-record-btn');
        if (addBtn) {
            addBtn.disabled = !this.selectedBatchId;
        }
        
        if (this.selectedBatchId) {
            loading(true);
            await this.loadRecords();
            loading(false);
            this.render();
        } else {
            this.papermakingRecords = [];
            this.expandedRecordIds.clear();
            this.observationsMap.clear();
            this.renderEmptyState();
        }
    },

    async loadRecords() {
        if (!this.selectedBatchId) return;
        
        try {
            this.papermakingRecords = await API.records.listBatchPapermaking(this.selectedBatchId);
            for (const record of this.papermakingRecords) {
                if (this.expandedRecordIds.has(record.id)) {
                    await this.loadObservations(record.id);
                }
            }
        } catch (error) {
            showToast('加载抄纸记录失败: ' + error.message, 'error');
        }
    },

    async loadObservations(recordId) {
        try {
            const observations = await API.records.listObservations(recordId);
            this.observationsMap.set(recordId, observations);
        } catch (error) {
            showToast('加载成纸观察失败: ' + error.message, 'error');
        }
    },

    renderEmptyState() {
        App.setPageContent(emptyState('请先选择一个批次以查看抄纸记录', '📋'));
    },

    render() {
        if (!this.selectedBatchId) {
            this.renderEmptyState();
            return;
        }

        if (this.papermakingRecords.length === 0) {
            App.setPageContent(emptyState('暂无抄纸记录，请点击右上角新增抄纸记录', '📝'));
            return;
        }

        App.setPageContent(`
            <div class="space-y-3">
                ${this.papermakingRecords.map(record => this.renderRecordCard(record)).join('')}
            </div>
        `);
    },

    renderRecordCard(record) {
        const isExpanded = this.expandedRecordIds.has(record.id);
        const observations = this.observationsMap.get(record.id) || [];
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
                                    <span class="font-medium text-gray-800">📅 ${formatDate(record.paper_date)}</span>
                                    <span class="text-gray-600">👤 ${record.operator || '-'}</span>
                                    ${avgRating ? `<span class="text-yellow-500">${getRatingStars(parseFloat(avgRating))}</span>` : ''}
                                </div>
                                ${record.notes ? `<p class="text-sm text-gray-500 mt-1">${record.notes}</p>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center gap-2" onclick="event.stopPropagation()">
                            <span class="text-sm text-gray-400">${observations.length} 条观察</span>
                            <button class="btn btn-sm btn-outline" onclick="RecordsPage.openEditRecordModal(${record.id})">编辑</button>
                            <button class="btn btn-sm btn-danger" onclick="RecordsPage.deleteRecord(${record.id})">删除</button>
                        </div>
                    </div>
                </div>
                ${isExpanded ? `
                    <div class="border-t border-gray-100 bg-gray-50">
                        <div class="p-4">
                            <div class="flex items-center justify-between mb-3">
                                <h4 class="font-medium text-gray-700">🔍 成纸观察记录</h4>
                                <button class="btn btn-sm btn-primary" onclick="RecordsPage.openCreateObservationModal(${record.id})">
                                    ➕ 新增观察
                                </button>
                            </div>
                            ${this.renderObservationsTable(record.id, observations)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderObservationsTable(recordId, observations) {
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
                                    ${obs.overall_rating ? `<span class="text-yellow-500">${getRatingStars(obs.overall_rating)}</span>` : '-'}
                                </td>
                                <td class="px-3 py-2 text-sm text-gray-600 max-w-xs truncate" title="${obs.notes || ''}">${obs.notes || '-'}</td>
                                <td class="px-3 py-2">
                                    <div class="flex gap-1">
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
    },

    async toggleExpand(recordId) {
        if (this.expandedRecordIds.has(recordId)) {
            this.expandedRecordIds.delete(recordId);
        } else {
            this.expandedRecordIds.add(recordId);
            if (!this.observationsMap.has(recordId)) {
                await this.loadObservations(recordId);
            }
        }
        this.render();
    },

    openCreateRecordModal() {
        if (!this.selectedBatchId) {
            showToast('请先选择批次', 'warning');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const content = `
            <form id="record-form" class="space-y-4">
                <div>
                    <label class="label">抄纸日期 *</label>
                    <input type="date" name="paper_date" class="input" value="${today}" required>
                </div>
                <div>
                    <label class="label">操作人员 *</label>
                    <input type="text" name="operator" class="input" placeholder="请输入操作人员姓名" required>
                </div>
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea" placeholder="请输入备注信息"></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">创建记录</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '新增抄纸记录', width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#record-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                paper_date: formData.get('paper_date'),
                operator: formData.get('operator'),
                notes: formData.get('notes') || null,
            };

            const errors = validateForm(formData, {
                paper_date: { required: true, label: '抄纸日期' },
                operator: { required: true, label: '操作人员' },
            });

            if (errors.length > 0) {
                showToast(errors.join('，'), 'error');
                return;
            }

            try {
                await API.records.createPapermaking(this.selectedBatchId, data);
                showToast('抄纸记录创建成功', 'success');
                close();
                await this.loadRecords();
                this.render();
            } catch (error) {
                showToast('创建失败: ' + error.message, 'error');
            }
        });
    },

    openEditRecordModal(recordId) {
        const record = this.papermakingRecords.find(r => r.id === recordId);
        if (!record) return;

        const content = `
            <form id="record-form" class="space-y-4">
                <div>
                    <label class="label">抄纸日期 *</label>
                    <input type="date" name="paper_date" class="input" value="${record.paper_date}" required>
                </div>
                <div>
                    <label class="label">操作人员 *</label>
                    <input type="text" name="operator" class="input" value="${record.operator || ''}" required>
                </div>
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea">${record.notes || ''}</textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">保存修改</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '编辑抄纸记录', width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#record-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                paper_date: formData.get('paper_date'),
                operator: formData.get('operator'),
                notes: formData.get('notes') || null,
            };

            const errors = validateForm(formData, {
                paper_date: { required: true, label: '抄纸日期' },
                operator: { required: true, label: '操作人员' },
            });

            if (errors.length > 0) {
                showToast(errors.join('，'), 'error');
                return;
            }

            try {
                await API.records.updatePapermaking(recordId, data);
                showToast('抄纸记录更新成功', 'success');
                close();
                await this.loadRecords();
                this.render();
            } catch (error) {
                showToast('更新失败: ' + error.message, 'error');
            }
        });
    },

    async deleteRecord(recordId) {
        const record = this.papermakingRecords.find(r => r.id === recordId);
        if (!record) return;

        const observations = this.observationsMap.get(recordId) || [];
        let message = `确定要删除这条抄纸记录吗？`;
        let needSecondaryConfirm = false;

        if (observations.length > 0) {
            message = `⚠️ 该抄纸记录已关联 ${observations.length} 条成纸观察记录！\n\n删除将同时清除所有相关观察数据。\n\n请再次确认是否要删除？`;
            needSecondaryConfirm = true;
        }

        const doDelete = async () => {
            try {
                await API.records.deletePapermaking(recordId);
                showToast('抄纸记录删除成功', 'success');
                this.expandedRecordIds.delete(recordId);
                this.observationsMap.delete(recordId);
                await this.loadRecords();
                this.render();
            } catch (error) {
                showToast('删除失败: ' + error.message, 'error');
            }
        };

        if (needSecondaryConfirm) {
            showConfirmModal(
                message,
                () => {
                    showConfirmModal(
                        '这是二次确认！你真的确定要删除该记录及其所有关联观察数据吗？',
                        doDelete,
                        { title: '二次确认删除', confirmText: '彻底删除', type: 'danger' }
                    );
                },
                { title: '删除抄纸记录', confirmText: '确认删除', type: 'danger' }
            );
        } else {
            showConfirmModal(
                message,
                doDelete,
                { title: '删除抄纸记录', confirmText: '确认删除', type: 'danger' }
            );
        }
    },

    openCreateObservationModal(recordId) {
        const content = `
            <form id="observation-form" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label">厚度 (mm)</label>
                        <input type="number" name="thickness" class="input" step="0.01" min="0" placeholder="例如: 0.15">
                    </div>
                    <div>
                        <label class="label">抗张强度 (kN/m)</label>
                        <input type="number" name="tensile_strength" class="input" step="0.01" min="0" placeholder="例如: 2.5">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="label">吸墨性</label>
                        <input type="number" name="absorbency" class="input" step="0.01" min="0" placeholder="例如: 0.8">
                    </div>
                    <div>
                        <label class="label">颜色</label>
                        <input type="text" name="color" class="input" placeholder="例如: 米白色">
                    </div>
                    <div>
                        <label class="label">纹理</label>
                        <input type="text" name="texture" class="input" placeholder="例如: 细腻">
                    </div>
                </div>
                <div>
                    <label class="label">综合评分 (1-10) *</label>
                    <input type="range" name="overall_rating" class="w-full" min="1" max="10" value="5" step="1" 
                           oninput="document.getElementById('rating-display').textContent = this.value">
                    <div class="text-center text-2xl font-bold text-yellow-500" id="rating-display">5</div>
                </div>
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea" placeholder="请输入备注信息"></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">创建观察</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '新增成纸观察', width: '600px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#observation-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                thickness: formData.get('thickness') ? parseFloat(formData.get('thickness')) : null,
                tensile_strength: formData.get('tensile_strength') ? parseFloat(formData.get('tensile_strength')) : null,
                absorbency: formData.get('absorbency') ? parseFloat(formData.get('absorbency')) : null,
                color: formData.get('color') || null,
                texture: formData.get('texture') || null,
                overall_rating: parseInt(formData.get('overall_rating')),
                notes: formData.get('notes') || null,
            };

            try {
                await API.records.createObservation(recordId, data);
                showToast('成纸观察创建成功', 'success');
                close();
                await this.loadObservations(recordId);
                this.render();
            } catch (error) {
                showToast('创建失败: ' + error.message, 'error');
            }
        });
    },

    openEditObservationModal(recordId, observationId) {
        const observations = this.observationsMap.get(recordId) || [];
        const observation = observations.find(o => o.id === observationId);
        if (!observation) return;

        const content = `
            <form id="observation-form" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="label">厚度 (mm)</label>
                        <input type="number" name="thickness" class="input" step="0.01" min="0" value="${observation.thickness || ''}">
                    </div>
                    <div>
                        <label class="label">抗张强度 (kN/m)</label>
                        <input type="number" name="tensile_strength" class="input" step="0.01" min="0" value="${observation.tensile_strength || ''}">
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-4">
                    <div>
                        <label class="label">吸墨性</label>
                        <input type="number" name="absorbency" class="input" step="0.01" min="0" value="${observation.absorbency || ''}">
                    </div>
                    <div>
                        <label class="label">颜色</label>
                        <input type="text" name="color" class="input" value="${observation.color || ''}">
                    </div>
                    <div>
                        <label class="label">纹理</label>
                        <input type="text" name="texture" class="input" value="${observation.texture || ''}">
                    </div>
                </div>
                <div>
                    <label class="label">综合评分 (1-10) *</label>
                    <input type="range" name="overall_rating" class="w-full" min="1" max="10" value="${observation.overall_rating || 5}" step="1" 
                           oninput="document.getElementById('rating-display').textContent = this.value">
                    <div class="text-center text-2xl font-bold text-yellow-500" id="rating-display">${observation.overall_rating || 5}</div>
                </div>
                <div>
                    <label class="label">备注</label>
                    <textarea name="notes" class="textarea">${observation.notes || ''}</textarea>
                </div>
                <div class="flex justify-end gap-2 pt-4">
                    <button type="button" class="btn btn-outline modal-close-btn">取消</button>
                    <button type="submit" class="btn btn-primary">保存修改</button>
                </div>
            </form>
        `;

        const { modal, close } = showModal(content, { title: '编辑成纸观察', width: '600px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#observation-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = {
                thickness: formData.get('thickness') ? parseFloat(formData.get('thickness')) : null,
                tensile_strength: formData.get('tensile_strength') ? parseFloat(formData.get('tensile_strength')) : null,
                absorbency: formData.get('absorbency') ? parseFloat(formData.get('absorbency')) : null,
                color: formData.get('color') || null,
                texture: formData.get('texture') || null,
                overall_rating: parseInt(formData.get('overall_rating')),
                notes: formData.get('notes') || null,
            };

            try {
                await API.records.updateObservation(observationId, data);
                showToast('成纸观察更新成功', 'success');
                close();
                await this.loadObservations(recordId);
                this.render();
            } catch (error) {
                showToast('更新失败: ' + error.message, 'error');
            }
        });
    },

    async deleteObservation(recordId, observationId) {
        showConfirmModal(
            '确定要删除这条成纸观察记录吗？此操作不可恢复。',
            async () => {
                try {
                    await API.records.deleteObservation(observationId);
                    showToast('成纸观察删除成功', 'success');
                    await this.loadObservations(recordId);
                    this.render();
                } catch (error) {
                    showToast('删除失败: ' + error.message, 'error');
                }
            },
            { title: '删除成纸观察', confirmText: '确认删除', type: 'danger' }
        );
    },

    unmount() {},
};
