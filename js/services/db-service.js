/**
 * Database Service
 * Handles all IndexedDB operations for storing and retrieving todo lists
 */
class DBService {
    constructor() {
        this.DB_NAME = 'SoloDiloDB';
        this.DB_VERSION = 1;
        this.STORE_NAME = 'todoLists';
        this.db = null;
        this.initDB();
    }

    /**
     * Initialize the IndexedDB database
     * @returns {Promise} Promise that resolves when the database is ready
     */
    initDB() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = (event) => {
                console.error('Error opening database:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store for todo lists if it doesn't exist
                if (!db.objectStoreNames.contains(this.STORE_NAME)) {
                    const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('title', 'title', { unique: false });
                    store.createIndex('lastModified', 'lastModified', { unique: false });
                    console.log('Object store created');
                }
            };
        });
    }

    /**
     * Get all todo lists from the database
     * @returns {Promise<Array>} Promise that resolves with an array of todo lists
     */
    async getAllLists() {
        await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.STORE_NAME, 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Error getting lists:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Get a todo list by its ID
     * @param {number} id - The ID of the list to retrieve
     * @returns {Promise<Object>} Promise that resolves with the todo list object
     */
    async getListById(id) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.STORE_NAME, 'readonly');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Error getting list:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Save a todo list to the database (create new or update existing)
     * @param {Object} list - The todo list object to save
     * @returns {Promise<number>} Promise that resolves with the ID of the saved list
     */
    async saveList(list) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            
            // Add timestamp
            list.lastModified = new Date().getTime();
            
            const request = list.id ? store.put(list) : store.add(list);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = (event) => {
                console.error('Error saving list:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Delete a todo list from the database
     * @param {number} id - The ID of the list to delete
     * @returns {Promise<void>} Promise that resolves when the list is deleted
     */
    async deleteList(id) {
        await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.STORE_NAME, 'readwrite');
            const store = transaction.objectStore(this.STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error('Error deleting list:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Update the active list in local storage
     * @param {number} id - The ID of the active list
     */
    setActiveList(id) {
        localStorage.setItem('activeListId', id);
    }

    /**
     * Get the active list ID from local storage
     * @returns {number|null} The ID of the active list or null if none is set
     */
    getActiveListId() {
        const id = localStorage.getItem('activeListId');
        return id ? parseInt(id, 10) : null;
    }
    
    /**
     * Save app settings to local storage
     * @param {Object} settings - The settings object to save
     */
    saveSettings(settings) {
        localStorage.setItem('appSettings', JSON.stringify(settings));
    }
    
    /**
     * Get app settings from local storage
     * @returns {Object} The app settings object
     */
    getSettings() {
        const settingsJson = localStorage.getItem('appSettings');
        if (!settingsJson) {
            // Default settings
            const defaultSettings = {
                drawerPosition: 'right' // 'right' or 'left'
            };
            this.saveSettings(defaultSettings);
            return defaultSettings;
        }
        return JSON.parse(settingsJson);
    }
}
