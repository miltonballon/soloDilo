/**
 * UI Controller
 * Handles all UI interactions and rendering
 */
class UIController {
    constructor(dbService, speechService) {
        this.dbService = dbService;
        this.speechService = speechService;
        this.activeDictationButton = null;
        this.activeListId = null;
        this.currentList = null;
        this.isEditing = null;
        this.editingElement = null;
        this.settings = this.dbService.getSettings();

        // DOM Elements
        this.elements = {
            drawer: document.getElementById('drawer'),
            openDrawer: document.getElementById('openDrawer'),
            closeDrawer: document.getElementById('closeDrawer'),
            drawerCloseIcon: document.getElementById('drawerCloseIcon'),
            drawerOverlay: document.getElementById('drawerOverlay'),
            drawerPosition: document.getElementById('drawerPosition'),
            createListBtn: document.getElementById('createListBtn'),
            addListBtn: document.getElementById('addListBtn'),
            listsPanel: document.getElementById('listsPanel'),
            activeListView: document.getElementById('activeListView'),
            listModal: document.getElementById('listModal'),
            modalTitle: document.getElementById('modalTitle'),
            closeModal: document.getElementById('closeModal'),
            listTitle: document.getElementById('listTitle'),
            dictateTitle: document.getElementById('dictateTitle'),
            saveListBtn: document.getElementById('saveListBtn'),
            cancelBtn: document.getElementById('cancelBtn'),
            editTextPopup: document.getElementById('editTextPopup'),
            editTextInput: document.getElementById('editTextInput'),
            dictateEditText: document.getElementById('dictateEditText'),
            saveEditTextBtn: document.getElementById('saveEditTextBtn'),
            cancelEditTextBtn: document.getElementById('cancelEditTextBtn'),
            toast: document.getElementById('toast'),
            toastMessage: document.getElementById('toastMessage')
        };

        // Utility methods
        this.utils = {
            /**
             * Capitaliza la primera letra de un texto
             * @param {string} text - El texto a capitalizar
             * @returns {string} - El texto con la primera letra en mayúscula
             */
            capitalizeFirstLetter: (text) => {
                if (!text || typeof text !== 'string' || text.length === 0) return text;
                return text.charAt(0).toUpperCase() + text.slice(1);
            }
        };

        this.init();
    }

    /**
     * Initialize the UI controller
     */
    init() {
        // Cargar la configuración y aplicar la posición del drawer
        this.settings = this.dbService.getSettings();
        this.applyDrawerPosition();
        
        this.bindEvents();
        this.loadLists();

        // Check if speech recognition is supported
        if (!this.speechService.isSupported()) {
            this.showToast('La dictación por voz no está disponible en este navegador', 'error');
            // Hide voice buttons
            document.querySelectorAll('.voice-btn').forEach(btn => {
                btn.style.display = 'none';
            });
        }
    }
    
    /**
     * Apply the drawer position from settings
     */
    applyDrawerPosition() {
        const position = this.settings.drawerPosition;
        
        // Set the drawer class
        this.elements.drawer.classList.remove('drawer-left', 'drawer-right');
        this.elements.drawer.classList.add(`drawer-${position}`);
        
        // Set the dropdown value
        this.elements.drawerPosition.value = position;
        
        // Update the close icon
        if (position === 'left') {
            this.elements.drawerCloseIcon.classList.remove('fa-arrow-right');
            this.elements.drawerCloseIcon.classList.add('fa-arrow-left');
        } else {
            this.elements.drawerCloseIcon.classList.remove('fa-arrow-left');
            this.elements.drawerCloseIcon.classList.add('fa-arrow-right');
        }
        
        // Update the header layout based on drawer position
        const header = document.querySelector('header');
        if (position === 'left') {
            header.classList.add('drawer-left-mode');
        } else {
            header.classList.remove('drawer-left-mode');
        }
    }

    /**
     * Bind event listeners to UI elements
     */
    bindEvents() {
        // Drawer controls
        this.elements.openDrawer.addEventListener('click', () => this.openDrawer());
        this.elements.closeDrawer.addEventListener('click', () => this.closeDrawer());
        this.elements.drawerOverlay.addEventListener('click', () => this.closeDrawer());
        
        // Drawer position setting
        this.elements.drawerPosition.addEventListener('change', (e) => {
            const newPosition = e.target.value;
            this.settings.drawerPosition = newPosition;
            this.dbService.saveSettings(this.settings);
            
            // Cerrar y reabrir el drawer para aplicar los cambios
            this.closeDrawer();
            
            // Aplicar cambios después de un breve retraso para que se vea la animación
            setTimeout(() => {
                this.applyDrawerPosition();
                this.openDrawer();
                this.showToast(`Menú movido a la ${newPosition === 'left' ? 'izquierda' : 'derecha'}`, 'success');
            }, 300);
        });

        // List creation and editing
        this.elements.createListBtn.addEventListener('click', () => {
            this.openCreateListModal();
            this.closeDrawer();
        });
        this.elements.addListBtn.addEventListener('click', () => this.openCreateListModal());
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
        this.elements.cancelBtn.addEventListener('click', () => this.closeModal());
        this.elements.saveListBtn.addEventListener('click', () => this.saveList());

        // Voice dictation
        this.elements.dictateTitle.addEventListener('click', (e) => this.startDictation(e.target, this.elements.listTitle));
        
        // Edit text popup events
        this.elements.dictateEditText.addEventListener('click', (e) => {
            this.startDictation(e.target, this.elements.editTextInput);
        });
        
        this.elements.saveEditTextBtn.addEventListener('click', () => this.saveInlineEdit());
        this.elements.cancelEditTextBtn.addEventListener('click', () => this.closeInlineEdit());
        
        // Handle Enter and Escape keys in edit text popup
        this.elements.editTextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.saveInlineEdit();
            } else if (e.key === 'Escape') {
                this.closeInlineEdit();
            }
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.listModal) {
                this.closeModal();
            }
        });
        
        // Listener global para los botones de dictado en tareas
        document.addEventListener('click', (e) => {
            if (e.target.closest('.task-voice-btn')) {
                const button = e.target.closest('.task-voice-btn');
                const taskItem = button.closest('.task-item');
                const input = taskItem.querySelector('.task-edit-input');
                
                // Si no está en modo edición, activarlo primero
                if (!taskItem.classList.contains('editing')) {
                    this.startInlineEdit(taskItem);
                }
                
                this.startDictation(button, input);
            }
        });
        
        // Listen for escape key to close popups
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.listModal.classList.contains('show')) {
                    this.closeModal();
                }
            }
        });
    }

    /**
     * Load all lists from the database and render them
     */
    async loadLists() {
        try {
            const lists = await this.dbService.getAllLists();
            this.renderListsPanel(lists);
            
            // Load active list if set
            const activeListId = this.dbService.getActiveListId();
            if (activeListId) {
                this.loadActiveList(activeListId);
            }
        } catch (error) {
            console.error('Error loading lists:', error);
            this.showToast('Error al cargar las listas', 'error');
        }
    }

    /**
     * Update only the lists panel without affecting the active list view
     */
    async updateListsPanelOnly() {
        try {
            const lists = await this.dbService.getAllLists();
            this.renderListsPanel(lists);
        } catch (error) {
            console.error('Error updating lists panel:', error);
        }
    }

    /**
     * Render the lists panel with all todo lists
     * @param {Array} lists - Array of todo list objects
     */
    renderListsPanel(lists) {
        const listsPanel = this.elements.listsPanel;
        listsPanel.innerHTML = '';

        if (lists.length === 0) {
            listsPanel.innerHTML = '<div class="empty-state"><p>No hay listas creadas</p></div>';
            return;
        }

        // Sort lists by last modified date (newest first)
        lists.sort((a, b) => b.lastModified - a.lastModified);

        lists.forEach(list => {
            const listItem = document.createElement('div');
            listItem.className = 'list-item';
            if (this.activeListId === list.id) {
                listItem.classList.add('active');
            }
            listItem.dataset.id = list.id;

            // Capitalizar el título
            const capitalizedTitle = this.utils.capitalizeFirstLetter(list.title);
            
            listItem.innerHTML = `
                <div class="list-title">${capitalizedTitle}</div>
            `;

            // Add event listener to load the list when clicked
            listItem.addEventListener('click', () => {
                this.loadActiveList(list.id);
                // Close drawer with a slight delay to improve animation visibility
                setTimeout(() => {
                    this.closeDrawer();
                }, 50);
            });

            listsPanel.appendChild(listItem);
        });
    }

    /**
     * Load and display a list as the active list
     * @param {number} id - The ID of the list to load
     */
    async loadActiveList(id) {
        try {
            const list = await this.dbService.getListById(id);
            if (!list) {
                throw new Error('Lista no encontrada');
            }

            this.activeListId = id;
            this.currentList = list;
            this.dbService.setActiveList(id);
            
            // Update lists panel to highlight active list
            document.querySelectorAll('.list-item').forEach(item => {
                item.classList.remove('active');
                if (parseInt(item.dataset.id) === id) {
                    item.classList.add('active');
                }
            });

            this.renderActiveList(list);
        } catch (error) {
            console.error('Error loading active list:', error);
            this.showToast('Error al cargar la lista', 'error');
        }
    }

    /**
     * Render the active list view
     * @param {Object} list - The todo list object to render
     */
    renderActiveList(list) {
        const activeListView = this.elements.activeListView;
        
        // Capitalizar el título
        const capitalizedTitle = this.utils.capitalizeFirstLetter(list.title);
        
        activeListView.innerHTML = `
            <div class="list-header">
                <div class="list-title-container">
                    <h2 class="list-title" data-type="title">${capitalizedTitle}</h2>
                    <input type="text" class="list-title-edit-input" value="${capitalizedTitle}">
                    <button class="voice-btn list-title-voice-btn" title="Dictar título">
                        <i class="fas fa-microphone"></i>
                    </button>
                </div>
                <div class="list-actions">
                    <button class="btn danger delete-active-list-btn">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
            <div class="swipe-hint">
                <i class="fas fa-arrows-alt-h"></i>
                Desliza a la derecha para completar y a la izquierda para eliminar
                <i class="fas fa-hand-pointer ml-auto"></i>
                Mantén presionado para editar directamente
            </div>
            <ul class="task-list">
                ${list.tasks.length === 0 ? '<div class="empty-state"><p>No hay tareas en esta lista</p></div>' : ''}
                ${list.tasks.map((task, index) => {
                    // Capitalizar cada tarea
                    const capitalizedTask = this.utils.capitalizeFirstLetter(task.text);
                    return `
                        <li class="task-item ${task.completed ? 'completed' : ''}" data-index="${index}">
                            <input type="checkbox" class="task-checkbox" data-index="${index}" ${task.completed ? 'checked' : ''}>
                            <div class="task-content" data-index="${index}">
                                <div class="task-text-container">
                                    <span class="task-text" data-type="task" data-index="${index}">${capitalizedTask}</span>
                                    <input type="text" class="task-edit-input" value="${capitalizedTask}" data-index="${index}">
                                    <button class="voice-btn task-voice-btn" data-index="${index}" title="Dictar tarea">
                                        <i class="fas fa-microphone"></i>
                                    </button>
                                </div>
                            </div>
                        </li>
                    `;
                }).join('')}
            </ul>
            <button class="add-task-btn" id="addNewTaskBtn">
                <i class="fas fa-plus"></i> Añadir nueva tarea
            </button>
        `;

        // Add event listeners
        const listTitleContainer = activeListView.querySelector('.list-title-container');
        listTitleContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('list-title')) {
                this.startListTitleInlineEdit(listTitleContainer);
            }
        });

        activeListView.querySelector('.delete-active-list-btn').addEventListener('click', () => {
            this.deleteList(list.id);
        });

        // Add event listeners for list title editing
        const listTitleInput = activeListView.querySelector('.list-title-edit-input');
        listTitleInput.addEventListener('input', (e) => {
            this.autoSaveListTitleEdit(e.target);
        });

        listTitleInput.addEventListener('blur', (e) => {
            setTimeout(() => {
                if (!this.activeDictationButton || !this.activeDictationButton.closest('.list-title-voice-btn')) {
                    this.finishListTitleInlineEdit(listTitleContainer);
                }
            }, 100);
        });

        listTitleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.finishListTitleInlineEdit(listTitleContainer);
            } else if (e.key === 'Escape') {
                this.cancelListTitleInlineEdit(listTitleContainer);
            }
        });

        // Add event listener for list title voice button
        const listTitleVoiceBtn = activeListView.querySelector('.list-title-voice-btn');
        if (listTitleVoiceBtn) {
            listTitleVoiceBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startDictation(listTitleVoiceBtn, listTitleInput);
            });
        }

        // Add event listeners for checkboxes
        activeListView.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.toggleTaskComplete(parseInt(checkbox.dataset.index, 10));
            });
        });

        // Add event listeners for task text click to edit
        activeListView.querySelectorAll('.task-text').forEach(taskText => {
            taskText.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                this.startInlineEdit(e.target.closest('.task-item'));
            });
        });

        // Add event listeners for input change to save automatically
        activeListView.querySelectorAll('.task-edit-input').forEach(input => {
            input.addEventListener('input', (e) => {
                this.autoSaveTaskEdit(e.target);
            });
            
            // Handle blur to finish editing
            input.addEventListener('blur', (e) => {
                // Pequeño timeout para permitir que el evento click del botón de micrófono se procese primero
                setTimeout(() => {
                    if (!this.activeDictationButton || !this.activeDictationButton.closest('.task-voice-btn')) {
                        this.finishInlineEdit(e.target.closest('.task-item'));
                    }
                }, 100);
            });
            
            // Handle enter key to finish editing
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.finishInlineEdit(e.target.closest('.task-item'));
                } else if (e.key === 'Escape') {
                    this.cancelInlineEdit(e.target.closest('.task-item'));
                }
            });
        });

        // Add swipe gesture functionality for each task item
        activeListView.querySelectorAll('.task-item').forEach(taskItem => {
            this.addSwipeGesture(taskItem);
        });

        // Add new task button
        activeListView.querySelector('#addNewTaskBtn').addEventListener('click', () => {
            this.addNewTask();
        });
    }

    /**
     * Add a new task to the current list directly from the main view
     */
    async addNewTask() {
        if (!this.currentList) return;
        
        // Añadir una tarea vacía a la lista actual
        this.currentList.tasks.push({ text: "Nueva tarea", completed: false });
        
        // Re-renderizar la lista
        this.renderActiveList(this.currentList);
        
        // Guardar en la base de datos
        await this.dbService.saveList(this.currentList);
        
        // Activar edición en la nueva tarea
        const taskItems = document.querySelectorAll('.task-item');
        const newTaskItem = taskItems[taskItems.length - 1];
        if (newTaskItem) {
            this.startInlineEdit(newTaskItem);
        }
    }

    /**
     * Show inline edit popup for text editing
     * @param {HTMLElement} element - The element being edited
     * @param {string} type - The type of element being edited ('title', 'task', 'new-task')
     * @param {number} index - The index of the task (for task editing)
     */
    showInlineEdit(element, type, index = null) {
        const popup = this.elements.editTextPopup;
        const input = this.elements.editTextInput;
        
        // Store reference to the element being edited and its type
        this.editingElement = element;
        this.editingType = type;
        this.editingIndex = index;
        
        // Set input value based on type
        if (type === 'title') {
            input.value = this.currentList.title;
            input.placeholder = 'Título de la lista';
        } else if (type === 'task') {
            input.value = this.currentList.tasks[index].text;
            input.placeholder = 'Texto de la tarea';
        } else if (type === 'new-task') {
            input.value = '';
            input.placeholder = 'Nueva tarea';
        }
        
        // Position the popup
        if (element) {
            const rect = element.getBoundingClientRect();
            popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
            popup.style.left = `${rect.left + window.scrollX}px`;
        } else {
            // For new task, position at the bottom of the task list
            const addTaskBtn = document.getElementById('addNewTaskBtn');
            const rect = addTaskBtn.getBoundingClientRect();
            popup.style.top = `${rect.top + window.scrollY - 5}px`;
            popup.style.left = `${rect.left + window.scrollX}px`;
        }
        
        // Show popup and focus input
        popup.classList.add('show');
        input.focus();
        
        // Select all text
        input.select();
    }

    /**
     * Save the inline edit
     */
    async saveInlineEdit() {
        const text = this.elements.editTextInput.value.trim();
        
        if (!text) {
            this.showToast('El texto no puede estar vacío', 'error');
            return;
        }
        
        if (!this.currentList) {
            this.closeInlineEdit();
            return;
        }
        
        // Capitalizar el texto
        const capitalizedText = this.utils.capitalizeFirstLetter(text);
        
        try {
            if (this.editingType === 'title') {
                this.currentList.title = capitalizedText;
                this.editingElement.textContent = capitalizedText;
            } else if (this.editingType === 'task') {
                this.currentList.tasks[this.editingIndex].text = capitalizedText;
                this.editingElement.textContent = capitalizedText;
            } else if (this.editingType === 'new-task') {
                this.currentList.tasks.push({ text: capitalizedText, completed: false });
                // Re-render the list to show the new task
                this.renderActiveList(this.currentList);
            }
            
            // Save to database
            await this.dbService.saveList(this.currentList);
            
            // Update lists panel to reflect any changes
            this.loadLists();
            
            this.closeInlineEdit();
        } catch (error) {
            console.error('Error saving edit:', error);
            this.showToast('Error al guardar los cambios', 'error');
        }
    }

    /**
     * Guarda los cambios realizados en la edición inline de una tarea
     */
    async saveInlineTaskEdit() {
        if (!this.editingElement || !this.currentList) return;
        
        const editInput = this.editingElement.querySelector('.task-edit-input');
        const taskText = this.editingElement.querySelector('.task-text');
        const index = parseInt(this.editingElement.dataset.index, 10);
        
        if (!editInput || index === undefined) return;
        
        const text = editInput.value.trim();
        
        if (text) {
            try {
                // Capitalizar el texto
                const capitalizedText = this.utils.capitalizeFirstLetter(text);
                
                // Actualizar el texto en la lista
                this.currentList.tasks[index].text = capitalizedText;
                
                // Actualizar el texto visible
                taskText.textContent = capitalizedText;
                
                // Guardar en la base de datos
                await this.dbService.saveList(this.currentList);
                
                // Actualizar el panel de listas
                this.loadLists();
                
            } catch (error) {
                console.error('Error al guardar la tarea editada:', error);
                this.showToast('Error al guardar los cambios', 'error');
            }
        } else {
            // Si el texto está vacío, restaurar el texto anterior
            editInput.value = this.currentList.tasks[index].text;
            this.showToast('El texto de la tarea no puede estar vacío', 'error');
        }
        
        // Quitar la clase de edición y restaurar la visualización
        this.editingElement.classList.remove('editing', 'long-press');
        taskText.style.display = '';
        this.editingElement.querySelector('.task-edit-container').style.display = 'none';
        this.editingElement = null;
        this.editingIndex = null;
        
        // Detener la dictación si está activa
        if (this.activeDictationButton && this.activeDictationButton.closest('.task-voice-btn')) {
            this.activeDictationButton.classList.remove('active');
            this.speechService.stopListening();
            this.activeDictationButton = null;
        }
    }

    /**
     * Close the inline edit popup
     */
    closeInlineEdit() {
        this.elements.editTextPopup.classList.remove('show');
        this.editingElement = null;
        this.editingType = null;
        this.editingIndex = null;
        
        // Stop dictation if active
        if (this.activeDictationButton && this.activeDictationButton === this.elements.dictateEditText) {
            this.activeDictationButton.classList.remove('active');
            this.speechService.stopListening();
            this.activeDictationButton = null;
        }
    }

    /**
     * Open the drawer
     */
    openDrawer() {
        this.elements.drawer.classList.add('open');
        this.elements.drawerOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling when drawer is open
    }

    /**
     * Close the drawer
     */
    closeDrawer() {
        this.elements.drawer.classList.remove('open');
        this.elements.drawerOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }

    /**
     * Open the create list modal
     */
    openCreateListModal() {
        this.isEditing = false;
        this.elements.modalTitle.textContent = 'Nueva Lista';
        this.elements.listTitle.value = '';
        
        this.showModal();
    }

    /**
     * Open the edit list modal - simplified to only edit title
     * @param {number} id - The ID of the list to edit
     */
    async editList(id) {
        try {
            const list = await this.dbService.getListById(id);
            if (!list) {
                throw new Error('Lista no encontrada');
            }
            
            this.isEditing = true;
            this.currentList = list;
            
            this.elements.modalTitle.textContent = 'Editar Lista';
            // Usar el título ya capitalizado que tiene la lista
            this.elements.listTitle.value = list.title;
            
            this.showModal();
        } catch (error) {
            console.error('Error loading list for editing:', error);
            this.showToast('Error al cargar la lista para editar', 'error');
        }
    }

    /**
     * Save the current list (create new or update existing)
     */
    async saveList() {
        const title = this.elements.listTitle.value.trim();
        if (!title) {
            this.showToast('El título de la lista no puede estar vacío', 'error');
            return;
        }

        // Capitalizar el título
        const capitalizedTitle = this.utils.capitalizeFirstLetter(title);

        try {
            let list = {
                title: capitalizedTitle,
                tasks: [] // Crear lista vacía
            };

            if (this.isEditing && this.currentList) {
                list.id = this.currentList.id;
                // Si estamos editando, mantener las tareas existentes
                list.tasks = this.currentList.tasks || [];
            }

            const id = await this.dbService.saveList(list);
            
            if (!this.isEditing) {
                // Si es una nueva lista, abrirla automáticamente
                this.activeListId = id;
                this.dbService.setActiveList(id);
                // Cargar y mostrar la nueva lista
                await this.loadActiveList(id);
            }
            
            this.showToast(this.isEditing ? 'Lista actualizada correctamente' : 'Lista creada correctamente', 'success');
            this.closeModal();
            this.loadLists();
        } catch (error) {
            console.error('Error saving list:', error);
            this.showToast('Error al guardar la lista', 'error');
        }
    }

    /**
     * Delete a list
     * @param {number} id - The ID of the list to delete
     */
    async deleteList(id) {
        if (!confirm('¿Estás seguro de que deseas eliminar esta lista?')) {
            return;
        }

        try {
            await this.dbService.deleteList(id);
            
            // If deleting active list, clear active list
            if (this.activeListId === id) {
                this.activeListId = null;
                this.dbService.setActiveList(null);
                this.elements.activeListView.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-clipboard-list fa-4x"></i>
                        <p>Selecciona una lista o crea una nueva para comenzar</p>
                    </div>
                `;
            }
            
            this.showToast('Lista eliminada correctamente', 'success');
            this.loadLists();
        } catch (error) {
            console.error('Error deleting list:', error);
            this.showToast('Error al eliminar la lista', 'error');
        }
    }

    /**
     * Toggle task completion status
     * @param {number} index - The index of the task in the current list
     */
    async toggleTaskComplete(index) {
        if (!this.currentList || !this.currentList.tasks || index >= this.currentList.tasks.length) {
            return;
        }

        this.currentList.tasks[index].completed = !this.currentList.tasks[index].completed;
        
        try {
            await this.dbService.saveList(this.currentList);
            this.renderActiveList(this.currentList);
        } catch (error) {
            console.error('Error updating task:', error);
            this.showToast('Error al actualizar la tarea', 'error');
        }
    }

    /**
     * Delete a task from the current list
     * @param {number} index - The index of the task to delete
     */
    async deleteTask(index) {
        if (!this.currentList || !this.currentList.tasks || index >= this.currentList.tasks.length) {
            return;
        }

        this.currentList.tasks.splice(index, 1);
        
        try {
            await this.dbService.saveList(this.currentList);
            this.renderActiveList(this.currentList);
        } catch (error) {
            console.error('Error deleting task:', error);
            this.showToast('Error al eliminar la tarea', 'error');
        }
    }

    /**
     * Start voice dictation
     * @param {HTMLElement} button - The voice button that was clicked
     * @param {HTMLInputElement} input - The input element to dictate into
     */
    startDictation(button, input) {
        // If we're already listening, stop
        if (this.activeDictationButton) {
            this.activeDictationButton.classList.remove('active');
            this.speechService.stopListening();
        }

        // Find the actual button element if it's an icon
        const buttonElement = button.tagName === 'BUTTON' ? button : button.closest('button');
        
        // Asegurar que el input está disponible
        if (!input || !buttonElement) {
            console.error('Input o botón no disponible para dictado');
            return;
        }
        
        // Start listening
        buttonElement.classList.add('active');
        this.activeDictationButton = buttonElement;
        
        this.speechService.startListening(input, (text, error) => {
            buttonElement.classList.remove('active');
            this.activeDictationButton = null;
            
            if (error) {
                this.showToast('Error en el reconocimiento de voz: ' + error, 'error');
            }
        });
    }

    /**
     * Show the list modal
     */
    showModal() {
        this.elements.listModal.classList.add('show');
    }

    /**
     * Close the list modal
     */
    closeModal() {
        this.elements.listModal.classList.remove('show');
        
        // Stop dictation if active
        if (this.activeDictationButton) {
            this.activeDictationButton.classList.remove('active');
            this.speechService.stopListening();
            this.activeDictationButton = null;
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to show
     * @param {string} type - The type of toast ('success' or 'error')
     */
    showToast(message, type = 'success') {
        const toast = this.elements.toast;
        const toastMessage = this.elements.toastMessage;
        
        // Set message and type
        toastMessage.textContent = message;
        toast.className = 'toast';
        toast.classList.add(type);
        
        // Show toast
        toast.classList.add('show');
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    /**
     * Añade funcionalidad de deslizamiento (swipe) a un elemento de tarea
     * @param {HTMLElement} element - El elemento al que añadir el gesto de deslizamiento
     */
    addSwipeGesture(element) {
        let startX, moveX, offsetX = 0;
        let longPressTimer = null; // Timer para detectar pulsación larga
        let hasMoved = false; // Indica si ha habido movimiento durante el toque
        const threshold = 70; // Umbral para considerar un deslizamiento completo
        const longPressDelay = 1500; // Tiempo en ms para considerar pulsación larga (1.5 segundos)
        
        const handleTouchStart = (e) => {
            startX = e.touches[0].clientX;
            element.classList.add('swiping');
            element.classList.remove('slide-left', 'slide-right');
            hasMoved = false;
            
            // Iniciar el timer para detectar pulsación larga
            longPressTimer = setTimeout(() => {
                // Solo activar la edición inline si no ha habido movimiento
                if (!hasMoved) {
                    element.classList.add('long-press');
                    this.startInlineEdit(element);
                }
            }, longPressDelay);
        };
        
        const handleTouchMove = (e) => {
            if (!startX) return;
            
            // Marcar que ha habido movimiento
            hasMoved = true;
            
            // Cancelar el timer de pulsación larga si hay movimiento
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            moveX = e.touches[0].clientX;
            offsetX = moveX - startX;
            
            // Limitar el deslizamiento
            if (Math.abs(offsetX) > threshold) {
                offsetX = offsetX > 0 ? threshold : -threshold;
            }
            
            element.style.transform = `translateX(${offsetX}px)`;
            
            // Feedback visual mientras desliza
            if (offsetX > 20) {
                element.classList.add('slide-right');
                element.classList.remove('slide-left');
            } else if (offsetX < -20) {
                element.classList.add('slide-left');
                element.classList.remove('slide-right');
            } else {
                element.classList.remove('slide-left', 'slide-right');
            }
            
            // Prevenir scroll mientras se desliza
            if (Math.abs(offsetX) > 10) {
                e.preventDefault();
            }
        };
        
        const handleTouchEnd = () => {
            element.classList.remove('swiping');
            element.style.transform = '';
            
            // Cancelar el timer de pulsación larga
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            if (!startX || !moveX) return;
            
            const index = parseInt(element.dataset.index, 10);
            
            if (offsetX > threshold / 2) {
                // Deslizamiento a la derecha - marcar como completada
                this.toggleTaskComplete(index);
            } else if (offsetX < -threshold / 2) {
                // Deslizamiento a la izquierda - eliminar
                this.deleteTask(index);
            } else {
                // Deslizamiento pequeño - restaurar posición
                element.classList.remove('slide-left', 'slide-right');
            }
            
            // Resetear valores
            startX = moveX = offsetX = 0;
        };
        
        // Añadir listeners de eventos touch
        element.addEventListener('touchstart', handleTouchStart, { passive: true });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);
        element.addEventListener('touchcancel', handleTouchEnd);
        
        // Soporte para ratón (para pruebas en desktop)
        let isMouseDown = false;
        let mouseLongPressTimer = null;
        
        element.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            startX = e.clientX;
            element.classList.add('swiping');
            element.classList.remove('slide-left', 'slide-right');
            hasMoved = false;
            
            // Iniciar el timer para detectar pulsación larga con ratón
            mouseLongPressTimer = setTimeout(() => {
                // Solo activar la edición inline si no ha habido movimiento
                if (isMouseDown && !hasMoved) {
                    element.classList.add('long-press');
                    this.startInlineEdit(element);
                }
            }, longPressDelay);
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isMouseDown) return;
            
            // Marcar que ha habido movimiento
            hasMoved = true;
            
            // Cancelar el timer de pulsación larga si hay movimiento
            if (mouseLongPressTimer) {
                clearTimeout(mouseLongPressTimer);
                mouseLongPressTimer = null;
            }
            
            moveX = e.clientX;
            offsetX = moveX - startX;
            
            // Limitar el deslizamiento
            if (Math.abs(offsetX) > threshold) {
                offsetX = offsetX > 0 ? threshold : -threshold;
            }
            
            element.style.transform = `translateX(${offsetX}px)`;
            
            // Feedback visual mientras desliza
            if (offsetX > 20) {
                element.classList.add('slide-right');
                element.classList.remove('slide-left');
            } else if (offsetX < -20) {
                element.classList.add('slide-left');
                element.classList.remove('slide-right');
            } else {
                element.classList.remove('slide-left', 'slide-right');
            }
        });
        
        const mouseUpHandler = () => {
            if (!isMouseDown) return;
            
            isMouseDown = false;
            element.classList.remove('swiping', 'long-press');
            element.style.transform = '';
            
            // Cancelar el timer de pulsación larga
            if (mouseLongPressTimer) {
                clearTimeout(mouseLongPressTimer);
                mouseLongPressTimer = null;
            }
            
            if (!startX || !moveX) return;
            
            const index = parseInt(element.dataset.index, 10);
            
            if (offsetX > threshold / 2) {
                // Deslizamiento a la derecha - marcar como completada
                this.toggleTaskComplete(index);
            } else if (offsetX < -threshold / 2) {
                // Deslizamiento a la izquierda - eliminar
                this.deleteTask(index);
            } else {
                // Deslizamiento pequeño - restaurar posición
                element.classList.remove('slide-left', 'slide-right');
            }
            
            // Resetear valores
            startX = moveX = offsetX = 0;
        };
        
        document.addEventListener('mouseup', mouseUpHandler);
        document.addEventListener('mouseleave', mouseUpHandler);
    }
    
    /**
     * Inicia la edición inline de una tarea
     * @param {HTMLElement} taskItem - El elemento de tarea a editar
     */
    startInlineEdit(taskItem) {
        if (!taskItem) return;
        
        // Si ya hay algún elemento en edición, terminamos primero esa edición
        if (this.editingElement && this.editingElement !== taskItem) {
            this.finishInlineEdit(this.editingElement);
        }
        
        // Marcar el elemento como en edición
        taskItem.classList.add('editing');
        
        // Almacenar referencia al elemento en edición
        this.editingElement = taskItem;
        this.editingIndex = parseInt(taskItem.dataset.index, 10);
        
        // Obtener el input y darle foco
        const input = taskItem.querySelector('.task-edit-input');
        if (input) {
            // Guardar el valor original para poder cancelar
            input.dataset.originalValue = input.value;
            
            // Enfocar y seleccionar todo el texto
            input.focus();
            input.select();
            
            // Configurar el botón de micrófono para dictado durante la edición
            const micButton = taskItem.querySelector('.task-voice-btn');
            if (micButton) {
                // Limpiar eventos anteriores para evitar duplicación
                const newMicButton = micButton.cloneNode(true);
                micButton.parentNode.replaceChild(newMicButton, micButton);
                
                // Asegurar que el ícono dentro del botón no interfiera con los clics
                const micIcon = newMicButton.querySelector('i');
                if (micIcon) {
                    micIcon.style.pointerEvents = 'none';
                }
                
                // Añadir evento de dictado directamente
                newMicButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Evitar propagación del evento
                    this.startDictation(newMicButton, input);
                });
            }
        }
    }
    
    /**
     * Finaliza la edición inline de una tarea
     * @param {HTMLElement} taskItem - El elemento de tarea que estaba en edición
     */
    finishInlineEdit(taskItem) {
        if (!taskItem || !this.currentList || taskItem !== this.editingElement) return;
        
        const input = taskItem.querySelector('.task-edit-input');
        const index = this.editingIndex;
        
        if (input) {
            const text = input.value.trim();
            
            if (text) {
                // No hace falta guardar aquí porque ya se guardó en autoSaveTaskEdit
                // Sólo actualizamos el panel de listas para reflejar cambios
                this.loadLists();
            } else {
                // Si está vacío, restauramos el valor original
                const originalText = this.currentList.tasks[index].text;
                input.value = originalText;
                taskItem.querySelector('.task-text').textContent = originalText;
            }
        }
        
        // Quitar la clase de edición
        taskItem.classList.remove('editing', 'long-press');
        
        // Limpiar referencias
        this.editingElement = null;
        this.editingIndex = null;
        
        // Detener la dictación si está activa
        if (this.activeDictationButton) {
            this.activeDictationButton.classList.remove('active');
            this.speechService.stopListening();
            this.activeDictationButton = null;
        }
    }

    /**
     * Auto-save task edit changes as the user types
     * @param {HTMLInputElement} input - The input element being edited
     */
    async autoSaveTaskEdit(input) {
        if (!this.currentList || !input) return;
        
        const taskItem = input.closest('.task-item');
        if (!taskItem) return;
        
        const index = parseInt(taskItem.dataset.index, 10);
        if (index === undefined || !this.currentList.tasks[index]) return;
        
        const text = input.value.trim();
        
        if (text && text !== this.currentList.tasks[index].text) {
            try {
                // Capitalizar el texto
                const capitalizedText = this.utils.capitalizeFirstLetter(text);
                
                // Actualizar el texto en la lista
                this.currentList.tasks[index].text = capitalizedText;
                
                // Actualizar el texto visible
                const taskText = taskItem.querySelector('.task-text');
                if (taskText) {
                    taskText.textContent = capitalizedText;
                }
                
                // Guardar en la base de datos
                await this.dbService.saveList(this.currentList);
                
            } catch (error) {
                console.error('Error al auto-guardar la tarea:', error);
                // No mostramos toast aquí para evitar spam durante la edición
            }
        }
    }

    /**
     * Cancel inline edit and restore original value
     * @param {HTMLElement} taskItem - The task item being edited
     */
    cancelInlineEdit(taskItem) {
        if (!taskItem || taskItem !== this.editingElement) return;
        
        const input = taskItem.querySelector('.task-edit-input');
        if (input && input.dataset.originalValue) {
            input.value = input.dataset.originalValue;
        }
        
        this.finishInlineEdit(taskItem);
    }

    /**
     * Start inline editing for list title
     * @param {HTMLElement} titleContainer - The title container element
     */
    startListTitleInlineEdit(titleContainer) {
        if (!titleContainer || !this.currentList) return;
        
        // If already editing, return
        if (titleContainer.classList.contains('editing')) return;
        
        // Mark as editing
        titleContainer.classList.add('editing');
        this.editingElement = titleContainer;
        
        // Get input and focus
        const input = titleContainer.querySelector('.list-title-edit-input');
        if (input) {
            input.dataset.originalValue = input.value;
            input.focus();
            input.select();
        }
    }

    /**
     * Finish inline editing for list title
     * @param {HTMLElement} titleContainer - The title container element
     */
    finishListTitleInlineEdit(titleContainer) {
        if (!titleContainer || !this.currentList || titleContainer !== this.editingElement) return;
        
        const input = titleContainer.querySelector('.list-title-edit-input');
        const titleElement = titleContainer.querySelector('.list-title');
        
        if (input && titleElement) {
            const text = input.value.trim();
            
            if (text) {
                // Update the title element with the new text
                const capitalizedText = this.utils.capitalizeFirstLetter(text);
                titleElement.textContent = capitalizedText;
                input.value = capitalizedText;
            } else {
                // If empty, restore original value
                const originalText = this.currentList.title;
                input.value = originalText;
                titleElement.textContent = originalText;
            }
        }
        
        // Remove editing state
        titleContainer.classList.remove('editing');
        this.editingElement = null;
        
        // Update lists panel to show changes
        this.updateListsPanelOnly();
        
        // Stop dictation if active
        if (this.activeDictationButton) {
            this.activeDictationButton.classList.remove('active');
            this.speechService.stopListening();
            this.activeDictationButton = null;
        }
    }

    /**
     * Auto-save list title edit changes
     * @param {HTMLInputElement} input - The input element being edited
     */
    async autoSaveListTitleEdit(input) {
        if (!this.currentList || !input) return;
        
        const text = input.value.trim();
        
        if (text && text !== this.currentList.title) {
            try {
                const capitalizedText = this.utils.capitalizeFirstLetter(text);
                this.currentList.title = capitalizedText;
                
                // Update the visible title
                const titleElement = input.parentElement.querySelector('.list-title');
                if (titleElement) {
                    titleElement.textContent = capitalizedText;
                }
                
                // Save to database
                await this.dbService.saveList(this.currentList);
                
                // Update lists panel without re-rendering the current view
                // Only update the sidebar panel, not the active list view
                this.updateListsPanelOnly();
                
            } catch (error) {
                console.error('Error al auto-guardar el título:', error);
            }
        }
    }

    /**
     * Cancel list title inline edit and restore original value
     * @param {HTMLElement} titleContainer - The title container element
     */
    cancelListTitleInlineEdit(titleContainer) {
        if (!titleContainer || titleContainer !== this.editingElement) return;
        
        const input = titleContainer.querySelector('.list-title-edit-input');
        if (input && input.dataset.originalValue) {
            input.value = input.dataset.originalValue;
            const titleElement = titleContainer.querySelector('.list-title');
            if (titleElement) {
                titleElement.textContent = input.dataset.originalValue;
            }
        }
        
        this.finishListTitleInlineEdit(titleContainer);
    }
}
