/**
 * Main Application
 * Initializes services and sets up the application
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize services
    const dbService = new DBService();
    const speechService = new SpeechService();
    
    // Initialize UI controller
    const uiController = new UIController(dbService, speechService);
    
    // Display welcome message
    console.log('Solo Dilo application initialized successfully');
});
