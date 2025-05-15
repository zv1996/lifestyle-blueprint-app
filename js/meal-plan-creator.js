/**
 * Meal Plan Creator for Lifestyle Blueprint
 * 
 * This module handles the creation and management of meal plans,
 * including generating plans, displaying them, and handling user interactions.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';
import { MealPlanOverlay } from './meal-plan-overlay.js';

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
    let loadingId = null;
    
    try {
      if (this.isCreating) {
        console.warn('Meal plan creation already in progress');
        return;
      }
      
      this.isCreating = true;
      this.conversationId = conversationId;
      
      // Add a message to the chat
      this.addBotMessage('Please wait a moment while we create your personalized meal plan...');
      
      // Show a loading indicator
      loadingId = this.addLoadingIndicator();
      
      // Get the current user
      const user = getCurrentUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
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
            
            // Remove the loading indicator before showing the overlay
            this.removeLoadingIndicator(loadingId);
            loadingId = null;
            
            // Show success message
            this.addBotMessage('Your personalized meal plan is ready!');
            
            // Show the meal plan overlay
            this.showMealPlanOverlay(existingMealPlan);
            return;
          }
        }
      } catch (checkError) {
        // If there's an error checking for existing meal plans, just continue with creation
        console.warn('Error checking for existing meal plan:', checkError);
      }
      
      // Call the API to create the meal plan with timeout and retry logic
      let response;
      let retries = 0;
      const maxRetries = 3; // Increased to 3 retries
      let lastError = null;
      let mealPlanCreated = false;
      
      // Update the user on retry status
      const updateRetryStatus = (retry, max, reason = '') => {
        const statusMessage = reason 
          ? `Attempt ${retry} didn't meet requirements (${reason}). Retrying...` 
          : `Generating meal plan (attempt ${retry + 1}/${max + 1})...`;
        
        this.addBotMessage(statusMessage);
      };
      
      // Initial status message
      updateRetryStatus(0, maxRetries);
      
      while (retries <= maxRetries && !mealPlanCreated) {
        try {
          // Create an AbortController to handle timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout (increased from 60s)
          
          response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: user.id,
              conversationId: this.conversationId,
              retryCount: retries // Pass retry count to server for logging
            }),
            signal: controller.signal
          });
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          // If the response is successful, mark as created and break out of the retry loop
          if (response.ok) {
            mealPlanCreated = true;
            break;
          }
          
          // If we get a server error, increment retries and try again
          retries++;
          
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
          
          if (retries <= maxRetries) {
            console.log(`Retrying meal plan creation (${retries}/${maxRetries})...`);
            updateRetryStatus(retries, maxRetries, errorReason);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
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
          
          retries++;
          
          if (retries <= maxRetries) {
            console.log(`Retrying meal plan creation (${retries}/${maxRetries})...`);
            updateRetryStatus(retries, maxRetries, fetchError.message);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
          }
        }
      }
      
      // After all retries, check if we need to fetch the meal plan from the database
      // This handles the case where the API call timed out but the meal plan was actually created
      if (!mealPlanCreated && this.conversationId) {
        try {
          console.log('Checking if meal plan was created despite timeout/errors...');
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
              
              // Remove the loading indicator before showing the overlay
              this.removeLoadingIndicator(loadingId);
              loadingId = null;
              
              // Show success message
              this.addBotMessage('Your personalized meal plan is ready!');
              
              // Show the meal plan overlay
              this.showMealPlanOverlay(existingMealPlan);
              return;
            }
          }
        } catch (checkError) {
          console.warn('Error checking for created meal plan:', checkError);
        }
      }
      
      // If we still don't have a valid response after retries and database check
      if (!mealPlanCreated || !response || !response.ok) {
        // Only throw error after all retries are exhausted
        if (lastError) {
          throw lastError;
        } else {
          // Try to parse error data if possible
          let errorMessage = 'Unknown error';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || response.statusText;
          } catch (e) {
            errorMessage = response ? response.statusText : 'Failed to connect to server';
          }
          
          throw new Error(`Error creating meal plan: ${errorMessage}`);
        }
      }
      
      // Get the meal plan data
      let mealPlan;
      try {
        mealPlan = await response.json();
      } catch (jsonError) {
        console.error('Error parsing meal plan JSON:', jsonError);
        throw new Error('Error parsing meal plan data from server');
      }
      
      // Store the meal plan data
      this.mealPlanId = mealPlan.meal_plan_id;
      this.mealPlanData = mealPlan;
      
      console.log('Meal plan created:', mealPlan);
      
      // Remove the loading indicator before showing the overlay
      this.removeLoadingIndicator(loadingId);
      loadingId = null;
      
      // Show success message
      this.addBotMessage('Your personalized meal plan is ready!');
      
      // Show the meal plan overlay
      this.showMealPlanOverlay(mealPlan);
    } catch (error) {
      console.error('Error creating meal plan:', error);
      this.addBotMessage(`Sorry, there was an error creating your meal plan: ${error.message}`);
      
      // Remove the loading indicator if it exists
      if (loadingId) {
        this.removeLoadingIndicator(loadingId);
        loadingId = null;
      }
    } finally {
      this.isCreating = false;
    }
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
      
      // Add a message to the chat
      this.addBotMessage('Your meal plan has been approved! You can view it anytime in the Meal Plans section.');
      
      // Hide the loading state and close the overlay
      if (currentOverlay) {
        currentOverlay.hideLoadingState();
        currentOverlay.hide();
        this.overlay = null;
      }
    } catch (error) {
      console.error('Error approving meal plan:', error);
      this.addBotMessage(`Sorry, there was an error approving your meal plan: ${error.message}`);
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
