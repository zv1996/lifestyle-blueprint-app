/**
 * Calorie Calculation Collector for Lifestyle Blueprint
 * 
 * This module handles the calorie calculation stage of the conversation,
 * calculating the user's calorie needs and displaying the results.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';
import { CalorieCalculator } from './calorie-calculator.js';
import { CalorieResultsOverlay } from './calorie-results-overlay.js';
import { MealPlanCreator } from './meal-plan-creator.js';

// Calorie calculation states
const STATES = {
  CALCULATING: 'calculating',
  SHOWING_RESULTS: 'showing_results',
  COMPLETE: 'complete'
};

// Current state of the collector
let currentState = {
  state: STATES.CALCULATING,
  data: {
    calculationResults: null
  },
  conversationId: null
};

// Reference to the meal plan creator
let mealPlanCreator = null;

// Reference to UI elements
let uiElements = {
  chatMessages: null,
  userInput: null,
  sendButton: null
};

/**
 * Initialize the calorie calculation collector
 * @param {Object} elements - UI elements
 * @returns {Object} The collector interface
 */
function initCalorieCalculationCollector(elements) {
  // Store UI elements
  uiElements = elements;
  
  // Reset the state
  currentState = {
    state: STATES.CALCULATING,
    data: {
      calculationResults: null
    },
    conversationId: elements.conversationId || null
  };
  
  console.log('Calorie calculation collector initialized with conversation ID:', currentState.conversationId);
  
  // Return the collector interface
  return {
    startCalculations,
    handleCreatePlanClick,
    isComplete: () => currentState.state === STATES.COMPLETE
  };
}

/**
 * Start the calorie calculations
 */
async function startCalculations() {
  try {
    // Show loading message
    addBotMessage("Please wait one moment while we calculate your required calorie intake...");
    
    // Disable input while calculating
    setInputEnabled(false);
    
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Get all user data with the current conversation ID
    const userData = await getAllUserData(user.id, currentState.conversationId);
    
    // Validate that we have the required data before proceeding
    if (!userData) {
      throw new Error('Unable to retrieve user data');
    }
    
    if (!userData.metricsAndGoals) {
      throw new Error('Missing metrics and goals data: height, weight, and activity level are required for calculations');
    }
    
    // Perform calculations
    const calculator = new CalorieCalculator();
    const results = calculator.calculateAll(userData);
    
    // Store the results in memory
    currentState.data.calculationResults = results;
    
    try {
      // Store in database
      await storeCalculationResults(results);
    } catch (storageError) {
      console.error('Error storing calculation results:', storageError);
      // Continue even if storage fails - we can still show results
    }
    
    // Update state
    currentState.state = STATES.SHOWING_RESULTS;
    
    // Show the results overlay
    const overlay = new CalorieResultsOverlay(results, handleCreatePlanClick);
    overlay.show();
  } catch (error) {
    console.error('Error calculating calorie needs:', error);
    
    // Provide more specific error messages based on the error
    if (error.message.includes('metrics and goals data')) {
      addBotMessage('Unable to calculate calories: Your height, weight, and activity level information is missing. Please complete the metrics and goals stage first.');
    } else if (error.message.includes('user data')) {
      addBotMessage('Unable to calculate calories: Your basic information is missing. Please complete the basic info stage first.');
    } else if (error.message.includes('storing calorie calculations')) {
      addBotMessage('Your calorie needs were calculated but there was an error saving them. The results will still be displayed.');
    } else {
      addBotMessage('Sorry, there was an error calculating your calorie needs. Please try again.');
    }
    
    // Re-enable input
    setInputEnabled(true);
  }
}

/**
 * Handle the Create Plan button click
 * @param {Object} results - The calculation results
 */
function handleCreatePlanClick(results) {
  // Add the results to the chat
  addCalorieResultsMessage(results);
  
  // Update state
  currentState.state = STATES.COMPLETE;
  
  // Trigger a custom event to notify chatbot.js to transition to the meal plan stage
  const event = new CustomEvent('calorieCalculationComplete', { 
    detail: { results }
  });
  document.dispatchEvent(event);
  
  // Create the meal plan
  if (!mealPlanCreator) {
    mealPlanCreator = new MealPlanCreator({
      conversationId: currentState.conversationId
    });
  }
  
  // Start the meal plan creation process
  mealPlanCreator.createMealPlan(currentState.conversationId);
}

/**
 * Store the calculation results in the database
 * @param {Object} results - The calculation results
 * @returns {Promise<Object>} The stored data
 */
async function storeCalculationResults(results) {
  try {
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Validate results object
    if (!results || !results.calculations || !results.calculations.weeklyCalories) {
      throw new Error('Invalid calculation results');
    }
    
    // Prepare simplified data for storage
    const weeklyCalorieIntake = Math.round(results.calculations.weeklyCalories);
    const fiveTwoSplit = `weekdays:${Math.round(results.split.weekday.calories)} weekends:${Math.round(results.split.weekend.calories)}`;
    const macronutrientSplit = results.macroSplit.type; // e.g., "40/30/30"
    
    console.log('Storing calorie calculations with data:', {
      userId: user.id,
      weeklyCalorieIntake,
      fiveTwoSplit,
      macronutrientSplit,
      conversationId: currentState.conversationId
    });
    
    // Make a POST request to the API to store the calorie calculations
    const response = await fetch(`${config.getApiBaseUrl()}/api/user/calorie-calculations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id,
        weeklyCalorieIntake,
        fiveTwoSplit,
        macronutrientSplit,
        conversationId: currentState.conversationId
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error storing calorie calculations: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('Calorie calculations stored successfully:', data);
    return data;
  } catch (error) {
    console.error('Error storing calorie calculations:', error);
    throw error;
  }
}

/**
 * Get all user data from the database
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object>} The user data
 */
async function getAllUserData(userId, conversationId) {
  try {
    // Make a GET request to the API to get all user data
    const response = await fetch(`${config.getApiBaseUrl()}/api/user/${userId}/data?conversationId=${conversationId}`);
    
    if (!response.ok) {
      throw new Error(`Error getting user data: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
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
 * Add a calorie results message to the chat
 * @param {Object} results - The calculation results
 */
function addCalorieResultsMessage(results) {
  const { chatMessages } = uiElements;
  
  if (!chatMessages) {
    return;
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', 'bot', 'calorie-results');
  
  const messageContent = document.createElement('div');
  messageContent.classList.add('message-content');
  
  // Use the static method from CalorieResultsOverlay to create the content
  messageContent.innerHTML = CalorieResultsOverlay.createChatMessageContent(results);
  
  messageDiv.appendChild(messageContent);
  chatMessages.appendChild(messageDiv);
  
  // Scroll to the bottom of the chat
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Set the input enabled state
 * @param {boolean} enabled - Whether the input is enabled
 */
function setInputEnabled(enabled) {
  const { userInput, sendButton } = uiElements;
  
  if (userInput) {
    userInput.disabled = !enabled;
  }
  
  if (sendButton) {
    sendButton.disabled = !enabled;
  }
}

// Export the collector
export { initCalorieCalculationCollector };
