const ComparePage = {
    mode: 'detail',
    viewMode: 'info',
    batches: [],
    selectedBatchIds: [],
    compareData: null,
    traceData: null,
    singleBatchId: null,
    fibers: [],
    sizingAgents: [],
    fillers: [],

    async mount() {
        App.setPageTitle('🔍 批次对比与回溯');
        loading(true);

        this.parseUrlParams();
        await this.loadAllData();

        if (this.singleBatchId) {
            await this.loadTraceData(this.singleBatchId);
            this.mode = 'detail';
            this.viewMode = 'info';
        }

        App.setPageActions(this.renderPageActions());
        this.render();
    },

    parseUrlParams() {
        const hash = window.location.hash;
        const queryMatch = hash.match(/\?(.*)/);
        if (queryMatch) {
            const params = new URLSearchParams(queryMatch[1]);
            const batchId = params.get('batchId');
            if (batchId) {
                this.singleBatchId = parseInt(batchId);
                this.selectedBatchIds = [this.singleBatchId];
            }
        }
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

    async loadTraceData(batchId) {
        try {
            this.traceData = await API.statistics.trace(batchId);
        } catch (error) {
            showToast('加载回溯数据失败: ' + error.message, 'error');
            this.traceData = null;
        }
    },

    async loadCompareData() {
        if (this.selectedBatchIds.length < 2) {
            showToast('请至少选择两个批次进行对比', 'warning');
            return;
        }
        try {
            this.compareData = await API.statistics.compare(this.selectedBatchIds);
        } catch (error) {
            showToast('加载对比数据失败: ' + error.message, 'error');
            this.compareData = null;
        }
    },

    renderPageActions() {
        return `
            <div class="flex gap-2">
                <div class="flex bg-gray-100 rounded-lg p-1">
                    <button 
                        class="px-4 py-2 rounded-md text-sm font-medium transition-colors ${this.mode === 'detail' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}"
                        onclick="ComparePage.switchMode('detail')"
                    >
                        📋 详情模式
                    </button>
                    <button 
                        class="px-4 py-2 rounded-md text-sm font-medium transition-colors ${this.mode === 'compare' ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-800'}"
                        onclick="ComparePage.switchMode('compare')"
                    >
                        ⚖️ 对比模式
                    </button>
                </div>
            </div>
        `;
    },

    render() {
        App.setPageActions(this.renderPageActions());

        if (this.mode === 'detail') {
            this.renderDetailMode();
        } else {
            this.renderCompareMode();
        }
    },

    renderDetailMode() {
        const content = `
            <div class="space-y-6">
                ${this.renderBatchSelector()}
                ${this.selectedBatchIds.length > 0 ? this.renderBatchDetailCard() : ''}
                ${this.selectedBatchIds.length > 0 ? this.renderViewTabs() : ''}
                ${this.selectedBatchIds.length > 0 && this.viewMode === 'info' ? this.renderBatchInfo() : ''}
                ${this.selectedBatchIds.length > 0 && this.viewMode === 'timeline' ? this.renderTimeline() : ''}
            </div>
        `;
        App.setPageContent(content);
    },

    renderCompareMode() {
        const content = `
            <div class="space-y-6">
                ${this.renderBatchSelector(true)}
                ${this.selectedBatchIds.length >= 2 ? this.renderCompareTable() : this.renderCompareEmpty()}
            </div>
        `;
        App.setPageContent(content);
    },

    renderBatchSelector(multiSelect = false) {
        const displayBatches = this.batches.filter(b => !b.hidden);

        if (multiSelect) {
            return `
                <div class="card">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-semibold text-gray-800">选择批次对比</h3>
                        <div class="flex gap-2">
                            <span class="text-sm text-gray-500">已选择 ${this.selectedBatchIds.length} 个批次</span>
                            ${this.selectedBatchIds.length >= 2 ? `
                                <button class="btn btn-sm btn-primary" onclick="ComparePage.doCompare()">开始对比</button>
                            ` : ''}
                            ${this.selectedBatchIds.length > 0 ? `
                                <button class="btn btn-sm btn-outline" onclick="ComparePage.clearSelection()">清空选择</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-80 overflow-y-auto">
                        ${displayBatches.map(batch => this.renderBatchCheckbox(batch)).join('')}
                    </div>
                </div>
            `;
        }

        return `
            <div class="card">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-semibold text-gray-800">选择批次</h3>
                    ${this.selectedBatchIds.length > 0 ? `
                        <button class="btn btn-sm btn-outline" onclick="ComparePage.clearSelection()">清空选择</button>
                    ` : ''}
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-80 overflow-y-auto">
                    ${displayBatches.map(batch => this.renderBatchCard(batch)).join('')}
                </div>
            </div>
        `;
    },

    renderBatchCheckbox(batch) {
        const isSelected = this.selectedBatchIds.includes(batch.id);
        return `
            <label class="flex items-start gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}">
                <input 
                    type="checkbox" 
                    class="mt-1 w-4 h-4 text-blue-600" 
                    ${isSelected ? 'checked' : ''}
                    onchange="ComparePage.toggleBatchSelection(${batch.id}, this.checked)"
                >
                <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-800 truncate">${batch.batch_no}</div>
                    <div class="text-xs text-gray-500">${getStatusBadge(batch.is_sealed, batch.hidden)}</div>
                    <div class="text-xs text-gray-400 mt-1">${formatDate(batch.created_at)}</div>
                </div>
            </label>
        `;
    },

    renderBatchCard(batch) {
        const isSelected = this.selectedBatchIds.includes(batch.id);
        return `
            <div 
                class="p-3 border-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}"
                onclick="ComparePage.selectSingleBatch(${batch.id})"
            >
                <div class="font-medium text-gray-800 truncate">${batch.batch_no}</div>
                <div class="text-xs mt-1">${getStatusBadge(batch.is_sealed, batch.hidden)}</div>
                <div class="text-xs text-gray-400 mt-1">${formatDate(batch.created_at)}</div>
                <div class="flex flex-wrap gap-1 mt-2">
                    ${(batch.components || []).slice(0, 3).map(comp => {
                        const colorClass = getMaterialTypeColor(comp.material_type);
                        return `<span class="chip ${colorClass} text-xs">${this.getMaterialName(comp)}</span>`;
                    }).join('')}
                    ${(batch.components || []).length > 3 ? `<span class="text-xs text-gray-400">+${batch.components.length - 3}</span>` : ''}
                </div>
            </div>
        `;
    },

    renderBatchDetailCard() {
        const batchId = this.selectedBatchIds[0];
        const batch = this.batches.find(b => b.id === batchId);
        if (!batch) return '';

        const components = batch.components || [];
        const totalRatio = components.reduce((sum, c) => sum + c.ratio, 0);

        return `
            <div class="card">
                <div class="flex items-start justify-between">
                    <div>
                        <h2 class="text-xl font-bold text-gray-800">${batch.batch_no}</h2>
                        <div class="flex items-center gap-3 mt-2">
                            ${getStatusBadge(batch.is_sealed, batch.hidden)}
                            <span class="text-sm text-gray-500">创建时间: ${formatDateTime(batch.created_at)}</span>
                            <span class="text-sm text-gray-500">更新时间: ${formatDateTime(batch.updated_at)}</span>
                        </div>
                        ${batch.notes ? `<p class="text-gray-600 mt-2">${batch.notes}</p>` : ''}
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-sm btn-outline" onclick="ComparePage.switchToCompare(${batch.id})">⚖️ 加入对比</button>
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-100">
                    <h4 class="font-medium text-gray-700 mb-3">配方成分</h4>
                    <div class="flex flex-wrap gap-2">
                        ${components.map(comp => {
                            const name = this.getMaterialName(comp);
                            const colorClass = getMaterialTypeColor(comp.material_type);
                            return `<span class="chip ${colorClass}">${name}: ${comp.ratio}</span>`;
                        }).join('') || '<span class="text-gray-400">暂无成分</span>'}
                    </div>
                    ${totalRatio > 0 ? `<div class="text-sm text-gray-500 mt-2">总计配比: ${totalRatio.toFixed(2)}</div>` : ''}
                </div>
            </div>
        `;
    },

    renderViewTabs() {
        const tabs = [
            { id: 'info', name: '基本信息', icon: '📋' },
            { id: 'timeline', name: '回溯时间线', icon: '⏱️' },
        ];

        return `
            <div class="flex gap-2 border-b border-gray-200">
                ${tabs.map(tab => `
                    <button 
                        class="px-6 py-3 font-medium transition-colors relative ${this.viewMode === tab.id ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}"
                        onclick="ComparePage.switchViewMode('${tab.id}')"
                    >
                        ${tab.icon} ${tab.name}
                    </button>
                `).join('')}
            </div>
        `;
    },

    renderBatchInfo() {
        const batchId = this.selectedBatchIds[0];
        const batch = this.batches.find(b => b.id === batchId);
        if (!batch) return emptyState('未找到批次信息', '❓');

        const components = batch.components || [];
        const groupedComponents = {
            fiber: components.filter(c => c.material_type === 'fiber'),
            sizing: components.filter(c => c.material_type === 'sizing'),
            filler: components.filter(c => c.material_type === 'filler'),
        };

        return `
            <div class="card">
                <h3 class="font-semibold text-gray-800 mb-4">配方详情</h3>
                <div class="space-y-6">
                    ${Object.entries(groupedComponents).map(([type, items]) => {
                        if (items.length === 0) return '';
                        const typeName = getMaterialTypeName(type);
                        const colorClass = getMaterialTypeColor(type);
                        const typeTotal = items.reduce((sum, c) => sum + c.ratio, 0);
                        return `
                            <div>
                                <div class="flex items-center justify-between mb-2">
                                    <span class="chip ${colorClass} font-medium">${typeName}</span>
                                    <span class="text-sm text-gray-500">小计: ${typeTotal.toFixed(2)}</span>
                                </div>
                                <table class="w-full text-sm">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-4 py-2 text-left text-gray-600 font-medium">材料名称</th>
                                            <th class="px-4 py-2 text-left text-gray-600 font-medium">配比</th>
                                            <th class="px-4 py-2 text-left text-gray-600 font-medium">备注</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${items.map(comp => `
                                            <tr class="border-b border-gray-100">
                                                <td class="px-4 py-2 font-medium text-gray-800">${this.getMaterialName(comp)}</td>
                                                <td class="px-4 py-2 text-gray-600">${comp.ratio}</td>
                                                <td class="px-4 py-2 text-gray-500">${comp.notes || '-'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    renderTimeline() {
        if (!this.traceData) {
            return `
                <div class="card text-center py-8">
                    <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p class="text-gray-500">正在加载回溯数据...</p>
                </div>
            `;
        }

        const events = this.collectTimelineEvents();
        if (events.length === 0) {
            return emptyState('暂无历史事件记录', '📭');
        }

        return `
            <div class="card">
                <h3 class="font-semibold text-gray-800 mb-4">完整回溯时间线</h3>
                <div class="relative">
                    <div class="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                    <div class="space-y-6">
                        ${events.map(event => this.renderTimelineEvent(event)).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    collectTimelineEvents() {
        const events = [];

        if (this.traceData.concentrations) {
            this.traceData.concentrations.forEach(conc => {
                events.push({
                    type: 'concentration',
                    time: conc.measured_at || conc.created_at,
                    data: conc,
                });
            });
        }

        if (this.traceData.papermaking_records) {
            this.traceData.papermaking_records.forEach(record => {
                events.push({
                    type: 'papermaking',
                    time: record.paper_date || record.created_at,
                    data: record,
                });

                if (record.observations) {
                    record.observations.forEach(obs => {
                        events.push({
                            type: 'observation',
                            time: obs.created_at,
                            data: obs,
                            parentRecord: record,
                        });
                    });
                }
            });
        }

        if (this.traceData.batch) {
            events.push({
                type: 'batch_created',
                time: this.traceData.batch.created_at,
                data: this.traceData.batch,
            });
        }

        events.sort((a, b) => new Date(b.time) - new Date(a.time));
        return events;
    },

    renderTimelineEvent(event) {
        const icons = {
            concentration: '📊',
            papermaking: '📄',
            observation: '🔬',
            batch_created: '🗂️',
        };

        const colors = {
            concentration: 'bg-yellow-500',
            papermaking: 'bg-blue-500',
            observation: 'bg-green-500',
            batch_created: 'bg-gray-500',
        };

        const titles = {
            concentration: '浓度测量',
            papermaking: '抄纸记录',
            observation: '成纸观察',
            batch_created: '批次创建',
        };

        return `
            <div class="relative pl-14">
                <div class="absolute left-4 w-5 h-5 ${colors[event.type]} rounded-full border-4 border-white shadow"></div>
                <div class="bg-gray-50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-gray-800">${icons[event.type]} ${titles[event.type]}</span>
                        <span class="text-sm text-gray-500">${formatDateTime(event.time)}</span>
                    </div>
                    ${this.renderEventContent(event)}
                </div>
            </div>
        `;
    },

    renderEventContent(event) {
        if (event.type === 'batch_created') {
            return `
                <div class="text-sm text-gray-600">
                    <p>批次 <span class="font-medium">${event.data.batch_no}</span> 已创建</p>
                    ${event.data.notes ? `<p class="mt-1">备注: ${event.data.notes}</p>` : ''}
                </div>
            `;
        }

        if (event.type === 'concentration') {
            return `
                <div class="text-sm text-gray-600 space-y-1">
                    <p>浓度值: <span class="font-medium">${event.data.concentration}%</span></p>
                    <p>测量时间: ${formatDateTime(event.data.measured_at)}</p>
                    ${event.data.notes ? `<p>备注: ${event.data.notes}</p>` : ''}
                </div>
            `;
        }

        if (event.type === 'papermaking') {
            return `
                <div class="text-sm text-gray-600 space-y-1">
                    <p>抄纸日期: <span class="font-medium">${formatDate(event.data.paper_date)}</span></p>
                    <p>操作人员: ${event.data.operator || '-'}</p>
                    <p>关联观察记录: ${event.data.observations?.length || 0} 条</p>
                    ${event.data.notes ? `<p>备注: ${event.data.notes}</p>` : ''}
                </div>
            `;
        }

        if (event.type === 'observation') {
            return `
                <div class="text-sm text-gray-600 space-y-1">
                    <p>关联抄纸日期: <span class="font-medium">${formatDate(event.parentRecord?.paper_date)}</span></p>
                    ${event.data.thickness ? `<p>厚度: ${event.data.thickness} mm</p>` : ''}
                    ${event.data.tensile_strength ? `<p>抗张强度: ${event.data.tensile_strength}</p>` : ''}
                    ${event.data.absorbency ? `<p>吸水性: ${event.data.absorbency}</p>` : ''}
                    ${event.data.color ? `<p>颜色: ${event.data.color}</p>` : ''}
                    ${event.data.texture ? `<p>纹理: ${event.data.texture}</p>` : ''}
                    ${event.data.overall_rating ? `<p>综合评分: ${getRatingStars(event.data.overall_rating)}</p>` : ''}
                    ${event.data.notes ? `<p>备注: ${event.data.notes}</p>` : ''}
                </div>
            `;
        }

        return '';
    },

    renderCompareEmpty() {
        return emptyState('请在上方选择至少两个批次进行对比', '⚖️');
    },

    renderCompareTable() {
        if (!this.compareData) {
            return `
                <div class="card text-center py-8">
                    <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p class="text-gray-500">正在加载对比数据...</p>
                </div>
            `;
        }

        const batchInfos = this.selectedBatchIds.map(id => this.batches.find(b => b.id === id)).filter(Boolean);
        const allMaterials = this.collectAllMaterials(batchInfos);

        return `
            <div class="card overflow-x-auto">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="font-semibold text-gray-800">配方对比分析</h3>
                    <button class="btn btn-sm btn-outline" onclick="ComparePage.exportCompare()">📥 导出对比</button>
                </div>
                <table class="w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-3 text-left font-medium text-gray-600 sticky left-0 bg-gray-50 z-10">材料</th>
                            ${batchInfos.map(batch => `
                                <th class="px-4 py-3 text-center font-medium text-gray-600 min-w-32">
                                    <div class="font-medium">${batch.batch_no}</div>
                                    <div class="text-xs font-normal text-gray-400">${getStatusBadge(batch.is_sealed, batch.hidden)}</div>
                                </th>
                            `).join('')}
                            <th class="px-4 py-3 text-center font-medium text-gray-600 min-w-24">差异分析</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${['fiber', 'sizing', 'filler'].map(type => this.renderMaterialTypeSection(type, allMaterials[type], batchInfos)).join('')}
                    </tbody>
                </table>
                <div class="mt-4 pt-4 border-t border-gray-100">
                    <h4 class="font-medium text-gray-700 mb-3">批次基本信息</h4>
                    <table class="w-full text-sm">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-2 text-left font-medium text-gray-600">属性</th>
                                ${batchInfos.map(batch => `
                                    <th class="px-4 py-2 text-center font-medium text-gray-600">${batch.batch_no}</th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="border-b border-gray-100">
                                <td class="px-4 py-2 text-gray-600">创建时间</td>
                                ${batchInfos.map(batch => `
                                    <td class="px-4 py-2 text-center text-gray-600">${formatDateTime(batch.created_at)}</td>
                                `).join('')}
                            </tr>
                            <tr class="border-b border-gray-100">
                                <td class="px-4 py-2 text-gray-600">成分数量</td>
                                ${batchInfos.map(batch => `
                                    <td class="px-4 py-2 text-center text-gray-600">${batch.components?.length || 0} 种</td>
                                `).join('')}
                            </tr>
                            <tr class="border-b border-gray-100">
                                <td class="px-4 py-2 text-gray-600">总配比</td>
                                ${batchInfos.map(batch => {
                                    const total = (batch.components || []).reduce((sum, c) => sum + c.ratio, 0);
                                    return `<td class="px-4 py-2 text-center font-medium ${total !== 100 ? 'text-orange-600' : 'text-gray-800'}">${total.toFixed(2)}</td>`;
                                }).join('')}
                            </tr>
                            <tr>
                                <td class="px-4 py-2 text-gray-600">备注</td>
                                ${batchInfos.map(batch => `
                                    <td class="px-4 py-2 text-center text-gray-500">${batch.notes || '-'}</td>
                                `).join('')}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    collectAllMaterials(batchInfos) {
        const materials = {
            fiber: new Map(),
            sizing: new Map(),
            filler: new Map(),
        };

        batchInfos.forEach(batch => {
            (batch.components || []).forEach(comp => {
                const name = this.getMaterialName(comp);
                const key = `${comp.material_type}_${this.getMaterialId(comp)}`;
                if (!materials[comp.material_type].has(key)) {
                    materials[comp.material_type].set(key, {
                        name,
                        type: comp.material_type,
                        id: this.getMaterialId(comp),
                    });
                }
            });
        });

        return {
            fiber: Array.from(materials.fiber.values()),
            sizing: Array.from(materials.sizing.values()),
            filler: Array.from(materials.filler.values()),
        };
    },

    getMaterialId(comp) {
        if (comp.material_type === 'fiber') return comp.fiber_source_id;
        if (comp.material_type === 'sizing') return comp.sizing_agent_id;
        return comp.mineral_filler_id;
    },

    renderMaterialTypeSection(type, materials, batchInfos) {
        if (materials.length === 0) return '';

        const typeName = getMaterialTypeName(type);
        const colorClass = getMaterialTypeColor(type);

        return `
            <tr class="bg-gray-100">
                <td class="px-4 py-2 font-medium text-gray-700 sticky left-0 bg-gray-100 z-10" colspan="${batchInfos.length + 2}">
                    <span class="chip ${colorClass}">${typeName}</span>
                </td>
            </tr>
            ${materials.map(material => this.renderMaterialRow(material, batchInfos)).join('')}
        `;
    },

    renderMaterialRow(material, batchInfos) {
        const ratios = batchInfos.map(batch => {
            const comp = (batch.components || []).find(c => {
                if (c.material_type !== material.type) return false;
                return this.getMaterialId(c) === material.id;
            });
            return comp ? comp.ratio : 0;
        });

        const nonZeroRatios = ratios.filter(r => r > 0);
        const hasDiff = nonZeroRatios.length > 0 && (new Set(nonZeroRatios).size > 1 || nonZeroRatios.length !== batchInfos.length);
        const maxRatio = Math.max(...ratios);

        return `
            <tr class="border-b border-gray-100 ${hasDiff ? 'bg-orange-50' : ''}">
                <td class="px-4 py-2 font-medium text-gray-800 sticky left-0 ${hasDiff ? 'bg-orange-50' : 'bg-white'} z-10">${material.name}</td>
                ${ratios.map((ratio, idx) => {
                    const isMax = ratio === maxRatio && ratio > 0;
                    return `
                        <td class="px-4 py-2 text-center">
                            <span class="${ratio === 0 ? 'text-gray-300' : isMax ? 'text-green-600 font-bold' : 'text-gray-700'}">
                                ${ratio === 0 ? '-' : ratio}
                            </span>
                        </td>
                    `;
                }).join('')}
                <td class="px-4 py-2 text-center">
                    ${hasDiff ? '<span class="text-orange-600 text-xs font-medium">⚡ 有差异</span>' : '<span class="text-gray-400 text-xs">—</span>'}
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

    async toggleBatchSelection(batchId, checked) {
        if (checked) {
            if (!this.selectedBatchIds.includes(batchId)) {
                this.selectedBatchIds.push(batchId);
            }
        } else {
            this.selectedBatchIds = this.selectedBatchIds.filter(id => id !== batchId);
        }
        this.render();
    },

    async selectSingleBatch(batchId) {
        this.selectedBatchIds = [batchId];
        this.singleBatchId = batchId;
        this.compareData = null;
        loading(true);
        await this.loadTraceData(batchId);
        this.render();
    },

    clearSelection() {
        this.selectedBatchIds = [];
        this.singleBatchId = null;
        this.compareData = null;
        this.traceData = null;
        this.render();
    },

    async switchMode(mode) {
        this.mode = mode;
        if (mode === 'compare' && this.selectedBatchIds.length >= 2) {
            loading(true);
            await this.loadCompareData();
        }
        this.render();
    },

    async switchViewMode(viewMode) {
        this.viewMode = viewMode;
        if (viewMode === 'timeline' && this.selectedBatchIds.length > 0 && !this.traceData) {
            loading(true);
            await this.loadTraceData(this.selectedBatchIds[0]);
        }
        this.render();
    },

    switchToCompare(batchId) {
        if (!this.selectedBatchIds.includes(batchId)) {
            this.selectedBatchIds.push(batchId);
        }
        this.mode = 'compare';
        this.render();
    },

    async doCompare() {
        loading(true);
        await this.loadCompareData();
        this.render();
    },

    exportCompare() {
        if (!this.compareData) return;

        const batchInfos = this.selectedBatchIds.map(id => this.batches.find(b => b.id === id)).filter(Boolean);
        let csv = '材料,' + batchInfos.map(b => b.batch_no).join(',') + '\n';

        const allMaterials = this.collectAllMaterials(batchInfos);
        ['fiber', 'sizing', 'filler'].forEach(type => {
            allMaterials[type].forEach(material => {
                const ratios = batchInfos.map(batch => {
                    const comp = (batch.components || []).find(c => {
                        if (c.material_type !== material.type) return false;
                        return this.getMaterialId(c) === material.id;
                    });
                    return comp ? comp.ratio : 0;
                });
                csv += `"${material.name}",${ratios.join(',')}\n`;
            });
        });

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `批次对比_${new Date().toLocaleDateString('zh-CN')}.csv`;
        link.click();
        showToast('导出成功', 'success');
    },

    unmount() {},
};
