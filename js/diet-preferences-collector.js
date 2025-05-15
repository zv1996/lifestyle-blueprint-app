/**
 * Diet and Meal Preferences Collector for Lifestyle Blueprint
 * 
 * This module handles the collection of user diet and meal preferences
 * using a simple state machine approach without relying on OpenAI Assistants.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';

// Diet and meal preferences collection states
const STATES = {
  DIETARY_RESTRICTIONS: 'dietary_restrictions',
  DIETARY_PREFERENCES: 'dietary_preferences',
  MEAL_PORTIONS: 'meal_portions',
  MEAL_PORTIONS_DETAILS: 'meal_portions_details',
  SNACKS_CHOICE: 'snacks_choice',
  SNACKS_DETAILS: 'snacks_details',
  FAVORITE_MEALS_CHOICE: 'favorite_meals_choice',
  FAVORITE_MEALS_DETAILS: 'favorite_meals_details',
  COMPLETE: 'complete'
};

// Questions for each state
const QUESTIONS = {
  [STATES.DIETARY_RESTRICTIONS]: "Do you have any dietary restrictions (e.g., food allergies)?",
  [STATES.DIETARY_PREFERENCES]: "What are your dietary preferences (foods you do or don't like)?",
  [STATES.MEAL_PORTIONS]: "How many people are you preparing meals for?",
  [STATES.MEAL_PORTIONS_DETAILS]: "Please specify how many adults and children:",
  [STATES.SNACKS_CHOICE]: "Would you like to include any snacks in your meal plan?",
  [STATES.SNACKS_DETAILS]: "Please specify 2 snacks you'd like included in your meal plan:",
  [STATES.FAVORITE_MEALS_CHOICE]: "Would you like to include any favorite meals for weekend meals?",
  [STATES.FAVORITE_MEALS_DETAILS]: "Please specify 2 favorite meals you'd like included in your meal plan:"
};

// Validation functions for each state
const VALIDATORS = {
  [STATES.DIETARY_RESTRICTIONS]: (value) => {
    // Any text is valid, including "none"
    return value.trim().length > 0;
  },
  [STATES.DIETARY_PREFERENCES]: (value) => {
    // Any text is valid, including "none"
    return value.trim().length > 0;
  },
  [STATES.MEAL_PORTIONS]: (value) => {
    // Should be a number
    const count = parseInt(value);
    return !isNaN(count) && count > 0 && count <= 10;
  },
  [STATES.MEAL_PORTIONS_DETAILS]: (value) => {
    // Any text is valid
    return value.trim().length > 0;
  },
  [STATES.SNACKS_CHOICE]: (value) => {
    // Should be "yes" or "no"
    return ['yes', 'no'].includes(value.toLowerCase());
  },
  [STATES.SNACKS_DETAILS]: (value) => {
    // Any text is valid
    return value.trim().length > 0;
  },
  [STATES.FAVORITE_MEALS_CHOICE]: (value) => {
    // Should be "yes" or "no"
    return ['yes', 'no'].includes(value.toLowerCase());
  },
  [STATES.FAVORITE_MEALS_DETAILS]: (value) => {
    // Any text is valid
    return value.trim().length > 0;
  }
};

// Error messages for validation failures
const ERROR_MESSAGES = {
  [STATES.DIETARY_RESTRICTIONS]: "Please enter your dietary restrictions or 'none' if you don't have any.",
  [STATES.DIETARY_PREFERENCES]: "Please enter your dietary preferences or 'none' if you don't have any specific preferences.",
  [STATES.MEAL_PORTIONS]: "Please enter a valid number of people (between 1 and 10).",
  [STATES.MEAL_PORTIONS_DETAILS]: "Please specify how many adults and children.",
  [STATES.SNACKS_CHOICE]: "Please select 'Yes' or 'No'.",
  [STATES.SNACKS_DETAILS]: "Please specify 2 snacks you'd like included.",
  [STATES.FAVORITE_MEALS_CHOICE]: "Please select 'Yes' or 'No'.",
  [STATES.FAVORITE_MEALS_DETAILS]: "Please specify 2 favorite meals you'd like included."
};

// Current state of the collector
let currentState = {
  state: STATES.DIETARY_RESTRICTIONS,
  data: {
    dietaryRestrictions: '',
    dietaryPreferences: '',
    mealPortionPeopleCount: 0,
    mealPortionDetails: '',
    includeSnacks: false,
    snack1: '',
    snack2: '',
    includeFavoriteMeals: false,
    favoriteMeal1: '',
    favoriteMeal2: ''
  },
  conversationId: null
};

// Reference to UI elements
let uiElements = {
  chatMessages: null,
  userInput: null,
  sendButton: null,
  yesNoButtons: null
};

/**
 * Initialize the diet and meal preferences collector
 * @param {Object} elements - UI elements
 * @returns {Object} The collector interface
 */
function initDietPreferencesCollector(elements) {
  // Store UI elements
  uiElements = elements;
  
  // Reset the state
  currentState = {
    state: STATES.DIETARY_RESTRICTIONS,
    data: {
      dietaryRestrictions: '',
      dietaryPreferences: '',
      mealPortionPeopleCount: 0,
      mealPortionDetails: '',
      includeSnacks: false,
      snack1: '',
      snack2: '',
      includeFavoriteMeals: false,
      favoriteMeal1: '',
      favoriteMeal2: ''
    },
    conversationId: elements.conversationId || null
  };
  
  console.log('Diet preferences collector initialized with conversation ID:', currentState.conversationId);
  
  // Show the first question
  addBotMessage(QUESTIONS[STATES.DIETARY_RESTRICTIONS]);
  
  // Note: Input field is already enabled by chatbot.js
  
  // Return the collector interface
  return {
    processMessage,
    handleYesNoButtonClick,
    isComplete: () => currentState.state === STATES.COMPLETE
  };
}

/**
 * Handle yes/no button click
 * @param {string} choice - The selected choice ('yes' or 'no')
 */
function handleYesNoButtonClick(choice) {
  // Hide the yes/no buttons
  hideYesNoButtons();
  
  // Add the user's selection as a message
  const displayText = choice === 'yes' ? 'Yes' : 'No';
  addUserMessage(displayText);
  
  // Store the message in the conversations table
  storeUserMessage(displayText);
  
  if (currentState.state === STATES.SNACKS_CHOICE) {
    // Store the choice first
    currentState.data.includeSnacks = choice.toLowerCase() === 'yes';
    console.log('Setting includeSnacks to:', currentState.data.includeSnacks);
    
    if (currentState.data.includeSnacks) {
      // If yes, show snacks details question and enable input
      currentState.state = STATES.SNACKS_DETAILS;
      addBotMessage(QUESTIONS[currentState.state]);
      setInputEnabled(true);
    } else {
      // If no, just move to favorite meals question
      currentState.state = STATES.FAVORITE_MEALS_CHOICE;
      addBotMessage(QUESTIONS[currentState.state]);
      showYesNoButtons();
      setInputEnabled(false);
    }
  } else if (currentState.state === STATES.FAVORITE_MEALS_CHOICE) {
    // Store the choice first
    currentState.data.includeFavoriteMeals = choice.toLowerCase() === 'yes';
    console.log('Setting includeFavoriteMeals to:', currentState.data.includeFavoriteMeals);
    
    if (currentState.data.includeFavoriteMeals) {
      // If yes, show favorite meals details question and enable input
      currentState.state = STATES.FAVORITE_MEALS_DETAILS;
      addBotMessage(QUESTIONS[currentState.state]);
      setInputEnabled(true);
    } else {
      // If no, complete the process
      storeDietPreferences().then(() => {
        currentState.state = STATES.COMPLETE;
        addBotMessage("Thank you! Your dietary and meal preferences have been saved. Now, let's calculate your calorie needs based on your information.");
        const event = new CustomEvent('dietPreferencesComplete');
        document.dispatchEvent(event);
      }).catch(error => {
        console.error('Error storing diet preferences:', error);
        addBotMessage('Sorry, there was an error saving your information. Please try again.');
      });
    }
  }
}

/**
 * Process a user message
 * @param {string} message - The user message
 * @returns {Promise<boolean>} Whether the message was processed successfully
 */
async function processMessage(message) {
  console.log('Current state before processing:', currentState.state);
  console.log('Current data before processing:', JSON.stringify(currentState.data, null, 2));
  
  // If we're already complete, do nothing
  if (currentState.state === STATES.COMPLETE) {
    return false;
  }
  
  // Skip validation for Yes/No choice states since they're handled by handleYesNoButtonClick
  if (currentState.state !== STATES.SNACKS_CHOICE && currentState.state !== STATES.FAVORITE_MEALS_CHOICE) {
    // Validate the message for the current state
    const isValid = VALIDATORS[currentState.state](message);
    
    if (!isValid) {
      // If the message is invalid, show an error message
      addBotMessage(ERROR_MESSAGES[currentState.state]);
      return false;
    }
  }
  
  // Process the message based on the current state
  switch (currentState.state) {
    case STATES.DIETARY_RESTRICTIONS:
      // Store the dietary restrictions as a string
      currentState.data.dietaryRestrictions = message;
      console.log('Storing dietary restrictions:', currentState.data.dietaryRestrictions);
      
      // Move to the next state
      currentState.state = STATES.DIETARY_PREFERENCES;
      addBotMessage(QUESTIONS[currentState.state]);
      console.log('Updated state:', currentState.state);
      console.log('Updated data:', JSON.stringify(currentState.data, null, 2));
      break;
      
    case STATES.DIETARY_PREFERENCES:
      // Store the dietary preferences as a string
      currentState.data.dietaryPreferences = message;
      console.log('Storing dietary preferences:', currentState.data.dietaryPreferences);
      
      // Move to the next state
      currentState.state = STATES.MEAL_PORTIONS;
      addBotMessage(QUESTIONS[currentState.state]);
      console.log('Updated state:', currentState.state);
      console.log('Updated data:', JSON.stringify(currentState.data, null, 2));
      break;
      
    case STATES.MEAL_PORTIONS:
      // Store the meal portion people count
      currentState.data.mealPortionPeopleCount = parseInt(message);
      console.log('Storing meal portion people count:', currentState.data.mealPortionPeopleCount);
      
      // If more than 1 person, ask for details
      if (currentState.data.mealPortionPeopleCount > 1) {
        currentState.state = STATES.MEAL_PORTIONS_DETAILS;
        addBotMessage(QUESTIONS[currentState.state]);
      } else {
        // Skip to the next state
        currentState.state = STATES.SNACKS_CHOICE;
        addBotMessage(QUESTIONS[currentState.state]);
        showYesNoButtons();
        setInputEnabled(false);
      }
      console.log('Updated state:', currentState.state);
      console.log('Updated data:', JSON.stringify(currentState.data, null, 2));
      break;
      
    case STATES.MEAL_PORTIONS_DETAILS:
      // Store the meal portion details
      currentState.data.mealPortionDetails = message;
      console.log('Storing meal portion details:', currentState.data.mealPortionDetails);
      
      // Move to the next state
      currentState.state = STATES.SNACKS_CHOICE;
      addBotMessage(QUESTIONS[currentState.state]);
      showYesNoButtons();
      setInputEnabled(false);
      console.log('Updated state:', currentState.state);
      console.log('Updated data:', JSON.stringify(currentState.data, null, 2));
      break;
      
    // SNACKS_CHOICE case removed - now handled by handleYesNoButtonClick
      
    case STATES.SNACKS_DETAILS:
      // Store the snacks directly
      const snackParts = message.split(',').map(s => s.trim());
      currentState.data.snack1 = snackParts[0] || '';
      currentState.data.snack2 = snackParts.length > 1 ? snackParts[1] : '';
      console.log('Storing snacks:', currentState.data.snack1, currentState.data.snack2);
      
      // Move to the next state
      currentState.state = STATES.FAVORITE_MEALS_CHOICE;
      addBotMessage(QUESTIONS[currentState.state]);
      showYesNoButtons();
      setInputEnabled(false);
      console.log('Updated state:', currentState.state);
      console.log('Updated data:', JSON.stringify(currentState.data, null, 2));
      break;
      
    // FAVORITE_MEALS_CHOICE case removed - now handled by handleYesNoButtonClick
      
    case STATES.FAVORITE_MEALS_DETAILS:
      // Store the favorite meals directly
      const mealParts = message.split(',').map(m => m.trim());
      currentState.data.favoriteMeal1 = mealParts[0] || '';
      currentState.data.favoriteMeal2 = mealParts.length > 1 ? mealParts[1] : '';
      console.log('Storing favorite meals:', currentState.data.favoriteMeal1, currentState.data.favoriteMeal2);
      
      // Complete the process
      try {
        await storeDietPreferences();
        
        // Move to the complete state
        currentState.state = STATES.COMPLETE;
        
        // Show a completion message
        addBotMessage("Thank you! Your dietary and meal preferences have been saved. Now, let's calculate your calorie needs based on your information.");
        
        // Trigger a custom event to notify chatbot.js to transition to the calorie calculation stage
        const event = new CustomEvent('dietPreferencesComplete');
        document.dispatchEvent(event);
        
        console.log('Updated state:', currentState.state);
        console.log('Updated data:', JSON.stringify(currentState.data, null, 2));
        return true;
      } catch (error) {
        console.error('Error storing diet preferences:', error);
        addBotMessage('Sorry, there was an error saving your information. Please try again.');
        return false;
      }
      break;
      
    default:
      return false;
  }
  
  return true;
}

/**
 * Parse snacks or meals from a message
 * @param {string} message - The message containing snacks or meals
 * @returns {Array<string>} Array of snacks or meals
 */
function parseSnacksOrMeals(message) {
  // Split by common separators (comma, semicolon, newline, and)
  const items = message.split(/[,;\n]|\s+and\s+/).map(item => item.trim()).filter(item => item);
  
  // Return the first two items
  return items.slice(0, 2);
}

/**
 * Store the diet preferences in the database
 * @returns {Promise<Object>} The stored diet preferences data
 */
async function storeDietPreferences() {
  try {
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Log the data we're about to send
    console.log('Storing diet preferences with data:', JSON.stringify(currentState.data, null, 2));
    
    // Prepare the request body
    const requestBody = {
      userId: user.id,
      dietaryRestrictions: currentState.data.dietaryRestrictions,
      dietaryPreferences: currentState.data.dietaryPreferences,
      mealPortionPeopleCount: currentState.data.mealPortionPeopleCount,
      mealPortionDetails: currentState.data.mealPortionDetails,
      includeSnacks: currentState.data.includeSnacks,
      snack1: currentState.data.snack1,
      snack2: currentState.data.snack2,
      includeFavoriteMeals: currentState.data.includeFavoriteMeals,
      favoriteMeal1: currentState.data.favoriteMeal1,
      favoriteMeal2: currentState.data.favoriteMeal2,
      conversationId: currentState.conversationId
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    // Make a POST request to the API to store the diet preferences
    const response = await fetch(`${config.getApiBaseUrl()}/api/user/diet-preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Error storing diet preferences: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Diet preferences stored successfully:', result);
    return result;
  } catch (error) {
    console.error('Error storing diet preferences:', error);
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
 * Show the yes/no buttons
 */
function showYesNoButtons() {
  // Create the yes/no buttons container if it doesn't exist
  if (!uiElements.yesNoButtons) {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'yesNoButtons';
    buttonsContainer.classList.add('fitness-goal-buttons'); // Reuse the same style
    
    // Create the buttons
    const yesButton = document.createElement('button');
    yesButton.classList.add('fitness-goal-button'); // Reuse the same style
    yesButton.textContent = 'Yes';
    yesButton.dataset.value = 'yes';
    
    const noButton = document.createElement('button');
    noButton.classList.add('fitness-goal-button'); // Reuse the same style
    noButton.textContent = 'No';
    noButton.dataset.value = 'no';
    
    // Add the buttons to the container
    buttonsContainer.appendChild(yesButton);
    buttonsContainer.appendChild(noButton);
    
    // Insert the buttons before the chat input
    const chatInput = document.querySelector('.chat-input');
    chatInput.parentNode.insertBefore(buttonsContainer, chatInput);
    
    // Add event listeners
    const buttons = buttonsContainer.querySelectorAll('.fitness-goal-button');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        handleYesNoButtonClick(button.dataset.value);
      });
    });
    
    // Store the buttons container reference
    uiElements.yesNoButtons = buttonsContainer;
  } else {
    // Show the existing buttons
    uiElements.yesNoButtons.style.display = 'flex';
  }
}

/**
 * Hide the yes/no buttons
 */
function hideYesNoButtons() {
  if (uiElements.yesNoButtons) {
    uiElements.yesNoButtons.style.display = 'none';
  }
}

/**
 * Store a user message in the conversations table
 * @param {string} message - The message to store
 */
async function storeUserMessage(message) {
  try {
    // Get the current user
    const user = getCurrentUser();
    
    if (!user || !currentState.conversationId) {
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

/**
 * Set the input enabled state
 * @param {boolean} enabled - Whether the input is enabled
 */
function setInputEnabled(enabled) {
  const { userInput, sendButton } = uiElements;
  
  if (userInput) {
    userInput.disabled = !enabled;
    if (!enabled) {
      userInput.placeholder = "Please use the options above...";
    } else {
      userInput.placeholder = "Type your message here...";
      
      // Auto-focus the input field when enabled
      setTimeout(() => {
        userInput.focus();
      }, 50);
    }
  }
  
  if (sendButton) {
    sendButton.disabled = !enabled;
  }
}

// Export the collector
export { initDietPreferencesCollector };
