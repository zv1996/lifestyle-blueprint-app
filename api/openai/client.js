/**
 * OpenAI API Client for Lifestyle Blueprint
 * 
 * This module handles communication with the OpenAI API for chat completions.
 */

require('dotenv').config();
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Create a chat completion
 * @param {Array} messages - The messages to send to the API
 * @param {Object} options - Additional options for the completion
 * @returns {Promise<Object>} The completion response
 */
async function createChatCompletion(messages, options = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model: options.model || 'gpt-4',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
      ...options
    });
    
    return completion;
  } catch (error) {
    console.error('Error creating chat completion:', error);
    throw error;
  }
}

/**
 * Store a conversation message
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 * @param {string} message - The message to store
 * @param {string} role - The role of the message sender (user/assistant)
 * @returns {Promise<Object>} The stored message
 */
async function storeConversationMessage(userId, conversationId, message, role = 'user') {
  try {
    const dbClient = require('../database/client');
    
    // Store the message in the database
    const result = await dbClient.storeConversationMessage(
      userId,
      conversationId,
      message
    );
    
    return result;
  } catch (error) {
    console.error('Error storing conversation message:', error);
    throw error;
  }
}

module.exports = {
  createChatCompletion,
  storeConversationMessage
};
