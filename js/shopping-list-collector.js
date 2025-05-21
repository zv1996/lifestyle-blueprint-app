/**
 * Shopping List Collector for Lifestyle Blueprint
 * 
 * This module handles the collection of shopping list preferences
 * and generation of the shopping list based on the approved meal plan.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';
import { ShoppingListLoadingOverlay } from './shopping-list-loading-overlay.js';
import { ShoppingListOverlay } from './shopping-list-overlay.js';

/**
 * Initialize the shopping list collector
 * @param {Object} options - Configuration options
 * @returns {Object} The collector interface
 */
function initShoppingListCollector(options = {}) {
  const { chatMessages, userInput, sendButton, conversationId, mealPlanId } = options;
  
  // State variables
  let state = {
    stage: 'INTRO',
    brandPreferences: [],
    conversationId,
    mealPlanId,
    isComplete: false
  };
  
  // UI elements
  const uiElements = {
    chatMessages,
    userInput,
    sendButton
  };
  
  /**
   * Start the shopping list collection process
   */
  function start() {
    // Add the initial message
    addBotMessage("Your meal plan has been saved! Now, let's create your shopping list.");
    
    // Ask about brand preferences
    setTimeout(() => {
      askAboutBrandPreferences();
    }, 1000);
  }
  
  /**
   * Ask the user about brand preferences
   */
  function askAboutBrandPreferences() {
    // Add the question
    addBotMessage("Would you like to specify any particular brands for your shopping list?");
    
    // Show Yes/No buttons
    showYesNoButtons();
    
    // Disable the text input
    setInputEnabled(false);
  }
  
  /**
   * Show Yes/No buttons for brand preferences
   */
  function showYesNoButtons() {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'sex-buttons';
    buttonsContainer.id = 'brandPreferenceButtons';
    
    const yesButton = document.createElement('button');
    yesButton.className = 'sex-button';
    yesButton.textContent = 'Yes';
    yesButton.dataset.value = 'yes';
    
    const noButton = document.createElement('button');
    noButton.className = 'sex-button';
    noButton.textContent = 'No';
    noButton.dataset.value = 'no';
    
    // Add event listeners
    yesButton.addEventListener('click', () => handleBrandPreferenceResponse('yes'));
    noButton.addEventListener('click', () => handleBrandPreferenceResponse('no'));
    
    // Add buttons to container
    buttonsContainer.appendChild(yesButton);
    buttonsContainer.appendChild(noButton);
    
    // Add container to chat
    const chatInput = document.querySelector('.chat-input');
    chatInput.parentNode.insertBefore(buttonsContainer, chatInput);
  }
  
  /**
   * Hide the Yes/No buttons
   */
  function hideYesNoButtons() {
    const buttonsContainer = document.getElementById('brandPreferenceButtons');
    if (buttonsContainer) {
      buttonsContainer.remove();
    }
  }
  
  /**
   * Handle the brand preference response
   * @param {string} response - The user's response ('yes' or 'no')
   */
  function handleBrandPreferenceResponse(response) {
    // Add the user's response as a message
    addUserMessage(response === 'yes' ? 'Yes' : 'No');
    
    // Hide the buttons
    hideYesNoButtons();
    
    // Store the message in the conversations table
    storeUserMessage(response === 'yes' ? 'Yes' : 'No');
    
    // Process the response
    if (response === 'yes') {
      // Ask for specific brand preferences
      state.stage = 'BRAND_PREFERENCES';
      addBotMessage("Please specify which products and brands you'd like to include in your shopping list.");
      setInputEnabled(true);
    } else {
      // Skip to shopping list creation
      state.stage = 'CREATING_LIST';
      createShoppingList();
    }
  }
  
  /**
   * Process a user message
   * @param {string} message - The user message
   * @returns {Promise<boolean>} Whether the message was processed successfully
   */
  async function processMessage(message) {
    if (state.isComplete) {
      return false;
    }
    
    if (state.stage === 'BRAND_PREFERENCES') {
      // Store the brand preferences
      state.brandPreferences.push(message);
      
      // Acknowledge the preferences
      addBotMessage("Thanks for sharing your preferences. I'll include these brands in your shopping list.");
      
      // Move to creating the shopping list
      state.stage = 'CREATING_LIST';
      
      // Start creating the shopping list
      createShoppingList();
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Create the shopping list
   */
  async function createShoppingList() {
    try {
      // Disable input while processing
      setInputEnabled(false);
      
      // Get the current user
      const user = getCurrentUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Create and show the loading overlay
      const loadingOverlay = new ShoppingListLoadingOverlay();
      loadingOverlay.show();
      
      // Call the API to generate the shopping list
      loadingOverlay.updateStatusMessage('Analyzing your meal plan ingredients...', 20);
      
      // Create an AbortController to handle timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      try {
        // Call the API to create the shopping list
        const response = await fetch(`${config.getApiBaseUrl()}/api/shopping-list/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id,
            conversationId: state.conversationId,
            mealPlanId: state.mealPlanId,
            brandPreferences: state.brandPreferences
          }),
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Check if the response is successful
        if (!response.ok) {
          // Try to get error details
          let errorReason = '';
          try {
            const errorData = await response.json();
            errorReason = errorData.error || response.statusText;
          } catch (e) {
            errorReason = response.statusText;
          }
          
          throw new Error(`Error creating shopping list: ${errorReason}`);
        }
        
        // Get the shopping list data
        const shoppingListData = await response.json();
        
        // Show success message and hide loading overlay
        loadingOverlay.showSuccess('Your shopping list is ready!');
        
        // Wait for the success message to be shown before showing the shopping list
        setTimeout(() => {
          // Show the shopping list overlay
          showShoppingListOverlay(shoppingListData);
          
          // Mark as complete
          state.isComplete = true;
          
          // Dispatch event for completion
          const event = new CustomEvent('shoppingListComplete', {
            detail: { shoppingList: shoppingListData }
          });
          document.dispatchEvent(event);
        }, 1500);
        
      } catch (fetchError) {
        // Handle timeout or network errors
        if (fetchError.name === 'AbortError') {
          loadingOverlay.showError('Request timed out. The shopping list generation is taking longer than expected.');
        } else {
          loadingOverlay.showError(`Network error: ${fetchError.message}`);
        }
        
        console.error('Error creating shopping list:', fetchError);
        addBotMessage(`Sorry, there was an error creating your shopping list: ${fetchError.message}`);
        
        // Re-enable input
        setInputEnabled(true);
      }
      
    } catch (error) {
      console.error('Error creating shopping list:', error);
      addBotMessage(`Sorry, there was an error creating your shopping list: ${error.message}`);
      
      // Re-enable input
      setInputEnabled(true);
    }
  }
  
  /**
   * Show the shopping list overlay
   * @param {Object} shoppingList - The shopping list data
   */
  function showShoppingListOverlay(shoppingList) {
    try {
      // Make sure the shopping list has the meal plan ID
      const shoppingListWithMealPlanId = {
        ...shoppingList,
        mealPlanId: state.mealPlanId
      };
      
      // Create the overlay
      const overlay = new ShoppingListOverlay({
        shoppingList: shoppingListWithMealPlanId,
        onSave: handleSaveShoppingList
      });
      
      // Show the overlay
      overlay.show();
    } catch (error) {
      console.error('Error showing shopping list overlay:', error);
      addBotMessage('Sorry, there was an error displaying your shopping list. Please try again.');
    }
  }
  
  /**
   * Handle saving the shopping list
   * @param {Object} shoppingList - The shopping list data
   */
  async function handleSaveShoppingList(shoppingList) {
    try {
      // Get the current user
      const user = getCurrentUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Call the API to save the shopping list
      const response = await fetch(`${config.getApiBaseUrl()}/api/shopping-list/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          conversationId: state.conversationId,
          mealPlanId: state.mealPlanId,
          shoppingList
        })
      });
      
      if (!response.ok) {
        // Try to get error details
        let errorReason = '';
        try {
          const errorData = await response.json();
          errorReason = errorData.error || response.statusText;
        } catch (e) {
          errorReason = response.statusText;
        }
        
        throw new Error(`Error saving shopping list: ${errorReason}`);
      }
      
      // Add a message to the chat
      addBotMessage('Your shopping list has been saved! You can view it anytime in the Meal Plans section.');
      
    } catch (error) {
      console.error('Error saving shopping list:', error);
      addBotMessage(`Sorry, there was an error saving your shopping list: ${error.message}`);
    }
  }
  
  /**
   * Add a bot message to the chat
   * @param {string} message - The message to add
   */
  function addBotMessage(message) {
    const { chatMessages } = uiElements;
    
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
   * Add a user message to the chat
   * @param {string} message - The message to add
   */
  function addUserMessage(message) {
    const { chatMessages } = uiElements;
    
    if (!chatMessages) {
      return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', 'user');
    
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
   * Store a user message in the conversations table
   * @param {string} message - The message to store
   */
  async function storeUserMessage(message) {
    try {
      // Get the current user
      const user = getCurrentUser();
      
      if (!user || !state.conversationId) {
        console.error('Cannot store message: user not authenticated or no conversation ID');
        return;
      }
      
      // Use the API endpoint to store the message
      const response = await fetch(`${config.getApiBaseUrl()}/api/conversation/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          conversationId: state.conversationId,
          message: message
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error storing message: ${response.statusText}`);
      }
      
      console.log('Message stored in conversation:', state.conversationId);
    } catch (error) {
      console.error('Error storing conversation message:', error);
      // Continue with processing even if message storage fails
    }
  }
  
  /**
   * Set the input enabled state
   * @param {boolean} enabled - Whether the input is enabled
   */
  function setInputEnabled(enabled) {
    const { userInput, sendButton } = uiElements;
    
    if (userInput) {
      userInput.disabled = !enabled;
      
      // Auto-focus the input field when enabled
      if (enabled) {
        // Use setTimeout to ensure focus happens after any DOM updates
        setTimeout(() => {
          userInput.focus();
        }, 50);
      }
    }
    
    if (sendButton) {
      sendButton.disabled = !enabled;
    }
  }
  
  /**
   * Check if the collection is complete
   * @returns {boolean} Whether the collection is complete
   */
  function isComplete() {
    return state.isComplete;
  }
  
  // Return the collector interface
  return {
    start,
    processMessage,
    isComplete
  };
}

export { initShoppingListCollector };
