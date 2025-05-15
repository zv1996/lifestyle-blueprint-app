/**
 * Database Client for Lifestyle Blueprint
 * 
 * This module handles communication with the Supabase database,
 * including reading and writing to tables for user data, meal plans, etc.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Get user data by ID
 * @param {string} userId - The user ID
 * @returns {Promise<Object>} The user data
 */
async function getUserById(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
}

/**
 * Get user metrics and goals by user ID and conversation ID
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Object>} The user metrics and goals
 */
async function getUserMetricsAndGoals(userId, conversationId = null) {
  try {
    let query = supabase
      .from('user_metrics_and_goals')
      .select('*')
      .eq('user_id', userId);
    
    // If conversationId is provided, filter by it
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    
    // Order by created_at to get the most recent entry if no conversation_id is provided
    if (!conversationId) {
      query = query.order('created_at', { ascending: false });
    }
    
    // Get the first matching record
    const { data, error } = await query.limit(1).maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    return data || null;
  } catch (error) {
    console.error('Error getting user metrics and goals:', error);
    throw error;
  }
}

/**
 * Get user diet and meal preferences by user ID and conversation ID
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Object>} The user diet and meal preferences
 */
async function getUserDietAndMealPreferences(userId, conversationId = null) {
  try {
    let query = supabase
      .from('user_diet_and_meal_preferences')
      .select('*')
      .eq('user_id', userId);
    
    // If conversationId is provided, filter by it
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    
    // Order by date_created to get the most recent entry if no conversation_id is provided
    if (!conversationId) {
      query = query.order('date_created', { ascending: false });
    }
    
    // Get the first matching record
    const { data, error } = await query.limit(1).maybeSingle();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  } catch (error) {
    console.error('Error getting user diet and meal preferences:', error);
    throw error;
  }
}

/**
 * Get calorie calculations for a user
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Object>} The calorie calculations
 */
async function getCalorieCalculations(userId, conversationId = null) {
  try {
    let query = supabase
      .from('calorie_calculations')
      .select('*')
      .eq('user_id', userId);
    
    // If conversationId is provided, filter by it
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    
    // Order by date_created to get the most recent entry
    query = query.order('date_created', { ascending: false });
    
    // Get the first matching record
    const { data, error } = await query.limit(1);
    
    if (error) {
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting calorie calculations:', error);
    throw error;
  }
}

/**
 * Store a meal plan in the database
 * @param {string} userId - The user ID
 * @param {Object} mealPlanData - The meal plan data
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object>} The stored meal plan
 */
async function storeMealPlan(userId, mealPlanData, conversationId) {
  try {
    console.log('Storing meal plan for user:', userId, 'conversation:', conversationId);
    
    // Check if we need to generate a meal plan ID
    if (!mealPlanData.meal_plan_id) {
      mealPlanData.meal_plan_id = crypto.randomUUID();
    }
    
    // Prepare the data for insertion
    const mealPlanRecord = {
      meal_plan_id: mealPlanData.meal_plan_id,
      user_id: userId,
      conversation_id: conversationId,
      created_at: new Date().toISOString(),
      is_initial_plan: mealPlanData.is_initial_plan || true,
      status: mealPlanData.status || 'draft'
    };
    
    // If this is based on another plan, include that reference
    if (mealPlanData.based_on_plan_id) {
      mealPlanRecord.based_on_plan_id = mealPlanData.based_on_plan_id;
    }
    
    // Process structured meal data if available
    if (mealPlanData.meals && Array.isArray(mealPlanData.meals)) {
      // Convert structured meal data to flat structure
      mealPlanData.meals.forEach(meal => {
        const { day, mealType, name, description, ingredients, recipe, protein, carbs, fat } = meal;
        
        mealPlanRecord[`${mealType}_${day}_name`] = name;
        mealPlanRecord[`${mealType}_${day}_description`] = description;
        mealPlanRecord[`${mealType}_${day}_ingredients`] = ingredients;
        mealPlanRecord[`${mealType}_${day}_recipe`] = recipe;
        mealPlanRecord[`${mealType}_${day}_protein`] = protein;
        mealPlanRecord[`${mealType}_${day}_carbs`] = carbs;
        mealPlanRecord[`${mealType}_${day}_fat`] = fat;
      });
    }
    
    // Process snacks if available
    if (mealPlanData.snacks && Array.isArray(mealPlanData.snacks)) {
      mealPlanData.snacks.forEach((snack, index) => {
        const snackNumber = index + 1;
        if (snackNumber <= 2) { // We only support 2 snacks
          mealPlanRecord[`snack_${snackNumber}_name`] = snack.name;
          mealPlanRecord[`snack_${snackNumber}_protein`] = snack.protein;
          mealPlanRecord[`snack_${snackNumber}_carbs`] = snack.carbs;
          mealPlanRecord[`snack_${snackNumber}_fat`] = snack.fat;
        }
      });
    }
    
    // Process favorite meals if available
    if (mealPlanData.favoriteMeals && Array.isArray(mealPlanData.favoriteMeals)) {
      mealPlanData.favoriteMeals.forEach((meal, index) => {
        const mealNumber = index + 1;
        if (mealNumber <= 2) { // We only support 2 favorite meals
          mealPlanRecord[`favorite_meal_${mealNumber}_name`] = meal.name;
          mealPlanRecord[`favorite_meal_${mealNumber}_protein`] = meal.protein;
          mealPlanRecord[`favorite_meal_${mealNumber}_carbs`] = meal.carbs;
          mealPlanRecord[`favorite_meal_${mealNumber}_fat`] = meal.fat;
        }
      });
    }
    
    // Add any other flat properties from the meal plan data
    for (const key in mealPlanData) {
      if (
        !['meals', 'snacks', 'favoriteMeals', 'meal_plan_id', 'is_initial_plan', 'status', 'based_on_plan_id'].includes(key) &&
        !key.startsWith('mealPlan')
      ) {
        mealPlanRecord[key] = mealPlanData[key];
      }
    }
    
    console.log('Meal plan record prepared:', mealPlanRecord);
    
    // Check if this meal plan already exists
    if (mealPlanData.meal_plan_id) {
      const { data: existingPlan } = await supabase
        .from('meal_plans')
        .select('meal_plan_id')
        .eq('meal_plan_id', mealPlanData.meal_plan_id)
        .limit(1);
      
      if (existingPlan && existingPlan.length > 0) {
        // Update the existing meal plan
        const { data, error } = await supabase
          .from('meal_plans')
          .update(mealPlanRecord)
          .eq('meal_plan_id', mealPlanData.meal_plan_id)
          .select();
        
        if (error) {
          throw error;
        }
        
        console.log('Meal plan updated:', data);
        return data[0];
      }
    }
    
    // Insert a new meal plan
    const { data, error } = await supabase
      .from('meal_plans')
      .insert(mealPlanRecord)
      .select();
    
    if (error) {
      throw error;
    }
    
    console.log('Meal plan stored:', data);
    return data[0];
  } catch (error) {
    console.error('Error storing meal plan:', error);
    throw error;
  }
}

/**
 * Get a meal plan by ID
 * @param {string} mealPlanId - The meal plan ID
 * @returns {Promise<Object>} The meal plan
 */
async function getMealPlanById(mealPlanId) {
  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .select('*')
      .eq('meal_plan_id', mealPlanId)
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error getting meal plan by ID:', error);
    throw error;
  }
}

/**
 * Get meal plans for a user
 * @param {string} userId - The user ID (optional if conversationId is provided)
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Array>} The meal plans
 */
async function getMealPlansByUserId(userId, conversationId = null) {
  try {
    let query = supabase
      .from('meal_plans')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by user ID if provided
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    // Filter by conversation ID if provided
    if (conversationId) {
      query = query.eq('conversation_id', conversationId);
    }
    
    // If neither userId nor conversationId is provided, return an empty array
    if (!userId && !conversationId) {
      console.warn('Neither userId nor conversationId provided to getMealPlansByUserId');
      return [];
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error getting meal plans by user ID or conversation ID:', error);
    throw error;
  }
}

/**
 * Finalize a meal plan (mark as approved)
 * @param {string} mealPlanId - The meal plan ID
 * @returns {Promise<Object>} The updated meal plan
 */
async function finalizeMealPlan(mealPlanId) {
  try {
    const { data, error } = await supabase
      .from('meal_plans')
      .update({ status: 'approved' })
      .eq('meal_plan_id', mealPlanId)
      .select();
    
    if (error) {
      throw error;
    }
    
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error finalizing meal plan:', error);
    throw error;
  }
}

/**
 * Get groceries for a meal plan
 * @param {string} mealPlanId - The meal plan ID
 * @returns {Promise<Array>} The groceries
 */
async function getGroceriesByMealPlanId(mealPlanId) {
  try {
    const { data, error } = await supabase
      .from('groceries')
      .select('*')
      .eq('meal_plan_id', mealPlanId)
      .order('category', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error getting groceries by meal plan ID:', error);
    throw error;
  }
}

/**
 * Store basic user information
 * @param {string} userId - The user ID
 * @param {Object} userInfo - The user information to store
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Object>} The stored user data
 */
async function storeUserInfo(userId, userInfo, conversationId = null) {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        user_id: userId,
        first_name: userInfo.firstName,
        last_name: userInfo.lastName,
        phone_number: userInfo.phoneNumber,
        birth_date: userInfo.birthDate,
        biological_sex: userInfo.biologicalSex,
        conversation_id: conversationId
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error storing user info:', error);
    throw error;
  }
}

/**
 * Store user metrics and goals
 * @param {string} userId - The user ID
 * @param {Object} metricsAndGoals - The metrics and goals to store
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Object>} The stored metrics and goals
 */
async function storeUserMetricsAndGoals(userId, metricsAndGoals, conversationId = null) {
  try {
    const { data, error } = await supabase
      .from('user_metrics_and_goals')
      .upsert({
        user_id: userId,
        height_inches: metricsAndGoals.heightInches,
        weight_pounds: metricsAndGoals.weightPounds,
        activity_level: metricsAndGoals.activityLevel,
        health_fitness_goal: metricsAndGoals.healthFitnessGoal,
        conversation_id: conversationId
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error storing user metrics and goals:', error);
    throw error;
  }
}

/**
 * Store user diet and meal preferences
 * @param {string} userId - The user ID
 * @param {Object} dietPreferences - The diet preferences to store
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Object>} The stored diet preferences
 */
async function storeUserDietAndMealPreferences(userId, dietPreferences, conversationId = null) {
  try {
    console.log('Received diet preferences:', dietPreferences);
    
    // Convert dietary restrictions to array if it's a string
    let dietaryRestrictions = dietPreferences.dietary_restrictions;
    if (typeof dietaryRestrictions === 'string') {
      dietaryRestrictions = [dietaryRestrictions];
    } else if (!Array.isArray(dietaryRestrictions)) {
      dietaryRestrictions = [];
    }
    
    // Convert dietary preferences to array if it's a string
    let dietaryPreferences = dietPreferences.dietary_preferences;
    if (typeof dietaryPreferences === 'string') {
      dietaryPreferences = [dietaryPreferences];
    } else if (!Array.isArray(dietaryPreferences)) {
      dietaryPreferences = [];
    }
    
    // Handle camelCase to snake_case conversion for frontend data
    if (dietPreferences.dietaryRestrictions !== undefined) {
      if (typeof dietPreferences.dietaryRestrictions === 'string') {
        dietaryRestrictions = [dietPreferences.dietaryRestrictions];
      } else if (Array.isArray(dietPreferences.dietaryRestrictions)) {
        dietaryRestrictions = dietPreferences.dietaryRestrictions;
      }
    }
    
    if (dietPreferences.dietaryPreferences !== undefined) {
      if (typeof dietPreferences.dietaryPreferences === 'string') {
        dietaryPreferences = [dietPreferences.dietaryPreferences];
      } else if (Array.isArray(dietPreferences.dietaryPreferences)) {
        dietaryPreferences = dietPreferences.dietaryPreferences;
      }
    }
    
    // Create the data object to upsert
    const dataToUpsert = {
      user_id: userId,
      dietary_restrictions: dietaryRestrictions,
      dietary_preferences: dietaryPreferences,
      meal_portion_people_count: dietPreferences.meal_portion_people_count || dietPreferences.mealPortionPeopleCount,
      meal_portion_details: dietPreferences.meal_portion_details || dietPreferences.mealPortionDetails || '',
      include_snacks: dietPreferences.include_snacks || dietPreferences.includeSnacks || false,
      snack_1: dietPreferences.snack_1 || dietPreferences.snack1 || '',
      snack_2: dietPreferences.snack_2 || dietPreferences.snack2 || '',
      include_favorite_meals: dietPreferences.include_favorite_meals || dietPreferences.includeFavoriteMeals || false,
      favorite_meal_1: dietPreferences.favorite_meal_1 || dietPreferences.favoriteMeal1 || '',
      favorite_meal_2: dietPreferences.favorite_meal_2 || dietPreferences.favoriteMeal2 || '',
      date_created: new Date().toISOString().split('T')[0],
      conversation_id: conversationId
    };
    
    console.log('Upserting data:', dataToUpsert);
    
    const { data, error } = await supabase
      .from('user_diet_and_meal_preferences')
      .upsert(dataToUpsert)
      .select()
      .single();
    
    if (error) throw error;
    console.log('Stored diet preferences:', data);
    return data;
  } catch (error) {
    console.error('Error storing user diet and meal preferences:', error);
    throw error;
  }
}

/**
 * Store calorie calculations
 * @param {string} userId - The user ID
 * @param {Object} calorieCalculations - The calorie calculations to store
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Object>} The stored calorie calculations
 */
async function storeCalorieCalculations(userId, calorieCalculations, conversationId = null) {
  try {
    console.log('Storing calorie calculations in database:', {
      user_id: userId,
      weekly_calorie_intake: calorieCalculations.weeklyCalorieIntake,
      five_two_split: calorieCalculations.fiveTwoSplit,
      macronutrient_split: calorieCalculations.macronutrientSplit,
      conversation_id: conversationId
    });
    
    const { data, error } = await supabase
      .from('calorie_calculations')
      .insert({
        user_id: userId,
        date_created: new Date().toISOString().split('T')[0],
        weekly_calorie_intake: calorieCalculations.weeklyCalorieIntake,
        five_two_split: calorieCalculations.fiveTwoSplit,
        macronutrient_split: calorieCalculations.macronutrientSplit,
        conversation_id: conversationId
      })
      .select()
      .single();
    
    if (error) {
      console.error('Database error storing calorie calculations:', error);
      throw error;
    }
    
    console.log('Successfully stored calorie calculations:', data);
    return data;
  } catch (error) {
    console.error('Error storing calorie calculations:', error);
    throw error;
  }
}

/**
 * Store a grocery list
 * @param {string} userId - The user ID
 * @param {string} mealPlanId - The meal plan ID
 * @param {Array} groceries - The groceries to store
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Array>} The stored groceries
 */
async function storeGroceryList(userId, mealPlanId, groceries, conversationId = null) {
  try {
    // Create grocery items with IDs and timestamps
    const groceryItems = groceries.map(grocery => ({
      id: crypto.randomUUID(),
      user_id: userId,
      meal_plan_id: mealPlanId,
      ingredient_name: grocery.ingredientName,
      quantity: grocery.quantity,
      unit: grocery.unit,
      category: grocery.category,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      conversation_id: conversationId
    }));
    
    // Insert the groceries
    const { data, error } = await supabase
      .from('groceries')
      .insert(groceryItems)
      .select();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error storing grocery list:', error);
    throw error;
  }
}

/**
 * Store a conversation message
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID
 * @param {string} messageText - The message text
 * @param {Array} embeddingVector - The embedding vector
 * @returns {Promise<Object>} The stored message
 */
async function storeConversationMessage(userId, conversationId, messageText, embeddingVector = null) {
  try {
    // First, check if we need to create a metadata entry for this conversation
    const { data: existingMetadata, error: metadataError } = await supabase
      .from('conversation_metadata')
      .select('conversation_id')
      .eq('conversation_id', conversationId)
      .limit(1);
    
    if (metadataError) {
      console.error('Error checking for conversation metadata:', metadataError);
    }
    
    // If no metadata exists for this conversation, create it
    if (!existingMetadata || existingMetadata.length === 0) {
      console.log('Creating new conversation metadata with ID:', conversationId);
      
      const metadataData = {
        conversation_id: conversationId,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const { error: insertError } = await supabase
        .from('conversation_metadata')
        .insert(metadataData);
      
      if (insertError) {
        console.error('Error creating conversation metadata:', insertError);
        // Continue anyway, as the message might still be stored
      }
    } else {
      // Update the updated_at timestamp
      const { error: updateError } = await supabase
        .from('conversation_metadata')
        .update({ updated_at: new Date().toISOString() })
        .eq('conversation_id', conversationId);
      
      if (updateError) {
        console.error('Error updating conversation metadata:', updateError);
        // Continue anyway, as the message might still be stored
      }
    }
    
    // Now store the message
    const messageData = {
      id: crypto.randomUUID(), // Ensure a unique ID for each message
      conversation_id: conversationId,
      user_id: userId,
      conversation_date: new Date().toISOString().split('T')[0],
      message_timestamp: new Date().toISOString(),
      message_text: messageText
    };
    
    if (embeddingVector) {
      messageData.embedding_vector = embeddingVector;
    }
    
    // Insert the message
    const { data, error } = await supabase
      .from('conversations')
      .insert(messageData)
      .select()
      .single();
    
    if (error) {
      console.error('Error storing conversation message:', error);
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error storing conversation message:', error);
    
    // If this is a duplicate key error, we can ignore it and continue
    if (error.code === '23505' && error.message.includes('conversations_conversation_id_key')) {
      console.log('Ignoring duplicate conversation_id error - conversation already exists');
      return { conversation_id: conversationId, message_text: messageText };
    }
    
    throw error;
  }
}

/**
 * Get all user data for a user
 * @param {string} userId - The user ID
 * @param {string} conversationId - The conversation ID (optional)
 * @returns {Promise<Object>} All user data
 */
async function getAllUserData(userId, conversationId = null) {
  try {
    // Get basic user info
    const user = await getUserById(userId);
    
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    
    // Get user metrics and goals
    const metricsAndGoals = await getUserMetricsAndGoals(userId, conversationId);
    
    // Get user diet and meal preferences
    const dietAndMealPreferences = await getUserDietAndMealPreferences(userId, conversationId);
    
    // Get calorie calculations
    const calorieCalculations = await getCalorieCalculations(userId, conversationId);
    
    // Get meal plans
    const mealPlans = await getMealPlansByUserId(userId);
    
    // Check if we have all required data for calculations
    if (!metricsAndGoals) {
      console.warn(`User ${userId} is missing metrics and goals data`);
    }
    
    // Return all user data
    return {
      user,
      metricsAndGoals,
      dietAndMealPreferences,
      calorieCalculations,
      mealPlans
    };
  } catch (error) {
    console.error('Error getting all user data:', error);
    throw error;
  }
}

module.exports = {
  getUserById,
  getUserMetricsAndGoals,
  getUserDietAndMealPreferences,
  getCalorieCalculations,
  getMealPlansByUserId,
  getMealPlanById,
  getGroceriesByMealPlanId,
  storeUserInfo,
  storeUserMetricsAndGoals,
  storeUserDietAndMealPreferences,
  storeCalorieCalculations,
  storeMealPlan,
  storeGroceryList,
  finalizeMealPlan,
  storeConversationMessage,
  getAllUserData
};
