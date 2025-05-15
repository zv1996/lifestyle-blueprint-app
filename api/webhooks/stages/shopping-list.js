/**
 * Shopping List Stage Handler for Lifestyle Blueprint
 * 
 * This module handles the shopping list stage of the conversation,
 * processing tool calls and storing the generated grocery list.
 */

const dbClient = require('../../database/client');

/**
 * Handle a completed run for the shopping list stage
 * @param {string} threadId - The thread ID
 * @param {string} runId - The run ID
 * @param {Object} assistantMessage - The assistant message
 * @param {string} userId - The user ID
 */
async function handleRunCompleted(threadId, runId, assistantMessage, userId) {
  try {
    console.log('Shopping list stage completed for user:', userId);
    
    // Check if we need to transition to the next stage
    // This could be determined by analyzing the assistant message
    // or by checking if we have a complete shopping list
    
    // For now, we'll just log the completion
    console.log('Shopping list stage message:', assistantMessage.content[0].text.value);
  } catch (error) {
    console.error('Error handling shopping list stage completion:', error);
    throw error;
  }
}

/**
 * Handle a tool call for the shopping list stage
 * @param {string} toolName - The name of the tool
 * @param {Object} args - The tool arguments
 * @param {string} userId - The user ID
 * @returns {Object} The tool output
 */
async function handleToolCall(toolName, args, userId) {
  try {
    console.log('Shopping list stage tool call:', toolName, args);
    
    if (toolName === 'store_grocery_list') {
      // Store the grocery list
      const result = await storeGroceryList(userId, args);
      return result;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling shopping list stage tool call:', error);
    throw error;
  }
}

/**
 * Store a grocery list
 * @param {string} userId - The user ID
 * @param {Object} groceryList - The grocery list
 * @returns {Object} The result
 */
async function storeGroceryList(userId, groceryList) {
  try {
    // Extract conversation_id if provided
    const { conversationId, ...groceryData } = groceryList;
    
    // Store the grocery list in the database
    const result = await dbClient.storeGroceryList(
      userId,
      groceryData.mealPlanId,
      groceryData.groceries,
      conversationId
    );
    
    // Return a success message
    return {
      success: true,
      message: 'Grocery list stored successfully',
      count: result.length,
      mealPlanId: groceryList.mealPlanId
    };
  } catch (error) {
    console.error('Error storing grocery list:', error);
    return {
      success: false,
      message: `Error storing grocery list: ${error.message}`
    };
  }
}

module.exports = {
  handleRunCompleted,
  handleToolCall
};
