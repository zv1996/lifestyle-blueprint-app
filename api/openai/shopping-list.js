/**
 * Shopping List Generator for Lifestyle Blueprint
 * 
 * This module handles the generation of shopping lists based on meal plans
 * using OpenAI's API.
 */

const { OpenAI } = require('openai');
const dbClient = require('../database/client');

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a shopping list based on a meal plan
 * @param {string} userId - The user ID
 * @param {string} mealPlanId - The meal plan ID
 * @param {string} conversationId - The conversation ID
 * @param {Array} brandPreferences - Optional brand preferences
 * @returns {Promise<Object>} The generated shopping list
 */
async function generateShoppingList(userId, mealPlanId, conversationId, brandPreferences = []) {
  try {
    console.log(`Generating shopping list for meal plan ${mealPlanId}`);
    
    // Get the meal plan from the database
    const mealPlan = await dbClient.getMealPlanById(mealPlanId);
    
    if (!mealPlan) {
      throw new Error(`Meal plan not found: ${mealPlanId}`);
    }
    
    // Check if the meal plan is approved
    if (mealPlan.status !== 'approved') {
      throw new Error('Cannot generate shopping list for unapproved meal plan');
    }
    
    // Extract all ingredients from the meal plan
    const ingredients = extractIngredientsFromMealPlan(mealPlan);
    
    // Generate the shopping list using OpenAI
    const shoppingList = await createShoppingListWithOpenAI(ingredients, brandPreferences);
    
    // Store the shopping list in the database
    const storedItems = await storeShoppingList(userId, mealPlanId, conversationId, shoppingList);
    
    // Return the shopping list with stored item IDs
    return {
      meal_plan_id: mealPlanId,
      conversation_id: conversationId,
      items: storedItems
    };
  } catch (error) {
    console.error('Error generating shopping list:', error);
    throw error;
  }
}

/**
 * Extract ingredients from a meal plan
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
  
  // Process snacks
  if (mealPlan.snack_1_ingredients) {
    let snackIngredients;
    
    // Parse ingredients if they're stored as a string
    if (typeof mealPlan.snack_1_ingredients === 'string') {
      try {
        snackIngredients = JSON.parse(mealPlan.snack_1_ingredients);
      } catch (e) {
        console.warn('Error parsing snack 1 ingredients:', e);
        snackIngredients = [];
      }
    } else {
      snackIngredients = mealPlan.snack_1_ingredients;
    }
    
    // Add each ingredient to the list
    if (Array.isArray(snackIngredients)) {
      snackIngredients.forEach(ingredient => {
        ingredients.push({
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          meal: 'Snack 1'
        });
      });
    }
  }
  
  if (mealPlan.snack_2_ingredients) {
    let snackIngredients;
    
    // Parse ingredients if they're stored as a string
    if (typeof mealPlan.snack_2_ingredients === 'string') {
      try {
        snackIngredients = JSON.parse(mealPlan.snack_2_ingredients);
      } catch (e) {
        console.warn('Error parsing snack 2 ingredients:', e);
        snackIngredients = [];
      }
    } else {
      snackIngredients = mealPlan.snack_2_ingredients;
    }
    
    // Add each ingredient to the list
    if (Array.isArray(snackIngredients)) {
      snackIngredients.forEach(ingredient => {
        ingredients.push({
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          meal: 'Snack 2'
        });
      });
    }
  }
  
  return ingredients;
}

/**
 * Create a shopping list using OpenAI
 * @param {Array} ingredients - The ingredients from the meal plan
 * @param {Array} brandPreferences - Optional brand preferences
 * @returns {Promise<Array>} The generated shopping list
 */
async function createShoppingListWithOpenAI(ingredients, brandPreferences = []) {
  try {
    // Create a prompt for OpenAI
    const prompt = createShoppingListPrompt(ingredients, brandPreferences);
    
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
    
    // Try to parse the content directly as JSON first
    let shoppingList;
    try {
      // First, try to parse the entire content as JSON
      shoppingList = JSON.parse(content);
    } catch (directParseError) {
      console.log('Direct JSON parsing failed, trying to extract JSON from response...');
      
      try {
        // Extract the JSON part if direct parsing fails
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                          content.match(/```\n([\s\S]*?)\n```/) || 
                          content.match(/\[([\s\S]*?)\]/);
        
        if (!jsonMatch) {
          console.error('Failed to extract JSON from OpenAI response:', content);
          throw new Error('Failed to parse shopping list from OpenAI response');
        }
        
        // If we matched the full array with brackets
        if (jsonMatch[0].startsWith('[') && jsonMatch[0].endsWith(']')) {
          shoppingList = JSON.parse(jsonMatch[0]);
        } else {
          // Otherwise parse the content inside the code block
          shoppingList = JSON.parse(jsonMatch[1]);
        }
      } catch (extractionError) {
        console.error('Error extracting and parsing JSON from OpenAI response:', extractionError);
        console.error('Original content:', content);
        throw new Error('Failed to parse shopping list JSON');
      }
    }
    
    return shoppingList;
  } catch (error) {
    console.error('Error creating shopping list with OpenAI:', error);
    throw error;
  }
}

/**
 * Create a prompt for the shopping list generation
 * @param {Array} ingredients - The ingredients from the meal plan
 * @param {Array} brandPreferences - Optional brand preferences
 * @returns {string} The prompt
 */
function createShoppingListPrompt(ingredients, brandPreferences = []) {
  // Create a string representation of the ingredients
  const ingredientsList = ingredients.map(ingredient => {
    return `- ${ingredient.quantity} ${ingredient.unit} ${ingredient.name} (for ${ingredient.meal})`;
  }).join('\n');
  
  // Create a string representation of the brand preferences
  const brandPreferencesList = brandPreferences.length > 0 
    ? `\nBrand preferences:\n${brandPreferences.map(pref => `- ${pref}`).join('\n')}`
    : '';
  
  // Create the prompt
  return `
Create a consolidated shopping list from these meal plan ingredients:

${ingredientsList}
${brandPreferencesList}

IMPORTANT INSTRUCTIONS:
1. Combine similar ingredients (e.g., all rice becomes one entry with total quantity)
2. Use ONLY these categories: Produce, Meat, Dairy, Pantry
3. Standardize units (e.g., convert small amounts to teaspoons/tablespoons, use grams for most weights)
4. Include brand preferences where applicable
5. Keep the list concise - aim for 30-40 items maximum by combining similar items

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
}

/**
 * Store a shopping list in the database
 * @param {string} userId - The user ID
 * @param {string} mealPlanId - The meal plan ID
 * @param {string} conversationId - The conversation ID
 * @param {Array} shoppingList - The shopping list items
 * @returns {Promise<Array>} The stored items with IDs
 */
async function storeShoppingList(userId, mealPlanId, conversationId, shoppingList) {
  try {
    // Store each item in the database
    const storedItems = await dbClient.storeGroceryList(
      userId,
      mealPlanId,
      shoppingList,
      conversationId
    );
    
    return storedItems;
  } catch (error) {
    console.error('Error storing shopping list:', error);
    throw error;
  }
}

module.exports = {
  generateShoppingList
};
