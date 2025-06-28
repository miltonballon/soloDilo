/**
 * Speech Service
 * Handles speech recognition for voice dictation
 */
class SpeechService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.targetElement = null;
        this.setupSpeechRecognition();
    }

    /**
     * Set up the SpeechRecognition API
     */
    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.error('Speech recognition not supported in this browser');
            return;
        }

        // Initialize SpeechRecognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // Configure recognition settings
        this.recognition.lang = 'es-ES';  // Spanish language
        this.recognition.continuous = false;  // Stop after a pause in speech
        this.recognition.interimResults = true;  // Get interim results

        // Set up event handlers
        this.recognition.onresult = this.handleSpeechResult.bind(this);
        this.recognition.onerror = this.handleSpeechError.bind(this);
        this.recognition.onend = this.handleSpeechEnd.bind(this);
    }

    /**
     * Start listening for speech
     * @param {HTMLElement} targetElement - The input element to write the recognized speech to
     * @param {Function} callback - Optional callback to execute when recognition is complete
     */
    startListening(targetElement, callback = null) {
        if (!this.recognition) {
            console.error('Speech recognition not available');
            return;
        }

        if (this.isListening) {
            this.stopListening();
        }

        this.targetElement = targetElement;
        this.callback = callback;
        this.isListening = true;

        try {
            this.recognition.start();
            console.log('Speech recognition started');
        } catch (error) {
            console.error('Error starting speech recognition:', error);
        }
    }

    /**
     * Stop listening for speech
     */
    stopListening() {
        if (!this.recognition || !this.isListening) {
            return;
        }

        try {
            this.recognition.stop();
            console.log('Speech recognition stopped');
        } catch (error) {
            console.error('Error stopping speech recognition:', error);
        }

        this.isListening = false;
    }

    /**
     * Handle speech recognition results
     * @param {SpeechRecognitionEvent} event - The speech recognition result event
     */
    handleSpeechResult(event) {
        if (!this.targetElement) return;
        
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');
        
        if (event.results[0].isFinal) {
            // Final result
            this.targetElement.value = transcript;
            
            // Dispatch input event to trigger auto-save
            const inputEvent = new Event('input', { bubbles: true });
            this.targetElement.dispatchEvent(inputEvent);
            
            // Execute callback if provided
            if (this.callback && typeof this.callback === 'function') {
                this.callback(transcript);
            }
        } else {
            // Interim result
            this.targetElement.value = transcript;
        }
    }

    /**
     * Handle speech recognition errors
     * @param {SpeechRecognitionError} event - The speech recognition error event
     */
    handleSpeechError(event) {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
        
        // Notify UI that recognition has stopped
        if (this.callback && typeof this.callback === 'function') {
            this.callback(null, event.error);
        }
    }

    /**
     * Handle speech recognition end
     */
    handleSpeechEnd() {
        this.isListening = false;
        console.log('Speech recognition ended');
        
        // Dispatch input event to ensure auto-save is triggered
        if (this.targetElement) {
            const inputEvent = new Event('input', { bubbles: true });
            this.targetElement.dispatchEvent(inputEvent);
        }
        
        // Notify UI that recognition has stopped
        if (this.callback && typeof this.callback === 'function') {
            this.callback(this.targetElement ? this.targetElement.value : '');
        }
    }

    /**
     * Check if speech recognition is supported in this browser
     * @returns {boolean} True if speech recognition is supported
     */
    isSupported() {
        return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
    }
}
