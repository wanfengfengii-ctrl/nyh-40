class ConcentrationsPageImpl extends PageState {
    constructor() {
        super({
            pageTitle: '🧫 槽液浓度记录',
            initialState: {
                batches: [],
                selectedBatchId: null,
                concentrations: [],
            },
        });
        this.chart = null;
    }

    async mount() {
        this.setPage();
        UIKit.loading(true);
        try {
            await this.loadData();
        } catch (error) {
            this.handleError(error, '加载数据失败');
        } finally {
            UIKit.loading(false);
        }
        this.render();
    }

    setPage() {
        this.setActions(this._renderActions());
        UIKit.setPage(this.pageTitle, this.pageActions, '');
    }

    _renderActions() {
        const { selectedBatchId } = this._state;
        return `
            <button class="btn btn-success" onclick="ConcentrationsPage.openAddModal()" ${!selectedBatchId ? 'disabled' : ''}>
                ➕ 新增记录
            </button>
        `;
    }

    async loadData() {
        this._state.batches = await NewAPI.batches.list();
        if (this._state.batches.length > 0 && !this._state.selectedBatchId) {
            this._state.selectedBatchId = this._state.batches[0].id;
        }
        if (this._state.selectedBatchId) {
            this._state.concentrations = await NewAPI.batches.getConcentrations(this._state.selectedBatchId);
        }
    }

    getSelectedBatch() {
        const { batches, selectedBatchId } = this._state;
        return batches.find(b => b.id === selectedBatchId);
    }

    render() {
        const { batches } = this._state;
        if (batches.length === 0) {
            this.setContent(UIKit.emptyState('暂无批次数据，请先在批次管理中创建批次', '📦'));
            return;
        }

        const selectedBatch = this.getSelectedBatch();
        const sealedWarning = selectedBatch?.is_sealed
            ? `<div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                 <span class="text-amber-600 text-xl">⚠️</span>
                 <span class="text-amber-800">该批次已封存，但仍可添加浓度记录</span>
               </div>`
            : '';

        const batchOptions = batches.map(batch => `
            <option value="${batch.id}" ${batch.id === this._state.selectedBatchId ? 'selected' : ''}>
                ${batch.batch_no} ${batch.is_sealed ? '(已封存)' : ''}
            </option>
        `).join('');

        const content = `
            <div class="mb-6 flex gap-4 items-center">
                <div class="flex-1">
                    <label class="label">选择批次</label>
                    <select class="select" onchange="ConcentrationsPage.onBatchChange(this.value)">
                        ${batchOptions}
                    </select>
                </div>
                ${selectedBatch ? `
                <div class="flex-1">
                    <label class="label">批次状态</label>
                    <div class="pt-2">${UIKit.getStatusBadge(selectedBatch.is_sealed, selectedBatch.hidden)}</div>
                </div>
                ` : ''}
            </div>

            ${sealedWarning}

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="card">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">📈 浓度变化趋势</h3>
                    <div class="h-80">
                        <canvas id="concentration-chart"></canvas>
                    </div>
                </div>

                <div class="card overflow-hidden">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4 p-4 pb-0">📋 浓度记录列表</h3>
                    ${this.renderTable()}
                </div>
            </div>
        `;

        this.setContent(content);
        this.renderChart();
    }

    renderTable() {
        const { concentrations } = this._state;
        if (concentrations.length === 0) {
            return UIKit.emptyState('暂无浓度记录，请点击右上角新增记录', '🧫');
        }

        const sortedConcentrations = [...concentrations].sort((a, b) =>
            new Date(b.measured_at) - new Date(a.measured_at)
        );

        return `
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">测量时间</th>
                        <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">浓度值</th>
                        <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">备注</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedConcentrations.map(conc => `
                        <tr class="border-b border-gray-100">
                            <td class="px-4 py-3 text-gray-600 text-sm">${UIKit.formatDateTime(conc.measured_at)}</td>
                            <td class="px-4 py-3 font-medium text-gray-800">${conc.value}</td>
                            <td class="px-4 py-3 text-gray-600 max-w-xs truncate" title="${conc.notes || ''}">${conc.notes || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderChart() {
        const canvas = document.getElementById('concentration-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const sortedData = [...this._state.concentrations].sort((a, b) =>
            new Date(a.measured_at) - new Date(b.measured_at)
        );

        const labels = sortedData.map(conc => UIKit.formatDateTime(conc.measured_at));
        const values = sortedData.map(conc => conc.value);

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '浓度值',
                    data: values,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: 'rgb(59, 130, 246)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `浓度: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 10
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '浓度值'
                        }
                    }
                }
            }
        });
    }

    async onBatchChange(batchId) {
        this._state.selectedBatchId = parseInt(batchId);
        UIKit.loading(true);
        try {
            this._state.concentrations = await NewAPI.batches.getConcentrations(this._state.selectedBatchId);
            this.setActions(this._renderActions());
            this.render();
        } catch (error) {
            this.handleError(error, '加载浓度记录失败');
        } finally {
            UIKit.loading(false);
        }
    }

    openAddModal() {
        const { selectedBatchId } = this._state;
        if (!selectedBatchId) {
            UIKit.toast('请先选择一个批次', 'warning');
            return;
        }

        const selectedBatch = this.getSelectedBatch();
        const sealedNotice = selectedBatch?.is_sealed
            ? `<div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                 ⚠️ 该批次已封存，但仍可添加浓度记录
               </div>`
            : '';

        const fields = [
            { name: 'value', key: 'value', label: '浓度值 *', type: 'number', step: 0.01, min: 0, placeholder: '请输入浓度值', required: true },
            { name: 'measured_at', key: 'measured_at', label: '测量时间', type: 'datetime-local', placeholder: '不填则默认为当前时间' },
            { name: 'notes', key: 'notes', label: '备注', type: 'textarea', placeholder: '请输入备注', rows: 3 },
        ];

        FormManager.open({
            title: '新增浓度记录',
            width: '500px',
            submitText: '保存',
            extraContent: {
                beforeFields: sealedNotice,
            },
            fields,
            rules: {
                value: { required: true, label: '浓度值', min: 0 },
            },
            onSubmit: async (data, { close }) => {
                const submitData = {
                    value: parseFloat(data.value),
                    notes: data.notes || null,
                };

                if (data.measured_at) {
                    submitData.measured_at = new Date(data.measured_at).toISOString();
                }

                await this.safeCall(NewAPI.batches.addConcentration(selectedBatchId, submitData), {
                    successMsg: '浓度记录添加成功',
                    errorMsg: '添加失败',
                });
                close();
                await this._refreshConcentrations();
            },
        });
    }

    async _refreshConcentrations() {
        const { selectedBatchId } = this._state;
        if (!selectedBatchId) return;
        try {
            this._state.concentrations = await NewAPI.batches.getConcentrations(selectedBatchId);
        } catch (error) {
            this.handleError(error, '加载浓度记录失败');
        }
        this.render();
    }

    unmount() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        super.unmount();
    }
}

window.ConcentrationsPage = new ConcentrationsPageImpl();
