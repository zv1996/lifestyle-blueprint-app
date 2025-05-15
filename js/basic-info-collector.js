/**
 * Basic Info Collector for Lifestyle Blueprint
 * 
 * This module handles the collection of basic user information
 * using a simple state machine approach without relying on OpenAI Assistants.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';

// Basic info collection states
const STATES = {
  WELCOME: 'welcome',
  NAME: 'name',
  PHONE: 'phone',
  BIRTHDATE: 'birthdate',
  SEX: 'sex',
  COMPLETE: 'complete'
};

// Questions for each state
const QUESTIONS = {
  [STATES.WELCOME]: "Hi there! Ready to create your personalized meal plan for the week?",
  [STATES.NAME]: "Great! Let's start with your name. What's your full name?",
  [STATES.PHONE]: "Thanks! What's your phone number?",
  [STATES.BIRTHDATE]: "Now, what's your birth date?",
  [STATES.SEX]: "What is your biological sex?"
};

// Validation functions for each state
const VALIDATORS = {
  [STATES.NAME]: (value) => {
    // Name should be at least 2 characters
    return value.trim().length >= 2;
  },
  [STATES.PHONE]: (value) => {
    // Phone should be 10 digits (after removing non-digits)
    return /^\d{10}$/.test(value.replace(/\D/g, ''));
  },
  [STATES.BIRTHDATE]: (value) => {
    // Birthdate should be a valid date
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
  },
  [STATES.SEX]: (value) => {
    // Sex should be one of the allowed values
    return ['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY'].includes(value);
  }
};

// Error messages for validation failures
const ERROR_MESSAGES = {
  [STATES.NAME]: "Please enter your full name.",
  [STATES.PHONE]: "Please enter a valid 10-digit phone number.",
  [STATES.BIRTHDATE]: "Please select a valid birth date.",
  [STATES.SEX]: "Please select your biological sex."
};

// Current state of the collector
let currentState = {
  state: STATES.WELCOME,
  data: {
    firstName: '',
    lastName: '',
    phoneNumber: '',
    birthDate: '',
    biologicalSex: ''
  },
  conversationId: null
};

// Reference to UI elements
let uiElements = {
  chatMessages: null,
  userInput: null,
  sendButton: null,
  startButton: null,
  calendarPicker: null,
  sexButtons: null
};

/**
 * Initialize the basic info collector
 * @param {Object} elements - UI elements
 * @returns {Object} The collector interface
 */
function initBasicInfoCollector(elements) {
  // Store UI elements
  uiElements = elements;
  
  // Reset the state
  currentState = {
    state: STATES.WELCOME,
    data: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      birthDate: '',
      biologicalSex: ''
    },
    conversationId: elements.conversationId || null
  };
  
  console.log('Basic info collector initialized with conversation ID:', currentState.conversationId);
  
  // Show the welcome message and start button
  addBotMessage(QUESTIONS[STATES.WELCOME]);
  showStartButton();
  
  // Disable the text input initially
  setInputEnabled(false);
  
  // Return the collector interface
  return {
    processMessage,
    handleStartButton,
    handleSexButtonClick,
    isComplete: () => currentState.state === STATES.COMPLETE
  };
}

/**
 * Handle the start button click
 */
function handleStartButton() {
  // Hide the start button
  hideStartButton();
  
  // Move to the name state
  currentState.state = STATES.NAME;
  
  // Show the name question
  addBotMessage(QUESTIONS[STATES.NAME]);
  
  // Enable the text input
  setInputEnabled(true);
}

/**
 * Handle the sex button click
 * @param {string} sex - The selected sex
 */
function handleSexButtonClick(sex) {
  // Hide the sex buttons
  hideSexButtons();
  
  // Add the user's selection as a message
  const displayText = sex === 'MALE' ? 'Male' : 
                      sex === 'FEMALE' ? 'Female' : 
                      'Prefer not to say';
  addUserMessage(displayText);
  
  // Store the message in the conversations table
  storeUserMessage(displayText);
  
  // Process the selection and get the result
  processMessage(sex).then(result => {
    // If processing was successful and we're now in the complete state,
    // trigger a custom event to notify chatbot.js to transition to the metrics stage
    if (result && currentState.state === STATES.COMPLETE) {
      // Create and dispatch a custom event
      const event = new CustomEvent('basicInfoComplete');
      document.dispatchEvent(event);
    }
  });
}

/**
 * Process a user message
 * @param {string} message - The user message
 * @returns {Promise<boolean>} Whether the message was processed successfully
 */
async function processMessage(message) {
  // If we're in the welcome state, do nothing
  if (currentState.state === STATES.WELCOME) {
    return false;
  }
  
  // If we're already complete, do nothing
  if (currentState.state === STATES.COMPLETE) {
    return false;
  }
  
  // For the sex state, the message will be the button value
  if (currentState.state !== STATES.SEX) {
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
    case STATES.NAME:
      // Split the name into first and last name
      const nameParts = message.trim().split(' ');
      currentState.data.firstName = nameParts[0];
      currentState.data.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      
      // Move to the next state
      currentState.state = STATES.PHONE;
      addBotMessage(QUESTIONS[currentState.state]);
      break;
      
    case STATES.PHONE:
      // Store the phone number (digits only)
      currentState.data.phoneNumber = message.replace(/\D/g, '');
      
      // Move to the next state
      currentState.state = STATES.BIRTHDATE;
      addBotMessage(QUESTIONS[currentState.state]);
      
      // Show the calendar picker
      showCalendarPicker();
      break;
      
    case STATES.BIRTHDATE:
      // Store the birth date
      currentState.data.birthDate = message;
      
      // Move to the next state
      currentState.state = STATES.SEX;
      addBotMessage(QUESTIONS[currentState.state]);
      
      // Show the sex buttons
      showSexButtons();
      
      // Disable the text input
      setInputEnabled(false);
      break;
      
    case STATES.SEX:
      // Store the biological sex
      currentState.data.biologicalSex = message;
      
      // Store the data in the database
      try {
        await storeUserInfo();
        
        // Move to the complete state
        currentState.state = STATES.COMPLETE;
        
        // Show a completion message
        const firstName = currentState.data.firstName;
        addBotMessage(`Thank you, ${firstName}! Your basic information has been saved. Now, let's talk about your health metrics and fitness goals.`);
        
        // Signal completion - this will trigger the chatbot.js to transition to the metrics stage
        // The metrics stage will be initialized in chatbot.js
        return true;
      } catch (error) {
        console.error('Error storing user info:', error);
        addBotMessage('Sorry, there was an error saving your information. Please try again.');
        
        // Show the sex buttons again
        showSexButtons();
        
        return false;
      }
      
    default:
      return false;
  }
  
  return true;
}

/**
 * Store the user info in the database
 * @returns {Promise<Object>} The stored user data
 */
async function storeUserInfo() {
  try {
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Make a POST request to the API to store the user info
    const response = await fetch(`${config.getApiBaseUrl()}/api/user/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id,
        firstName: currentState.data.firstName,
        lastName: currentState.data.lastName,
        phoneNumber: currentState.data.phoneNumber,
        birthDate: currentState.data.birthDate,
        biologicalSex: currentState.data.biologicalSex,
        conversationId: currentState.conversationId
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error storing user info: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error storing user info:', error);
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
 * Show the start button
 */
function showStartButton() {
  // Create the start button if it doesn't exist
  if (!uiElements.startButton) {
    const startButton = document.createElement('button');
    startButton.id = 'startButton';
    startButton.classList.add('start-button');
    startButton.textContent = "Let's Get Started!";
    
    // Insert the button before the chat input
    const chatInput = document.querySelector('.chat-input');
    chatInput.parentNode.insertBefore(startButton, chatInput);
    
    // Store the button reference
    uiElements.startButton = startButton;
  } else {
    // Show the existing button
    uiElements.startButton.style.display = 'block';
  }
}

/**
 * Hide the start button
 */
function hideStartButton() {
  if (uiElements.startButton) {
    uiElements.startButton.style.display = 'none';
  }
}

/**
 * Show the calendar picker
 */
function showCalendarPicker() {
  // Create the calendar picker if it doesn't exist
  if (!uiElements.calendarPicker) {
    const calendarPicker = document.createElement('input');
    calendarPicker.type = 'date';
    calendarPicker.id = 'calendarPicker';
    calendarPicker.classList.add('calendar-picker');
    
    // Set max date to today (no future dates)
    const today = new Date();
    const maxDate = today.toISOString().split('T')[0];
    calendarPicker.max = maxDate;
    
    // Set min date to 100 years ago
    const minYear = today.getFullYear() - 100;
    const minDate = new Date(minYear, today.getMonth(), today.getDate()).toISOString().split('T')[0];
    calendarPicker.min = minDate;
    
    // Insert the calendar picker before the chat input
    const chatInput = document.querySelector('.chat-input');
    chatInput.parentNode.insertBefore(calendarPicker, chatInput);
    
    // Add event listener
    calendarPicker.addEventListener('change', (event) => {
      const date = event.target.value;
      
      // Add the date as a user message
      addUserMessage(date);
      
      // Store the message in the conversations table
      storeUserMessage(date);
      
      // Process the date
      processMessage(date);
      
      // Hide the calendar picker
      calendarPicker.style.display = 'none';
    });
    
    // Store the calendar picker reference
    uiElements.calendarPicker = calendarPicker;
  } else {
    // Show the existing calendar picker
    uiElements.calendarPicker.style.display = 'block';
  }
}

/**
 * Show the sex buttons
 */
function showSexButtons() {
  // Create the sex buttons container if it doesn't exist
  if (!uiElements.sexButtons) {
    const sexButtonsContainer = document.createElement('div');
    sexButtonsContainer.id = 'sexButtons';
    sexButtonsContainer.classList.add('sex-buttons');
    
    // Create the buttons
    const maleButton = document.createElement('button');
    maleButton.classList.add('sex-button');
    maleButton.textContent = 'Male';
    maleButton.dataset.value = 'MALE';
    
    const femaleButton = document.createElement('button');
    femaleButton.classList.add('sex-button');
    femaleButton.textContent = 'Female';
    femaleButton.dataset.value = 'FEMALE';
    
    const preferNotToSayButton = document.createElement('button');
    preferNotToSayButton.classList.add('sex-button');
    preferNotToSayButton.textContent = 'Prefer not to say';
    preferNotToSayButton.dataset.value = 'PREFER_NOT_TO_SAY';
    
    // Add the buttons to the container
    sexButtonsContainer.appendChild(maleButton);
    sexButtonsContainer.appendChild(femaleButton);
    sexButtonsContainer.appendChild(preferNotToSayButton);
    
    // Insert the buttons before the chat input
    const chatInput = document.querySelector('.chat-input');
    chatInput.parentNode.insertBefore(sexButtonsContainer, chatInput);
    
    // Add event listeners
    const buttons = sexButtonsContainer.querySelectorAll('.sex-button');
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        handleSexButtonClick(button.dataset.value);
      });
    });
    
    // Store the buttons container reference
    uiElements.sexButtons = sexButtonsContainer;
  } else {
    // Show the existing buttons
    uiElements.sexButtons.style.display = 'flex';
  }
}

/**
 * Hide the sex buttons
 */
function hideSexButtons() {
  if (uiElements.sexButtons) {
    uiElements.sexButtons.style.display = 'none';
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
export { initBasicInfoCollector };
