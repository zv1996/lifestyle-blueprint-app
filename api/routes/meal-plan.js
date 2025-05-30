/**
 * Meal Plan Routes for Lifestyle Blueprint
 * 
 * This module handles the API routes for meal plan operations
 * including cloning, retrieving, and managing meal plans.
 */

const express = require('express');
const router = express.Router();
const dbClient = require('../database/client');

/**
 * Get a meal plan by ID
 * GET /api/meal-plan/:mealPlanId
 */
router.get('/:mealPlanId', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    
    // Validate required fields
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Meal plan ID is required' });
    }
    
    // Get the meal plan from the database
    const mealPlan = await dbClient.getMealPlanById(mealPlanId);
    
    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    // Return the meal plan
    res.json(mealPlan);
  } catch (error) {
    console.error('Error getting meal plan:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get meal plans for a user
 * GET /api/meal-plans/user/:userId
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Get the meal plans from the database
    const mealPlans = await dbClient.getMealPlansByUserId(userId);
    
    // Return the meal plans
    res.json(mealPlans);
  } catch (error) {
    console.error('Error getting meal plans for user:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Clone a meal plan
 * POST /api/meal-plan/clone/:mealPlanId
 */
router.post('/clone/:mealPlanId', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    const { userId } = req.body;
    
    // Validate required fields
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Meal plan ID is required' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    console.log(`Cloning meal plan ${mealPlanId} for user ${userId}`);
    
    // Clone the meal plan and its grocery list
    const clonedMealPlan = await dbClient.cloneMealPlan(mealPlanId, userId);
    
    console.log('Successfully cloned meal plan:', clonedMealPlan);
    
    // Return the cloned meal plan
    res.json({
      success: true,
      message: 'Meal plan cloned successfully',
      mealPlan: clonedMealPlan
    });
  } catch (error) {
    console.error('Error cloning meal plan:', error);
    
    // Handle specific error cases
    if (error.message === 'Original meal plan not found') {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    if (error.message === 'User does not have permission to clone this meal plan') {
      return res.status(403).json({ error: 'Permission denied: You can only clone your own meal plans' });
    }
    
    // Generic error response
    res.status(500).json({ 
      error: 'Failed to clone meal plan', 
      details: error.message 
    });
  }
});

/**
 * Update favorite status for a meal plan
 * PUT /api/meal-plan/:mealPlanId/favorite
 */
router.put('/:mealPlanId/favorite', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    const { userId, isFavorite } = req.body;
    
    // Validate required fields
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Meal plan ID is required' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (typeof isFavorite !== 'boolean') {
      return res.status(400).json({ error: 'isFavorite must be a boolean' });
    }
    
    // Get the meal plan to verify ownership
    const mealPlan = await dbClient.getMealPlanById(mealPlanId);
    
    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    // Verify the user owns the meal plan
    if (mealPlan.user_id !== userId) {
      return res.status(403).json({ error: 'Permission denied: You can only modify your own meal plans' });
    }
    
    // Update the favorite status
    const { data, error } = await dbClient.supabase
      .from('meal_plans')
      .update({ is_favorite: isFavorite })
      .eq('meal_plan_id', mealPlanId)
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    // Return the updated meal plan
    res.json({
      success: true,
      message: 'Favorite status updated successfully',
      mealPlan: data
    });
  } catch (error) {
    console.error('Error updating favorite status:', error);
    res.status(500).json({ 
      error: 'Failed to update favorite status', 
      details: error.message 
    });
  }
});

/**
 * Create a share link for a meal plan
 * POST /api/meal-plan/:mealPlanId/share
 */
router.post('/:mealPlanId/share', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    const { userId } = req.body;
    
    // Validate required fields
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Meal plan ID is required' });
    }
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    console.log(`Creating share link for meal plan ${mealPlanId} for user ${userId}`);
    
    // Create the share link
    const shareData = await dbClient.createMealPlanShare(mealPlanId, userId);
    
    console.log('Successfully created share link:', shareData);
    
    // Return the share data
    res.json({
      success: true,
      message: 'Share link created successfully',
      shareToken: shareData.shareToken,
      shareUrl: shareData.shareUrl,
      expiresAt: shareData.expiresAt
    });
  } catch (error) {
    console.error('Error creating share link:', error);
    
    // Handle specific error cases
    if (error.message === 'Meal plan not found') {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    if (error.message === 'User does not have permission to share this meal plan') {
      return res.status(403).json({ error: 'Permission denied: You can only share your own meal plans' });
    }
    
    // Generic error response
    res.status(500).json({ 
      error: 'Failed to create share link', 
      details: error.message 
    });
  }
});

module.exports = router;
