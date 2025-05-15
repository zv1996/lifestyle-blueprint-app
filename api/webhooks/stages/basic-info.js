/**
 * Basic Info Stage Handler for Lifestyle Blueprint
 * 
 * This module handles the basic user information stage of the conversation,
 * processing tool calls and storing user data.
 */

const dbClient = require('../../database/client');

/**
 * Handle a completed run for the basic info stage
 * @param {string} threadId - The thread ID
 * @param {string} runId - The run ID
 * @param {Object} assistantMessage - The assistant message
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 */
async function handleRunCompleted(threadId, runId, assistantMessage, userId, conversationId) {
  try {
    console.log('Basic info stage completed for user:', userId);
    
    // Check if we need to transition to the next stage
    // This could be determined by analyzing the assistant message
    // or by checking if we have all the required user information
    
    // For now, we'll just log the completion
    console.log('Basic info stage message:', assistantMessage.content[0].text.value);
  } catch (error) {
    console.error('Error handling basic info stage completion:', error);
    throw error;
  }
}

/**
 * Handle a tool call for the basic info stage
 * @param {string} toolName - The name of the tool
 * @param {Object} args - The tool arguments
 * @param {string} userId - The user ID
 * @returns {Object} The tool output
 */
async function handleToolCall(toolName, args, userId) {
  try {
    console.log('Basic info stage tool call:', toolName, args);
    
    if (toolName === 'store_user_info') {
      // Store the user information
      const result = await storeUserInfo(userId, args);
      return result;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling basic info stage tool call:', error);
    throw error;
  }
}

/**
 * Store user information
 * @param {string} userId - The user ID
 * @param {Object} userInfo - The user information
 * @returns {Object} The result
 */
async function storeUserInfo(userId, userInfo) {
  try {
    // Extract conversation_id if provided
    const { conversationId, ...userData } = userInfo;
    
    // Store the user information in the database
    const result = await dbClient.storeUserInfo(userId, userData, conversationId);
    
    // Return a success message
    return {
      success: true,
      message: 'User information stored successfully',
      user: {
        firstName: result.first_name,
        lastName: result.last_name,
        phoneNumber: result.phone_number,
        birthDate: result.birth_date,
        biologicalSex: result.biological_sex
      }
    };
  } catch (error) {
    console.error('Error storing user information:', error);
    return {
      success: false,
      message: `Error storing user information: ${error.message}`
    };
  }
}

module.exports = {
  handleRunCompleted,
  handleToolCall
};
