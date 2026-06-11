const UIKit = {
    toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    modal(content, options = {}) {
        const container = document.getElementById('modal-container');
        const { width = '600px', title = '', onClose = null } = options;

        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
            <div class="modal-content" style="width: ${width}">
                ${title ? `
                <div class="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
                    <button class="modal-close text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>
                ` : ''}
                <div class="modal-body p-4">${content}</div>
            </div>
        `;

        container.appendChild(modal);

        const close = () => {
            modal.remove();
            if (onClose) onClose();
        };

        modal.querySelector('.modal-close')?.addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });

        return { close, modal, element: modal };
    },

    confirm(message, onConfirm, options = {}) {
        const { title = '确认操作', confirmText = '确认', cancelText = '取消', type = 'danger' } = options;
        const content = `
            <div class="text-center py-4">
                <div class="text-5xl mb-4">${type === 'danger' ? '⚠️' : '❓'}</div>
                <p class="text-gray-700 mb-6">${message}</p>
                <div class="flex justify-center gap-3">
                    <button class="btn btn-outline modal-cancel">${cancelText}</button>
                    <button class="btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'} modal-confirm">${confirmText}</button>
                </div>
            </div>
        `;
        const { modal, close } = UIKit.modal(content, { title, width: '480px' });

        modal.querySelector('.modal-cancel').addEventListener('click', close);
        modal.querySelector('.modal-confirm').addEventListener('click', () => {
            close();
            onConfirm();
        });
    },

    confirmWithSecondary(primaryMessage, secondaryMessage, onConfirm, options = {}) {
        const { title = '确认操作', confirmText = '确认删除', secondaryConfirmText = '彻底删除' } = options;
        UIKit.confirm(
            primaryMessage,
            () => {
                UIKit.confirm(
                    secondaryMessage,
                    onConfirm,
                    { title: '二次确认', confirmText: secondaryConfirmText, type: 'danger' }
                );
            },
            { title, confirmText, type: 'danger' }
        );
    },

    loading(show = true) {
        const content = document.getElementById('page-content');
        if (show) {
            content.innerHTML = `
                <div class="flex items-center justify-center py-20">
                    <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                    <span class="ml-3 text-gray-600">加载中...</span>
                </div>
            `;
        }
    },

    emptyState(message, icon = '📭') {
        return `
            <div class="text-center py-16 text-gray-500">
                <div class="text-6xl mb-4">${icon}</div>
                <p class="text-lg">${message}</p>
            </div>
        `;
    },

    validateForm(formData, rules) {
        const errors = [];
        for (const [field, rule] of Object.entries(rules)) {
            const value = formData.get(field);
            if (rule.required && (!value || value.trim() === '')) {
                errors.push(`${rule.label || field}不能为空`);
            }
            if (rule.minLength && value && value.length < rule.minLength) {
                errors.push(`${rule.label || field}长度不能少于${rule.minLength}个字符`);
            }
            if (rule.maxLength && value && value.length > rule.maxLength) {
                errors.push(`${rule.label || field}长度不能超过${rule.maxLength}个字符`);
            }
            if (rule.min && value && parseFloat(value) < rule.min) {
                errors.push(`${rule.label || field}不能小于${rule.min}`);
            }
            if (rule.max && value && parseFloat(value) > rule.max) {
                errors.push(`${rule.label || field}不能大于${rule.max}`);
            }
        }
        return errors;
    },

    async safeCall(promise, { successMsg = null, errorMsg = '操作失败', onSuccess = null, onError = null } = {}) {
        try {
            const result = await promise;
            if (successMsg) UIKit.toast(successMsg, 'success');
            if (onSuccess) onSuccess(result);
            return result;
        } catch (error) {
            UIKit.toast(`${errorMsg}: ${error.message}`, 'error');
            if (onError) onError(error);
            throw error;
        }
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN');
    },

    formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN');
    },

    getMaterialTypeName(type) {
        const names = {
            fiber: '纤维',
            sizing: '胶料',
            filler: '填料',
        };
        return names[type] || type;
    },

    getMaterialTypeColor(type) {
        const colors = {
            fiber: 'bg-green-100 text-green-800',
            sizing: 'bg-blue-100 text-blue-800',
            filler: 'bg-purple-100 text-purple-800',
        };
        return colors[type] || 'bg-gray-100 text-gray-800';
    },

    getStatusBadge(isSealed, hidden) {
        if (hidden) {
            return '<span class="badge badge-gray">已隐藏</span>';
        }
        if (isSealed) {
            return '<span class="badge badge-green">已封存</span>';
        }
        return '<span class="badge badge-blue">进行中</span>';
    },

    getRatingStars(rating) {
        if (!rating) return '-';
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 >= 0.5;
        let stars = '⭐'.repeat(fullStars);
        if (hasHalf) stars += '☆';
        return `${stars} (${rating})`;
    },

    setPageTitle(title) {
        document.getElementById('page-title').textContent = title;
    },

    setPageActions(actionsHtml) {
        document.getElementById('page-actions').innerHTML = actionsHtml;
    },

    setPageContent(contentHtml) {
        document.getElementById('page-content').innerHTML = contentHtml;
    },

    setPage(title, actionsHtml, contentHtml) {
        UIKit.setPageTitle(title);
        UIKit.setPageActions(actionsHtml);
        UIKit.setPageContent(contentHtml);
    },
};
