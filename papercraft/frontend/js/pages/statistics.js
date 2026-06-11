const StatisticsPage = {
    data: null,
    filterType: 'all',
    sortOrder: 'desc',
    chart: null,

    async mount() {
        App.setPageTitle('📊 材料占比统计');
        App.setPageActions('');
        loading(true);
        await this.loadData();
        this.render();
    },

    async loadData() {
        try {
            this.data = await API.statistics.materialProportion();
        } catch (error) {
            showToast('加载数据失败: ' + error.message, 'error');
        }
    },

    getFilteredItems() {
        if (!this.data || !this.data.items) return [];
        
        let items = [...this.data.items];
        
        if (this.filterType !== 'all') {
            items = items.filter(item => item.material_type === this.filterType);
        }
        
        items.sort((a, b) => {
            if (this.sortOrder === 'desc') {
                return b.ratio_percentage - a.ratio_percentage;
            } else {
                return a.ratio_percentage - b.ratio_percentage;
            }
        });
        
        return items;
    },

    getMaterialChartColors(materialType) {
        const baseColors = {
            fiber: { bg: 'rgb(34, 197, 94)', border: 'rgb(21, 128, 61)' },
            sizing: { bg: 'rgb(59, 130, 246)', border: 'rgb(29, 78, 216)' },
            filler: { bg: 'rgb(168, 85, 247)', border: 'rgb(126, 34, 206)' },
        };
        return baseColors[materialType] || { bg: 'rgb(156, 163, 175)', border: 'rgb(107, 114, 128)' };
    },

    getProgressBarColor(materialType) {
        const colors = {
            fiber: 'bg-green-500',
            sizing: 'bg-blue-500',
            filler: 'bg-purple-500',
        };
        return colors[materialType] || 'bg-gray-500';
    },

    render() {
        if (!this.data) {
            App.setPageContent(emptyState('加载数据失败，请稍后重试', '📊'));
            return;
        }

        const filteredItems = this.getFilteredItems();
        const groupedItems = this.groupByType(filteredItems);

        App.setPageContent(`
            ${this.renderStatsCards()}
            
            <div class="mb-6 flex flex-wrap gap-4 items-center justify-between">
                ${this.renderFilterButtons()}
                ${this.renderSortButton()}
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div class="card">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">🥧 材料占比分布图</h3>
                    <div class="h-80">
                        <canvas id="proportion-chart"></canvas>
                    </div>
                </div>

                <div class="card overflow-hidden">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4 p-4 pb-0">📋 材料占比详情</h3>
                    ${this.renderTable(groupedItems)}
                </div>
            </div>
        `);

        this.renderChart();
    },

    renderStatsCards() {
        const batchCount = this.data.batch_count || 0;
        const totalRatioSum = this.data.total_ratio_sum || 0;
        const materialCount = this.data.items?.length || 0;

        return `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div class="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-blue-600 font-medium">批次数量</p>
                            <p class="text-3xl font-bold text-blue-800 mt-1">${batchCount}</p>
                        </div>
                        <div class="text-4xl text-blue-400">📦</div>
                    </div>
                </div>
                <div class="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-green-600 font-medium">总配比之和</p>
                            <p class="text-3xl font-bold text-green-800 mt-1">${totalRatioSum.toFixed(2)}</p>
                        </div>
                        <div class="text-4xl text-green-400">⚖️</div>
                    </div>
                </div>
                <div class="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-sm text-purple-600 font-medium">材料种类</p>
                            <p class="text-3xl font-bold text-purple-800 mt-1">${materialCount}</p>
                        </div>
                        <div class="text-4xl text-purple-400">🧪</div>
                    </div>
                </div>
            </div>
        `;
    },

    renderFilterButtons() {
        const filters = [
            { id: 'all', name: '全部', icon: '📋' },
            { id: 'fiber', name: '纤维', icon: '🌾' },
            { id: 'sizing', name: '胶料', icon: '🧴' },
            { id: 'filler', name: '填料', icon: '💎' },
        ];

        return `
            <div class="flex gap-2 bg-gray-100 rounded-lg p-1">
                ${filters.map(filter => `
                    <button 
                        class="px-4 py-2 rounded-md text-sm font-medium transition-colors ${this.filterType === filter.id ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}"
                        onclick="StatisticsPage.setFilter('${filter.id}')"
                    >
                        ${filter.icon} ${filter.name}
                    </button>
                `).join('')}
            </div>
        `;
    },

    renderSortButton() {
        const sortIcon = this.sortOrder === 'desc' ? '⬇️' : '⬆️';
        const sortText = this.sortOrder === 'desc' ? '降序' : '升序';

        return `
            <button 
                class="btn btn-outline"
                onclick="StatisticsPage.toggleSort()"
            >
                ${sortIcon} 按占比${sortText}
            </button>
        `;
    },

    groupByType(items) {
        const groups = {
            fiber: [],
            sizing: [],
            filler: [],
        };
        
        items.forEach(item => {
            if (groups[item.material_type]) {
                groups[item.material_type].push(item);
            }
        });
        
        return groups;
    },

    renderTable(groupedItems) {
        const filteredItems = this.getFilteredItems();
        
        if (filteredItems.length === 0) {
            return emptyState('暂无符合条件的数据', '📭');
        }

        const typeOrder = ['fiber', 'sizing', 'filler'];
        let tableHtml = `
            <table class="w-full">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">材料名称</th>
                        <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">材料类型</th>
                        <th class="px-4 py-3 text-right text-sm font-medium text-gray-600">总配比</th>
                        <th class="px-4 py-3 text-right text-sm font-medium text-gray-600">占比</th>
                        <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 w-40">进度</th>
                    </tr>
                </thead>
                <tbody>
        `;

        if (this.filterType === 'all') {
            typeOrder.forEach(type => {
                if (groupedItems[type].length > 0) {
                    tableHtml += this.renderTypeSection(type, groupedItems[type]);
                }
            });
        } else {
            filteredItems.forEach(item => {
                tableHtml += this.renderItemRow(item);
            });
        }

        tableHtml += `
                </tbody>
            </table>
        `;

        return tableHtml;
    },

    renderTypeSection(type, items) {
        if (items.length === 0) return '';

        const typeName = getMaterialTypeName(type);
        const colorClass = getMaterialTypeColor(type);
        const typeTotal = items.reduce((sum, item) => sum + item.total_ratio, 0);
        const typePercentage = items.reduce((sum, item) => sum + item.ratio_percentage, 0);

        return `
            <tr class="bg-gray-100">
                <td colspan="5" class="px-4 py-2">
                    <div class="flex items-center justify-between">
                        <span class="chip ${colorClass} font-medium">${typeName}</span>
                        <span class="text-sm text-gray-600">
                            ${items.length} 种材料 · 总配比 ${typeTotal.toFixed(2)} · 占比 ${typePercentage.toFixed(2)}%
                        </span>
                    </div>
                </td>
            </tr>
            ${items.map(item => this.renderItemRow(item)).join('')}
        `;
    },

    renderItemRow(item) {
        const typeName = getMaterialTypeName(item.material_type);
        const colorClass = getMaterialTypeColor(item.material_type);
        const progressColor = this.getProgressBarColor(item.material_type);
        const percentage = item.ratio_percentage || 0;

        return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="px-4 py-3 font-medium text-gray-800">${item.material_name}</td>
                <td class="px-4 py-3">
                    <span class="badge ${colorClass}">${typeName}</span>
                </td>
                <td class="px-4 py-3 text-right text-gray-700 font-medium">${item.total_ratio.toFixed(2)}</td>
                <td class="px-4 py-3 text-right text-gray-800 font-bold">${percentage.toFixed(2)}%</td>
                <td class="px-4 py-3">
                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                        <div class="${progressColor} h-2.5 rounded-full transition-all duration-500" style="width: ${Math.min(percentage, 100)}%"></div>
                    </div>
                </td>
            </tr>
        `;
    },

    renderChart() {
        const canvas = document.getElementById('proportion-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (this.chart) {
            this.chart.destroy();
        }

        const items = this.getFilteredItems();
        
        if (items.length === 0) {
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
            return;
        }

        const labels = items.map(item => item.material_name);
        const data = items.map(item => item.ratio_percentage);
        const colors = items.map(item => this.getMaterialChartColors(item.material_type).bg);
        const borderColors = items.map(item => this.getMaterialChartColors(item.material_type).border);

        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    hoverOffset: 10,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const item = items[context.dataIndex];
                                return `${label}: ${value.toFixed(2)}% (配比: ${item.total_ratio.toFixed(2)})`;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw: function(chart) {
                    const { ctx, chartArea: { left, top, width, height } } = chart;
                    ctx.save();
                    
                    const centerX = left + width / 2;
                    const centerY = top + height / 2;
                    
                    const total = items.reduce((sum, item) => sum + item.ratio_percentage, 0);
                    
                    ctx.font = 'bold 20px sans-serif';
                    ctx.fillStyle = '#1F2937';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${total.toFixed(1)}%`, centerX, centerY - 8);
                    
                    ctx.font = '11px sans-serif';
                    ctx.fillStyle = '#6B7280';
                    ctx.fillText('总占比', centerX, centerY + 12);
                    
                    ctx.restore();
                }
            }]
        });
    },

    setFilter(filterType) {
        this.filterType = filterType;
        this.render();
    },

    toggleSort() {
        this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
        this.render();
    },

    unmount() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    },
};
