const FormManager = {
    _escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _getFieldName(field) {
        return field.key !== undefined ? field.key : field.name;
    },

    _getFieldValue(field, initialValues) {
        const name = this._getFieldName(field);
        if (field.value !== undefined && field.value !== null) return field.value;
        if (initialValues && initialValues[name] !== undefined && initialValues[name] !== null) {
            return initialValues[name];
        }
        return '';
    },

    _renderField(field, initialValues) {
        const name = this._getFieldName(field);
        const value = this._escapeHtml(this._getFieldValue(field, initialValues));
        const requiredAttr = field.required ? 'required' : '';
        const placeholderAttr = field.placeholder ? `placeholder="${this._escapeHtml(field.placeholder)}"` : '';
        const extraClass = field.extraClass ? ` ${field.extraClass}` : '';
        const stepAttr = field.step !== undefined ? `step="${field.step}"` : '';
        const minAttr = field.min !== undefined ? `min="${field.min}"` : '';
        const maxAttr = field.max !== undefined ? `max="${field.max}"` : '';
        const requiredMark = field.required ? '<span class="text-red-500 ml-1">*</span>' : '';
        const rows = field.rows || 3;

        let fieldHtml = '';
        const type = field.type || 'text';

        switch (type) {
            case 'hidden':
                return `<input type="hidden" name="${name}" value="${value}">`;

            case 'textarea':
                fieldHtml = `
                    <textarea name="${name}" class="textarea${extraClass}" ${placeholderAttr} ${requiredAttr} rows="${rows}">${value}</textarea>
                `;
                break;

            case 'select':
                const optionsHtml = (field.options || []).map(opt => {
                    const optValue = opt.value !== undefined ? opt.value : opt;
                    const optLabel = opt.label !== undefined ? opt.label : opt;
                    const selected = String(optValue) === String(value) ? 'selected' : '';
                    return `<option value="${this._escapeHtml(optValue)}" ${selected}>${this._escapeHtml(optLabel)}</option>`;
                }).join('');
                const defaultOption = !field.required || !value ? `<option value="">-- 请选择${field.label || ''} --</option>` : '';
                fieldHtml = `
                    <select name="${name}" class="select${extraClass}" ${requiredAttr}>
                        ${defaultOption}
                        ${optionsHtml}
                    </select>
                `;
                break;

            case 'range':
                const rangeValue = value || field.min || 0;
                fieldHtml = `
                    <div class="flex items-center gap-3">
                        <input type="range" name="${name}" class="flex-1${extraClass}" 
                               ${stepAttr} ${minAttr} ${maxAttr} 
                               value="${rangeValue}"
                               oninput="this.nextElementSibling.textContent = this.value">
                        <span class="text-sm text-gray-600 w-12 text-center">${rangeValue}</span>
                    </div>
                `;
                break;

            case 'number':
                const numValue = value !== '' && value !== null && value !== undefined ? `value="${value}"` : '';
                fieldHtml = `
                    <input type="number" name="${name}" class="input${extraClass}" 
                           ${placeholderAttr} ${requiredAttr} ${stepAttr} ${minAttr} ${maxAttr}
                           ${numValue}>
                `;
                break;

            case 'date':
                const dateValue = value ? `value="${value}"` : '';
                fieldHtml = `
                    <input type="date" name="${name}" class="input${extraClass}" 
                           ${requiredAttr} ${minAttr} ${maxAttr}
                           ${dateValue}>
                `;
                break;

            case 'datetime-local':
                const dtValue = value ? `value="${String(value).slice(0, 16)}"` : '';
                fieldHtml = `
                    <input type="datetime-local" name="${name}" class="input${extraClass}" 
                           ${requiredAttr} ${dtValue}>
                `;
                break;

            case 'text':
            default:
                const textValue = value !== null && value !== undefined ? `value="${value}"` : '';
                fieldHtml = `
                    <input type="${type}" name="${name}" class="input${extraClass}" 
                           ${placeholderAttr} ${requiredAttr} ${textValue}>
                `;
                break;
        }

        const gridCols = field.gridCols ? `md:col-span-${field.gridCols}` : 'md:col-span-1';

        return `
            <div class="${gridCols}">
                ${field.label ? `<label class="label">${this._escapeHtml(field.label)}${requiredMark}</label>` : ''}
                ${fieldHtml}
            </div>
        `;
    },

    _renderFields(fields, layout, initialValues) {
        const fieldsHtml = fields.map(f => this._renderField(f, initialValues)).join('');
        if (layout === 'grid') {
            return `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${fieldsHtml}</div>`;
        }
        return `<div class="space-y-4">${fieldsHtml}</div>`;
    },

    _buildFormContent(config, initialValues) {
        const {
            formId = 'form-manager-form',
            fields = [],
            layout = 'vertical',
            submitText = '提交',
            cancelText = '取消',
            extraContent = {}
        } = config;

        const fieldsHtml = this._renderFields(fields, layout, initialValues);
        const beforeForm = extraContent.beforeForm || '';
        const afterForm = extraContent.afterForm || '';
        const beforeFields = extraContent.beforeFields || '';
        const afterFields = extraContent.afterFields || '';

        return `
            ${beforeForm}
            <form id="${formId}" class="space-y-4">
                ${beforeFields}
                ${fieldsHtml}
                ${afterFields}
                <div class="flex justify-end gap-2 pt-4 border-t border-gray-100">
                    <button type="button" class="btn btn-outline form-manager-cancel">${cancelText}</button>
                    <button type="submit" class="btn btn-primary form-manager-submit">${submitText}</button>
                </div>
            </form>
            ${afterForm}
        `;
    },

    _collectFormData(form, fields, transform) {
        const formData = new FormData(form);
        let data = {};

        fields.forEach(field => {
            const name = this._getFieldName(field);
            let value = formData.get(name);

            if (field.type === 'number' || field.type === 'range') {
                value = value !== '' && value !== null ? parseFloat(value) : null;
            } else if (value === '') {
                value = null;
            }

            data[name] = value;
        });

        if (typeof transform === 'function') {
            data = transform(data, formData) || data;
        }

        return { data, formData };
    },

    _validateRules(formData, rules) {
        if (!rules || Object.keys(rules).length === 0) return [];
        return UIKit.validateForm(formData, rules);
    },

    open(config) {
        const {
            title = '',
            width = '500px',
            formId = 'form-manager-form',
            fields = [],
            rules = {},
            transform = null,
            onSubmit = null,
            initialValues = {}
        } = config;

        const content = this._buildFormContent(config, initialValues);
        const { modal, close, element } = UIKit.modal(content, { title, width });

        const form = modal.querySelector(`#${formId}`);
        const cancelBtn = modal.querySelector('.form-manager-cancel');
        const submitBtn = modal.querySelector('.form-manager-submit');

        cancelBtn.addEventListener('click', close);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const { data, formData } = this._collectFormData(form, fields, transform);
            const errors = this._validateRules(formData, rules);

            if (errors.length > 0) {
                UIKit.toast(errors[0], 'error');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '提交中...';

            const closeModal = close;
            const submitHandler = onSubmit;

            try {
                if (typeof submitHandler === 'function') {
                    await submitHandler(data, { close: closeModal, modal, element });
                }
            } catch (error) {
                UIKit.toast(`操作失败: ${error.message}`, 'error');
            } finally {
                if (modal.parentNode) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = config.submitText || '提交';
                }
            }
        });

        return { modal, close, element, form, submitBtn, cancelBtn };
    },

    createCreate(config) {
        const {
            api = null,
            apiMethod = 'create',
            onSuccess = null,
            successMsg = '创建成功',
            errorMsg = '创建失败',
            ...restConfig
        } = config;

        return this.open({
            submitText: restConfig.submitText || '保存',
            ...restConfig,
            onSubmit: async (data, handlers) => {
                const apiInstance = api || NewAPI;

                let promise;
                if (typeof apiMethod === 'function') {
                    promise = apiMethod(data);
                } else if (apiInstance && apiInstance[apiMethod]) {
                    promise = apiInstance[apiMethod](data);
                } else if (restConfig.onSubmit) {
                    return restConfig.onSubmit(data, handlers);
                } else {
                    throw new Error('未指定有效的 API 调用方式');
                }

                const result = await UIKit.safeCall(promise, {
                    successMsg,
                    errorMsg,
                });

                handlers.close();

                if (typeof onSuccess === 'function') {
                    onSuccess(result, data);
                }
            }
        });
    },

    createEdit(config, id, existingData) {
        const {
            api = null,
            apiMethod = 'update',
            onSuccess = null,
            successMsg = '更新成功',
            errorMsg = '更新失败',
            initialValues = {},
            ...restConfig
        } = config;

        const mergedInitialValues = existingData
            ? { ...initialValues, ...existingData }
            : initialValues;

        return this.open({
            submitText: restConfig.submitText || '保存修改',
            ...restConfig,
            initialValues: mergedInitialValues,
            onSubmit: async (data, handlers) => {
                const apiInstance = api || NewAPI;

                let promise;
                if (typeof apiMethod === 'function') {
                    promise = apiMethod(id, data);
                } else if (apiInstance && apiInstance[apiMethod]) {
                    promise = apiInstance[apiMethod](id, data);
                } else if (restConfig.onSubmit) {
                    return restConfig.onSubmit(data, handlers);
                } else {
                    throw new Error('未指定有效的 API 调用方式');
                }

                const result = await UIKit.safeCall(promise, {
                    successMsg,
                    errorMsg,
                });

                handlers.close();

                if (typeof onSuccess === 'function') {
                    onSuccess(result, data);
                }
            }
        });
    },

    renderField(field, value = '') {
        const initialValues = {};
        const name = this._getFieldName(field);
        if (value !== '' && value !== null && value !== undefined) {
            initialValues[name] = value;
        }
        return this._renderField(field, initialValues);
    },

    renderForm(fields, data = {}, gridCols = 1) {
        const gridClass = gridCols > 1 ? ` grid grid-cols-${gridCols} gap-4` : ' space-y-4';
        return `
            <form id="crud-form" class="${gridClass}">
                ${fields.map(field => this.renderField(field, data[this._getFieldName(field)])).join('')}
            </form>
        `;
    },

    collectFormData(container, fields, transformFormData) {
        const form = typeof container.querySelector === 'function'
            ? container.querySelector('#crud-form')
            : (container.tagName === 'FORM' ? container : null);
        if (!form) return { data: {}, formData: new FormData() };
        return this._collectFormData(form, fields, transformFormData);
    }
};
