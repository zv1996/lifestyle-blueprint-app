/**
 * Metrics and Goals Stage Handler for Lifestyle Blueprint
 * 
 * This module handles the metrics and goals stage of the conversation,
 * processing tool calls and storing user metrics and fitness goals.
 */

const dbClient = require('../../database/client');

/**
 * Handle a completed run for the metrics and goals stage
 * @param {string} threadId - The thread ID
 * @param {string} runId - The run ID
 * @param {Object} assistantMessage - The assistant message
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 */
async function handleRunCompleted(threadId, runId, assistantMessage, userId, conversationId) {
  try {
    console.log('Metrics and goals stage completed for user:', userId);
    
    // Check if we need to transition to the next stage
    // This could be determined by analyzing the assistant message
    // or by checking if we have all the required metrics and goals
    
    // For now, we'll just log the completion
    console.log('Metrics and goals stage message:', assistantMessage.content[0].text.value);
  } catch (error) {
    console.error('Error handling metrics and goals stage completion:', error);
    throw error;
  }
}

/**
 * Handle a tool call for the metrics and goals stage
 * @param {string} toolName - The name of the tool
 * @param {Object} args - The tool arguments
 * @param {string} userId - The user ID
 * @returns {Object} The tool output
 */
async function handleToolCall(toolName, args, userId) {
  try {
    console.log('Metrics and goals stage tool call:', toolName, args);
    
    if (toolName === 'store_metrics_and_goals') {
      // Store the metrics and goals
      const result = await storeMetricsAndGoals(userId, args);
      return result;
    } else {
      throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    console.error('Error handling metrics and goals stage tool call:', error);
    throw error;
  }
}

/**
 * Store metrics and goals
 * @param {string} userId - The user ID
 * @param {Object} metricsAndGoals - The metrics and goals
 * @returns {Object} The result
 */
async function storeMetricsAndGoals(userId, metricsAndGoals) {
  try {
    // Extract conversation_id if provided
    const { conversationId, ...metricsData } = metricsAndGoals;
    
    // Store the metrics and goals in the database
    const result = await dbClient.storeUserMetricsAndGoals(userId, metricsData, conversationId);
    
    // Return a success message
    return {
      success: true,
      message: 'Metrics and goals stored successfully',
      metricsAndGoals: {
        heightInches: result.height_inches,
        weightPounds: result.weight_pounds,
        activityLevel: result.activity_level,
        healthFitnessGoal: result.health_fitness_goal
      }
    };
  } catch (error) {
    console.error('Error storing metrics and goals:', error);
    return {
      success: false,
      message: `Error storing metrics and goals: ${error.message}`
    };
  }
}

module.exports = {
  handleRunCompleted,
  handleToolCall
};
