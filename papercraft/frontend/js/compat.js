(function () {
    if (typeof window.NewAPI !== 'undefined') {
        window.API = window.NewAPI;
    }

    if (typeof window.UIKit !== 'undefined') {
        window.showToast = function () { return UIKit.toast.apply(UIKit, arguments); };
        window.showModal = function () {
            const result = UIKit.modal.apply(UIKit, arguments);
            return { close: result.close, modal: result.modal };
        };
        window.showConfirmModal = function () { return UIKit.confirm.apply(UIKit, arguments); };
        window.loading = function () { return UIKit.loading.apply(UIKit, arguments); };
        window.emptyState = function () { return UIKit.emptyState.apply(UIKit, arguments); };
        window.validateForm = function () { return UIKit.validateForm.apply(UIKit, arguments); };

        window.formatDate = function () { return UIKit.formatDate.apply(UIKit, arguments); };
        window.formatDateTime = function () { return UIKit.formatDateTime.apply(UIKit, arguments); };
        window.getMaterialTypeName = function () { return UIKit.getMaterialTypeName.apply(UIKit, arguments); };
        window.getMaterialTypeColor = function () { return UIKit.getMaterialTypeColor.apply(UIKit, arguments); };
        window.getStatusBadge = function () { return UIKit.getStatusBadge.apply(UIKit, arguments); };
        window.getRatingStars = function () { return UIKit.getRatingStars.apply(UIKit, arguments); };
    }

    if (typeof window.NewAPI !== 'undefined') {
        window.CATEGORY_MAP = NewAPI.categoryMap;
        window.getCategoryInfo = NewAPI.getCategoryInfo;
    }
})();
