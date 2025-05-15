/**
 * Express Server for Lifestyle Blueprint
 * 
 * This module sets up an Express server to handle webhook requests
 * from OpenAI and provide API endpoints for the frontend.
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const webhookHandler = require('./webhooks/handler');
const openaiClient = require('./openai/client');
const dbClient = require('./database/client');

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  // Allow requests from any origin in development
  // In production, you should specify your PHP hosted domain
  origin: function(origin, callback) {
    // In development, allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Allow requests from localhost in development
    if (origin.match(/^https?:\/\/localhost(:[0-9]+)?$/)) {
      return callback(null, true);
    }
    
    // Add your production domain here
    const allowedDomains = [
      // Example: 'https://your-php-domain.com'
      // Add your actual domain when deploying
    ];
    
    if (allowedDomains.length === 0 || allowedDomains.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('.'));

// Webhook endpoint for OpenAI
app.post('/api/webhook', async (req, res) => {
  try {
    await webhookHandler.handleWebhook(req, res);
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to store user info
app.post('/api/user/info', async (req, res) => {
  try {
    const { userId, firstName, lastName, phoneNumber, birthDate, biologicalSex, conversationId } = req.body;
    
    if (!userId || !firstName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Store the user info
    const result = await dbClient.storeUserInfo(userId, {
      firstName,
      lastName,
      phoneNumber,
      birthDate,
      biologicalSex
    }, conversationId);
    
    console.log('User info stored:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error storing user info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to store user metrics and goals
app.post('/api/user/metrics-goals', async (req, res) => {
  try {
    const { userId, heightInches, weightPounds, activityLevel, healthFitnessGoal, conversationId } = req.body;
    
    if (!userId || !heightInches || !weightPounds || !activityLevel || !healthFitnessGoal) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Store the metrics and goals
    const result = await dbClient.storeUserMetricsAndGoals(userId, {
      heightInches,
      weightPounds,
      activityLevel,
      healthFitnessGoal
    }, conversationId);
    
    console.log('User metrics and goals stored:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error storing user metrics and goals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to store user diet and meal preferences
app.post('/api/user/diet-preferences', async (req, res) => {
  try {
    const { 
      userId, 
      dietaryRestrictions, 
      dietaryPreferences, 
      mealPortionPeopleCount,
      mealPortionDetails,
      includeSnacks,
      snack1,
      snack2,
      includeFavoriteMeals,
      favoriteMeal1,
      favoriteMeal2,
      conversationId
    } = req.body;
    
    if (!userId || !dietaryRestrictions || !dietaryPreferences || !mealPortionPeopleCount) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Store the diet preferences
    const result = await dbClient.storeUserDietAndMealPreferences(userId, {
      dietary_restrictions: dietaryRestrictions,
      dietary_preferences: dietaryPreferences,
      meal_portion_people_count: mealPortionPeopleCount,
      meal_portion_details: mealPortionDetails || '',
      include_snacks: includeSnacks || false,
      snack_1: snack1 || '',
      snack_2: snack2 || '',
      include_favorite_meals: includeFavoriteMeals || false,
      favorite_meal_1: favoriteMeal1 || '',
      favorite_meal_2: favoriteMeal2 || ''
    }, conversationId);
    
    console.log('User diet and meal preferences stored:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error storing user diet and meal preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get meal plans for a user
app.get('/api/user/:userId/meal-plans', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    // Get meal plans for the user
    const mealPlans = await dbClient.getMealPlansByUserId(userId);
    
    res.json(mealPlans);
  } catch (error) {
    console.error('Error getting meal plans:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get a specific meal plan
app.get('/api/meal-plan/:mealPlanId', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Missing meal plan ID' });
    }
    
    // Get the meal plan
    const mealPlan = await dbClient.getMealPlanById(mealPlanId);
    
    if (!mealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    res.json(mealPlan);
  } catch (error) {
    console.error('Error getting meal plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get a meal plan by conversation ID
app.get('/api/meal-plan/by-conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Missing conversation ID' });
    }
    
    // Get meal plans for the user
    const mealPlans = await dbClient.getMealPlansByUserId(null, conversationId);
    
    // Return the most recent meal plan for this conversation
    if (mealPlans && mealPlans.length > 0) {
      res.json(mealPlans[0]);
    } else {
      res.status(404).json({ error: 'No meal plan found for this conversation' });
    }
  } catch (error) {
    console.error('Error getting meal plan by conversation ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get groceries for a meal plan
app.get('/api/meal-plan/:mealPlanId/groceries', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Missing meal plan ID' });
    }
    
    // Get groceries for the meal plan
    const groceries = await dbClient.getGroceriesByMealPlanId(mealPlanId);
    
    res.json(groceries);
  } catch (error) {
    console.error('Error getting groceries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to store a conversation message
app.post('/api/conversation/message', async (req, res) => {
  try {
    const { userId, conversationId, message } = req.body;
    
    if (!userId || !conversationId || !message) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Store the conversation message
    const result = await dbClient.storeConversationMessage(
      userId,
      conversationId,
      message
    );
    
    console.log('Conversation message stored:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error storing conversation message:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to store calorie calculations
app.post('/api/user/calorie-calculations', async (req, res) => {
  try {
    const { userId, weeklyCalorieIntake, fiveTwoSplit, macronutrientSplit, conversationId } = req.body;
    
    if (!userId || !weeklyCalorieIntake) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log('Received calorie calculation data:', {
      userId,
      weeklyCalorieIntake,
      fiveTwoSplit,
      macronutrientSplit,
      conversationId
    });
    
    // Store the calorie calculations
    const result = await dbClient.storeCalorieCalculations(userId, {
      weeklyCalorieIntake,
      fiveTwoSplit,
      macronutrientSplit
    }, conversationId);
    
    console.log('Calorie calculations stored:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error storing calorie calculations:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// API endpoint to get calorie calculations for a user
app.get('/api/user/:userId/calorie-calculations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { conversationId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    // Get calorie calculations for the user
    const calculations = await dbClient.getCalorieCalculations(userId, conversationId);
    
    res.json(calculations);
  } catch (error) {
    console.error('Error getting calorie calculations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to create a meal plan
app.post('/api/meal-plan/create', async (req, res) => {
  try {
    const { userId, conversationId } = req.body;
    
    if (!userId || !conversationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log('Creating meal plan for user:', userId, 'conversation:', conversationId);
    
    // Get all user data needed for meal plan creation
    const userData = await dbClient.getAllUserData(userId, conversationId);
    
    if (!userData || !userData.calorieCalculations) {
      return res.status(400).json({ error: 'Missing required user data or calorie calculations' });
    }
    
    // Create the meal plan using OpenAI
    const openaiClient = require('./openai/meal-plan');
    const mealPlanData = await openaiClient.generateMealPlan(userData);
    
    // Store the meal plan in the database
    const mealPlan = await dbClient.storeMealPlan(userId, {
      ...mealPlanData,
      status: 'draft',
      is_initial_plan: true
    }, conversationId);
    
    res.json(mealPlan);
  } catch (error) {
    console.error('Error creating meal plan:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// API endpoint to update a meal plan
app.put('/api/meal-plan/:mealPlanId', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    const { userId, conversationId, changes } = req.body;
    
    if (!mealPlanId || !userId || !changes) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get the existing meal plan
    const existingMealPlan = await dbClient.getMealPlanById(mealPlanId);
    
    if (!existingMealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    // Get all user data needed for meal plan revision
    const userData = await dbClient.getAllUserData(userId, conversationId);
    
    // Update the meal plan using OpenAI
    const openaiClient = require('./openai/meal-plan');
    const updatedMealPlanData = await openaiClient.reviseMealPlan(existingMealPlan, changes, userData);
    
    // Store the updated meal plan
    const updatedMealPlan = await dbClient.storeMealPlan(userId, {
      ...updatedMealPlanData,
      meal_plan_id: mealPlanId,
      status: 'draft'
    }, conversationId);
    
    res.json(updatedMealPlan);
  } catch (error) {
    console.error('Error updating meal plan:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// API endpoint to approve a meal plan
app.put('/api/meal-plan/:mealPlanId/approve', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    
    if (!mealPlanId) {
      return res.status(400).json({ error: 'Missing meal plan ID' });
    }
    
    // Finalize the meal plan
    const mealPlan = await dbClient.finalizeMealPlan(mealPlanId);
    
    res.json(mealPlan);
  } catch (error) {
    console.error('Error approving meal plan:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint for testing connectivity
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// API endpoint to get all user data
app.get('/api/user/:userId/data', async (req, res) => {
  try {
    const { userId } = req.params;
    const { conversationId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    // Get all user data, passing the conversationId if provided
    const userData = await dbClient.getAllUserData(userId, conversationId);
    
    res.json(userData);
  } catch (error) {
    console.error('Error getting user data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
