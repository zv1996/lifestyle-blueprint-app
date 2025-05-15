/**
 * Calorie Calculation Stage Handler for Lifestyle Blueprint
 * 
 * This module handles the calorie calculation stage of the conversation,
 * processing tool calls and storing calorie and macronutrient calculations.
 */

const dbClient = require('../../database/client');

/**
 * Handle a completed run for the calorie calculation stage
 * @param {string} threadId - The thread ID
 * @param {string} runId - The run ID
 * @param {Object} assistantMessage - The assistant message
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 */
async function handleRunCompleted(threadId, runId, assistantMessage, userId, conversationId) {
  try {
    console.log('Calorie calculation stage completed for user:', userId);
    
    // Check if we need to transition to the next stage
    // This could be determined by analyzing the assistant message
    // or by checking if we have all the required calorie calculations
    
    // For now, we'll just log the completion
    console.log('Calorie calculation stage message:', assistantMessage.content[0].text.value);
  } catch (error) {
    console.error('Error handling calorie calculation stage completion:', error);
    throw error;
  }
}

/**
 * Handle a tool call for the calorie calculation stage
 * @param {string} toolName - The name of the tool
 * @param {Object} args - The tool arguments
 * @param {string} userId - The user ID
 * @returns {Object} The tool output
 */
async function handleToolCall(toolName, args, userId) {
  try {
    console.log('Calorie calculation stage tool call:', toolName, args);
    
    if (toolName === 'store_calorie_calculations') {
      // Store the calorie calculations
      const result = await storeCalorieCalculations(userId, args);
      return result;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling calorie calculation stage tool call:', error);
    throw error;
  }
}

/**
 * Store calorie calculations
 * @param {string} userId - The user ID
 * @param {Object} calorieCalculations - The calorie calculations
 * @returns {Object} The result
 */
async function storeCalorieCalculations(userId, calorieCalculations) {
  try {
    // Extract conversation_id if provided
    const { conversationId, ...calculationData } = calorieCalculations;
    
    // Store the calorie calculations in the database
    const result = await dbClient.storeCalorieCalculations(userId, calculationData, conversationId);
    
    // Return a success message
    return {
      success: true,
      message: 'Calorie calculations stored successfully',
      calorieCalculations: {
        weeklyCalorieIntake: result.weekly_calorie_intake,
        fiveTwoSplit: result.five_two_split,
        macronutrientSplit: result.macronutrient_split
      }
    };
  } catch (error) {
    console.error('Error storing calorie calculations:', error);
    return {
      success: false,
      message: `Error storing calorie calculations: ${error.message}`
    };
  }
}

module.exports = {
  handleRunCompleted,
  handleToolCall
};
