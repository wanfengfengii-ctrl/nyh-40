const API_BASE = 'http://localhost:8000';

const ApiService = {
    async request(path, options = {}) {
        const url = `${API_BASE}${path}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };
        const mergedOptions = { ...defaultOptions, ...options };
        if (mergedOptions.body && typeof mergedOptions.body !== 'string') {
            mergedOptions.body = JSON.stringify(mergedOptions.body);
        }
        try {
            const response = await fetch(url, mergedOptions);
            if (response.status === 204) {
                return null;
            }
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || `请求失败: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async upload(path, formData, onProgress = null) {
        const url = `${API_BASE}${path}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || `上传失败: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error('API Upload Error:', error);
            throw error;
        }
    },
};

const CrudEndpointMixin = {
    list(params = {}) {
        const query = new URLSearchParams(params).toString();
        return ApiService.request(`${this.path}${query ? `?${query}` : ''}`);
    },
    get(id) {
        return ApiService.request(`${this.path}/${id}`);
    },
    create(data) {
        return ApiService.request(this.path, { method: 'POST', body: data });
    },
    update(id, data) {
        return ApiService.request(`${this.path}/${id}`, { method: 'PUT', body: data });
    },
    delete(id) {
        return ApiService.request(`${this.path}/${id}`, { method: 'DELETE' });
    },
};

const FibersAPI = {
    path: '/fibers',
    ...CrudEndpointMixin,
};

const SizingAgentsAPI = {
    path: '/sizing-agents',
    ...CrudEndpointMixin,
};

const FillersAPI = {
    path: '/mineral-fillers',
    ...CrudEndpointMixin,
};

const MaterialsAPI = {
    async loadAll() {
        return Promise.all([
            FibersAPI.list(),
            SizingAgentsAPI.list(),
            FillersAPI.list(),
        ]);
    },
    getMaterialName(comp, fibers, sizingAgents, fillers) {
        if (comp.material_type === 'fiber') {
            const fiber = fibers.find(f => f.id === comp.fiber_source_id);
            return fiber ? fiber.name : `纤维#${comp.fiber_source_id}`;
        } else if (comp.material_type === 'sizing') {
            const agent = sizingAgents.find(s => s.id === comp.sizing_agent_id);
            return agent ? agent.name : `胶料#${comp.sizing_agent_id}`;
        } else {
            const filler = fillers.find(f => f.id === comp.mineral_filler_id);
            return filler ? filler.name : `填料#${comp.mineral_filler_id}`;
        }
    },
    getMaterialOptions(type, fibers, sizingAgents, fillers, selectedId = null) {
        if (type === 'fiber') {
            return fibers.map(f => `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${f.name}</option>`).join('');
        } else if (type === 'sizing') {
            return sizingAgents.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${s.name}</option>`).join('');
        } else {
            return fillers.map(f => `<option value="${f.id}" ${f.id === selectedId ? 'selected' : ''}>${f.name}</option>`).join('');
        }
    },
    getMaterialId(comp) {
        if (comp.material_type === 'fiber') return comp.fiber_source_id;
        if (comp.material_type === 'sizing') return comp.sizing_agent_id;
        return comp.mineral_filler_id;
    },
    createEmptyComponent(fibers) {
        return {
            material_type: 'fiber',
            fiber_source_id: fibers[0]?.id || null,
            sizing_agent_id: null,
            mineral_filler_id: null,
            ratio: 0,
            notes: '',
        };
    },
};

const BatchesAPI = {
    path: '/batches',
    list() {
        return ApiService.request('/batches');
    },
    get(id) {
        return ApiService.request(`/batches/${id}`);
    },
    create(data) {
        return ApiService.request('/batches', { method: 'POST', body: data });
    },
    update(id, data) {
        return ApiService.request(`/batches/${id}`, { method: 'PUT', body: data });
    },
    delete(id, confirmed = false) {
        return ApiService.request(`/batches/${id}?confirmed=${confirmed}`, { method: 'DELETE' });
    },
    seal(id) {
        return ApiService.request(`/batches/${id}/seal`, { method: 'POST' });
    },
    unseal(id) {
        return ApiService.request(`/batches/${id}/unseal`, { method: 'POST' });
    },
    toggleHidden(id) {
        return ApiService.request(`/batches/${id}/toggle-hidden`, { method: 'POST' });
    },
    addComponent(id, data) {
        return ApiService.request(`/batches/${id}/components`, { method: 'POST', body: data });
    },
    updateComponent(batchId, compId, data) {
        return ApiService.request(`/batches/${batchId}/components/${compId}`, { method: 'PUT', body: data });
    },
    deleteComponent(batchId, compId) {
        return ApiService.request(`/batches/${batchId}/components/${compId}`, { method: 'DELETE' });
    },
    addConcentration(id, data) {
        return ApiService.request(`/batches/${id}/concentrations`, { method: 'POST', body: data });
    },
    getConcentrations(id) {
        return ApiService.request(`/batches/${id}/concentrations`);
    },
};

const RecordsAPI = {
    createPapermaking(batchId, data) {
        return ApiService.request(`/records/${batchId}/papermaking`, { method: 'POST', body: data });
    },
    listPapermaking() {
        return ApiService.request('/records/papermaking');
    },
    listBatchPapermaking(batchId) {
        return ApiService.request(`/records/${batchId}/papermaking`);
    },
    getPapermaking(id) {
        return ApiService.request(`/records/papermaking/${id}`);
    },
    updatePapermaking(id, data) {
        return ApiService.request(`/records/papermaking/${id}`, { method: 'PUT', body: data });
    },
    deletePapermaking(id) {
        return ApiService.request(`/records/papermaking/${id}`, { method: 'DELETE' });
    },
    createObservation(recordId, data) {
        return ApiService.request(`/records/papermaking/${recordId}/observations`, { method: 'POST', body: data });
    },
    listObservations(recordId) {
        return ApiService.request(`/records/papermaking/${recordId}/observations`);
    },
    getObservation(id) {
        return ApiService.request(`/records/observations/${id}`);
    },
    updateObservation(id, data) {
        return ApiService.request(`/records/observations/${id}`, { method: 'PUT', body: data });
    },
    deleteObservation(id) {
        return ApiService.request(`/records/observations/${id}`, { method: 'DELETE' });
    },
};

const StatisticsAPI = {
    compare(batchIds) {
        return ApiService.request('/statistics/compare', { method: 'POST', body: { batch_ids: batchIds } });
    },
    trace(batchId) {
        return ApiService.request(`/statistics/trace/${batchId}`);
    },
    materialProportion() {
        return ApiService.request('/statistics/material-proportion');
    },
    summary() {
        return ApiService.request('/statistics/summary');
    },
};

const ImportAPI = {
    batches(data) {
        return ApiService.request('/import', { method: 'POST', body: data });
    },
};

const TemplatesAPI = {
    list(params = {}) {
        const query = new URLSearchParams(params).toString();
        return ApiService.request(`/templates${query ? `?${query}` : ''}`);
    },
    get(id) {
        return ApiService.request(`/templates/${id}`);
    },
    create(data) {
        return ApiService.request('/templates', { method: 'POST', body: data });
    },
    update(id, data) {
        return ApiService.request(`/templates/${id}`, { method: 'PUT', body: data });
    },
    delete(id) {
        return ApiService.request(`/templates/${id}`, { method: 'DELETE' });
    },
    listCategories() {
        return ApiService.request('/templates/categories');
    },
    recommend(data) {
        return ApiService.request('/templates/recommend', { method: 'POST', body: data });
    },
    createFromBatch(batchId, params) {
        const query = new URLSearchParams(params).toString();
        return ApiService.request(`/templates/from-batch/${batchId}?${query}`, { method: 'POST' });
    },
    listVersions(templateId) {
        return ApiService.request(`/templates/${templateId}/versions`);
    },
    createVersion(templateId, data) {
        return ApiService.request(`/templates/${templateId}/versions`, { method: 'POST', body: data });
    },
    getVersion(versionId) {
        return ApiService.request(`/templates/versions/${versionId}`);
    },
    replicate(templateId, data) {
        return ApiService.request(`/templates/${templateId}/replicate`, { method: 'POST', body: data });
    },
    listReplications(templateId) {
        return ApiService.request(`/templates/${templateId}/replications`);
    },
};

const ImagesAPI = {
    upload(formData) {
        return ApiService.upload('/images/upload', formData);
    },
    list(params = {}) {
        const query = new URLSearchParams(params).toString();
        return ApiService.request(`/images${query ? `?${query}` : ''}`);
    },
    get(id) {
        return ApiService.request(`/images/${id}`);
    },
    update(id, data) {
        return ApiService.request(`/images/${id}`, { method: 'PUT', body: data });
    },
    delete(id) {
        return ApiService.request(`/images/${id}`, { method: 'DELETE' });
    },
    toggleHidden(id) {
        return ApiService.request(`/images/${id}/toggle-hidden`, { method: 'POST' });
    },
    toggleTypical(id) {
        return ApiService.request(`/images/${id}/toggle-typical`, { method: 'POST' });
    },
    getFileUrl(id) {
        return `${API_BASE}/images/${id}/file`;
    },
    addAnnotation(imageId, data) {
        return ApiService.request(`/images/${imageId}/annotations`, { method: 'POST', body: data });
    },
    listAnnotations(imageId) {
        return ApiService.request(`/images/${imageId}/annotations`);
    },
    updateAnnotation(annotationId, data) {
        return ApiService.request(`/images/annotations/${annotationId}`, { method: 'PUT', body: data });
    },
    deleteAnnotation(annotationId) {
        return ApiService.request(`/images/annotations/${annotationId}`, { method: 'DELETE' });
    },
    compare(imageIds) {
        return ApiService.request('/images/compare', { method: 'POST', body: { image_ids: imageIds } });
    },
    getBatchTimeline(batchId, includeHidden = false) {
        return ApiService.request(`/images/batch/${batchId}/timeline?include_hidden=${includeHidden}`);
    },
    getSummary(params = {}) {
        const query = new URLSearchParams(params).toString();
        return ApiService.request(`/images/summary${query ? `?${query}` : ''}`);
    },
};

const _CATEGORY_MAP = {
    raw_material: { name: '原料', icon: '🌾', color: 'bg-green-100 text-green-800' },
    wet_paper: { name: '湿纸页', icon: '💧', color: 'bg-blue-100 text-blue-800' },
    dry_paper: { name: '成纸', icon: '📄', color: 'bg-amber-100 text-amber-800' },
    microscopy: { name: '显微结构', icon: '🔬', color: 'bg-purple-100 text-purple-800' },
};

const _getCategoryInfo = function (category) {
    return _CATEGORY_MAP[category] || { name: category, icon: '📷', color: 'bg-gray-100 text-gray-800' };
};

if (typeof window !== 'undefined') {
    window.CATEGORY_MAP = _CATEGORY_MAP;
    window.getCategoryInfo = _getCategoryInfo;
}

const NewAPI = {
    base: API_BASE,
    service: ApiService,
    fibers: FibersAPI,
    sizingAgents: SizingAgentsAPI,
    fillers: FillersAPI,
    materials: MaterialsAPI,
    batches: BatchesAPI,
    records: RecordsAPI,
    statistics: StatisticsAPI,
    import: ImportAPI,
    templates: TemplatesAPI,
    images: ImagesAPI,
    categoryMap: _CATEGORY_MAP,
    getCategoryInfo: _getCategoryInfo,
};
