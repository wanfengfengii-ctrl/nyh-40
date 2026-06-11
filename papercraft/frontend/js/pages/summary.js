const SummaryPage = {
    data: null,
    fiberChart: null,
    sizingChart: null,
    fillerChart: null,

    async mount() {
        App.setPageTitle('📈 实验阶段总结');
        App.setPageActions(`
            <button class="btn btn-primary" onclick="SummaryPage.refresh()">
                🔄 刷新数据
            </button>
        `);
        loading(true);
        await this.loadData();
        this.render();
    },

    async loadData() {
        try {
            this.data = await API.statistics.summary();
        } catch (error) {
            showToast('加载总结数据失败: ' + error.message, 'error');
            this.data = null;
        }
    },

    async refresh() {
        loading(true);
        this.destroyCharts();
        await this.loadData();
        this.render();
        showToast('数据已刷新', 'success');
    },

    render() {
        if (!this.data) {
            App.setPageContent(emptyState('加载数据失败，请点击刷新按钮重试', '❌'));
            return;
        }

        App.setPageContent(`
            <div class="space-y-6">
                ${this.renderOverviewCards()}
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="card">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">🌿 纤维分布</h3>
                        <div class="h-72">
                            <canvas id="fiber-chart"></canvas>
                        </div>
                    </div>
                    <div class="card">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">🧪 胶料分布</h3>
                        <div class="h-72">
                            <canvas id="sizing-chart"></canvas>
                        </div>
                    </div>
                    <div class="card">
                        <h3 class="text-lg font-semibold text-gray-800 mb-4">⛏️ 填料分布</h3>
                        <div class="h-72">
                            <canvas id="filler-chart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `);

        this.renderCharts();
    },

    renderOverviewCards() {
        const d = this.data;
        const cards = [
            {
                icon: '📦',
                title: '总批次数量',
                value: d.total_batches || 0,
                color: 'bg-blue-50 border-blue-200',
                iconColor: 'text-blue-500',
            },
            {
                icon: '👁️',
                title: '可见批次',
                value: d.visible_batches || 0,
                color: 'bg-green-50 border-green-200',
                iconColor: 'text-green-500',
            },
            {
                icon: '🔒',
                title: '已封存批次',
                value: d.sealed_batches || 0,
                color: 'bg-amber-50 border-amber-200',
                iconColor: 'text-amber-500',
            },
            {
                icon: '📄',
                title: '抄纸记录总数',
                value: d.total_papermaking_records || 0,
                color: 'bg-purple-50 border-purple-200',
                iconColor: 'text-purple-500',
            },
            {
                icon: '🔬',
                title: '成纸观察总数',
                value: d.total_observations || 0,
                color: 'bg-cyan-50 border-cyan-200',
                iconColor: 'text-cyan-500',
            },
            {
                icon: '⭐',
                title: '平均综合评分',
                value: d.avg_overall_rating ? getRatingStars(parseFloat(d.avg_overall_rating)) : '-',
                color: 'bg-yellow-50 border-yellow-200',
                iconColor: 'text-yellow-500',
            },
            {
                icon: '📅',
                title: '实验时间跨度',
                value: this.formatDateRange(d.date_range),
                color: 'bg-rose-50 border-rose-200',
                iconColor: 'text-rose-500',
            },
            {
                icon: '🧫',
                title: '槽液浓度统计',
                value: this.formatConcentrationStats(d.concentration_stats),
                color: 'bg-indigo-50 border-indigo-200',
                iconColor: 'text-indigo-500',
            },
        ];

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                ${cards.map(card => this.renderCard(card)).join('')}
            </div>
        `;
    },

    renderCard(card) {
        return `
            <div class="p-4 rounded-lg border ${card.color}">
                <div class="flex items-start justify-between">
                    <div>
                        <p class="text-sm text-gray-600 mb-1">${card.title}</p>
                        <p class="text-2xl font-bold text-gray-800">${card.value}</p>
                    </div>
                    <span class="text-3xl ${card.iconColor}">${card.icon}</span>
                </div>
            </div>
        `;
    },

    formatDateRange(dateRange) {
        if (!dateRange || (!dateRange.earliest && !dateRange.latest)) {
            return '-';
        }
        const earliest = dateRange.earliest ? formatDate(dateRange.earliest) : '-';
        const latest = dateRange.latest ? formatDate(dateRange.latest) : '-';
        return `<span class="text-sm">${earliest} ~ ${latest}</span>`;
    },

    formatConcentrationStats(stats) {
        if (!stats || stats.count === 0) {
            return '-';
        }
        const min = stats.min?.toFixed(2) || '-';
        const max = stats.max?.toFixed(2) || '-';
        const avg = stats.avg?.toFixed(2) || '-';
        return `<span class="text-xs text-gray-600">最小: ${min} | 最大: ${max}<br>平均: ${avg}</span>`;
    },

    renderCharts() {
        this.renderFiberChart();
        this.renderSizingChart();
        this.renderFillerChart();
    },

    renderFiberChart() {
        const canvas = document.getElementById('fiber-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.data.fiber_distribution || {};
        const labels = Object.keys(data);
        const values = Object.values(data);

        const colors = labels.map(() => 'rgba(34, 197, 94, 0.7)');
        const borderColors = labels.map(() => 'rgb(22, 163, 74)');

        this.fiberChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '配比',
                    data: values,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,
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
                                return `配比: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '配比'
                        }
                    }
                }
            }
        });
    },

    renderSizingChart() {
        const canvas = document.getElementById('sizing-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.data.sizing_distribution || {};
        const labels = Object.keys(data);
        const values = Object.values(data);

        const colors = labels.map(() => 'rgba(59, 130, 246, 0.7)');
        const borderColors = labels.map(() => 'rgb(37, 99, 235)');

        this.sizingChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '配比',
                    data: values,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,
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
                                return `配比: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '配比'
                        }
                    }
                }
            }
        });
    },

    renderFillerChart() {
        const canvas = document.getElementById('filler-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.data.filler_distribution || {};
        const labels = Object.keys(data);
        const values = Object.values(data);

        const colors = labels.map(() => 'rgba(168, 85, 247, 0.7)');
        const borderColors = labels.map(() => 'rgb(147, 51, 234)');

        this.fillerChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '配比',
                    data: values,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 4,
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
                                return `配比: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '配比'
                        }
                    }
                }
            }
        });
    },

    destroyCharts() {
        if (this.fiberChart) {
            this.fiberChart.destroy();
            this.fiberChart = null;
        }
        if (this.sizingChart) {
            this.sizingChart.destroy();
            this.sizingChart = null;
        }
        if (this.fillerChart) {
            this.fillerChart.destroy();
            this.fillerChart = null;
        }
    },

    unmount() {
        this.destroyCharts();
    },
};
