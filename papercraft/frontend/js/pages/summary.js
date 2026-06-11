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
                ${this.renderImageSummary()}
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

    renderImageSummary() {
        const imgSummary = this.data.image_summary;
        if (!imgSummary || imgSummary.total_images === 0) {
            return `
                <div class="card">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">📷 实验图片汇总</h3>
                    <div class="text-center py-8 text-gray-400">
                        <div class="text-4xl mb-2">📷</div>
                        <p>暂无实验图片数据</p>
                        <p class="text-sm mt-1">请在材料、批次、抄纸记录或成纸观察中上传图片</p>
                    </div>
                </div>
            `;
        }

        const byCategory = imgSummary.by_category || {};
        const categoryLabels = {
            raw_material: '🌾 原料',
            wet_paper: '💧 湿纸页',
            dry_paper: '📄 成纸',
            microscopy: '🔬 显微结构',
        };

        const typicalSummary = imgSummary.typical_summary || [];

        return `
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-800">📷 实验图片汇总</h3>
                    <div class="flex items-center gap-4 text-sm text-gray-500">
                        <span>共 ${imgSummary.total_images} 张</span>
                        <span>可见 ${imgSummary.visible_images} 张</span>
                        <span>⭐ 典型 ${imgSummary.typical_images} 张</span>
                    </div>
                </div>
                <div class="grid grid-cols-4 gap-4 mb-6">
                    ${Object.entries(categoryLabels).map(([key, label]) => `
                        <div class="text-center p-3 bg-gray-50 rounded-lg">
                            <div class="text-2xl font-bold text-gray-800">${byCategory[key] || 0}</div>
                            <div class="text-sm text-gray-500">${label}</div>
                        </div>
                    `).join('')}
                </div>
                ${typicalSummary.length > 0 ? `
                    <div class="border-t pt-4">
                        <h4 class="font-medium text-gray-700 mb-4">⭐ 典型图例与观察结论</h4>
                        <div class="space-y-6">
                            ${typicalSummary.map(section => this.renderTypicalSection(section)).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderTypicalSection(section) {
        const images = section.images || [];
        const notes = section.observation_notes || [];

        return `
            <div>
                <h5 class="font-medium text-gray-800 mb-3">${section.category_name}</h5>
                <div class="grid grid-cols-1 lg:grid-cols-${Math.min(images.length + 1, 3)} gap-4">
                    <div class="grid grid-cols-${Math.min(images.length, 4)} gap-3">
                        ${images.map(img => `
                            <div class="border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                                 onclick="ImagesPage.openImageDetail(${img.id})">
                                <div class="aspect-video bg-gray-100 overflow-hidden">
                                    <img src="${API.images.getFileUrl(img.id)}" class="w-full h-full object-contain"
                                         onerror="this.parentElement.innerHTML='<span class=\\'text-3xl text-gray-300 flex items-center justify-center h-full\\'>📷</span>'">
                                </div>
                                <div class="p-2">
                                    <p class="text-xs font-medium text-gray-800 truncate">${img.title || img.file_name}</p>
                                    ${img.description ? `<p class="text-xs text-gray-500 line-clamp-2">${img.description}</p>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ${notes.length > 0 ? `
                        <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <h6 class="font-medium text-amber-800 mb-2">📝 观察结论</h6>
                            <ul class="space-y-2">
                                ${notes.map(note => `
                                    <li class="text-sm text-amber-700 flex items-start gap-2">
                                        <span class="text-amber-400 mt-1">•</span>
                                        <span>${note}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    unmount() {
        this.destroyCharts();
    },
};
