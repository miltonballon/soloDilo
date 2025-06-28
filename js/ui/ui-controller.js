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
        this.isEditing = false;

        // DOM Elements
        this.elements = {
            createListBtn: document.getElementById('createListBtn'),
            listsPanel: document.getElementById('listsPanel'),
            activeListView: document.getElementById('activeListView'),
            listModal: document.getElementById('listModal'),
            modalTitle: document.getElementById('modalTitle'),
            closeModal: document.getElementById('closeModal'),
            listTitle: document.getElementById('listTitle'),
            dictateTitle: document.getElementById('dictateTitle'),
            taskInputContainer: document.getElementById('taskInputContainer'),
            addTaskBtn: document.getElementById('addTaskBtn'),
            saveListBtn: document.getElementById('saveListBtn'),
            cancelBtn: document.getElementById('cancelBtn'),
            toast: document.getElementById('toast'),
            toastMessage: document.getElementById('toastMessage')
        };

        this.init();
    }

    /**
     * Initialize the UI controller
     */
    init() {
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
     * Bind event listeners to UI elements
     */
    bindEvents() {
        // List creation and editing
        this.elements.createListBtn.addEventListener('click', () => this.openCreateListModal());
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
        this.elements.cancelBtn.addEventListener('click', () => this.closeModal());
        this.elements.saveListBtn.addEventListener('click', () => this.saveList());
        this.elements.addTaskBtn.addEventListener('click', () => this.addTaskInput());

        // Voice dictation
        this.elements.dictateTitle.addEventListener('click', (e) => this.startDictation(e.target, this.elements.listTitle));
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.elements.listModal) {
                this.closeModal();
            }
        });

        // Bind event delegation for task input voice buttons
        this.elements.taskInputContainer.addEventListener('click', (e) => {
            if (e.target.closest('.dictate-task')) {
                const button = e.target.closest('.dictate-task');
                const input = button.closest('.input-with-voice').querySelector('input');
                this.startDictation(button, input);
            } else if (e.target.closest('.remove-task-btn')) {
                const row = e.target.closest('.input-with-voice');
                if (this.elements.taskInputContainer.children.length > 1) {
                    row.remove();
                } else {
                    row.querySelector('input').value = '';
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

            listItem.innerHTML = `
                <div class="list-title">${list.title}</div>
                <div class="list-options">
                    <button class="edit-list-btn" title="Editar lista">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-list-btn" title="Eliminar lista">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            // Add event listeners
            listItem.querySelector('.list-title').addEventListener('click', () => {
                this.loadActiveList(list.id);
            });

            listItem.querySelector('.edit-list-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.editList(list.id);
            });

            listItem.querySelector('.delete-list-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteList(list.id);
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
        
        activeListView.innerHTML = `
            <div class="list-header">
                <h2>${list.title}</h2>
                <div>
                    <button class="btn secondary edit-active-list-btn">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn danger delete-active-list-btn">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
            <ul class="task-list">
                ${list.tasks.length === 0 ? '<div class="empty-state"><p>No hay tareas en esta lista</p></div>' : ''}
                ${list.tasks.map((task, index) => `
                    <li class="task-item ${task.completed ? 'completed' : ''}">
                        <input type="checkbox" class="task-checkbox" data-index="${index}" ${task.completed ? 'checked' : ''}>
                        <span class="task-text">${task.text}</span>
                        <div class="task-actions">
                            <button class="delete-task-btn" data-index="${index}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;

        // Add event listeners
        activeListView.querySelector('.edit-active-list-btn').addEventListener('click', () => {
            this.editList(list.id);
        });

        activeListView.querySelector('.delete-active-list-btn').addEventListener('click', () => {
            this.deleteList(list.id);
        });

        // Add event listeners for checkboxes and delete buttons
        activeListView.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.toggleTaskComplete(parseInt(checkbox.dataset.index, 10));
            });
        });

        activeListView.querySelectorAll('.delete-task-btn').forEach(button => {
            button.addEventListener('click', () => {
                this.deleteTask(parseInt(button.dataset.index, 10));
            });
        });
    }

    /**
     * Open the create list modal
     */
    openCreateListModal() {
        this.isEditing = false;
        this.elements.modalTitle.textContent = 'Nueva Lista';
        this.elements.listTitle.value = '';
        
        // Clear task inputs and leave one empty input
        this.elements.taskInputContainer.innerHTML = `
            <div class="input-with-voice">
                <input type="text" class="task-input" placeholder="Nueva tarea">
                <button class="voice-btn dictate-task" title="Dictar tarea">
                    <i class="fas fa-microphone"></i>
                </button>
                <button class="remove-task-btn" title="Eliminar tarea">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        this.showModal();
    }

    /**
     * Open the edit list modal
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
            this.elements.listTitle.value = list.title;
            
            // Populate task inputs
            this.elements.taskInputContainer.innerHTML = '';
            
            if (list.tasks.length === 0) {
                // Add an empty task input if there are no tasks
                this.addTaskInput();
            } else {
                list.tasks.forEach(task => {
                    const taskInput = document.createElement('div');
                    taskInput.className = 'input-with-voice';
                    taskInput.innerHTML = `
                        <input type="text" class="task-input" placeholder="Nueva tarea" value="${task.text}">
                        <button class="voice-btn dictate-task" title="Dictar tarea">
                            <i class="fas fa-microphone"></i>
                        </button>
                        <button class="remove-task-btn" title="Eliminar tarea">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    this.elements.taskInputContainer.appendChild(taskInput);
                });
            }
            
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

        const taskInputs = Array.from(this.elements.taskInputContainer.querySelectorAll('.task-input'));
        const tasks = taskInputs
            .map(input => input.value.trim())
            .filter(text => text !== '')
            .map(text => ({ text, completed: false }));

        if (tasks.length === 0) {
            this.showToast('La lista debe tener al menos una tarea', 'error');
            return;
        }

        try {
            let list = {
                title,
                tasks
            };

            if (this.isEditing && this.currentList) {
                list.id = this.currentList.id;
                
                // Preserve completed status for existing tasks
                if (this.currentList.tasks) {
                    for (let i = 0; i < list.tasks.length && i < this.currentList.tasks.length; i++) {
                        if (list.tasks[i].text === this.currentList.tasks[i].text) {
                            list.tasks[i].completed = this.currentList.tasks[i].completed;
                        }
                    }
                }
            }

            const id = await this.dbService.saveList(list);
            
            if (!this.isEditing) {
                // If creating a new list, set it as active
                this.activeListId = id;
                this.dbService.setActiveList(id);
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
     * Add a new task input field to the modal
     */
    addTaskInput() {
        const taskInput = document.createElement('div');
        taskInput.className = 'input-with-voice';
        taskInput.innerHTML = `
            <input type="text" class="task-input" placeholder="Nueva tarea">
            <button class="voice-btn dictate-task" title="Dictar tarea">
                <i class="fas fa-microphone"></i>
            </button>
            <button class="remove-task-btn" title="Eliminar tarea">
                <i class="fas fa-times"></i>
            </button>
        `;
        this.elements.taskInputContainer.appendChild(taskInput);
        
        // Focus the new input
        const newInput = taskInput.querySelector('input');
        newInput.focus();
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
}
