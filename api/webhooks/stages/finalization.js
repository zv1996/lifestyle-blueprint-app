/**
 * Finalization Stage Handler for Lifestyle Blueprint
 * 
 * This module handles the finalization stage of the conversation,
 * processing tool calls and finalizing the meal plan.
 */

const dbClient = require('../../database/client');

/**
 * Handle a completed run for the finalization stage
 * @param {string} threadId - The thread ID
 * @param {string} runId - The run ID
 * @param {Object} assistantMessage - The assistant message
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 */
async function handleRunCompleted(threadId, runId, assistantMessage, userId, conversationId) {
  try {
    console.log('Finalization stage completed for user:', userId);
    
    // This is the final stage, so we don't need to transition to another stage
    // We'll just log the completion
    console.log('Finalization stage message:', assistantMessage.content[0].text.value);
  } catch (error) {
    console.error('Error handling finalization stage completion:', error);
    throw error;
  }
}

/**
 * Handle a tool call for the finalization stage
 * @param {string} toolName - The name of the tool
 * @param {Object} args - The tool arguments
 * @param {string} userId - The user ID
 * @returns {Object} The tool output
 */
async function handleToolCall(toolName, args, userId) {
  try {
    console.log('Finalization stage tool call:', toolName, args);
    
    if (toolName === 'finalize_meal_plan') {
      // Extract conversation_id if provided
      const { conversationId, mealPlanId } = args;
      
      // Finalize the meal plan
      const result = await finalizeMealPlan(mealPlanId);
      return result;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling finalization stage tool call:', error);
    throw error;
  }
}

/**
 * Finalize a meal plan
 * @param {string} mealPlanId - The meal plan ID
 * @returns {Object} The result
 */
async function finalizeMealPlan(mealPlanId) {
  try {
    // Finalize the meal plan in the database
    const result = await dbClient.finalizeMealPlan(mealPlanId);
    
    // Return a success message
    return {
      success: true,
      message: 'Meal plan finalized successfully',
      mealPlanId: result.meal_plan_id,
      status: result.status
    };
  } catch (error) {
    console.error('Error finalizing meal plan:', error);
    return {
      success: false,
      message: `Error finalizing meal plan: ${error.message}`
    };
  }
}

module.exports = {
  handleRunCompleted,
  handleToolCall
};
