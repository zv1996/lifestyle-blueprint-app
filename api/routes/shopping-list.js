/**
 * Shopping List Routes for Lifestyle Blueprint
 * 
 * This module handles the API routes for shopping list generation and management.
 */

const express = require('express');
const router = express.Router();
const dbClient = require('../database/client');
const shoppingListGenerator = require('../openai/shopping-list');

/**
 * Create a shopping list
 * POST /api/shopping-list/create
 */
router.post('/create', async (req, res) => {
  try {
    const { userId, conversationId, mealPlanId, brandPreferences = [] } = req.body;
    
    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Meal plan ID is required' });
    }
    
    // Check if a shopping list already exists for this meal plan
    const existingList = await dbClient.getGroceryListByMealPlanId(mealPlanId);
    
    if (existingList && existingList.length > 0) {
      console.log(`Shopping list already exists for meal plan ${mealPlanId}, returning existing list`);
      
      return res.json({
        meal_plan_id: mealPlanId,
        conversation_id: conversationId,
        items: existingList
      });
    }
    
    // Generate the shopping list
    const shoppingList = await shoppingListGenerator.generateShoppingList(
      userId,
      mealPlanId,
      conversationId,
      brandPreferences
    );
    
    // Return the shopping list
    res.json(shoppingList);
  } catch (error) {
    console.error('Error creating shopping list:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Save a shopping list
 * POST /api/shopping-list/save
 */
router.post('/save', async (req, res) => {
  try {
    const { userId, conversationId, mealPlanId, shoppingList } = req.body;
    
    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Meal plan ID is required' });
    }
    
    if (!shoppingList || !shoppingList.items || !Array.isArray(shoppingList.items)) {
      return res.status(400).json({ error: 'Valid shopping list is required' });
    }
    
    // Update the shopping list items in the database
    const updatedItems = await dbClient.updateGroceryList(
      userId,
      mealPlanId,
      shoppingList.items
    );
    
    // Return the updated shopping list
    res.json({
      meal_plan_id: mealPlanId,
      conversation_id: conversationId,
      items: updatedItems
    });
  } catch (error) {
    console.error('Error saving shopping list:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a shopping list by meal plan ID
 * GET /api/shopping-list/by-meal-plan/:mealPlanId
 */
router.get('/by-meal-plan/:mealPlanId', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    
    // Validate required fields
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Meal plan ID is required' });
    }
    
    // Get the shopping list from the database
    const items = await dbClient.getGroceryListByMealPlanId(mealPlanId);
    
    // Return the shopping list
    res.json({
      meal_plan_id: mealPlanId,
      items
    });
  } catch (error) {
    console.error('Error getting shopping list:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a shopping list by conversation ID
 * GET /api/shopping-list/by-conversation/:conversationId
 */
router.get('/by-conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Validate required fields
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }
    
    // Get the shopping list from the database
    const items = await dbClient.getGroceryListByConversationId(conversationId);
    
    // Return the shopping list
    res.json({
      conversation_id: conversationId,
      items
    });
  } catch (error) {
    console.error('Error getting shopping list:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
