const MaterialPicker = {
    create(config) {
        const instance = {
            container: typeof config.container === 'string'
                ? document.querySelector(config.container)
                : config.container,
            fibers: config.fibers || [],
            sizingAgents: config.sizingAgents || [],
            fillers: config.fillers || [],
            components: config.components || [],
            onChange: config.onChange || null,

            _bindRowEvents(row, index) {
                const typeSelect = row.querySelector('[data-field="materialType"]');
                const idSelect = row.querySelector('[data-field="materialId"]');
                const ratioInput = row.querySelector('[data-field="ratio"]');
                const noteInput = row.querySelector('[data-field="notes"]');
                const deleteBtn = row.querySelector('[data-action="delete"]');

                typeSelect.addEventListener('change', (e) => {
                    const value = e.target.value;
                    this.components[index].material_type = value;

                    let selectedId = null;
                    if (value === 'fiber') {
                        selectedId = this.fibers[0]?.id || null;
                        this.components[index].fiber_source_id = selectedId;
                        this.components[index].sizing_agent_id = null;
                        this.components[index].mineral_filler_id = null;
                    } else if (value === 'sizing') {
                        selectedId = this.sizingAgents[0]?.id || null;
                        this.components[index].fiber_source_id = null;
                        this.components[index].sizing_agent_id = selectedId;
                        this.components[index].mineral_filler_id = null;
                    } else {
                        selectedId = this.fillers[0]?.id || null;
                        this.components[index].fiber_source_id = null;
                        this.components[index].sizing_agent_id = null;
                        this.components[index].mineral_filler_id = selectedId;
                    }

                    idSelect.innerHTML = NewAPI.materials.getMaterialOptions(
                        value, this.fibers, this.sizingAgents, this.fillers, selectedId
                    );

                    this._triggerChange();
                });

                idSelect.addEventListener('change', (e) => {
                    const value = parseInt(e.target.value);
                    const comp = this.components[index];
                    if (comp.material_type === 'fiber') {
                        comp.fiber_source_id = value;
                    } else if (comp.material_type === 'sizing') {
                        comp.sizing_agent_id = value;
                    } else {
                        comp.mineral_filler_id = value;
                    }
                    this._triggerChange();
                });

                ratioInput.addEventListener('change', (e) => {
                    this.components[index].ratio = parseFloat(e.target.value) || 0;
                    this._triggerChange();
                });

                noteInput.addEventListener('change', (e) => {
                    this.components[index].notes = e.target.value || null;
                    this._triggerChange();
                });

                deleteBtn.addEventListener('click', () => {
                    this.removeComponentRow(index);
                });
            },

            _triggerChange() {
                if (typeof this.onChange === 'function') {
                    this.onChange(this.components);
                }
            },

            _createRowElement(comp, index, componentId) {
                let selectedId = null;
                if (comp.material_type === 'fiber') selectedId = comp.fiber_source_id;
                else if (comp.material_type === 'sizing') selectedId = comp.sizing_agent_id;
                else selectedId = comp.mineral_filler_id;

                const row = document.createElement('div');
                row.className = 'flex gap-2 items-start p-3 bg-gray-50 rounded-lg';
                row.dataset.rowIndex = index;
                row.dataset.componentId = componentId;
                row.innerHTML = `
                    <div class="flex-1">
                        <label class="label">材料类型</label>
                        <select class="select" data-field="materialType">
                            <option value="fiber" ${comp.material_type === 'fiber' ? 'selected' : ''}>纤维</option>
                            <option value="sizing" ${comp.material_type === 'sizing' ? 'selected' : ''}>胶料</option>
                            <option value="filler" ${comp.material_type === 'filler' ? 'selected' : ''}>填料</option>
                        </select>
                    </div>
                    <div class="flex-1">
                        <label class="label">具体材料</label>
                        <select class="select" data-field="materialId">
                            ${NewAPI.materials.getMaterialOptions(
                                comp.material_type, this.fibers, this.sizingAgents, this.fillers, selectedId
                            )}
                        </select>
                    </div>
                    <div class="w-24">
                        <label class="label">配比 *</label>
                        <input type="number" class="input" data-field="ratio" step="0.01" min="0" value="${comp.ratio}">
                    </div>
                    <div class="flex-1">
                        <label class="label">备注</label>
                        <input type="text" class="input" data-field="notes" value="${comp.notes || ''}">
                    </div>
                    <div class="pt-6">
                        <button type="button" class="btn btn-sm btn-danger" data-action="delete">✕</button>
                    </div>
                `;

                this._bindRowEvents(row, index);
                return row;
            },

            _reindexRows() {
                const rows = this.container.querySelectorAll(':scope > div');
                rows.forEach((row, i) => {
                    row.dataset.rowIndex = i;
                    const deleteBtn = row.querySelector('[data-action="delete"]');
                    const newBtn = deleteBtn.cloneNode(true);
                    deleteBtn.parentNode.replaceChild(newBtn, deleteBtn);
                    newBtn.addEventListener('click', () => {
                        this.removeComponentRow(i);
                    });
                });
            },

            addComponentRow() {
                const componentId = Date.now() + Math.floor(Math.random() * 1000);
                const newComp = NewAPI.materials.createEmptyComponent(this.fibers);
                this.components.push(newComp);

                const index = this.components.length - 1;
                const row = this._createRowElement(newComp, index, componentId);
                this.container.appendChild(row);

                this._triggerChange();
            },

            removeComponentRow(index) {
                this.components.splice(index, 1);
                const rows = this.container.querySelectorAll(':scope > div');
                if (rows[index]) {
                    rows[index].remove();
                }
                this._reindexRows();
                this._triggerChange();
            },

            renderComponents(components) {
                this.container.innerHTML = '';
                this.components.length = 0;

                components.forEach((comp, index) => {
                    const componentId = Date.now() + index;
                    const compCopy = { ...comp };
                    this.components.push(compCopy);
                    const row = this._createRowElement(compCopy, index, componentId);
                    this.container.appendChild(row);
                });

                this._triggerChange();
            },

            getValidComponents() {
                return this.components.filter(c => c.ratio > 0);
            },
        };

        return instance;
    },
};
