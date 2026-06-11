class PageState {
    constructor(options = {}) {
        this.pageTitle = options.pageTitle || '';
        this.pageActions = options.pageActions || '';
        this.enableCache = options.enableCache || false;
        this.cacheTTL = options.cacheTTL || 5 * 60 * 1000;
        this._cacheKey = null;
        this._cacheTimestamp = 0;
        this._state = options.initialState || {};
        this._isMounted = false;
        this._bindMethods();
    }

    _bindMethods() {
        const proto = Object.getPrototypeOf(this);
        const methodNames = Object.getOwnPropertyNames(proto);
        for (const name of methodNames) {
            if (typeof this[name] === 'function' && name !== 'constructor') {
                this[name] = this[name].bind(this);
            }
        }
    }

    get state() {
        return { ...this._state };
    }

    setState(partial, autoRender = true) {
        this._state = { ...this._state, ...partial };
        if (autoRender && this._isMounted) {
            this.render();
        }
        return this.state;
    }

    async mount() {
        this._isMounted = true;
        try {
            this.setPage();
            UIKit.loading(true);
            const shouldLoad = await this._shouldLoadData();
            if (shouldLoad) {
                await this.loadData();
                this._saveToCache();
            } else {
                this._loadFromCache();
            }
        } catch (error) {
            this.handleError(error, '初始化页面失败');
        } finally {
            UIKit.loading(false);
            if (this._isMounted) {
                this.render();
            }
        }
    }

    unmount() {
        this._isMounted = false;
    }

    setPage() {
        UIKit.setPage(
            this.pageTitle,
            typeof this.pageActions === 'function' ? this.pageActions() : this.pageActions,
            ''
        );
    }

    async loadData() {
    }

    render() {
    }

    async refresh() {
        if (!this._isMounted) return;
        try {
            UIKit.loading(true);
            this._clearCache();
            await this.loadData();
            this._saveToCache();
            UIKit.toast('数据已刷新', 'success');
        } catch (error) {
            this.handleError(error, '刷新失败');
        } finally {
            UIKit.loading(false);
            if (this._isMounted) {
                this.render();
            }
        }
    }

    handleError(error, prefix = '操作失败') {
        const message = error?.message || String(error);
        UIKit.toast(`${prefix}: ${message}`, 'error');
    }

    async safeCall(fn, options = {}) {
        const {
            successMsg = null,
            errorMsg = '操作失败',
            onSuccess = null,
            onError = null,
            showLoading = false,
        } = options;

        if (showLoading) UIKit.loading(true);
        try {
            const result = typeof fn === 'function' ? await fn() : await fn;
            if (successMsg) UIKit.toast(successMsg, 'success');
            if (onSuccess) onSuccess(result);
            return result;
        } catch (error) {
            this.handleError(error, errorMsg);
            if (onError) onError(error);
            throw error;
        } finally {
            if (showLoading) UIKit.loading(false);
        }
    }

    async safeRender(fn, fallbackHtml = '') {
        try {
            return await fn();
        } catch (error) {
            this.handleError(error, '渲染失败');
            return fallbackHtml || UIKit.emptyState('渲染失败，请重试', '❌');
        }
    }

    _getCacheKey() {
        return this._cacheKey || `PageState:${this.constructor.name || 'default'}`;
    }

    _shouldLoadData() {
        if (!this.enableCache) return Promise.resolve(true);
        const cached = sessionStorage.getItem(this._getCacheKey());
        if (!cached) return Promise.resolve(true);
        try {
            const { timestamp } = JSON.parse(cached);
            const now = Date.now();
            if (now - timestamp > this.cacheTTL) return Promise.resolve(true);
            return Promise.resolve(false);
        } catch {
            return Promise.resolve(true);
        }
    }

    _saveToCache() {
        if (!this.enableCache) return;
        try {
            const cacheData = {
                timestamp: Date.now(),
                state: this._state,
            };
            sessionStorage.setItem(this._getCacheKey(), JSON.stringify(cacheData));
        } catch {
        }
    }

    _loadFromCache() {
        if (!this.enableCache) return;
        try {
            const cached = sessionStorage.getItem(this._getCacheKey());
            if (!cached) return;
            const { state } = JSON.parse(cached);
            this._state = { ...this._state, ...state };
        } catch {
        }
    }

    _clearCache() {
        if (this.enableCache) {
            sessionStorage.removeItem(this._getCacheKey());
        }
    }

    setCacheKey(key) {
        this._cacheKey = key;
    }

    empty(message, icon = '📭') {
        return UIKit.emptyState(message, icon);
    }

    setTitle(title) {
        this.pageTitle = title;
        UIKit.setPageTitle(title);
    }

    setActions(actionsHtmlOrFn) {
        this.pageActions = actionsHtmlOrFn;
        const html = typeof actionsHtmlOrFn === 'function' ? actionsHtmlOrFn() : actionsHtmlOrFn;
        UIKit.setPageActions(html);
    }

    setContent(html) {
        UIKit.setPageContent(html);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PageState;
}
