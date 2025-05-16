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
const server = require('http').createServer(app);

// Set up Socket.IO for real-time progress updates
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io available globally for other modules
global.io = io;

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware
app.use(cors({
  // Allow requests from any origin in development
  // In production, you should specify your PHP hosted domain
  origin: function(origin, callback) {
    // Log the origin for debugging
    console.log('Request origin:', origin);
    
    // In development, allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      console.log('Allowing request with no origin');
      return callback(null, true);
    }
    
    // Allow requests from localhost in development
    if (origin.match(/^https?:\/\/localhost(:[0-9]+)?$/)) {
      console.log('Allowing localhost request');
      return callback(null, true);
    }
    
    // Allow requests from file:// protocol during development
    if (origin.match(/^file:\/\//)) {
      console.log('Allowing file:// protocol request');
      return callback(null, true);
    }
    
    // Add your production domain here
    const allowedDomains = [
      'https://phpstack-718927-5513557.cloudwaysapps.com',
      'https://lifestyle-blueprint-app.onrender.com'
    ];
    
    console.log('Checking against allowed domains:', allowedDomains);
    
    if (allowedDomains.length === 0 || allowedDomains.indexOf(origin) !== -1) {
      console.log('Origin is in allowed domains list');
      callback(null, true);
    } else {
      console.log('Origin is NOT in allowed domains list');
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
    const { userId, conversationId, useNewApproach, retryCount } = req.body;
    
    if (!userId || !conversationId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    console.log('Creating meal plan for user:', userId, 'conversation:', conversationId, 
      useNewApproach ? '(using day-by-day approach)' : '');
    
    // Get all user data needed for meal plan creation
    const userData = await dbClient.getAllUserData(userId, conversationId);
    
    if (!userData || !userData.calorieCalculations) {
      return res.status(400).json({ error: 'Missing required user data or calorie calculations' });
    }
    
    // Create the meal plan using OpenAI
    const openaiClient = require('./openai/meal-plan');
    
    // Generate the meal plan - the generateMealPlan function now supports day-by-day generation
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
    
    // Check if a meal plan was created despite the error
    // This can happen if the error occurred after meal plan creation
    try {
      const { userId, conversationId } = req.body;
      if (conversationId) {
        const existingMealPlans = await dbClient.getMealPlansByUserId(userId, conversationId);
        
        if (existingMealPlans && existingMealPlans.length > 0) {
          console.log('Found meal plan that was created despite errors:', existingMealPlans[0].meal_plan_id);
          return res.json(existingMealPlans[0]);
        }
      }
    } catch (checkError) {
      console.warn('Error checking for created meal plan:', checkError);
    }
    
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

// Database connection test endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    console.log('Testing database connection...');
    console.log('Supabase URL:', process.env.SUPABASE_URL ? 'URL is set' : 'URL is missing');
    console.log('Supabase Key:', process.env.SUPABASE_SERVICE_KEY ? 'Key is set' : 'Key is missing');
    
    // Try to query the users table
    const { data, error } = await dbClient.supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error connecting to database:', error);
      return res.status(500).json({ 
        error: 'Database connection error', 
        details: error.message,
        supabaseUrl: process.env.SUPABASE_URL ? 'URL is set' : 'URL is missing',
        supabaseKey: process.env.SUPABASE_SERVICE_KEY ? 'Key is set' : 'Key is missing'
      });
    }
    
    // Return success response
    res.status(200).json({
      status: 'Database connection successful',
      timestamp: new Date().toISOString(),
      data: data || null
    });
  } catch (error) {
    console.error('Unexpected error testing database:', error);
    res.status(500).json({ 
      error: 'Unexpected error', 
      details: error.message,
      supabaseUrl: process.env.SUPABASE_URL ? 'URL is set' : 'URL is missing',
      supabaseKey: process.env.SUPABASE_SERVICE_KEY ? 'Key is set' : 'Key is missing'
    });
  }
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
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
