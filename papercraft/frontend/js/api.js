const API_BASE = 'http://localhost:8000';

const API = {
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

    fibers: {
        list: () => API.request('/fibers'),
        get: (id) => API.request(`/fibers/${id}`),
        create: (data) => API.request('/fibers', { method: 'POST', body: data }),
        update: (id, data) => API.request(`/fibers/${id}`, { method: 'PUT', body: data }),
        delete: (id) => API.request(`/fibers/${id}`, { method: 'DELETE' }),
    },

    sizingAgents: {
        list: () => API.request('/sizing-agents'),
        get: (id) => API.request(`/sizing-agents/${id}`),
        create: (data) => API.request('/sizing-agents', { method: 'POST', body: data }),
        update: (id, data) => API.request(`/sizing-agents/${id}`, { method: 'PUT', body: data }),
        delete: (id) => API.request(`/sizing-agents/${id}`, { method: 'DELETE' }),
    },

    fillers: {
        list: () => API.request('/mineral-fillers'),
        get: (id) => API.request(`/mineral-fillers/${id}`),
        create: (data) => API.request('/mineral-fillers', { method: 'POST', body: data }),
        update: (id, data) => API.request(`/mineral-fillers/${id}`, { method: 'PUT', body: data }),
        delete: (id) => API.request(`/mineral-fillers/${id}`, { method: 'DELETE' }),
    },

    batches: {
        list: () => API.request('/batches'),
        get: (id) => API.request(`/batches/${id}`),
        create: (data) => API.request('/batches', { method: 'POST', body: data }),
        update: (id, data) => API.request(`/batches/${id}`, { method: 'PUT', body: data }),
        delete: (id, confirmed = false) => API.request(`/batches/${id}?confirmed=${confirmed}`, { method: 'DELETE' }),
        seal: (id) => API.request(`/batches/${id}/seal`, { method: 'POST' }),
        unseal: (id) => API.request(`/batches/${id}/unseal`, { method: 'POST' }),
        toggleHidden: (id) => API.request(`/batches/${id}/toggle-hidden`, { method: 'POST' }),
        addComponent: (id, data) => API.request(`/batches/${id}/components`, { method: 'POST', body: data }),
        updateComponent: (batchId, compId, data) => API.request(`/batches/${batchId}/components/${compId}`, { method: 'PUT', body: data }),
        deleteComponent: (batchId, compId) => API.request(`/batches/${batchId}/components/${compId}`, { method: 'DELETE' }),
        addConcentration: (id, data) => API.request(`/batches/${id}/concentrations`, { method: 'POST', body: data }),
        getConcentrations: (id) => API.request(`/batches/${id}/concentrations`),
    },

    records: {
        createPapermaking: (batchId, data) => API.request(`/records/${batchId}/papermaking`, { method: 'POST', body: data }),
        listPapermaking: () => API.request('/records/papermaking'),
        listBatchPapermaking: (batchId) => API.request(`/records/${batchId}/papermaking`),
        getPapermaking: (id) => API.request(`/records/papermaking/${id}`),
        updatePapermaking: (id, data) => API.request(`/records/papermaking/${id}`, { method: 'PUT', body: data }),
        deletePapermaking: (id) => API.request(`/records/papermaking/${id}`, { method: 'DELETE' }),
        createObservation: (recordId, data) => API.request(`/records/papermaking/${recordId}/observations`, { method: 'POST', body: data }),
        listObservations: (recordId) => API.request(`/records/papermaking/${recordId}/observations`),
        getObservation: (id) => API.request(`/records/observations/${id}`),
        updateObservation: (id, data) => API.request(`/records/observations/${id}`, { method: 'PUT', body: data }),
        deleteObservation: (id) => API.request(`/records/observations/${id}`, { method: 'DELETE' }),
    },

    statistics: {
        compare: (batchIds) => API.request('/statistics/compare', { method: 'POST', body: { batch_ids: batchIds } }),
        trace: (batchId) => API.request(`/statistics/trace/${batchId}`),
        materialProportion: () => API.request('/statistics/material-proportion'),
        summary: () => API.request('/statistics/summary'),
    },

    import: {
        batches: (data) => API.request('/import', { method: 'POST', body: data }),
    },

    templates: {
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/templates${query ? `?${query}` : ''}`);
        },
        get: (id) => API.request(`/templates/${id}`),
        create: (data) => API.request('/templates', { method: 'POST', body: data }),
        update: (id, data) => API.request(`/templates/${id}`, { method: 'PUT', body: data }),
        delete: (id) => API.request(`/templates/${id}`, { method: 'DELETE' }),
        listCategories: () => API.request('/templates/categories'),
        recommend: (data) => API.request('/templates/recommend', { method: 'POST', body: data }),
        createFromBatch: (batchId, params) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/templates/from-batch/${batchId}?${query}`, { method: 'POST' });
        },
        listVersions: (templateId) => API.request(`/templates/${templateId}/versions`),
        createVersion: (templateId, data) => API.request(`/templates/${templateId}/versions`, { method: 'POST', body: data }),
        getVersion: (versionId) => API.request(`/templates/versions/${versionId}`),
        replicate: (templateId, data) => API.request(`/templates/${templateId}/replicate`, { method: 'POST', body: data }),
        listReplications: (templateId) => API.request(`/templates/${templateId}/replications`),
    },

    images: {
        upload: async (formData) => {
            const url = `${API_BASE}/images/upload`;
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
                console.error('API Error:', error);
                throw error;
            }
        },
        list: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/images${query ? `?${query}` : ''}`);
        },
        get: (id) => API.request(`/images/${id}`),
        update: (id, data) => API.request(`/images/${id}`, { method: 'PUT', body: data }),
        delete: (id) => API.request(`/images/${id}`, { method: 'DELETE' }),
        toggleHidden: (id) => API.request(`/images/${id}/toggle-hidden`, { method: 'POST' }),
        toggleTypical: (id) => API.request(`/images/${id}/toggle-typical`, { method: 'POST' }),
        getFileUrl: (id) => `${API_BASE}/images/${id}/file`,
        addAnnotation: (imageId, data) => API.request(`/images/${imageId}/annotations`, { method: 'POST', body: data }),
        listAnnotations: (imageId) => API.request(`/images/${imageId}/annotations`),
        updateAnnotation: (annotationId, data) => API.request(`/images/annotations/${annotationId}`, { method: 'PUT', body: data }),
        deleteAnnotation: (annotationId) => API.request(`/images/annotations/${annotationId}`, { method: 'DELETE' }),
        compare: (imageIds) => API.request('/images/compare', { method: 'POST', body: { image_ids: imageIds } }),
        getBatchTimeline: (batchId, includeHidden = false) => API.request(`/images/batch/${batchId}/timeline?include_hidden=${includeHidden}`),
        getSummary: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return API.request(`/images/summary${query ? `?${query}` : ''}`);
        },
    },
};
