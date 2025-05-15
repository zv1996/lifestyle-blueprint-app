/**
 * Diet and Meal Preferences Stage Handler for Lifestyle Blueprint
 * 
 * This module handles the diet and meal preferences stage of the conversation,
 * processing tool calls and storing user dietary preferences.
 */

const dbClient = require('../../database/client');

/**
 * Handle a completed run for the diet preferences stage
 * @param {string} threadId - The thread ID
 * @param {string} runId - The run ID
 * @param {Object} assistantMessage - The assistant message
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 */
async function handleRunCompleted(threadId, runId, assistantMessage, userId, conversationId) {
  try {
    console.log('Diet preferences stage completed for user:', userId);
    
    // Check if we need to transition to the next stage
    // This could be determined by analyzing the assistant message
    // or by checking if we have all the required diet preferences
    
    // For now, we'll just log the completion
    console.log('Diet preferences stage message:', assistantMessage.content[0].text.value);
  } catch (error) {
    console.error('Error handling diet preferences stage completion:', error);
    throw error;
  }
}

/**
 * Handle a tool call for the diet preferences stage
 * @param {string} toolName - The name of the tool
 * @param {Object} args - The tool arguments
 * @param {string} userId - The user ID
 * @returns {Object} The tool output
 */
async function handleToolCall(toolName, args, userId) {
  try {
    console.log('Diet preferences stage tool call:', toolName, args);
    
    if (toolName === 'store_diet_preferences') {
      // Store the diet preferences
      const result = await storeDietPreferences(userId, args);
      return result;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling diet preferences stage tool call:', error);
    throw error;
  }
}

/**
 * Store diet preferences
 * @param {string} userId - The user ID
 * @param {Object} dietPreferences - The diet preferences
 * @returns {Object} The result
 */
async function storeDietPreferences(userId, dietPreferences) {
  try {
    // Extract conversation_id if provided
    const { conversationId, ...prefData } = dietPreferences;
    
    // Map client-side field names to database column names
    const dbDietPreferences = {
      dietary_restrictions: prefData.dietaryRestrictions,
      dietary_preferences: prefData.dietaryPreferences,
      meal_portion_people_count: prefData.mealPortionPeopleCount,
      meal_portion_details: prefData.mealPortionDetails,
      include_snacks: prefData.includeSnacks,
      snack_1: prefData.snack1,
      snack_2: prefData.snack2,
      include_favorite_meals: prefData.includeFavoriteMeals,
      favorite_meal_1: prefData.favoriteMeal1,
      favorite_meal_2: prefData.favoriteMeal2
    };
    
    // Store the diet preferences in the database
    const result = await dbClient.storeUserDietAndMealPreferences(userId, dbDietPreferences, conversationId);
    
    // Return a success message
    return {
      success: true,
      message: 'Diet preferences stored successfully',
      dietPreferences: {
        dietaryRestrictions: result.dietary_restrictions,
        dietaryPreferences: result.dietary_preferences,
        mealPortionPeopleCount: result.meal_portion_people_count,
        mealPortionDetails: result.meal_portion_details,
        includeSnacks: result.include_snacks,
        snack1: result.snack_1,
        snack2: result.snack_2,
        includeFavoriteMeals: result.include_favorite_meals,
        favoriteMeal1: result.favorite_meal_1,
        favoriteMeal2: result.favorite_meal_2
      }
    };
  } catch (error) {
    console.error('Error storing diet preferences:', error);
    return {
      success: false,
      message: `Error storing diet preferences: ${error.message}`
    };
  }
}

module.exports = {
  handleRunCompleted,
  handleToolCall
};
