/**
 * Chatbot Component for Lifestyle Blueprint
 * 
 * This module handles the interaction with the chatbot,
 * using a state machine for basic info collection and
 * OpenAI Chat Completions for more complex interactions.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';
import { initBasicInfoCollector } from './basic-info-collector.js';
import { initMetricsAndGoalsCollector } from './metrics-goals-collector.js';
import { initDietPreferencesCollector } from './diet-preferences-collector.js';
import { initCalorieCalculationCollector } from './calorie-calculation-collector.js';

// Conversation stages
const STAGES = {
  BASIC_INFO: 'BASIC_INFO',
  METRICS_GOALS: 'METRICS_GOALS',
  DIET_PREFERENCES: 'DIET_PREFERENCES',
  CALORIE_CALCULATION: 'CALORIE_CALCULATION',
  MEAL_PLAN_CREATION: 'MEAL_PLAN_CREATION',
  SHOPPING_LIST: 'SHOPPING_LIST',
  FINALIZATION: 'FINALIZATION'
};

// Current conversation state
let currentState = {
  stage: STAGES.BASIC_INFO,
  messages: [],
  conversationId: null // Track the current conversation ID
};

// Reference to the collectors
let basicInfoCollector = null;
let metricsAndGoalsCollector = null;
let dietPreferencesCollector = null;
let calorieCalculationCollector = null;
let shoppingListCollector = null;

/**
 * Initialize the chatbot
 */
function initChatbot() {
  const chatMessages = document.getElementById('chatMessages');
  const userInput = document.getElementById('userInput');
  const sendButton = document.getElementById('sendButton');
  
  if (!chatMessages || !userInput || !sendButton) {
    console.warn('Chatbot elements not found');
    return;
  }
  
  // Clear any existing messages
  chatMessages.innerHTML = '';
  
  // Generate a new conversation ID
  currentState.conversationId = crypto.randomUUID();
  console.log('New conversation started with ID:', currentState.conversationId);
  
  // Add event listeners
  sendButton.addEventListener('click', handleSendMessage);
  userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      handleSendMessage();
    }
  });
  
  // Initialize the basic info collector
  basicInfoCollector = initBasicInfoCollector({
    chatMessages,
    userInput,
    sendButton,
    conversationId: currentState.conversationId
  });
  
  // Add event listeners for interactive elements
  document.addEventListener('click', (event) => {
    // Start button
    if (event.target && event.target.id === 'startButton') {
      basicInfoCollector.handleStartButton();
    }
    
    // Yes/No buttons for diet preferences
    if (event.target && event.target.classList.contains('fitness-goal-button')) {
      if (dietPreferencesCollector && currentState.stage === STAGES.DIET_PREFERENCES) {
        // Handle Yes/No buttons for diet preferences
        dietPreferencesCollector.handleYesNoButtonClick(event.target.dataset.value);
      }
      // Note: Fitness goal buttons for metrics stage are handled directly in metrics-goals-collector.js
    }
  });
  
  // Add event listener for activity level dropdown
  document.addEventListener('change', (event) => {
    if (event.target && event.target.classList.contains('activity-level-select') && metricsAndGoalsCollector) {
      metricsAndGoalsCollector.handleActivityLevelSelect(event.target.value);
    }
  });
  
  // Add event listener for basic info completion
  document.addEventListener('basicInfoComplete', () => {
    // Transition to the metrics stage
    currentState.stage = STAGES.METRICS_GOALS;
    console.log('Transitioning to METRICS_GOALS stage (via event)');
    
    // Initialize the metrics and goals collector
    metricsAndGoalsCollector = initMetricsAndGoalsCollector({
      chatMessages: document.getElementById('chatMessages'),
      userInput: document.getElementById('userInput'),
      sendButton: document.getElementById('sendButton'),
      conversationId: currentState.conversationId
    });
    
    // Explicitly enable the input field for the metrics stage
    setInputEnabled(true);
  });
  
  // Add event listener for metrics and goals completion
  document.addEventListener('metricsGoalsComplete', () => {
    // Transition to the diet preferences stage
    currentState.stage = STAGES.DIET_PREFERENCES;
    console.log('Transitioning to DIET_PREFERENCES stage (via event)');
    
    // Initialize the diet preferences collector
    dietPreferencesCollector = initDietPreferencesCollector({
      chatMessages: document.getElementById('chatMessages'),
      userInput: document.getElementById('userInput'),
      sendButton: document.getElementById('sendButton'),
      conversationId: currentState.conversationId
    });
    
    // Explicitly enable the input field for the diet preferences stage
    setInputEnabled(true);
  });
  
  // Add event listener for diet preferences completion
  document.addEventListener('dietPreferencesComplete', () => {
    // Transition to the calorie calculation stage
    currentState.stage = STAGES.CALORIE_CALCULATION;
    console.log('Transitioning to CALORIE_CALCULATION stage (via event)');
    
    // Initialize the calorie calculation collector
    calorieCalculationCollector = initCalorieCalculationCollector({
      chatMessages: document.getElementById('chatMessages'),
      userInput: document.getElementById('userInput'),
      sendButton: document.getElementById('sendButton'),
      conversationId: currentState.conversationId
    });
    
    // Start the calculations immediately
    calorieCalculationCollector.startCalculations();
    
    // Input is disabled during calculations
    setInputEnabled(false);
  });
  
  // Add event listener for calorie calculation completion
  document.addEventListener('calorieCalculationComplete', (event) => {
    // Transition to the meal plan creation stage
    currentState.stage = STAGES.MEAL_PLAN_CREATION;
    console.log('Transitioning to MEAL_PLAN_CREATION stage (via event)');
    console.log('Calorie calculation results:', event.detail?.results);
  });
  
  // Add event listener for shopping list stage start
  document.addEventListener('shoppingListStageStarted', (event) => {
    // Transition to the shopping list stage
    currentState.stage = STAGES.SHOPPING_LIST;
    console.log('Transitioning to SHOPPING_LIST stage (via event)');
    console.log('Meal plan for shopping list:', event.detail?.mealPlan);
    
    // Import the shopping list collector
    import('./shopping-list-collector.js').then(module => {
      const { initShoppingListCollector } = module;
      
      // Initialize the shopping list collector
      shoppingListCollector = initShoppingListCollector({
        chatMessages: document.getElementById('chatMessages'),
        userInput: document.getElementById('userInput'),
        sendButton: document.getElementById('sendButton'),
        conversationId: currentState.conversationId,
        mealPlanId: event.detail?.mealPlan?.meal_plan_id
      });
      
      // Add event listener for starting the shopping list process
      document.addEventListener('startShoppingList', (startEvent) => {
        console.log('Starting shopping list process:', startEvent.detail);
        if (shoppingListCollector && typeof shoppingListCollector.start === 'function') {
          shoppingListCollector.start();
        } else {
          console.error('Shopping list collector not properly initialized');
          addBotMessage('Sorry, there was an error starting the shopping list process. Please try again later.');
        }
      });
    }).catch(error => {
      console.error('Error importing shopping list collector:', error);
    });
  });
  
  // Add event listener for shopping list completion
  document.addEventListener('shoppingListComplete', (event) => {
    // Transition to the finalization stage
    currentState.stage = STAGES.FINALIZATION;
    console.log('Transitioning to FINALIZATION stage (via event)');
    console.log('Shopping list:', event.detail?.shoppingList);
  });
}

/**
 * Handle sending a message
 */
async function handleSendMessage() {
  const userInput = document.getElementById('userInput');
  const message = userInput.value.trim();
  
  if (!message) {
    return;
  }
  
  // Add user message to chat
  addUserMessage(message);
  userInput.value = '';
  
  // Disable input while processing
  setInputEnabled(false);
  
  try {
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Store the message in the conversations table
    if (currentState.conversationId) {
      try {
        // Use the API endpoint to store the message
        const response = await fetch(`${config.getApiBaseUrl()}/api/conversation/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: user.id,
            conversationId: currentState.conversationId,
            message: message
          })
        });
        
        if (!response.ok) {
          throw new Error(`Error storing message: ${response.statusText}`);
        }
        
        console.log('Message stored in conversation:', currentState.conversationId);
      } catch (error) {
        console.error('Error storing conversation message:', error);
        // Continue with processing even if message storage fails
      }
    }
    
    // Process the message based on the current stage
    if (currentState.stage === STAGES.BASIC_INFO) {
      // Process with the basic info collector
      await basicInfoCollector.processMessage(message);
      
      // Check if basic info collection is complete
      if (basicInfoCollector.isComplete()) {
        // Transition to the next stage
        currentState.stage = STAGES.METRICS_GOALS;
        console.log('Transitioning to METRICS_GOALS stage');
        
        // Initialize the metrics and goals collector and start it immediately
        // This will show the first question of the metrics stage right after the basic info completion message
        metricsAndGoalsCollector = initMetricsAndGoalsCollector({
          chatMessages: document.getElementById('chatMessages'),
          userInput: document.getElementById('userInput'),
          sendButton: document.getElementById('sendButton'),
          conversationId: currentState.conversationId
        });
        
        // Explicitly enable the input field for the metrics stage
        setInputEnabled(true);
        
        // No need for user to respond to start the metrics and goals stage
        return;
      }
    } else if (currentState.stage === STAGES.METRICS_GOALS) {
      // Process with the metrics and goals collector
      await metricsAndGoalsCollector.processMessage(message);
      
      // Check if metrics and goals collection is complete
      if (metricsAndGoalsCollector.isComplete()) {
        // The transition to diet preferences is handled by the metrics-goals-collector.js
        // No need to dispatch the event here
        return;
      }
    } else if (currentState.stage === STAGES.DIET_PREFERENCES) {
      // Process with the diet preferences collector
      await dietPreferencesCollector.processMessage(message);
      
      // Check if diet preferences collection is complete
      if (dietPreferencesCollector.isComplete()) {
        // The transition to calorie calculation is handled by the diet-preferences-collector.js
        // No need to dispatch the event here
        return;
      }
    } else if (currentState.stage === STAGES.CALORIE_CALCULATION) {
      // The calorie calculation stage doesn't process user messages
      // It's handled automatically by the calorie-calculation-collector.js
      return;
    } else if (currentState.stage === STAGES.SHOPPING_LIST) {
      // Process with the shopping list collector
      if (shoppingListCollector) {
        await shoppingListCollector.processMessage(message);
      } else {
        addBotMessage('The shopping list stage is not ready yet. Please try again in a moment.');
      }
    } else {
      // For other stages, we'll implement OpenAI Chat Completions later
      addBotMessage('This stage is not yet implemented. Coming soon!');
    }
  } catch (error) {
    console.error('Error processing message:', error);
    addBotMessage('Sorry, there was an error processing your message. Please try again.');
  } finally {
    // Re-enable input
    setInputEnabled(true);
  }
}

/**
 * Add a user message to the chat
 * @param {string} message - The message to add
 */
function addUserMessage(message) {
  const chatMessages = document.getElementById('chatMessages');
  
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
 * Add a bot message to the chat
 * @param {string} message - The message to add
 */
function addBotMessage(message) {
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
function addLoadingIndicator() {
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
function removeLoadingIndicator(loadingId) {
  if (!loadingId) {
    return;
  }
  
  const loadingElement = document.getElementById(loadingId);
  
  if (loadingElement) {
    loadingElement.remove();
  }
}

/**
 * Set the input enabled state
 * @param {boolean} enabled - Whether the input is enabled
 */
function setInputEnabled(enabled) {
  const userInput = document.getElementById('userInput');
  const sendButton = document.getElementById('sendButton');
  
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

// Export the initChatbot function
export { initChatbot };
