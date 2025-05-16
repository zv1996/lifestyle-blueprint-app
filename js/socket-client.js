/**
 * Socket.IO Client for Lifestyle Blueprint
 * 
 * This module handles the connection to the Socket.IO server
 * and provides event handling for real-time updates.
 */

/**
 * Class to manage Socket.IO connection and events
 */
class SocketClient {
  /**
   * Initialize the Socket.IO client
   */
  constructor() {
    this.socket = null;
    this.connected = false;
    this.eventHandlers = {};
    
    // Automatically connect when the class is instantiated
    this.connect();
  }
  
  /**
   * Connect to the Socket.IO server
   */
  connect() {
    try {
      // Get the base URL from the config
      const baseUrl = window.config ? window.config.getApiBaseUrl() : '';
      
      // Create the Socket.IO connection
      this.socket = io(baseUrl, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });
      
      // Set up event handlers
      this.socket.on('connect', () => {
        console.log('Connected to Socket.IO server');
        this.connected = true;
        this.triggerEvent('connect');
      });
      
      this.socket.on('disconnect', () => {
        console.log('Disconnected from Socket.IO server');
        this.connected = false;
        this.triggerEvent('disconnect');
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        this.triggerEvent('error', error);
      });
      
      // Set up meal plan progress event handler
      this.socket.on('meal-plan-progress', (data) => {
        console.log('Meal plan progress update:', data);
        this.triggerEvent('meal-plan-progress', data);
      });
    } catch (error) {
      console.error('Error initializing Socket.IO client:', error);
    }
  }
  
  /**
   * Disconnect from the Socket.IO server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }
  
  /**
   * Add an event handler
   * @param {string} event - The event name
   * @param {Function} handler - The event handler function
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    
    this.eventHandlers[event].push(handler);
  }
  
  /**
   * Remove an event handler
   * @param {string} event - The event name
   * @param {Function} handler - The event handler function
   */
  off(event, handler) {
    if (!this.eventHandlers[event]) {
      return;
    }
    
    if (handler) {
      // Remove the specific handler
      this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
    } else {
      // Remove all handlers for this event
      delete this.eventHandlers[event];
    }
  }
  
  /**
   * Trigger an event
   * @param {string} event - The event name
   * @param {*} data - The event data
   */
  triggerEvent(event, data) {
    if (!this.eventHandlers[event]) {
      return;
    }
    
    for (const handler of this.eventHandlers[event]) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in ${event} event handler:`, error);
      }
    }
  }
  
  /**
   * Check if the client is connected
   * @returns {boolean} Whether the client is connected
   */
  isConnected() {
    return this.connected;
  }
}

// Create a singleton instance
const socketClient = new SocketClient();

export { socketClient };
