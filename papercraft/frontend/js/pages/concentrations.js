const ConcentrationsPage = {
    batches: [],
    selectedBatchId: null,
    concentrations: [],
    chart: null,

    async mount() {
        App.setPageTitle('🧫 槽液浓度记录');
        App.setPageActions(`
            <button class="btn btn-success" onclick="ConcentrationsPage.openAddModal()" ${!this.selectedBatchId ? 'disabled' : ''}>
                ➕ 新增记录
            </button>
        `);
        loading(true);
        await this.loadData();
        this.render();
    },

    async loadData() {
        try {
            this.batches = await API.batches.list();
            if (this.batches.length > 0 && !this.selectedBatchId) {
                this.selectedBatchId = this.batches[0].id;
            }
            if (this.selectedBatchId) {
                this.concentrations = await API.batches.getConcentrations(this.selectedBatchId);
            }
        } catch (error) {
            showToast('加载数据失败: ' + error.message, 'error');
        }
    },

    getSelectedBatch() {
        return this.batches.find(b => b.id === this.selectedBatchId);
    },

    render() {
        if (this.batches.length === 0) {
            App.setPageContent(emptyState('暂无批次数据，请先在批次管理中创建批次', '📦'));
            return;
        }

        const selectedBatch = this.getSelectedBatch();
        const sealedWarning = selectedBatch?.is_sealed
            ? `<div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                 <span class="text-amber-600 text-xl">⚠️</span>
                 <span class="text-amber-800">该批次已封存，但仍可添加浓度记录</span>
               </div>`
            : '';

        const batchOptions = this.batches.map(batch => `
            <option value="${batch.id}" ${batch.id === this.selectedBatchId ? 'selected' : ''}>
                ${batch.batch_no} ${batch.is_sealed ? '(已封存)' : ''}
            </option>
        `).join('');

        App.setPageContent(`
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
                    <div class="pt-2">${getStatusBadge(selectedBatch.is_sealed, selectedBatch.hidden)}</div>
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
        `);

        this.renderChart();
    },

    renderTable() {
        if (this.concentrations.length === 0) {
            return emptyState('暂无浓度记录，请点击右上角新增记录', '🧫');
        }

        const sortedConcentrations = [...this.concentrations].sort((a, b) => 
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
                            <td class="px-4 py-3 text-gray-600 text-sm">${formatDateTime(conc.measured_at)}</td>
                            <td class="px-4 py-3 font-medium text-gray-800">${conc.value}</td>
                            <td class="px-4 py-3 text-gray-600 max-w-xs truncate" title="${conc.notes || ''}">${conc.notes || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    renderChart() {
        const canvas = document.getElementById('concentration-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const sortedData = [...this.concentrations].sort((a, b) => 
            new Date(a.measured_at) - new Date(b.measured_at)
        );

        const labels = sortedData.map(conc => formatDateTime(conc.measured_at));
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
    },

    async onBatchChange(batchId) {
        this.selectedBatchId = parseInt(batchId);
        loading(true);
        try {
            this.concentrations = await API.batches.getConcentrations(this.selectedBatchId);
            this.render();
        } catch (error) {
            showToast('加载浓度记录失败: ' + error.message, 'error');
            loading(false);
        }
    },

    openAddModal() {
        if (!this.selectedBatchId) {
            showToast('请先选择一个批次', 'warning');
            return;
        }

        const selectedBatch = this.getSelectedBatch();
        const sealedNotice = selectedBatch?.is_sealed 
            ? `<div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                 ⚠️ 该批次已封存，但仍可添加浓度记录
               </div>`
            : '';

        const content = `
            <form id="concentration-form" class="space-y-4">
                ${sealedNotice}
                <div>
                    <label class="label">浓度值 *</label>
                    <input type="number" name="value" class="input" step="0.01" min="0" placeholder="请输入浓度值" required>
                </div>
                <div>
                    <label class="label">测量时间</label>
                    <input type="datetime-local" name="measured_at" class="input">
                    <p class="text-xs text-gray-500 mt-1">不填则默认为当前时间</p>
                </div>
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

        const { modal, close } = showModal(content, { title: '新增浓度记录', width: '500px' });

        modal.querySelector('.modal-close-btn').addEventListener('click', close);
        modal.querySelector('#concentration-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const rules = {
                value: { required: true, label: '浓度值', min: 0 },
            };

            const errors = validateForm(formData, rules);
            if (errors.length > 0) {
                showToast(errors[0], 'error');
                return;
            }

            const data = {
                value: parseFloat(formData.get('value')),
                notes: formData.get('notes') || null,
            };

            const measuredAt = formData.get('measured_at');
            if (measuredAt) {
                data.measured_at = new Date(measuredAt).toISOString();
            }

            try {
                await API.batches.addConcentration(this.selectedBatchId, data);
                showToast('浓度记录添加成功', 'success');
                close();
                this.concentrations = await API.batches.getConcentrations(this.selectedBatchId);
                this.render();
            } catch (error) {
                showToast('添加失败: ' + error.message, 'error');
            }
        });
    },

    unmount() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    },
};
