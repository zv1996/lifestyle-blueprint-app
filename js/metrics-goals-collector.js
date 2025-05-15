/**
 * Metrics and Goals Collector for Lifestyle Blueprint
 * 
 * This module handles the collection of user metrics and fitness goals
 * using a simple state machine approach without relying on OpenAI Assistants.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';

// Metrics and goals collection states
const STATES = {
  HEIGHT: 'height',
  WEIGHT: 'weight',
  ACTIVITY_LEVEL: 'activity_level',
  FITNESS_GOAL: 'fitness_goal',
  COMPLETE: 'complete'
};

// Questions for each state
const QUESTIONS = {
  [STATES.HEIGHT]: "What's your height in inches? (For example, 5'8\" would be 68 inches)",
  [STATES.WEIGHT]: "Thanks! Now, what's your current weight in pounds?",
  [STATES.ACTIVITY_LEVEL]: "Great! Let's talk about your activity level. Which of these best describes you?",
  [STATES.FITNESS_GOAL]: "Awesome! Finally, what's your primary health and fitness goal?"
};

// Validation functions for each state
const VALIDATORS = {
  [STATES.HEIGHT]: (value) => {
    // Height should be a number between 36 and 96 inches (3-8 feet)
    const height = parseFloat(value);
    return !isNaN(height) && height >= 36 && height <= 96;
  },
  [STATES.WEIGHT]: (value) => {
    // Weight should be a number between 50 and 500 pounds
    const weight = parseFloat(value);
    return !isNaN(weight) && weight >= 50 && weight <= 500;
  },
  [STATES.ACTIVITY_LEVEL]: (value) => {
    // Activity level should be one of the allowed values (1-5)
    return ['1', '2', '3', '4', '5'].includes(value);
  },
  [STATES.FITNESS_GOAL]: (value) => {
    // Fitness goal should be one of the allowed values
    return ['LOSE_WEIGHT', 'GAIN_MUSCLE', 'MAINTENANCE'].includes(value);
  }
};

// Error messages for validation failures
const ERROR_MESSAGES = {
  [STATES.HEIGHT]: "Please enter a valid height in inches (between 36 and 96).",
  [STATES.WEIGHT]: "Please enter a valid weight in pounds (between 50 and 500).",
  [STATES.ACTIVITY_LEVEL]: "Please select your activity level.",
  [STATES.FITNESS_GOAL]: "Please select your fitness goal."
};

// Activity level options
const ACTIVITY_LEVELS = [
  {
    value: '1',
    label: 'Level 1',
    description: 'Light: 3-4 hours exercise per week or less'
  },
  {
    value: '2',
    label: 'Level 2',
    description: 'Moderate: Regular exercise, active daily life'
  },
  {
    value: '3',
    label: 'Level 3',
    description: 'High: Marathon/event training'
  },
  {
    value: '4',
    label: 'Level 4',
    description: 'Athletic: Regular competitive sports'
  },
  {
    value: '5',
    label: 'Level 5',
    description: 'Professional: College/Pro athlete'
  }
];

// Fitness goal options
const FITNESS_GOALS = [
  {
    value: 'LOSE_WEIGHT',
    label: 'Lose Weight'
  },
  {
    value: 'GAIN_MUSCLE',
    label: 'Gain Muscle'
  },
  {
    value: 'MAINTENANCE',
    label: 'Maintenance'
  }
];

// Current state of the collector
let currentState = {
  state: STATES.HEIGHT,
  data: {
    heightInches: 0,
    weightPounds: 0,
    activityLevel: '',
    healthFitnessGoal: ''
  },
  conversationId: null
};

// Reference to UI elements
let uiElements = {
  chatMessages: null,
  userInput: null,
  sendButton: null,
  activityLevelDropdown: null,
  fitnessGoalButtons: null
};

/**
 * Initialize the metrics and goals collector
 * @param {Object} elements - UI elements
 * @returns {Object} The collector interface
 */
function initMetricsAndGoalsCollector(elements) {
  // Store UI elements
  uiElements = elements;
  
  // Reset the state
  currentState = {
    state: STATES.HEIGHT,
    data: {
      heightInches: 0,
      weightPounds: 0,
      activityLevel: '',
      healthFitnessGoal: ''
    },
    conversationId: elements.conversationId || null
  };
  
  console.log('Metrics and goals collector initialized with conversation ID:', currentState.conversationId);
  
  // Show the height question
  addBotMessage(QUESTIONS[STATES.HEIGHT]);
  
  // Note: Input field is already enabled by chatbot.js
  
  // Return the collector interface
  return {
    processMessage,
    handleActivityLevelSelect,
    handleFitnessGoalClick,
    isComplete: () => currentState.state === STATES.COMPLETE
  };
}

/**
 * Handle activity level selection
 * @param {string} level - The selected activity level
 */
function handleActivityLevelSelect(level) {
  // Hide the activity level dropdown
  hideActivityLevelDropdown();
  
  // Find the selected level
  const selectedLevel = ACTIVITY_LEVELS.find(l => l.value === level);
  
  // Store the activity level and show the message
  if (selectedLevel) {
    currentState.data.activityLevel = selectedLevel.description;
    const displayText = `${selectedLevel.label}: ${selectedLevel.description}`;
    addUserMessage(displayText);
    
    // Store the message in the conversations table
    storeUserMessage(displayText);
    
    // Show the fitness goal question and buttons
    currentState.state = STATES.FITNESS_GOAL;
    addBotMessage(QUESTIONS[currentState.state]);
    showFitnessGoalButtons();
  }
}

/**
 * Handle fitness goal button click
 * @param {string} goal - The selected fitness goal
 */
function handleFitnessGoalClick(goal) {
  // Hide the fitness goal buttons
  hideFitnessGoalButtons();
  
  // Store the fitness goal
  currentState.data.healthFitnessGoal = goal;
  
  // Add the user's selection as a message
  addUserMessage(goal);
  
  // Store the message in the conversations table
  storeUserMessage(goal);
  
  // Store the data and complete the process
  storeMetricsAndGoals()
    .then(() => {
      // Move to the complete state
      currentState.state = STATES.COMPLETE;
      
      // Get the user's first name from the URL or use a default
      const urlParams = new URLSearchParams(window.location.search);
      const firstName = urlParams.get('firstName') || 'there';
      
      // Show a completion message
      addBotMessage(`Thank you, ${firstName}! Now, let's talk about your dietary and meal preferences.`);
      
      // Trigger a custom event to notify chatbot.js to transition to the diet preferences stage
      const event = new CustomEvent('metricsGoalsComplete');
      document.dispatchEvent(event);
    })
    .catch(error => {
      console.error('Error storing metrics and goals:', error);
      addBotMessage('Sorry, there was an error saving your information. Please try again.');
      
      // Show the fitness goal buttons again
      showFitnessGoalButtons();
    });
}

/**
 * Process a user message
 * @param {string} message - The user message
 * @returns {Promise<boolean>} Whether the message was processed successfully
 */
async function processMessage(message) {
  // If we're already complete, do nothing
  if (currentState.state === STATES.COMPLETE) {
    return false;
  }
  
  // For the activity level and fitness goal states, the message will be the selected value
  if (currentState.state !== STATES.ACTIVITY_LEVEL && currentState.state !== STATES.FITNESS_GOAL) {
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
    case STATES.HEIGHT:
      // Store the height
      currentState.data.heightInches = parseFloat(message);
      
      // Move to the next state
      currentState.state = STATES.WEIGHT;
      addBotMessage(QUESTIONS[currentState.state]);
      break;
      
    case STATES.WEIGHT:
      // Store the weight
      currentState.data.weightPounds = parseFloat(message);
      
      // Move to the next state
      currentState.state = STATES.ACTIVITY_LEVEL;
      addBotMessage(QUESTIONS[currentState.state]);
      
      // Show the activity level dropdown
      showActivityLevelDropdown();
      
      // Disable the text input
      setInputEnabled(false);
      break;
      
    // Activity level is now handled directly in handleActivityLevelSelect
    // We skip the ACTIVITY_LEVEL case in processMessage
      
    // Fitness goal is now handled directly in handleFitnessGoalClick
    // We skip the FITNESS_GOAL case in processMessage
      
    default:
      return false;
  }
  
  return true;
}

/**
 * Store the metrics and goals in the database
 * @returns {Promise<Object>} The stored metrics and goals data
 */
async function storeMetricsAndGoals() {
  try {
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Make a POST request to the API to store the metrics and goals
    const response = await fetch(`${config.getApiBaseUrl()}/api/user/metrics-goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id,
        heightInches: currentState.data.heightInches,
        weightPounds: currentState.data.weightPounds,
        activityLevel: currentState.data.activityLevel,
        healthFitnessGoal: currentState.data.healthFitnessGoal,
        conversationId: currentState.conversationId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error storing metrics and goals: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error storing metrics and goals:', error);
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
 * Show the activity level dropdown
 */
function showActivityLevelDropdown() {
  // Create the activity level dropdown if it doesn't exist
  if (!uiElements.activityLevelDropdown) {
    const dropdownContainer = document.createElement('div');
    dropdownContainer.id = 'activityLevelDropdown';
    dropdownContainer.classList.add('activity-level-dropdown');
    
    // Create the select element
    const select = document.createElement('select');
    select.classList.add('activity-level-select');
    
    // Add a default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select your activity level...';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);
    
    // Add options for each activity level
    ACTIVITY_LEVELS.forEach(level => {
      const option = document.createElement('option');
      option.value = level.value;
      option.textContent = `${level.label}: ${level.description}`;
      select.appendChild(option);
    });
    
    // Add event listener
    select.addEventListener('change', (event) => {
      const level = event.target.value;
      if (level) {
        handleActivityLevelSelect(level);
      }
    });
    
    // Add the select to the container
    dropdownContainer.appendChild(select);
    
    // Insert the dropdown before the chat input
    const chatInput = document.querySelector('.chat-input');
    chatInput.parentNode.insertBefore(dropdownContainer, chatInput);
    
    // Store the dropdown reference
    uiElements.activityLevelDropdown = dropdownContainer;
  } else {
    // Show the existing dropdown
    uiElements.activityLevelDropdown.style.display = 'block';
  }
}

/**
 * Hide the activity level dropdown
 */
function hideActivityLevelDropdown() {
  if (uiElements.activityLevelDropdown) {
    uiElements.activityLevelDropdown.style.display = 'none';
  }
}

/**
 * Show the fitness goal buttons
 */
function showFitnessGoalButtons() {
  // Create the fitness goal buttons container if it doesn't exist
  if (!uiElements.fitnessGoalButtons) {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.id = 'fitnessGoalButtons';
    buttonsContainer.classList.add('fitness-goal-buttons');
    
    // Create buttons for each fitness goal
    FITNESS_GOALS.forEach((goal, index) => {
      const button = document.createElement('button');
      button.classList.add('fitness-goal-button');
      button.textContent = goal.label;
      
      // Store both the value and the label in the dataset
      button.dataset.value = goal.value;
      button.dataset.label = goal.label;
      button.dataset.index = (index + 1).toString(); // Add index for debugging
      
      // Add event listener
      button.addEventListener('click', () => {
        // Pass the label directly to ensure we store the text, not the code
        handleFitnessGoalClick(goal.label);
      });
      
      // Add the button to the container
      buttonsContainer.appendChild(button);
    });
    
    // Insert the buttons before the chat input
    const chatInput = document.querySelector('.chat-input');
    chatInput.parentNode.insertBefore(buttonsContainer, chatInput);
    
    // Store the buttons container reference
    uiElements.fitnessGoalButtons = buttonsContainer;
  } else {
    // Show the existing buttons
    uiElements.fitnessGoalButtons.style.display = 'flex';
  }
}

/**
 * Hide the fitness goal buttons
 */
function hideFitnessGoalButtons() {
  if (uiElements.fitnessGoalButtons) {
    uiElements.fitnessGoalButtons.style.display = 'none';
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
export { initMetricsAndGoalsCollector };
