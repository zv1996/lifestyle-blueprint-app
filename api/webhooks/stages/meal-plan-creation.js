/**
 * Meal Plan Creation Stage Handler for Lifestyle Blueprint
 * 
 * This module handles the meal plan creation stage of the conversation,
 * processing tool calls and storing the generated meal plan.
 */

const dbClient = require('../../database/client');
const crypto = require('crypto');

/**
 * Handle a completed run for the meal plan creation stage
 * @param {string} threadId - The thread ID
 * @param {string} runId - The run ID
 * @param {Object} assistantMessage - The assistant message
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 */
async function handleRunCompleted(threadId, runId, assistantMessage, userId, conversationId) {
  try {
    console.log('Meal plan creation stage completed for user:', userId);
    
    // Check if we need to transition to the next stage
    // This could be determined by analyzing the assistant message
    // or by checking if we have a complete meal plan
    
    // For now, we'll just log the completion
    console.log('Meal plan creation stage message:', assistantMessage.content[0].text.value);
  } catch (error) {
    console.error('Error handling meal plan creation stage completion:', error);
    throw error;
  }
}

/**
 * Handle a tool call for the meal plan creation stage
 * @param {string} toolName - The name of the tool
 * @param {Object} args - The tool arguments
 * @param {string} userId - The user ID
 * @returns {Object} The tool output
 */
async function handleToolCall(toolName, args, userId) {
  try {
    console.log('Meal plan creation stage tool call:', toolName, args);
    
    if (toolName === 'store_meal_plan') {
      // Store the meal plan
      const result = await storeMealPlan(userId, args);
      return result;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling meal plan creation stage tool call:', error);
    throw error;
  }
}

/**
 * Store a meal plan
 * @param {string} userId - The user ID
 * @param {Object} mealPlan - The meal plan
 * @returns {Object} The result
 */
async function storeMealPlan(userId, mealPlan) {
  try {
    // Extract conversation_id if provided
    const { conversationId, ...mealPlanData } = mealPlan;
    
    // Generate a meal plan ID if not provided
    if (!mealPlanData.mealPlanId) {
      mealPlanData.mealPlanId = crypto.randomUUID();
    }
    
    // Store the meal plan in the database
    const result = await dbClient.storeMealPlan(userId, mealPlanData, conversationId);
    
    // Return a success message
    return {
      success: true,
      message: 'Meal plan stored successfully',
      mealPlanId: result.meal_plan_id,
      status: result.status
    };
  } catch (error) {
    console.error('Error storing meal plan:', error);
    return {
      success: false,
      message: `Error storing meal plan: ${error.message}`
    };
  }
}

module.exports = {
  handleRunCompleted,
  handleToolCall
};
