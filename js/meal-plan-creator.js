/**
 * Meal Plan Creator for Lifestyle Blueprint
 * 
 * This module handles the creation and management of meal plans,
 * including generating plans, displaying them, and handling user interactions.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';
import { MealPlanOverlay } from './meal-plan-overlay.js';
import { MealPlanLoadingOverlay } from './meal-plan-loading-overlay.js';

/**
 * Class to handle meal plan creation and management
 */
class MealPlanCreator {
  /**
   * Initialize the meal plan creator
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.conversationId = options.conversationId || null;
    this.mealPlanId = null;
    this.mealPlanData = null;
    this.overlay = null;
    this.isCreating = false;
  }
  
  /**
   * Start the meal plan creation process
   * @param {string} conversationId - The conversation ID
   * @returns {Promise<void>}
   */
  async createMealPlan(conversationId) {
    // Create and show the loading overlay
    const loadingOverlay = new MealPlanLoadingOverlay();
    loadingOverlay.show();
    
    try {
      if (this.isCreating) {
        console.warn('Meal plan creation already in progress');
        loadingOverlay.hide();
        return;
      }
      
      this.isCreating = true;
      this.conversationId = conversationId;
      
      // Initialize progress tracking
      this.setupProgressEventSource();
      
      // Get the current user
      const user = getCurrentUser();
      
      if (!user) {
        loadingOverlay.showError('User not authenticated');
        throw new Error('User not authenticated');
      }
      
      // Update status
      loadingOverlay.updateStatusMessage('Checking for existing meal plans...');
      
      // First, check if a meal plan was already created for this conversation
      try {
        const checkResponse = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/by-conversation/${this.conversationId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (checkResponse.ok) {
          const existingMealPlan = await checkResponse.json();
          
          // If we already have a meal plan for this conversation, use it
          if (existingMealPlan && existingMealPlan.meal_plan_id) {
            console.log('Found existing meal plan for this conversation:', existingMealPlan);
            
            // Store the meal plan data
            this.mealPlanId = existingMealPlan.meal_plan_id;
            this.mealPlanData = existingMealPlan;
            
            // Show success message and hide loading overlay
            loadingOverlay.showSuccess('Your personalized meal plan is ready!');
            
            // Wait for the success message to be shown before showing the meal plan
            setTimeout(() => {
              // Show the meal plan overlay
              this.showMealPlanOverlay(existingMealPlan);
            }, 1500);
            
            return;
          }
        }
      } catch (checkError) {
        // If there's an error checking for existing meal plans, just continue with creation
        console.warn('Error checking for existing meal plan:', checkError);
      }
      
      // Call the API to create the meal plan with day-by-day approach
      let mealPlanCreated = false;
      let lastError = null;
      let response = null;
      
      // Update status
      loadingOverlay.updateStatusMessage('Initializing meal plan creation...', 10);
      
      // Set up event source for progress updates
      this.setupProgressListener((progressData) => {
        if (progressData.day) {
          const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
          const dayName = dayNames[progressData.day - 1] || `Day ${progressData.day}`;
          loadingOverlay.updateStatus(dayName, progressData.day);
        } else if (progressData.message) {
          loadingOverlay.updateStatusMessage(progressData.message, progressData.progress);
        }
      });
      
      try {
        // Create an AbortController to handle timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for the entire process
        
        // Update status
        loadingOverlay.updateStatusMessage('Starting meal plan generation...', 15);
        
        // Call the API to create the meal plan
        response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id,
            conversationId: this.conversationId,
            useNewApproach: true // Flag to use the day-by-day approach
          }),
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // If the response is successful, mark as created
        if (response.ok) {
          mealPlanCreated = true;
        } else {
          // Try to get error details
          let errorReason = '';
          try {
            const errorData = await response.json();
            errorReason = errorData.error || response.statusText;
            lastError = new Error(`Server error: ${errorReason}`);
          } catch (e) {
            errorReason = response.statusText;
            lastError = new Error(`Server error: ${errorReason}`);
          }
          
          console.error('Error creating meal plan:', errorReason);
        }
      } catch (fetchError) {
        // Handle timeout or network errors
        if (fetchError.name === 'AbortError') {
          console.error('Meal plan creation request timed out');
          lastError = new Error('Request timed out. The meal plan generation is taking longer than expected.');
        } else {
          console.error('Network error during meal plan creation:', fetchError);
          lastError = fetchError;
        }
      } finally {
        // Clean up event source
        this.cleanupProgressListener();
      }
      
      // Even if we got an error, check if a meal plan was created in the database
      // This handles the case where the API call had errors but the meal plan was actually created
      if (!mealPlanCreated && this.conversationId) {
        try {
          loadingOverlay.updateStatusMessage('Checking for created meal plan...', 90);
          console.log('Checking if meal plan was created despite errors...');
          
          // Wait a moment to allow the server to finish processing
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const checkResponse = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/by-conversation/${this.conversationId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (checkResponse.ok) {
            const existingMealPlan = await checkResponse.json();
            
            // If we found a meal plan, use it
            if (existingMealPlan && existingMealPlan.meal_plan_id) {
              console.log('Found meal plan that was created despite errors:', existingMealPlan);
              mealPlanCreated = true;
              response = { ok: true };
              
              // Store the meal plan data
              this.mealPlanId = existingMealPlan.meal_plan_id;
              this.mealPlanData = existingMealPlan;
              
              // Show success message and hide loading overlay
              loadingOverlay.showSuccess('Your personalized meal plan is ready!');
              
              // Wait for the success message to be shown before showing the meal plan
              setTimeout(() => {
                // Show the meal plan overlay
                this.showMealPlanOverlay(existingMealPlan);
              }, 1500);
              
              return;
            }
          }
        } catch (checkError) {
          console.warn('Error checking for created meal plan:', checkError);
        }
      }
      
      // If we still don't have a valid response and meal plan
      if (!mealPlanCreated || !response || !response.ok) {
        // Show error in the loading overlay
        if (lastError) {
          loadingOverlay.showError(lastError.message);
          throw lastError;
        } else {
          const error = new Error('Failed to create meal plan. Please try again later.');
          loadingOverlay.showError(error.message);
          throw error;
        }
      }
      
      // Get the meal plan data
      let mealPlan;
      try {
        loadingOverlay.updateStatusMessage('Processing meal plan data...', 95);
        mealPlan = await response.json();
      } catch (jsonError) {
        console.error('Error parsing meal plan JSON:', jsonError);
        loadingOverlay.showError('Error parsing meal plan data from server');
        throw new Error('Error parsing meal plan data from server');
      }
      
      // Store the meal plan data
      this.mealPlanId = mealPlan.meal_plan_id;
      this.mealPlanData = mealPlan;
      
      console.log('Meal plan created:', mealPlan);
      
      // Show success message and hide loading overlay
      loadingOverlay.showSuccess('Your personalized meal plan is ready!');
      
      // Wait for the success message to be shown before showing the meal plan
      setTimeout(() => {
        // Show the meal plan overlay
        this.showMealPlanOverlay(mealPlan);
      }, 1500);
      
    } catch (error) {
      console.error('Error creating meal plan:', error);
      
      // Check if we have a partial meal plan in the database
      if (this.conversationId) {
        try {
          loadingOverlay.updateStatusMessage('Checking for partial meal plan...', 90);
          
          // Wait a moment to allow the server to finish processing
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const checkResponse = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/by-conversation/${this.conversationId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (checkResponse.ok) {
            const existingMealPlan = await checkResponse.json();
            
            // If we found a meal plan, use it even if it's partial
            if (existingMealPlan && existingMealPlan.meal_plan_id) {
              console.log('Found partial meal plan despite errors:', existingMealPlan);
              
              // Store the meal plan data
              this.mealPlanId = existingMealPlan.meal_plan_id;
              this.mealPlanData = existingMealPlan;
              
              // Show partial success message and hide loading overlay
              loadingOverlay.showSuccess('We encountered some issues, but your meal plan is ready!');
              
              // Wait for the success message to be shown before showing the meal plan
              setTimeout(() => {
                // Show the meal plan overlay
                this.showMealPlanOverlay(existingMealPlan);
              }, 1500);
              
              return;
            }
          }
        } catch (checkError) {
          console.warn('Error checking for partial meal plan:', checkError);
        }
      }
      
      // If we couldn't find a partial meal plan, show the error
      loadingOverlay.showError(error.message);
    } finally {
      this.isCreating = false;
    }
  }
  
  /**
   * Set up event source for progress updates
   */
  setupProgressEventSource() {
    // Import the socket client
    import('./socket-client.js').then(module => {
      this.socketClient = module.socketClient;
      console.log('Socket client imported for progress updates');
    }).catch(error => {
      console.error('Error importing socket client:', error);
    });
  }
  
  /**
   * Set up a listener for progress updates
   * @param {Function} callback - The callback to call with progress data
   */
  setupProgressListener(callback) {
    // Store the callback
    this.progressCallback = callback;
    
    // Set up event listener for Socket.IO progress events
    if (this.socketClient) {
      console.log('Setting up Socket.IO progress listener');
      this.socketClient.on('meal-plan-progress', this.handleProgressEvent.bind(this));
    } else {
      // If Socket.IO is not available, fall back to simulated progress
      console.log('Socket.IO not available, using simulated progress');
      window.addEventListener('meal-plan-progress', this.handleProgressEvent.bind(this));
      this.simulateProgressUpdates();
    }
  }
  
  /**
   * Handle progress event
   * @param {Object} data - The progress event data
   */
  handleProgressEvent(data) {
    if (this.progressCallback) {
      this.progressCallback(data);
    }
  }
  
  /**
   * Clean up progress listener
   */
  cleanupProgressListener() {
    // Remove Socket.IO event listener
    if (this.socketClient) {
      this.socketClient.off('meal-plan-progress', this.handleProgressEvent.bind(this));
    } else {
      // Remove window event listener if using simulated progress
      window.removeEventListener('meal-plan-progress', this.handleProgressEvent.bind(this));
    }
    
    // Clear any simulated progress timers
    if (this.progressTimers) {
      this.progressTimers.forEach(timer => clearTimeout(timer));
      this.progressTimers = [];
    }
  }
  
  /**
   * Simulate progress updates for testing/demo purposes
   * Only used if Socket.IO is not available
   */
  simulateProgressUpdates() {
    console.log('Simulating progress updates');
    this.progressTimers = [];
    
    // Day 1
    this.progressTimers.push(setTimeout(() => {
      this.dispatchProgressEvent({ day: 1, message: 'Creating meals for Monday...' });
    }, 2000));
    
    // Day 2
    this.progressTimers.push(setTimeout(() => {
      this.dispatchProgressEvent({ day: 2, message: 'Creating meals for Tuesday...' });
    }, 6000));
    
    // Day 3
    this.progressTimers.push(setTimeout(() => {
      this.dispatchProgressEvent({ day: 3, message: 'Creating meals for Wednesday...' });
    }, 10000));
    
    // Day 4
    this.progressTimers.push(setTimeout(() => {
      this.dispatchProgressEvent({ day: 4, message: 'Creating meals for Thursday...' });
    }, 14000));
    
    // Day 5
    this.progressTimers.push(setTimeout(() => {
      this.dispatchProgressEvent({ day: 5, message: 'Creating meals for Friday...' });
    }, 18000));
    
    // Finalizing
    this.progressTimers.push(setTimeout(() => {
      this.dispatchProgressEvent({ message: 'Finalizing your meal plan...', progress: 90 });
    }, 22000));
  }
  
  /**
   * Dispatch a progress event (for simulated progress only)
   * @param {Object} detail - The progress event detail
   */
  dispatchProgressEvent(detail) {
    const event = new CustomEvent('meal-plan-progress', { detail });
    window.dispatchEvent(event);
  }
  
  /**
   * Show the meal plan overlay
   * @param {Object} mealPlan - The meal plan data
   */
  showMealPlanOverlay(mealPlan) {
    console.log('Showing meal plan overlay with data:', mealPlan);
    
    try {
      // Create the overlay
      this.overlay = new MealPlanOverlay({
        mealPlan,
        onApprove: this.handleApprovePlan.bind(this),
        onRequestChanges: this.handleRequestChanges.bind(this)
      });
      
      console.log('Overlay instance created successfully');
      
      // Show the overlay
      this.overlay.show();
      console.log('Overlay show() method called');
    } catch (error) {
      console.error('Error showing meal plan overlay:', error);
      this.addBotMessage('Sorry, there was an error displaying your meal plan. Please try again.');
    }
  }
  
  /**
   * Handle approving the meal plan
   * @param {Object} mealPlan - The approved meal plan
   */
  async handleApprovePlan(mealPlan) {
    let currentOverlay = null;
    
    try {
      // Get the current user
      const user = getCurrentUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Show the loading state in the overlay
      if (this.overlay) {
        this.overlay.showLoadingState();
        currentOverlay = this.overlay;
      }
      
      // Call the API to approve the meal plan with timeout and retry logic
      let response;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          // Create an AbortController to handle timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
          
          response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/${mealPlan.meal_plan_id}/approve`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.id
            }),
            signal: controller.signal
          });
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          // If the response is successful, break out of the retry loop
          if (response.ok) {
            break;
          }
          
          // If we get a server error, increment retries and try again
          retries++;
          
          if (retries <= maxRetries) {
            console.log(`Retrying meal plan approval (${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
          }
        } catch (fetchError) {
          // Handle timeout or network errors
          if (fetchError.name === 'AbortError') {
            console.error('Meal plan approval request timed out');
          } else {
            console.error('Network error during meal plan approval:', fetchError);
          }
          
          retries++;
          
          if (retries <= maxRetries) {
            console.log(`Retrying meal plan approval (${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
          } else {
            // Hide the loading state if we've exhausted retries
            if (currentOverlay) {
              currentOverlay.hideLoadingState();
            }
            throw new Error(`Network error: ${fetchError.message}`);
          }
        }
      }
      
      // Check if we have a valid response after retries
      if (!response || !response.ok) {
        // Hide the loading state
        if (currentOverlay) {
          currentOverlay.hideLoadingState();
        }
        
        // Try to parse error data if possible
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || response.statusText;
        } catch (e) {
          errorMessage = response ? response.statusText : 'Failed to connect to server';
        }
        
        throw new Error(`Error approving meal plan: ${errorMessage}`);
      }
      
      // Get the approved meal plan
      let approvedMealPlan;
      try {
        approvedMealPlan = await response.json();
      } catch (jsonError) {
        // Hide the loading state
        if (currentOverlay) {
          currentOverlay.hideLoadingState();
        }
        console.error('Error parsing meal plan JSON:', jsonError);
        throw new Error('Error parsing approved meal plan data from server');
      }
      
      console.log('Meal plan approved:', approvedMealPlan);
      
      // Hide the loading state
      if (currentOverlay) {
        currentOverlay.hideLoadingState();
      }
      
      // Trigger the shopping list stage
      this.triggerShoppingListStage(approvedMealPlan);
      
    } catch (error) {
      console.error('Error approving meal plan:', error);
      this.addBotMessage(`Sorry, there was an error approving your meal plan: ${error.message}`);
    }
  }
  
  /**
   * Trigger the shopping list stage
   * @param {Object} mealPlan - The approved meal plan
   */
  triggerShoppingListStage(mealPlan) {
    try {
      // Add a message to the chat
      this.addBotMessage('Your meal plan has been approved! Now let\'s create a shopping list for your meals.');
      
      // Dispatch event to update the chatbot stage FIRST
      // This will initialize the shopping list collector in chatbot.js
      const event = new CustomEvent('shoppingListStageStarted', {
        detail: { mealPlan }
      });
      document.dispatchEvent(event);
      
      // Give the event time to be processed and the collector to be initialized
      setTimeout(() => {
        // Now manually start the shopping list process
        // This will be picked up by the global shoppingListCollector in chatbot.js
        const startEvent = new CustomEvent('startShoppingList', {
          detail: { 
            conversationId: this.conversationId,
            mealPlanId: mealPlan.meal_plan_id
          }
        });
        document.dispatchEvent(startEvent);
      }, 500);
    } catch (error) {
      console.error('Error triggering shopping list stage:', error);
      this.addBotMessage('Sorry, there was an error starting the shopping list process. Please try again later.');
    }
  }
  
  /**
   * Handle requesting changes to the meal plan
   * @param {Object} mealPlan - The meal plan to change
   * @param {Array} changes - The requested changes
   */
  async handleRequestChanges(mealPlan, changes) {
    let currentOverlay = null;
    
    try {
      // Get the current user
      const user = getCurrentUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Show the loading state in the overlay
      if (this.overlay) {
        this.overlay.showLoadingState();
        currentOverlay = this.overlay;
      }
      
      // Call the API to update the meal plan with timeout and retry logic
      let response;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          // Create an AbortController to handle timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for revisions (they take longer)
          
          response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/${mealPlan.meal_plan_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.id,
              conversationId: this.conversationId,
              changes
            }),
            signal: controller.signal
          });
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          // If the response is successful, break out of the retry loop
          if (response.ok) {
            break;
          }
          
          // If we get a server error, increment retries and try again
          retries++;
          
          if (retries <= maxRetries) {
            console.log(`Retrying meal plan revision (${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
          }
        } catch (fetchError) {
          // Handle timeout or network errors
          if (fetchError.name === 'AbortError') {
            console.error('Meal plan revision request timed out');
          } else {
            console.error('Network error during meal plan revision:', fetchError);
          }
          
          retries++;
          
          if (retries <= maxRetries) {
            console.log(`Retrying meal plan revision (${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
          } else {
            // Hide the loading state if we've exhausted retries
            if (currentOverlay) {
              currentOverlay.hideLoadingState();
            }
            throw new Error(`Network error: ${fetchError.message}`);
          }
        }
      }
      
      // Check if we have a valid response after retries
      if (!response || !response.ok) {
        // Hide the loading state
        if (currentOverlay) {
          currentOverlay.hideLoadingState();
        }
        
        // Try to parse error data if possible
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || response.statusText;
        } catch (e) {
          errorMessage = response ? response.statusText : 'Failed to connect to server';
        }
        
        throw new Error(`Error updating meal plan: ${errorMessage}`);
      }
      
      // Get the updated meal plan
      let updatedMealPlan;
      try {
        updatedMealPlan = await response.json();
      } catch (jsonError) {
        // Hide the loading state
        if (currentOverlay) {
          currentOverlay.hideLoadingState();
        }
        console.error('Error parsing meal plan JSON:', jsonError);
        throw new Error('Error parsing updated meal plan data from server');
      }
      
      // Store the meal plan data
      this.mealPlanData = updatedMealPlan;
      
      console.log('Meal plan updated:', updatedMealPlan);
      
      // Add a message to the chat
      this.addBotMessage('Your meal plan has been updated with your requested changes.');
      
      // Create a new overlay instance for the updated meal plan
      this.overlay = new MealPlanOverlay({
        mealPlan: updatedMealPlan,
        onApprove: this.handleApprovePlan.bind(this),
        onRequestChanges: this.handleRequestChanges.bind(this)
      });
      
      // Hide the current overlay with loading state
      if (currentOverlay) {
        currentOverlay.hide();
        currentOverlay = null;
      }
      
      // Show the new overlay after a small delay
      setTimeout(() => {
        this.overlay.show();
      }, 500); // Small delay to ensure smooth transition
    } catch (error) {
      console.error('Error updating meal plan:', error);
      this.addBotMessage(`Sorry, there was an error updating your meal plan: ${error.message}`);
    }
  }
  
  /**
   * Add a bot message to the chat
   * @param {string} message - The message to add
   */
  addBotMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatMessages) {
      return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'bot');
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    const messageParagraph = document.createElement('p');
    messageParagraph.textContent = message;
    
    messageContent.appendChild(messageParagraph);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  /**
   * Add a loading indicator to the chat
   * @returns {string} The ID of the loading indicator
   */
  addLoadingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    
    if (!chatMessages) {
      return null;
    }
    
    const loadingId = `loading-${Date.now()}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'bot', 'loading');
    messageDiv.id = loadingId;
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('message-content');
    
    const loadingDots = document.createElement('div');
    loadingDots.classList.add('loading-dots');
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.classList.add('dot');
      loadingDots.appendChild(dot);
    }
    
    messageContent.appendChild(loadingDots);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to the bottom of the chat
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return loadingId;
  }
  
  /**
   * Remove a loading indicator from the chat
   * @param {string} loadingId - The ID of the loading indicator
   */
  removeLoadingIndicator(loadingId) {
    if (!loadingId) {
      return;
    }
    
    const loadingElement = document.getElementById(loadingId);
    
    if (loadingElement) {
      loadingElement.remove();
    }
  }
}

export { MealPlanCreator };
