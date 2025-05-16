// Test script to check Supabase database connection
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Test function to check database connection
async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', process.env.SUPABASE_URL);
    console.log('Supabase Key:', process.env.SUPABASE_SERVICE_KEY ? 'Key is set' : 'Key is missing');
    
    // Try to query the users table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error connecting to Supabase:', error);
      return;
    }
    
    console.log('Connection successful!');
    console.log('Data:', data);
    
    // Try to query the user_metrics_and_goals table
    const { data: metricsData, error: metricsError } = await supabase
      .from('user_metrics_and_goals')
      .select('*')
      .limit(1);
    
    if (metricsError) {
      console.error('Error querying user_metrics_and_goals:', metricsError);
    } else {
      console.log('user_metrics_and_goals query successful!');
      console.log('Data:', metricsData);
    }
    
    // Try to query the user_diet_and_meal_preferences table
    const { data: dietData, error: dietError } = await supabase
      .from('user_diet_and_meal_preferences')
      .select('*')
      .limit(1);
    
    if (dietError) {
      console.error('Error querying user_diet_and_meal_preferences:', dietError);
    } else {
      console.log('user_diet_and_meal_preferences query successful!');
      console.log('Data:', dietData);
    }
    
    // Try to query the calorie_calculations table
    const { data: calorieData, error: calorieError } = await supabase
      .from('calorie_calculations')
      .select('*')
      .limit(1);
    
    if (calorieError) {
      console.error('Error querying calorie_calculations:', calorieError);
    } else {
      console.log('calorie_calculations query successful!');
      console.log('Data:', calorieData);
    }
    
    // Try to query the meal_plans table
    const { data: mealPlanData, error: mealPlanError } = await supabase
      .from('meal_plans')
      .select('*')
      .limit(1);
    
    if (mealPlanError) {
      console.error('Error querying meal_plans:', mealPlanError);
    } else {
      console.log('meal_plans query successful!');
      console.log('Data:', mealPlanData);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the test
testConnection();
