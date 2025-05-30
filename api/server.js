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
const path = require('path');
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
    // Only log origins for non-undefined origins to reduce console spam
    if (origin) {
      console.log('Request origin:', origin);
    }
    
    // In development, allow requests with no origin (like mobile apps, service workers, or curl)
    if (!origin) {
      // Don't log every undefined origin to reduce console spam
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
    
    if (allowedDomains.length === 0 || allowedDomains.indexOf(origin) !== -1) {
      console.log('Origin is in allowed domains list');
      callback(null, true);
    } else {
      console.log('Origin is NOT in allowed domains list:', origin);
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

// API endpoint to get meal plans for the meal history page
app.get('/api/meal-plans/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID' });
    }
    
    // Get meal plans for the user
    const mealPlans = await dbClient.getMealPlansByUserId(userId);
    
    res.json(mealPlans);
  } catch (error) {
    console.error('Error getting meal plans for history page:', error);
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
    const groceries = await dbClient.getGroceryListByMealPlanId(mealPlanId);
    
    res.json(groceries);
  } catch (error) {
    console.error('Error getting groceries:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import shopping list routes
const shoppingListRoutes = require('./routes/shopping-list');

// Import meal plan routes
const mealPlanRoutes = require('./routes/meal-plan');

// Use shopping list routes
app.use('/api/shopping-list', shoppingListRoutes);

// Use meal plan routes
app.use('/api/meal-plan', mealPlanRoutes);

// Public API endpoints for shared meal plans (no authentication required)
app.get('/api/shared/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;
    
    if (!shareToken) {
      return res.status(400).json({ error: 'Share token is required' });
    }
    
    console.log('Getting shared meal plan for token:', shareToken);
    
    // Get the shared meal plan
    const sharedData = await dbClient.getSharedMealPlan(shareToken);
    
    res.json({
      success: true,
      mealPlan: sharedData.mealPlan,
      shareInfo: sharedData.shareInfo
    });
  } catch (error) {
    console.error('Error getting shared meal plan:', error);
    
    if (error.message === 'Share link not found or expired' || error.message === 'Share link has expired') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to load shared meal plan' });
  }
});

app.get('/api/shared/:shareToken/shopping-list', async (req, res) => {
  try {
    const { shareToken } = req.params;
    
    if (!shareToken) {
      return res.status(400).json({ error: 'Share token is required' });
    }
    
    console.log('Getting shared shopping list for token:', shareToken);
    
    // Get the shared shopping list
    let groceries = await dbClient.getSharedMealPlanGroceries(shareToken);
    
    // If no shopping list exists, generate one on-the-fly
    if (!groceries || groceries.length === 0) {
      console.log('No shopping list found, generating on-the-fly for shared meal plan');
      
      try {
        // Get the shared meal plan first
        const sharedData = await dbClient.getSharedMealPlan(shareToken);
        const mealPlan = sharedData.mealPlan;
        
        if (mealPlan) {
          // Import the shopping list generator
          const shoppingListGenerator = require('./openai/shopping-list');
          
          // Extract ingredients directly from the meal plan
          const ingredients = extractIngredientsFromMealPlan(mealPlan);
          
          if (ingredients.length > 0) {
            // Generate shopping list using OpenAI (bypass status check)
            const shoppingList = await generateShoppingListForShared(ingredients);
            
            // Store the generated shopping list in the database
            if (shoppingList && shoppingList.length > 0) {
              await dbClient.storeGroceryList(
                mealPlan.user_id,
                mealPlan.meal_plan_id,
                shoppingList,
                mealPlan.conversation_id
              );
              
              // Return the newly generated shopping list
              groceries = shoppingList.map(item => ({
                id: require('crypto').randomUUID(),
                ingredient_name: item.ingredient_name,
                quantity: item.quantity,
                unit: item.unit,
                category: item.category
              }));
            }
          }
        }
      } catch (generationError) {
        console.error('Error generating shopping list on-the-fly:', generationError);
        // Continue with empty list rather than failing
      }
    }
    
    res.json({
      success: true,
      items: groceries || []
    });
  } catch (error) {
    console.error('Error getting shared shopping list:', error);
    
    if (error.message === 'Share link not found or expired' || error.message === 'Share link has expired') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to load shared shopping list' });
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

// API endpoint to toggle favorite status for a meal plan
app.put('/api/meal-plan/:mealPlanId/favorite', async (req, res) => {
  try {
    const { mealPlanId } = req.params;
    const { userId, isFavorite } = req.body;
    
    if (!mealPlanId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Get the existing meal plan
    const existingMealPlan = await dbClient.getMealPlanById(mealPlanId);
    
    if (!existingMealPlan) {
      return res.status(404).json({ error: 'Meal plan not found' });
    }
    
    // Update the meal plan with the favorite status
    const updatedMealPlan = await dbClient.storeMealPlan(userId, {
      meal_plan_id: mealPlanId,
      is_favorite: isFavorite
    }, existingMealPlan.conversation_id);
    
    res.json(updatedMealPlan);
  } catch (error) {
    console.error('Error updating favorite status:', error);
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

// API endpoint to get complete user profile (for preloader)
app.get('/api/user/complete-profile', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing user ID in headers' });
    }
    
    console.log('UserDataPreloader: Fetching complete profile for user:', userId);
    
    // Get all user data components
    const [basicInfo, metrics, dietPreferences] = await Promise.all([
      dbClient.getUserById(userId).catch(() => null),
      dbClient.getUserMetricsAndGoals(userId).catch(() => null),
      dbClient.getUserDietAndMealPreferences(userId).catch(() => null)
    ]);
    
    // Check if user exists at all
    if (!basicInfo && !metrics && !dietPreferences) {
      return res.status(404).json({ error: 'No user data found' });
    }
    
    // Format response for UserDataPreloader
    const profileData = {
      basicInfo: basicInfo ? {
        first_name: basicInfo.first_name,
        last_name: basicInfo.last_name,
        phone_number: basicInfo.phone_number,
        birth_date: basicInfo.birth_date,
        biological_sex: basicInfo.biological_sex,
        lastUpdated: basicInfo.created_at || basicInfo.updated_at
      } : null,
      
      metrics: metrics ? {
        height_inches: metrics.height_inches,
        weight_pounds: metrics.weight_pounds,
        activity_level: metrics.activity_level,
        health_fitness_goal: metrics.health_fitness_goal,
        lastUpdated: metrics.created_at || metrics.updated_at
      } : null,
      
      dietPreferences: dietPreferences ? {
        dietary_restrictions: dietPreferences.dietary_restrictions,
        dietary_preferences: dietPreferences.dietary_preferences,
        meal_portion_people_count: dietPreferences.meal_portion_people_count,
        meal_portion_details: dietPreferences.meal_portion_details,
        include_snacks: dietPreferences.include_snacks,
        snack_1: dietPreferences.snack_1,
        snack_2: dietPreferences.snack_2,
        include_favorite_meals: dietPreferences.include_favorite_meals,
        favorite_meal_1: dietPreferences.favorite_meal_1,
        favorite_meal_2: dietPreferences.favorite_meal_2,
        lastUpdated: dietPreferences.date_created
      } : null
    };
    
    console.log('UserDataPreloader: Successfully retrieved profile data');
    res.json(profileData);
    
  } catch (error) {
    console.error('UserDataPreloader: Error getting complete profile:', error);
    res.status(500).json({ error: 'Internal server error' });
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

/**
 * Extract ingredients from a meal plan (helper function for shared shopping list)
 * @param {Object} mealPlan - The meal plan
 * @returns {Array} The extracted ingredients
 */
function extractIngredientsFromMealPlan(mealPlan) {
  const ingredients = [];
  
  // Process breakfast, lunch, and dinner for each day
  for (let day = 1; day <= 5; day++) {
    ['breakfast', 'lunch', 'dinner'].forEach(mealType => {
      const ingredientsKey = `${mealType}_${day}_ingredients`;
      
      if (mealPlan[ingredientsKey]) {
        let mealIngredients;
        
        // Parse ingredients if they're stored as a string
        if (typeof mealPlan[ingredientsKey] === 'string') {
          try {
            mealIngredients = JSON.parse(mealPlan[ingredientsKey]);
          } catch (e) {
            console.warn(`Error parsing ingredients for ${mealType} on day ${day}:`, e);
            mealIngredients = [];
          }
        } else {
          mealIngredients = mealPlan[ingredientsKey];
        }
        
        // Add each ingredient to the list
        if (Array.isArray(mealIngredients)) {
          mealIngredients.forEach(ingredient => {
            ingredients.push({
              name: ingredient.name,
              quantity: ingredient.quantity,
              unit: ingredient.unit,
              meal: `${mealType} (Day ${day})`
            });
          });
        }
      }
    });
  }
  
  return ingredients;
}

/**
 * Generate shopping list for shared meal plan (bypasses status check)
 * @param {Array} ingredients - The ingredients from the meal plan
 * @returns {Promise<Array>} The generated shopping list
 */
async function generateShoppingListForShared(ingredients) {
  try {
    const { OpenAI } = require('openai');
    
    // Initialize OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Create a prompt for OpenAI
    const ingredientsList = ingredients.map(ingredient => {
      return `- ${ingredient.quantity} ${ingredient.unit} ${ingredient.name} (for ${ingredient.meal})`;
    }).join('\n');
    
    const prompt = `
Create a consolidated shopping list from these meal plan ingredients:

${ingredientsList}

IMPORTANT INSTRUCTIONS:
1. Combine similar ingredients (e.g., all rice becomes one entry with total quantity)
2. Use ONLY these categories: Produce, Meat, Dairy, Pantry
3. Standardize units (e.g., convert small amounts to teaspoons/tablespoons, use grams for most weights)
4. Keep the list concise - aim for 30-40 items maximum by combining similar items

RESPONSE FORMAT:
Return ONLY a JSON array with this structure:
[
  {
    "ingredient_name": "Ingredient name",
    "quantity": numeric_quantity,
    "unit": "unit",
    "category": "category"
  }
]

CRITICAL: Your response must be ONLY the JSON array with no additional text, markdown formatting, or code blocks.
`;
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates organized shopping lists based on meal plan ingredients. You consolidate similar ingredients, categorize them, and format the output as JSON. Your response should ONLY contain a valid JSON array with no additional text, comments, or code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });
    
    // Parse the response
    const content = response.choices[0].message.content.trim();
    
    // Try to parse the content as JSON
    let shoppingList;
    try {
      shoppingList = JSON.parse(content);
    } catch (directParseError) {
      // Extract the JSON part if direct parsing fails
      const jsonMatch = content.match(/\[([\s\S]*?)\]/);
      if (jsonMatch) {
        shoppingList = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse shopping list from OpenAI response');
      }
    }
    
    return shoppingList;
  } catch (error) {
    console.error('Error generating shopping list for shared meal plan:', error);
    throw error;
  }
}

// Serve shared meal plan page for /s/{token} URLs
app.get('/s/:token', (req, res) => {
  console.log('Serving shared meal plan page for token:', req.params.token);
  res.sendFile(path.join(__dirname, '..', 'shared-meal-plan.html'));
});

// Start the server
server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
