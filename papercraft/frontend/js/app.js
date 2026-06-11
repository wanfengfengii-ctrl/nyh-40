const App = {
    currentRoute: null,

    routes: {
        materials: MaterialsPage,
        batches: BatchesPage,
        concentrations: ConcentrationsPage,
        records: RecordsPage,
        compare: ComparePage,
        statistics: StatisticsPage,
        summary: SummaryPage,
        templates: TemplatesPage,
        images: ImagesPage,
    },

    init() {
        window.addEventListener('hashchange', () => this.handleRoute());
        this.handleRoute();
    },

    handleRoute() {
        const hash = window.location.hash.replace('#/', '') || 'home';
        const route = hash.split('/')[0];

        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.route === route) {
                link.classList.add('active');
            }
        });

        if (this.currentRoute && this.currentRoute.unmount) {
            this.currentRoute.unmount();
        }

        if (this.routes[route]) {
            this.currentRoute = this.routes[route];
            this.currentRoute.mount();
        } else {
            document.getElementById('page-title').textContent = '欢迎使用';
            document.getElementById('page-actions').innerHTML = '';
        }
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
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
