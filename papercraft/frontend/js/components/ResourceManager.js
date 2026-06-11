const ResourceManager = {
    createCRUD(config) {
        const {
            api,
            pageName,
            tableColumns = [],
            actionButtons = [],
            formFields = [],
            formRules = {},
            transformFormData = null,
            renderCard = null,
            emptyMessage = '暂无数据',
            emptyIcon = '📭',
            onDataChange = null,
            deleteConfirmMessage = null,
            enableImages = false,
        } = config;

        const state = {
            data: [],
            loading: false,
        };

        const crud = {
            state,

            getData() {
                return state.data;
            },

            findById(id) {
                return state.data.find(item => item.id === id);
            },

            async load() {
                state.loading = true;
                try {
                    state.data = await api.list();
                    if (onDataChange) onDataChange(state.data);
                    return state.data;
                } catch (error) {
                    UIKit.toast(`加载${pageName}失败: ${error.message}`, 'error');
                    throw error;
                } finally {
                    state.loading = false;
                }
            },

            render() {
                const content = renderCard
                    ? this._renderCards()
                    : this._renderTable();
                UIKit.setPageContent(content);
            },

            _renderTable() {
                if (state.data.length === 0) {
                    return UIKit.emptyState(emptyMessage, emptyIcon);
                }

                return `
                    <div class="card overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full">
                                <thead class="bg-gray-50">
                                    <tr>
                                        ${tableColumns.map(col => `
                                            <th class="px-4 py-3 text-left text-sm font-medium text-gray-600 ${col.className || ''}">${col.label}</th>
                                        `).join('')}
                                        <th class="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${state.data.map(row => this._renderTableRow(row)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            },

            _renderTableRow(row) {
                return `
                    <tr class="border-b border-gray-100 hover:bg-gray-50">
                        ${tableColumns.map(col => `
                            <td class="px-4 py-3 ${col.className || ''}">
                                ${col.render ? col.render(row) : (row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '-')}
                            </td>
                        `).join('')}
                        <td class="px-4 py-3">
                            <div class="flex gap-1 flex-wrap">
                                ${this._renderActionButtons(row)}
                            </div>
                        </td>
                    </tr>
                `;
            },

            _renderCards() {
                if (state.data.length === 0) {
                    return UIKit.emptyState(emptyMessage, emptyIcon);
                }

                return `
                    <div class="space-y-3">
                        ${state.data.map(row => renderCard(row, this._renderInlineActions(row))).join('')}
                    </div>
                `;
            },

            _renderActionButtons(row) {
                const buttons = [];

                actionButtons.forEach(btn => {
                    buttons.push(`
                        <button class="btn btn-sm ${btn.class || 'btn-outline'}" 
                                onclick="window.__crud_action_${pageName}_${btn.label}_${row.id}(event)">
                            ${btn.label}
                        </button>
                    `);
                    this._deferAction(() => {
                        window[`__crud_action_${pageName}_${btn.label}_${row.id}`] = (e) => {
                            if (e) e.stopPropagation?.();
                            btn.onClick(row);
                        };
                    });
                });

                if (enableImages) {
                    buttons.push(`
                        <button class="btn btn-sm btn-outline" 
                                onclick="window.__crud_images_${pageName}_${row.id}(event)">
                            📷 图片
                        </button>
                    `);
                    this._deferAction(() => {
                        window[`__crud_images_${pageName}_${row.id}`] = (e) => {
                            if (e) e.stopPropagation?.();
                            this.viewImages(row.id);
                        };
                    });
                }

                buttons.push(`
                    <button class="btn btn-sm btn-outline" 
                            onclick="window.__crud_edit_${pageName}_${row.id}(event)">
                        编辑
                    </button>
                `);
                this._deferAction(() => {
                    window[`__crud_edit_${pageName}_${row.id}`] = (e) => {
                        if (e) e.stopPropagation?.();
                        this.openEdit(row.id);
                    };
                });

                buttons.push(`
                    <button class="btn btn-sm btn-danger" 
                            onclick="window.__crud_delete_${pageName}_${row.id}(event)">
                        删除
                    </button>
                `);
                this._deferAction(() => {
                    window[`__crud_delete_${pageName}_${row.id}`] = (e) => {
                        if (e) e.stopPropagation?.();
                        this.deleteItem(row.id);
                    };
                });

                return buttons.join('');
            },

            _renderInlineActions(row) {
                return this._renderActionButtons(row);
            },

            _deferredActions: [],
            _deferAction(fn) {
                this._deferredActions.push(fn);
                setTimeout(() => {
                    while (this._deferredActions.length > 0) {
                        const action = this._deferredActions.shift();
                        action();
                    }
                }, 0);
            },

            openCreate(extraData = {}) {
                const formHtml = FormManager.renderForm(formFields, extraData);
                const content = `
                    <div class="space-y-4">
                        ${formHtml}
                        <div class="flex justify-end gap-2 pt-4 border-t">
                            <button type="button" class="btn btn-outline modal-cancel-btn">取消</button>
                            <button type="button" class="btn btn-primary modal-submit-btn">创建</button>
                        </div>
                    </div>
                `;

                const { modal, close } = UIKit.modal(content, { title: `新增${pageName}`, width: '560px' });

                modal.querySelector('.modal-cancel-btn').addEventListener('click', close);
                modal.querySelector('.modal-submit-btn').addEventListener('click', async () => {
                    await this._handleCreateSubmit(modal, close, extraData);
                });

                modal.querySelector('#crud-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this._handleCreateSubmit(modal, close, extraData);
                });
            },

            async _handleCreateSubmit(modal, close, extraData) {
                const { data, formData } = FormManager.collectFormData(modal, formFields, transformFormData);
                const mergedData = { ...data, ...extraData };

                const errors = UIKit.validateForm(formData, formRules);
                if (errors.length > 0) {
                    UIKit.toast(errors.join('，'), 'error');
                    return;
                }

                try {
                    await UIKit.safeCall(api.create(mergedData), {
                        successMsg: `${pageName}创建成功`,
                        errorMsg: '创建失败',
                    });
                    close();
                    await this.load();
                    this.render();
                } catch (e) {
                }
            },

            async openEdit(id) {
                let existing;
                try {
                    existing = await api.get(id);
                } catch (error) {
                    UIKit.toast(`加载${pageName}详情失败: ${error.message}`, 'error');
                    return;
                }

                if (!existing) {
                    UIKit.toast(`${pageName}不存在`, 'error');
                    return;
                }

                const formHtml = FormManager.renderForm(formFields, existing);
                const content = `
                    <div class="space-y-4">
                        ${formHtml}
                        <div class="flex justify-end gap-2 pt-4 border-t">
                            <button type="button" class="btn btn-outline modal-cancel-btn">取消</button>
                            <button type="button" class="btn btn-primary modal-submit-btn">保存修改</button>
                        </div>
                    </div>
                `;

                const { modal, close } = UIKit.modal(content, { title: `编辑${pageName}`, width: '560px' });

                modal.querySelector('.modal-cancel-btn').addEventListener('click', close);
                modal.querySelector('.modal-submit-btn').addEventListener('click', async () => {
                    await this._handleEditSubmit(modal, close, id);
                });

                modal.querySelector('#crud-form').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this._handleEditSubmit(modal, close, id);
                });
            },

            async _handleEditSubmit(modal, close, id) {
                const { data, formData } = FormManager.collectFormData(modal, formFields, transformFormData);

                const errors = UIKit.validateForm(formData, formRules);
                if (errors.length > 0) {
                    UIKit.toast(errors.join('，'), 'error');
                    return;
                }

                try {
                    await UIKit.safeCall(api.update(id, data), {
                        successMsg: `${pageName}更新成功`,
                        errorMsg: '更新失败',
                    });
                    close();
                    await this.load();
                    this.render();
                } catch (e) {
                }
            },

            deleteItem(id, options = {}) {
                const item = this.findById(id);
                const message = deleteConfirmMessage
                    ? (typeof deleteConfirmMessage === 'function' ? deleteConfirmMessage(item) : deleteConfirmMessage)
                    : `确定要删除该${pageName}吗？此操作不可恢复。`;

                const confirmOptions = {
                    title: `删除${pageName}`,
                    confirmText: '确认删除',
                    type: 'danger',
                    ...options,
                };

                UIKit.confirm(message, async () => {
                    try {
                        await UIKit.safeCall(api.delete(id), {
                            successMsg: `${pageName}删除成功`,
                            errorMsg: '删除失败',
                        });
                        await this.load();
                        this.render();
                    } catch (e) {
                    }
                }, confirmOptions);
            },

            viewImages(id, viewOptions = {}) {
                const item = this.findById(id);
                const defaultOptions = {
                    title: `${item?.name || pageName} #${id} - 图片管理`,
                };
                const mergedOptions = { ...defaultOptions, ...viewOptions };

                const resourceType = config.resourceType;
                if (resourceType === 'fiber') {
                    mergedOptions.fiberSourceId = id;
                } else if (resourceType === 'sizing') {
                    mergedOptions.sizingAgentId = id;
                } else if (resourceType === 'filler') {
                    mergedOptions.mineralFillerId = id;
                } else if (resourceType === 'batch') {
                    mergedOptions.batchId = id;
                } else if (resourceType === 'record') {
                    mergedOptions.recordId = id;
                } else if (resourceType === 'observation') {
                    mergedOptions.observationId = id;
                }

                if (typeof ImagesPage !== 'undefined') {
                    ImagesPage.openImageManager(mergedOptions);
                } else {
                    UIKit.toast('图片管理模块未加载', 'warning');
                }
            },
        };

        return crud;
    },
};
