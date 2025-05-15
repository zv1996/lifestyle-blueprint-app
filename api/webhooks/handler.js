/**
 * Webhook Handler for Lifestyle Blueprint
 * 
 * This module handles incoming webhooks from OpenAI,
 * routing them to the appropriate stage handler.
 */

const openaiClient = require('../openai/client');
const dbClient = require('../database/client');
const crypto = require('crypto');

// Import stage handlers
const basicInfoHandler = require('./stages/basic-info');
const metricsGoalsHandler = require('./stages/metrics-goals');
const dietPreferencesHandler = require('./stages/diet-preferences');
const calorieCalculationHandler = require('./stages/calorie-calculation');
const mealPlanCreationHandler = require('./stages/meal-plan-creation');
const shoppingListHandler = require('./stages/shopping-list');
const finalizationHandler = require('./stages/finalization');

// Map of stage names to handlers
const stageHandlers = {
  BASIC_INFO: basicInfoHandler,
  METRICS_GOALS: metricsGoalsHandler,
  DIET_PREFERENCES: dietPreferencesHandler,
  CALORIE_CALCULATION: calorieCalculationHandler,
  MEAL_PLAN_CREATION: mealPlanCreationHandler,
  SHOPPING_LIST: shoppingListHandler,
  FINALIZATION: finalizationHandler
};

/**
 * Handle a webhook request
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 */
async function handleWebhook(req, res) {
  try {
    // Verify the webhook signature
    const signature = req.headers['x-openai-signature'];
    const timestamp = req.headers['x-openai-timestamp'];
    const body = req.body;
    
    if (!verifyWebhookSignature(signature, timestamp, body)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Extract webhook data
    const { type, data } = body;
    
    // Handle different webhook types
    if (type === 'thread.run.created') {
      // A new run was created, nothing to do yet
      return res.status(200).json({ status: 'acknowledged' });
    } else if (type === 'thread.run.queued') {
      // Run is queued, nothing to do yet
      return res.status(200).json({ status: 'acknowledged' });
    } else if (type === 'thread.run.in_progress') {
      // Run is in progress, nothing to do yet
      return res.status(200).json({ status: 'acknowledged' });
    } else if (type === 'thread.run.completed') {
      // Run completed, process the results
      await handleRunCompleted(data);
      return res.status(200).json({ status: 'processed' });
    } else if (type === 'thread.run.requires_action') {
      // Run requires action (function calling)
      await handleRunRequiresAction(data);
      return res.status(200).json({ status: 'processed' });
    } else if (type === 'thread.run.failed') {
      // Run failed, log the error
      console.error('Run failed:', data);
      return res.status(200).json({ status: 'acknowledged' });
    } else if (type === 'thread.run.cancelled') {
      // Run was cancelled, nothing to do
      return res.status(200).json({ status: 'acknowledged' });
    } else if (type === 'thread.run.expired') {
      // Run expired, log the error
      console.error('Run expired:', data);
      return res.status(200).json({ status: 'acknowledged' });
    } else {
      // Unknown webhook type
      console.warn('Unknown webhook type:', type);
      return res.status(200).json({ status: 'acknowledged' });
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Verify the webhook signature
 * @param {string} signature - The signature from the webhook
 * @param {string} timestamp - The timestamp from the webhook
 * @param {Object} body - The webhook body
 * @returns {boolean} Whether the signature is valid
 */
function verifyWebhookSignature(signature, timestamp, body) {
  // In a production environment, you would verify the signature
  // using the webhook secret provided by OpenAI
  
  // For development, we'll skip verification
  return true;
}

/**
 * Handle a completed run
 * @param {Object} data - The run data
 */
async function handleRunCompleted(data) {
  try {
    const { thread_id: threadId, id: runId, metadata } = data;
    
    // Get the stage from the metadata
    const stage = metadata?.stage;
    
    if (!stage) {
      console.warn('No stage found in run metadata:', metadata);
      return;
    }
    
    // Get the messages from the thread
    const messages = await openaiClient.getMessages(threadId, { limit: 10 });
    
    // Get the latest assistant message
    const assistantMessage = messages.find(msg => msg.role === 'assistant');
    
    if (!assistantMessage) {
      console.warn('No assistant message found in thread:', threadId);
      return;
    }
    
    // Get the user ID from the metadata
    const userId = metadata?.userId;
    
    if (!userId) {
      console.warn('No user ID found in run metadata:', metadata);
      return;
    }
    
    // Use the threadId as the conversationId
    const conversationId = threadId;
    
    // Store the conversation message
    await dbClient.storeConversationMessage(
      userId,
      conversationId,
      assistantMessage.content[0].text.value
    );
    
    // Get the appropriate stage handler
    const handler = stageHandlers[stage];
    
    if (!handler) {
      console.warn('No handler found for stage:', stage);
      return;
    }
    
    // Call the stage handler with the conversationId
    await handler.handleRunCompleted(threadId, runId, assistantMessage, userId, conversationId);
  } catch (error) {
    console.error('Error handling run completed:', error);
    throw error;
  }
}

/**
 * Handle a run that requires action
 * @param {Object} data - The run data
 */
async function handleRunRequiresAction(data) {
  try {
    const { thread_id: threadId, id: runId, required_action, metadata } = data;
    
    // Get the stage from the metadata
    const stage = metadata?.stage;
    
    if (!stage) {
      console.warn('No stage found in run metadata:', metadata);
      return;
    }
    
    // Get the user ID from the metadata
    const userId = metadata?.userId;
    
    if (!userId) {
      console.warn('No user ID found in run metadata:', metadata);
      return;
    }
    
    // Use the threadId as the conversationId
    const conversationId = threadId;
    
    // Get the tool calls from the required action
    const toolCalls = required_action.submit_tool_outputs.tool_calls;
    
    // Get the appropriate stage handler
    const handler = stageHandlers[stage];
    
    if (!handler) {
      console.warn('No handler found for stage:', stage);
      return;
    }
    
    // Process each tool call
    const toolOutputs = [];
    
    for (const toolCall of toolCalls) {
      const { id, function: func } = toolCall;
      const { name, arguments: args } = func;
      
      // Parse the arguments
      const parsedArgs = JSON.parse(args);
      
      // Add the conversationId to the arguments
      parsedArgs.conversationId = conversationId;
      
      // Call the stage handler to process the tool call
      const output = await handler.handleToolCall(name, parsedArgs, userId);
      
      // Add the tool output
      toolOutputs.push({
        tool_call_id: id,
        output: JSON.stringify(output)
      });
    }
    
    // Submit the tool outputs
    await openaiClient.submitToolOutputs(threadId, runId, toolOutputs);
  } catch (error) {
    console.error('Error handling run requires action:', error);
    throw error;
  }
}

module.exports = {
  handleWebhook
};
