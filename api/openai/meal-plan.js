/**
 * OpenAI Meal Plan Generator for Lifestyle Blueprint
 * 
 * This module handles the generation of meal plans using OpenAI's GPT-4 model.
 */

require('dotenv').config();
const { OpenAI } = require('openai');
const crypto = require('crypto');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a meal plan based on user data
 * @param {Object} userData - User data from database
 * @returns {Promise<Object>} The generated meal plan
 */
async function generateMealPlan(userData) {
  try {
    console.log('Generating meal plan with user data:', JSON.stringify(userData, null, 2));
    
    // Extract relevant data for the prompt
    const { user, metricsAndGoals, dietAndMealPreferences, calorieCalculations } = userData;
    
    if (!metricsAndGoals || !dietAndMealPreferences || !calorieCalculations) {
      throw new Error('Missing required user data for meal plan generation');
    }
    
    // Maximum number of retry attempts
    const maxRetries = 3;
    let attempts = 0;
    let mealPlanData = null;
    let lastError = null;
    
    // Retry loop with incremental backoff
    while (attempts < maxRetries && !mealPlanData) {
      try {
        attempts++;
        console.log(`Attempt ${attempts} of ${maxRetries} to generate meal plan`);
        
        // Adjust temperature based on retry attempt (lower temperature for more focused responses)
        const temperature = Math.max(0.3, 0.7 - (attempts - 1) * 0.2);
        
        // Create the prompt for GPT-4, adding feedback from previous attempts if available
        const prompt = createMealPlanPrompt(userData, lastError);
        
        // Call GPT-4 to generate the meal plan with increased timeout
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { 
              role: 'system', 
              content: `You are an expert nutritionist and meal planner specializing in high-calorie, nutrient-dense meal plans. You create detailed, personalized meal plans based on user data and nutritional requirements.

⚠️ CRITICAL CALORIE REQUIREMENTS (HIGHEST PRIORITY) ⚠️
1. EVERY SINGLE MEAL MUST MEET OR EXCEED its MINIMUM calorie requirement - this is your #1 priority
2. NEVER create a meal below the minimum calorie threshold specified for each meal type
3. ALWAYS verify each meal's calories by calculating: protein × 4 + carbs × 4 + fat × 9
4. If a meal is below the minimum calories, INCREASE portion sizes or add calorie-dense ingredients
5. NEVER use low-calorie substitutes (egg whites instead of whole eggs, skim milk instead of whole milk)

MEAL PORTION GUIDELINES TO ENSURE ADEQUATE CALORIES:
- Protein: 6-8oz (170-225g) portions minimum (NOT 3-4oz which is too small)
- Oils/Fats: 1-2 tbsp (15-30ml) per meal minimum
- Nuts/Seeds: 1-2oz (30-60g) portions when used
- Avocado: Use 1/2 to whole avocado, not just a few slices
- Starches: 1-1.5 cups cooked minimum (rice, pasta, potatoes)
- Dairy: Use full-fat versions, never low-fat or skim options

CRITICAL REQUIREMENTS:
1. You MUST provide complete meal plans with all required meals (15 total: breakfast, lunch, dinner for all 5 days)
2. You MUST ensure EACH INDIVIDUAL MEAL has the MINIMUM required calories - this is your TOP PRIORITY
3. You MUST calculate calories accurately using: protein × 4 + carbs × 4 + fat × 9 calories
4. You MUST ensure each day's total calories match the target (within acceptable range)
5. You MUST strictly adhere to all dietary restrictions
6. You MUST format your response as PURE, VALID JSON that can be parsed

JSON FORMAT REQUIREMENTS (EXTREMELY IMPORTANT):
- Your response MUST be PURE JSON only - no comments, no explanations, no extra text
- DO NOT include any JavaScript comments (// or /* */) in your JSON
- DO NOT include any explanatory text before or after the JSON
- DO NOT use trailing commas in arrays or objects
- DO NOT include any markdown formatting
- ONLY return a single, valid JSON object

COMMON MISTAKES TO AVOID:
- Creating meals that are too low in calories (this is the #1 issue to avoid)
- Using egg whites instead of whole eggs (whole eggs have 70 cal vs 17 cal for whites)
- Using small portions of protein (4oz is too small, use 6-8oz minimum)
- Forgetting to add oils/fats to recipes (add 1-2 tbsp oil minimum to most meals)
- Using skim or low-fat dairy instead of full-fat options
- Underestimating portion sizes needed to reach calorie targets
- Not including enough healthy fats (oils, nuts, avocados) which are calorie-dense
- Creating meals with insufficient protein content
- Including comments or explanations in your JSON response (this will cause parsing errors)

STRATEGIES FOR MEETING CALORIE TARGETS:
- Include calorie-dense foods: nuts, seeds, oils, avocados, whole grains
- Use proper portion sizes (e.g., 6-8oz protein portions, not 3-4oz)
- Include healthy fats with every meal (1-2 tbsp oil, 1/4 avocado, 1oz nuts)
- Ensure adequate carbohydrate portions (1-1.5 cups cooked grains/starches)
- Add calorie-dense toppings and sauces when appropriate
- Use whole eggs, not egg whites
- Use full-fat dairy, not low-fat or skim options
- Add extra olive oil, butter, or other healthy fats to increase calories
- Include calorie-dense sides like nuts, seeds, or avocado

Your meal plans should be creative, practical, and truly personalized to the user's specific needs while ensuring every meal meets its minimum calorie requirement.`
            },
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: 4000
        });
        
        // Parse the response
        const mealPlanText = response.choices[0].message.content;
        console.log(`Attempt ${attempts} meal plan text:`, mealPlanText);
        
        // Parse and validate the meal plan data
        const parsedData = parseMealPlanResponse(mealPlanText);
        
        // Validate the meal plan against user requirements
        const validationResult = validateMealPlanAgainstUserRequirements(parsedData, userData);
        
        if (!validationResult.isValid) {
          // If validation fails, throw an error to trigger a retry
          throw new Error(`Meal plan validation failed: ${validationResult.reason}`);
        }
        
        // If we get here, the meal plan is valid
        mealPlanData = parsedData;
        
      } catch (retryError) {
        console.error(`Attempt ${attempts} failed:`, retryError.message);
        lastError = retryError.message;
        
        // If this was the last attempt, throw the error
        if (attempts >= maxRetries) {
          throw new Error(`Failed to generate a valid meal plan after ${maxRetries} attempts: ${lastError}`);
        }
        
        // Wait before retrying (exponential backoff)
        const backoffMs = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
    
    // Generate a unique ID for the meal plan
    mealPlanData.mealPlanId = crypto.randomUUID();
    
    return mealPlanData;
  } catch (error) {
    console.error('Error generating meal plan:', error);
    throw error;
  }
}

/**
 * Validate a meal plan against user requirements
 * @param {Object} mealPlanData - The meal plan data
 * @param {Object} userData - The user data
 * @returns {Object} Validation result with isValid flag and reason if invalid
 */
function validateMealPlanAgainstUserRequirements(mealPlanData, userData) {
  const { metricsAndGoals, dietAndMealPreferences, calorieCalculations } = userData;
  
  // Check if all 15 meals are present
  if (!mealPlanData.meals || mealPlanData.meals.length < 15) {
    return {
      isValid: false,
      reason: `Incomplete meal plan: expected 15 meals, got ${mealPlanData.meals ? mealPlanData.meals.length : 0}`
    };
  }
  
  // Extract 5:2 split from the string format "weekdays:X weekends:Y" for pre-validation
  let weekdayCalories = 0;
  if (calorieCalculations.five_two_split) {
    const splitMatch = calorieCalculations.five_two_split.match(/weekdays:(\d+)/);
    if (splitMatch) {
      weekdayCalories = parseInt(splitMatch[1]);
    }
  }
  
  // Define minimum calorie requirements for each meal type
  if (weekdayCalories > 0) {
    const mealCalorieDistribution = {
      breakfast: { min: 0.25, target: 0.30, max: 0.35 },
      lunch: { min: 0.30, target: 0.35, max: 0.40 },
      dinner: { min: 0.30, target: 0.35, max: 0.40 }
    };
    
    // Pre-validation: Check each individual meal's calories
    for (const meal of mealPlanData.meals) {
      const mealType = meal.mealType;
      if (!mealType || !mealCalorieDistribution[mealType]) continue;
      
      // Calculate calories from macros
      const calories = (meal.protein || 0) * 4 + (meal.carbs || 0) * 4 + (meal.fat || 0) * 9;
      
      // Get target calories for this meal type
      const targetCalories = weekdayCalories * mealCalorieDistribution[mealType].target;
      const minMealCalories = weekdayCalories * mealCalorieDistribution[mealType].min * 0.75; // 75% of minimum (more lenient)
      
      // Check if meal has significantly too few calories
      if (calories < minMealCalories) {
        // Calculate minimum macros needed
        const minProtein = Math.round(targetCalories * 0.25 / 4); // 25% of calories from protein
        const minCarbs = Math.round(targetCalories * 0.4 / 4);    // 40% of calories from carbs
        const minFat = Math.round(targetCalories * 0.35 / 9);     // 35% of calories from fat
        
        // Analyze the meal to provide specific feedback
        let specificFeedback = "";
        
        // Check if protein is too low
        if (meal.protein < minProtein * 0.8) {
          specificFeedback += ` Increase protein (currently ${meal.protein}g, need ${minProtein}g).`;
        }
        
        // Check if fat is too low (common issue)
        if (meal.fat < minFat * 0.8) {
          specificFeedback += ` Increase fat (currently ${meal.fat}g, need ${minFat}g) by adding oils, nuts, or avocado.`;
        }
        
        // Check if carbs are too low
        if (meal.carbs < minCarbs * 0.8) {
          specificFeedback += ` Increase carbs (currently ${meal.carbs}g, need ${minCarbs}g).`;
        }
        
        // Check for common low-calorie substitutions
        if (meal.name.toLowerCase().includes("egg white")) {
          specificFeedback += " Replace egg whites with whole eggs for more calories.";
        }
        
        if (meal.name.toLowerCase().includes("skim") || meal.name.toLowerCase().includes("low-fat")) {
          specificFeedback += " Use full-fat dairy instead of low-fat options.";
        }
        
        return {
          isValid: false,
          reason: `Meal "${meal.name}" (Day ${meal.day} ${mealType}) has only ${Math.round(calories)} calories, which is below the minimum of ${Math.round(minMealCalories)} calories. This meal needs at least ${minProtein}g protein, ${minCarbs}g carbs, and ${minFat}g fat to meet calorie requirements.${specificFeedback}`
        };
      }
    }
  }
  
  // Check if all days and meal types are covered
  const mealMap = {};
  mealPlanData.meals.forEach(meal => {
    if (meal.day && meal.mealType) {
      const key = `${meal.day}_${meal.mealType}`;
      mealMap[key] = true;
    }
  });
  
  for (let day = 1; day <= 5; day++) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const key = `${day}_${mealType}`;
      if (!mealMap[key]) {
        return {
          isValid: false,
          reason: `Missing meal: Day ${day} ${mealType}`
        };
      }
    }
  }
  
  // Extract dietary restrictions for validation
  const dietaryRestrictions = Array.isArray(dietAndMealPreferences.dietary_restrictions) 
    ? dietAndMealPreferences.dietary_restrictions 
    : [dietAndMealPreferences.dietary_restrictions];
  
  // Check each meal for dietary restrictions
  for (const meal of mealPlanData.meals) {
    // Skip meals without ingredients
    if (!meal.ingredients || !Array.isArray(meal.ingredients) || meal.ingredients.length === 0) {
      continue;
    }
    
    // Check ingredients against dietary restrictions
    for (const ingredient of meal.ingredients) {
      for (const restriction of dietaryRestrictions) {
        if (restriction && typeof restriction === 'string') {
          const restrictionLower = restriction.toLowerCase();
          const ingredientNameLower = ingredient.name ? ingredient.name.toLowerCase() : '';
          
          // Simple check for common dietary restrictions
          if (restrictionLower.includes('vegan') && 
              (ingredientNameLower.includes('meat') || 
               ingredientNameLower.includes('chicken') || 
               ingredientNameLower.includes('beef') || 
               ingredientNameLower.includes('pork') || 
               ingredientNameLower.includes('fish') || 
               ingredientNameLower.includes('milk') || 
               ingredientNameLower.includes('cheese') || 
               ingredientNameLower.includes('egg'))) {
            return {
              isValid: false,
              reason: `Meal "${meal.name}" contains non-vegan ingredient "${ingredient.name}" despite vegan restriction`
            };
          }
          
          if (restrictionLower.includes('vegetarian') && 
              (ingredientNameLower.includes('meat') || 
               ingredientNameLower.includes('chicken') || 
               ingredientNameLower.includes('beef') || 
               ingredientNameLower.includes('pork') || 
               ingredientNameLower.includes('fish'))) {
            return {
              isValid: false,
              reason: `Meal "${meal.name}" contains non-vegetarian ingredient "${ingredient.name}" despite vegetarian restriction`
            };
          }
          
          if (restrictionLower.includes('gluten') && 
              (ingredientNameLower.includes('wheat') || 
               ingredientNameLower.includes('gluten') || 
               ingredientNameLower.includes('bread') || 
               ingredientNameLower.includes('pasta') || 
               ingredientNameLower.includes('flour'))) {
            return {
              isValid: false,
              reason: `Meal "${meal.name}" contains gluten ingredient "${ingredient.name}" despite gluten-free restriction`
            };
          }
          
          if (restrictionLower.includes('dairy') && 
              (ingredientNameLower.includes('milk') || 
               ingredientNameLower.includes('cheese') || 
               ingredientNameLower.includes('yogurt') || 
               ingredientNameLower.includes('butter') || 
               ingredientNameLower.includes('cream'))) {
            return {
              isValid: false,
              reason: `Meal "${meal.name}" contains dairy ingredient "${ingredient.name}" despite dairy-free restriction`
            };
          }
        }
      }
    }
  }
  
  // Check daily calorie totals (if we have calorie data)
  // We already have weekdayCalories from the pre-validation step, so we'll use that value
  if (weekdayCalories > 0) {
    // Group meals by day
    const mealsByDay = {};
    for (const meal of mealPlanData.meals) {
      if (!mealsByDay[meal.day]) {
        mealsByDay[meal.day] = [];
      }
      mealsByDay[meal.day].push(meal);
    }
    
    // Define suggested calorie distribution per meal type (as percentages of daily total)
    const mealCalorieDistribution = {
      breakfast: { min: 0.25, target: 0.30, max: 0.35 },
      lunch: { min: 0.30, target: 0.35, max: 0.40 },
      dinner: { min: 0.30, target: 0.35, max: 0.40 }
    };
    
    // Check each day's calorie total
    for (const day in mealsByDay) {
      const dailyMeals = mealsByDay[day];
      let dailyCalories = 0;
      const mealCalories = {};
      
      // Calculate calories for each meal
      for (const meal of dailyMeals) {
        // Calculate calories from macros (rough estimate: 4 cal/g protein, 4 cal/g carbs, 9 cal/g fat)
        const calories = (meal.protein || 0) * 4 + (meal.carbs || 0) * 4 + (meal.fat || 0) * 9;
        mealCalories[meal.mealType] = calories;
        dailyCalories += calories;
      }
      
      // Allow for a 30% margin of error (more flexible than before)
      const minAcceptable = weekdayCalories * 0.7;
      const maxAcceptable = weekdayCalories * 1.3;
      
      if (dailyCalories < minAcceptable || dailyCalories > maxAcceptable) {
        // Create a detailed error message with specific guidance
        const calorieAdjustment = dailyCalories < minAcceptable 
          ? `Add ${Math.round(minAcceptable - dailyCalories)} more calories` 
          : `Reduce by ${Math.round(dailyCalories - maxAcceptable)} calories`;
        
        // Check individual meals for imbalances
        const mealAnalysis = [];
        for (const mealType in mealCalorieDistribution) {
          const calories = mealCalories[mealType] || 0;
          const targetCalories = weekdayCalories * mealCalorieDistribution[mealType].target;
          const minMealCalories = weekdayCalories * mealCalorieDistribution[mealType].min;
          const maxMealCalories = weekdayCalories * mealCalorieDistribution[mealType].max;
          
          // If this meal is significantly off target, add it to the analysis
          if (calories < minMealCalories * 0.75 || calories > maxMealCalories * 1.3) {
            const adjustment = calories < minMealCalories * 0.7
              ? `increase by ~${Math.round(minMealCalories - calories)} calories`
              : `decrease by ~${Math.round(calories - maxMealCalories)} calories`;
            
            mealAnalysis.push(`${mealType}: ${calories} calories (target: ~${Math.round(targetCalories)}), ${adjustment}`);
          }
        }
        
        // Create a detailed error message
        let errorMessage = `Day ${day} calorie total (${Math.round(dailyCalories)}) is outside acceptable range (${Math.round(minAcceptable)}-${Math.round(maxAcceptable)}). ${calorieAdjustment}.`;
        
        // Add meal-specific guidance if available
        if (mealAnalysis.length > 0) {
          errorMessage += ` Meal adjustments needed: ${mealAnalysis.join('; ')}`;
        }
        
        return {
          isValid: false,
          reason: errorMessage
        };
      }
    }
  }
  
  // All checks passed
  return {
    isValid: true
  };
}

/**
 * Revise a meal plan based on user changes
 * @param {Object} existingMealPlan - The existing meal plan
 * @param {Array} changes - The requested changes
 * @param {Object} userData - User data from database
 * @returns {Promise<Object>} The revised meal plan
 */
async function reviseMealPlan(existingMealPlan, changes, userData) {
  try {
    console.log('Revising meal plan with changes:', changes);
    
    // Maximum number of retry attempts
    const maxRetries = 3;
    let attempts = 0;
    let revisedMealPlanData = null;
    let lastError = null;
    
    // Retry loop with incremental backoff
    while (attempts < maxRetries && !revisedMealPlanData) {
      try {
        attempts++;
        console.log(`Attempt ${attempts} of ${maxRetries} to revise meal plan`);
        
        // Adjust temperature based on retry attempt (lower temperature for more focused responses)
        const temperature = Math.max(0.3, 0.7 - (attempts - 1) * 0.2);
        
        // Create the prompt for GPT-4, adding feedback from previous attempts if available
        const prompt = createMealPlanRevisionPrompt(existingMealPlan, changes, userData, lastError);
        
        // Call GPT-4 to revise the meal plan with reduced token usage
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { 
              role: 'system', 
              content: `You are an expert nutritionist who revises meal plans based on user feedback.

CRITICAL REQUIREMENTS:
1. ONLY modify the specific meals requested by the user
2. Ensure meals meet calorie and macro targets
3. Strictly follow dietary restrictions
4. Return PURE JSON only - no comments, explanations, or extra text
5. Calculate calories accurately: protein × 4 + carbs × 4 + fat × 9`
            },
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: 2000
        });
        
        // Parse the response
        const revisedMealPlanText = response.choices[0].message.content;
        console.log(`Attempt ${attempts} revised meal plan text:`, revisedMealPlanText);
        
        // Parse the partial meal plan data
        const partialMealPlanData = parseMealPlanResponse(revisedMealPlanText);
        
        // Convert the existing meal plan to a structured format
        const fullMealPlanData = convertDatabaseMealPlanToStructured(existingMealPlan);
        
        // Create a map of the existing meals for easy lookup
        const existingMealsMap = {};
        fullMealPlanData.meals.forEach(meal => {
          const key = `${meal.day}_${meal.mealType}`;
          existingMealsMap[key] = meal;
        });
        
        // Merge the partial meal plan with the existing meal plan
        // Replace only the meals that were changed
        const mergedMeals = [...fullMealPlanData.meals];
        
        // For each meal in the partial meal plan, find and replace the corresponding meal in the merged meals
        partialMealPlanData.meals.forEach(partialMeal => {
          const key = `${partialMeal.day}_${partialMeal.mealType}`;
          const index = mergedMeals.findIndex(meal => 
            meal.day === partialMeal.day && meal.mealType === partialMeal.mealType
          );
          
          if (index !== -1) {
            // Replace the existing meal with the revised meal
            mergedMeals[index] = partialMeal;
          } else {
            // If the meal doesn't exist in the merged meals, add it
            mergedMeals.push(partialMeal);
          }
        });
        
        // Create the complete revised meal plan
        const completeMealPlanData = {
          meals: mergedMeals,
          snacks: fullMealPlanData.snacks,
          favoriteMeals: fullMealPlanData.favoriteMeals
        };
        
        // Validate only the days that were changed
        const daysToValidate = new Set(changes.map(change => parseInt(change.day)));
        const validationResult = validateChangedDays(completeMealPlanData, userData, daysToValidate);
        
        if (!validationResult.isValid) {
          // If validation fails, throw an error to trigger a retry
          throw new Error(`Revised meal plan validation failed: ${validationResult.reason}`);
        }
        
        // If we get here, the meal plan is valid
        revisedMealPlanData = completeMealPlanData;
        
      } catch (retryError) {
        console.error(`Attempt ${attempts} failed:`, retryError.message);
        lastError = retryError.message;
        
        // If this was the last attempt, throw the error
        if (attempts >= maxRetries) {
          throw new Error(`Failed to generate a valid revised meal plan after ${maxRetries} attempts: ${lastError}`);
        }
        
        // Wait before retrying (exponential backoff)
        const backoffMs = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
    
    // Keep the same meal plan ID
    revisedMealPlanData.mealPlanId = existingMealPlan.meal_plan_id;
    
    return revisedMealPlanData;
  } catch (error) {
    console.error('Error revising meal plan:', error);
    throw error;
  }
}

/**
 * Create a prompt for meal plan generation
 * @param {Object} userData - User data from database
 * @param {string} lastError - Error from previous attempt, if any
 * @returns {string} The prompt for GPT-4
 */
function createMealPlanPrompt(userData, lastError = null) {
  const { user, metricsAndGoals, dietAndMealPreferences, calorieCalculations } = userData;
  
  // Extract 5:2 split from the string format "weekdays:X weekends:Y"
  let weekdayCalories = 0;
  let weekendCalories = 0;
  
  if (calorieCalculations.five_two_split) {
    const splitMatch = calorieCalculations.five_two_split.match(/weekdays:(\d+) weekends:(\d+)/);
    if (splitMatch) {
      weekdayCalories = parseInt(splitMatch[1]);
      weekendCalories = parseInt(splitMatch[2]);
    }
  }
  
  // Parse macronutrient split
  let macroSplit = {};
  if (calorieCalculations.macronutrient_split) {
    if (typeof calorieCalculations.macronutrient_split === 'string') {
      try {
        macroSplit = JSON.parse(calorieCalculations.macronutrient_split);
      } catch (e) {
        macroSplit = { type: calorieCalculations.macronutrient_split };
      }
    } else {
      macroSplit = calorieCalculations.macronutrient_split;
    }
  }
  
  // Get the macronutrient split as a string (e.g., "35/35/30")
  const macroSplitStr = macroSplit.type || '35/35/30';
  
  // Parse the macronutrient split into protein/carbs/fat percentages
  const macroPercentages = macroSplitStr.split('/').map(num => parseInt(num));
  const proteinPercent = macroPercentages[0] || 35;
  const carbsPercent = macroPercentages[1] || 35;
  const fatPercent = macroPercentages[2] || 30;
  
  // Calculate target macros for a day
  const proteinGrams = Math.round((weekdayCalories * (proteinPercent / 100)) / 4); // 4 calories per gram of protein
  const carbsGrams = Math.round((weekdayCalories * (carbsPercent / 100)) / 4);     // 4 calories per gram of carbs
  const fatGrams = Math.round((weekdayCalories * (fatPercent / 100)) / 9);         // 9 calories per gram of fat
  
  // Calculate minimum macros for each meal type
  const breakfastMinCalories = Math.round(weekdayCalories * 0.25);
  const lunchMinCalories = Math.round(weekdayCalories * 0.3);
  const dinnerMinCalories = Math.round(weekdayCalories * 0.3);
  
  const breakfastMinProtein = Math.round((breakfastMinCalories * (proteinPercent / 100)) / 4);
  const breakfastMinCarbs = Math.round((breakfastMinCalories * (carbsPercent / 100)) / 4);
  const breakfastMinFat = Math.round((breakfastMinCalories * (fatPercent / 100)) / 9);
  
  const lunchMinProtein = Math.round((lunchMinCalories * (proteinPercent / 100)) / 4);
  const lunchMinCarbs = Math.round((lunchMinCalories * (carbsPercent / 100)) / 4);
  const lunchMinFat = Math.round((lunchMinCalories * (fatPercent / 100)) / 9);
  
  const dinnerMinProtein = Math.round((dinnerMinCalories * (proteinPercent / 100)) / 4);
  const dinnerMinCarbs = Math.round((dinnerMinCalories * (carbsPercent / 100)) / 4);
  const dinnerMinFat = Math.round((dinnerMinCalories * (fatPercent / 100)) / 9);
  
  // Extract dietary restrictions and preferences
  const dietaryRestrictions = Array.isArray(dietAndMealPreferences.dietary_restrictions) 
    ? dietAndMealPreferences.dietary_restrictions 
    : [dietAndMealPreferences.dietary_restrictions];
  
  const dietaryPreferences = Array.isArray(dietAndMealPreferences.dietary_preferences) 
    ? dietAndMealPreferences.dietary_preferences 
    : [dietAndMealPreferences.dietary_preferences];
  
  // Create the prompt
  let prompt = `
I need you to create a COMPLETE and PERSONALIZED 5-day meal plan (Monday through Friday) for a real user with specific dietary needs and goals.

USER PROFILE (IMPORTANT - PERSONALIZE FOR THIS USER):
- Health/Fitness Goal: ${metricsAndGoals.health_fitness_goal}
- Dietary Restrictions: ${JSON.stringify(dietaryRestrictions)}
- Dietary Preferences: ${JSON.stringify(dietaryPreferences)}
- Portions for: ${dietAndMealPreferences.meal_portion_people_count} people (${dietAndMealPreferences.meal_portion_details || 'standard portions'})

⚠️ CRITICAL CALORIE REQUIREMENTS (HIGHEST PRIORITY) ⚠️
1. EVERY SINGLE MEAL MUST MEET OR EXCEED its MINIMUM calorie requirement - this is your #1 priority
2. NEVER create a meal below the minimum calorie threshold specified for each meal type
3. ALWAYS verify each meal's calories by calculating: protein × 4 + carbs × 4 + fat × 9
4. If a meal is below the minimum calories, INCREASE portion sizes or add calorie-dense ingredients

NUTRITIONAL TARGETS (MUST BE FOLLOWED PRECISELY):
- Weekly Calorie Target: ${calorieCalculations.weekly_calorie_intake} calories
- Weekday Calories: ${weekdayCalories} calories per day
- Weekend Calories: ${weekendCalories} calories per day
- Macronutrient Split: ${macroSplitStr} (protein/carbs/fat)
- Daily Protein Target: ~${proteinGrams}g
- Daily Carbs Target: ~${carbsGrams}g
- Daily Fat Target: ~${fatGrams}g

CALORIE DISTRIBUTION PER MEAL (CRITICAL - FOLLOW EXACTLY):
- Breakfast: ${Math.round(weekdayCalories * 0.3)} calories (ABSOLUTE MINIMUM: ${breakfastMinCalories}, MAXIMUM: ${Math.round(weekdayCalories * 0.35)})
  * MINIMUM MACROS: ${breakfastMinProtein}g protein, ${breakfastMinCarbs}g carbs, ${breakfastMinFat}g fat
- Lunch: ${Math.round(weekdayCalories * 0.35)} calories (ABSOLUTE MINIMUM: ${lunchMinCalories}, MAXIMUM: ${Math.round(weekdayCalories * 0.4)})
  * MINIMUM MACROS: ${lunchMinProtein}g protein, ${lunchMinCarbs}g carbs, ${lunchMinFat}g fat
- Dinner: ${Math.round(weekdayCalories * 0.35)} calories (ABSOLUTE MINIMUM: ${dinnerMinCalories}, MAXIMUM: ${Math.round(weekdayCalories * 0.4)})
  * MINIMUM MACROS: ${dinnerMinProtein}g protein, ${dinnerMinCarbs}g carbs, ${dinnerMinFat}g fat
- Daily Total: ${weekdayCalories} calories (acceptable range: ${Math.round(weekdayCalories * 0.7)}-${Math.round(weekdayCalories * 1.3)} calories)

MEAL PORTION GUIDELINES TO ENSURE ADEQUATE CALORIES:
- Protein: 6-8oz (170-225g) portions minimum (NOT 3-4oz which is too small)
- Oils/Fats: 1-2 tbsp (15-30ml) per meal minimum
- Nuts/Seeds: 1-2oz (30-60g) portions when used
- Avocado: Use 1/2 to whole avocado, not just a few slices
- Starches: 1-1.5 cups cooked minimum (rice, pasta, potatoes)
- Dairy: Use full-fat versions, never low-fat or skim options

CALORIE CALCULATION EXAMPLE:
For a ${weekdayCalories} calorie day:
- Breakfast (30%): ${Math.round(weekdayCalories * 0.3)} calories = ~${Math.round((weekdayCalories * 0.3 * proteinPercent) / 400)} g protein, ~${Math.round((weekdayCalories * 0.3 * carbsPercent) / 400)} g carbs, ~${Math.round((weekdayCalories * 0.3 * fatPercent) / 900)} g fat
- Lunch (35%): ${Math.round(weekdayCalories * 0.35)} calories = ~${Math.round((weekdayCalories * 0.35 * proteinPercent) / 400)} g protein, ~${Math.round((weekdayCalories * 0.35 * carbsPercent) / 400)} g carbs, ~${Math.round((weekdayCalories * 0.35 * fatPercent) / 900)} g fat
- Dinner (35%): ${Math.round(weekdayCalories * 0.35)} calories = ~${Math.round((weekdayCalories * 0.35 * proteinPercent) / 400)} g protein, ~${Math.round((weekdayCalories * 0.35 * carbsPercent) / 400)} g carbs, ~${Math.round((weekdayCalories * 0.35 * fatPercent) / 900)} g fat
- TOTAL: ${weekdayCalories} calories = ${proteinGrams}g protein, ${carbsGrams}g carbs, ${fatGrams}g fat

EXAMPLE HIGH-CALORIE MEALS:

1. High-Calorie Breakfast Examples (${Math.round(weekdayCalories * 0.3)} calories):
   - Protein Oatmeal with Nuts and Berries
     * Ingredients: 1 cup rolled oats (300 cal), 1 scoop protein powder (120 cal), 1 tbsp honey (60 cal), 1 oz almonds (160 cal), 1/2 cup berries (40 cal), 1 tbsp peanut butter (90 cal)
     * Macros: 30g protein, 65g carbs, 20g fat = 560 calories
   
   - Greek Yogurt Power Bowl
     * Ingredients: 1.5 cups full-fat Greek yogurt (300 cal), 1/2 cup granola (200 cal), 1 tbsp honey (60 cal), 2 tbsp mixed nuts (120 cal), 1 tbsp chia seeds (60 cal)
     * Macros: 30g protein, 60g carbs, 25g fat = 565 calories

2. High-Calorie Lunch Examples (${Math.round(weekdayCalories * 0.35)} calories):
   - Grilled Chicken Quinoa Bowl
     * Ingredients: 8 oz grilled chicken (240 cal), 1.5 cups cooked quinoa (330 cal), 2 tbsp olive oil (240 cal), 1/2 avocado (120 cal), 1 cup mixed vegetables (50 cal), 2 tbsp vinaigrette (120 cal)
     * Macros: 50g protein, 80g carbs, 40g fat = 840 calories
   
   - Tuna Salad Sandwich with Sweet Potato Fries
     * Ingredients: 6 oz tuna (180 cal), 3 tbsp mayo (300 cal), 2 slices whole grain bread (200 cal), 1 medium sweet potato as fries (150 cal), 1 tbsp olive oil (120 cal)
     * Macros: 45g protein, 70g carbs, 35g fat = 770 calories

3. High-Calorie Dinner Examples (${Math.round(weekdayCalories * 0.35)} calories):
   - Salmon with Sweet Potato and Broccoli
     * Ingredients: 8 oz salmon (320 cal), 1 large sweet potato (200 cal), 2 cups broccoli (60 cal), 3 tbsp olive oil (360 cal), herbs and spices (10 cal)
     * Macros: 48g protein, 55g carbs, 50g fat = 850 calories
   
   - Beef Stir Fry with Rice
     * Ingredients: 8 oz beef (400 cal), 1.5 cups cooked rice (300 cal), 2 tbsp sesame oil (240 cal), 2 cups mixed vegetables (100 cal), 2 tbsp sauce (60 cal)
     * Macros: 50g protein, 90g carbs, 45g fat = 830 calories

${dietAndMealPreferences.include_snacks ? `
SNACK EXAMPLES:
1. Apple with Almond Butter: 1 medium apple (95 cal) + 2 tbsp almond butter (180 cal) = 275 calories
2. Protein Bar: 1 protein bar (200-250 calories)
3. Trail Mix: 1/3 cup mixed nuts and dried fruit (300 calories)
4. Protein Shake: 1 scoop protein powder (120 cal) + 1 cup whole milk (150 cal) + 1 banana (105 cal) = 375 calories
` : ''}

${dietAndMealPreferences.include_favorite_meals ? `
FAVORITE MEALS TO INCLUDE:
- ${dietAndMealPreferences.favorite_meal_1 || 'User choice'}: Include this as one of the meals in the plan
- ${dietAndMealPreferences.favorite_meal_2 || 'User choice'}: Include this as one of the meals in the plan
` : ''}

REQUIRED STRUCTURE:
You MUST provide ALL of the following meals (15 total meals):
- Day 1 (Monday): Breakfast, Lunch, Dinner
- Day 2 (Tuesday): Breakfast, Lunch, Dinner
- Day 3 (Wednesday): Breakfast, Lunch, Dinner
- Day 4 (Thursday): Breakfast, Lunch, Dinner
- Day 5 (Friday): Breakfast, Lunch, Dinner

For each meal (breakfast, lunch, dinner) for each day, provide:
1. Meal name
2. Brief description (1-2 sentences)
3. Ingredients with quantities
4. Recipe instructions (step by step)
5. Macro breakdown (protein, carbs, fat in grams)

FORMAT YOUR RESPONSE AS A VALID JSON OBJECT:
{
  "meals": [
    {
      "day": 1,
      "mealType": "breakfast",
      "name": "Meal Name",
      "description": "Brief description",
      "ingredients": [
        {"name": "Ingredient 1", "quantity": 1, "unit": "cup"},
        {"name": "Ingredient 2", "quantity": 2, "unit": "tbsp"}
      ],
      "recipe": "Step-by-step instructions",
      "protein": 20,
      "carbs": 30,
      "fat": 10
    },
    // IMPORTANT: You must include ALL 15 meals (3 meals for each of the 5 days)
  ],
  "snacks": [
    {
      "name": "Snack Name",
      "protein": 5,
      "carbs": 10,
      "fat": 2
    }
  ],
  "favoriteMeals": [
    {
      "name": "Favorite Meal Name",
      "protein": 25,
      "carbs": 35,
      "fat": 15
    }
  ]
}

CRITICAL REQUIREMENTS:
1. You MUST include ALL 15 meals (breakfast, lunch, dinner for all 5 days)
2. Each meal MUST meet or exceed its MINIMUM calorie requirement
3. Each day's meals MUST add up to approximately ${weekdayCalories} calories
4. The macronutrient ratios MUST match the specified split of ${macroSplitStr}
5. All dietary restrictions MUST be strictly followed
6. Dietary preferences MUST be incorporated where possible
7. Recipes MUST be practical and easy to follow
8. Ingredients MUST be common and accessible
9. Portion sizes MUST be appropriate for ${dietAndMealPreferences.meal_portion_people_count} people
10. Your response MUST be valid JSON that can be parsed

IMPORTANT: Your response must be PURE JSON only - no comments, no explanations, no extra text.`;

  // If there was an error in a previous attempt, add it to the prompt
  if (lastError) {
    prompt += `\n\nPREVIOUS ERROR (MUST BE FIXED):
The previous attempt failed with the following error: "${lastError}"
Please ensure your response addresses this issue.`;
  }
  
  return prompt;
}

/**
 * Create a prompt for meal plan revision
 * @param {Object} existingMealPlan - The existing meal plan
 * @param {Array} changes - The requested changes
 * @param {Object} userData - User data from database
 * @param {string} lastError - Error from previous attempt, if any
 * @returns {string} The prompt for GPT-4
 */
function createMealPlanRevisionPrompt(existingMealPlan, changes, userData, lastError = null) {
  // Convert the existing meal plan to a structured format
  const fullMealPlanData = convertDatabaseMealPlanToStructured(existingMealPlan);
  
  // Extract user data for context
  const { metricsAndGoals, dietAndMealPreferences, calorieCalculations } = userData;
  
  // Extract dietary restrictions for context
  const dietaryRestrictions = Array.isArray(dietAndMealPreferences.dietary_restrictions) 
    ? dietAndMealPreferences.dietary_restrictions 
    : [dietAndMealPreferences.dietary_restrictions];
    
  // Extract calorie information
  let weekdayCalories = 0;
  if (calorieCalculations && calorieCalculations.five_two_split) {
    const splitMatch = calorieCalculations.five_two_split.match(/weekdays:(\d+)/);
    if (splitMatch) {
      weekdayCalories = parseInt(splitMatch[1]);
    }
  }
  
  // Create a token-optimized version of the meal plan data
  // Only include the meals that need to be changed and other meals from the same days
  const daysToInclude = new Set(changes.map(change => parseInt(change.day)));
  const mealsToChange = new Set(changes.map(change => `${change.day}_${change.mealType}`));
  
  // Create a simplified meal plan with only the necessary information
  const optimizedMealPlanData = {
    meals: fullMealPlanData.meals.filter(meal => {
      // Include the meal if it's on a day that has changes
      return daysToInclude.has(parseInt(meal.day));
    }).map(meal => {
      const mealKey = `${meal.day}_${meal.mealType}`;
      // If this is a meal being changed, include full details
      // Otherwise, include only basic information to save tokens
      if (mealsToChange.has(mealKey)) {
        return meal;
      } else {
        // For unchanged meals, include only essential information
        return {
          day: meal.day,
          mealType: meal.mealType,
          name: meal.name,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat
        };
      }
    }),
    // Include minimal snack and favorite meal information
    snacks: fullMealPlanData.snacks.map(snack => ({
      name: snack.name,
      protein: snack.protein,
      carbs: snack.carbs,
      fat: snack.fat
    })),
    favoriteMeals: fullMealPlanData.favoriteMeals.map(meal => ({
      name: meal.name
    }))
  };
  
  // Create the prompt
  let prompt = `
I need you to revise specific meals in an existing meal plan. Here are the meals from the affected days:

${JSON.stringify(optimizedMealPlanData, null, 2)}

The user has requested the following changes:

${changes.map((change, index) => `
Change ${index + 1}:
- Day: ${change.day}
- Meal: ${change.mealType}
- Requested Change: ${change.description}
`).join('\n')}

USER PROFILE:
- Health/Fitness Goal: ${metricsAndGoals.health_fitness_goal}
- Dietary Restrictions: ${JSON.stringify(dietaryRestrictions)}
- Portions for: ${dietAndMealPreferences.meal_portion_people_count} people

NUTRITIONAL TARGETS:
${calorieCalculations && calorieCalculations.five_two_split ? `
- Weekday Calories: ${weekdayCalories} calories per day
- Breakfast: ~${Math.round(weekdayCalories * 0.3)} calories
- Lunch: ~${Math.round(weekdayCalories * 0.35)} calories
- Dinner: ~${Math.round(weekdayCalories * 0.35)} calories
` : ''}

INSTRUCTIONS:
1. ONLY modify the meals specified in the change requests
2. Keep all other meals exactly as they are
3. Ensure the revised meals meet nutritional requirements
4. Maintain daily calorie targets for affected days
5. Adhere to dietary restrictions

RESPONSE FORMAT:
Return a JSON object containing ONLY the meals from the days that have changes. Include all three meals for each affected day, even if only one meal is being changed.

Example response format:
{
  "meals": [
    {"day": 2, "mealType": "breakfast", "name": "...", "description": "...", "ingredients": [...], "recipe": "...", "protein": 30, "carbs": 40, "fat": 15},
    {"day": 2, "mealType": "lunch", "name": "...", "description": "...", "ingredients": [...], "recipe": "...", "protein": 35, "carbs": 45, "fat": 20},
    {"day": 2, "mealType": "dinner", "name": "...", "description": "...", "ingredients": [...], "recipe": "...", "protein": 40, "carbs": 35, "fat": 25}
  ]
}

IMPORTANT: Your response must be valid JSON that can be parsed. Do not include any text outside the JSON object.`;

  // If there was an error in a previous attempt, add it to the prompt
  if (lastError) {
    prompt += `\n\nPREVIOUS ERROR (MUST BE FIXED):
The previous attempt failed with the following error: "${lastError}"
Please ensure your response addresses this issue.`;
  }
  
  return prompt;
}

/**
 * Parse the meal plan response from GPT-4
 * @param {string} responseText - The response text from GPT-4
 * @returns {Object} The parsed meal plan data
 */
function parseMealPlanResponse(responseText) {
  try {
    // Extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in the response');
    }
    
    const jsonStr = jsonMatch[0];
    const mealPlanData = JSON.parse(jsonStr);
    
    // Validate the meal plan data
    if (!mealPlanData.meals || !Array.isArray(mealPlanData.meals)) {
      throw new Error('Invalid meal plan data: missing meals array');
    }
    
    return mealPlanData;
  } catch (error) {
    console.error('Error parsing meal plan response:', error);
    throw new Error(`Failed to parse meal plan response: ${error.message}`);
  }
}

/**
 * Convert a database meal plan to a structured format
 * @param {Object} dbMealPlan - The meal plan from the database
 * @returns {Object} The structured meal plan
 */
function convertDatabaseMealPlanToStructured(existingMealPlan) {
  const mealPlanData = {
    meals: [],
    snacks: [],
    favoriteMeals: []
  };
  
  // Create a template for an empty meal
  const createEmptyMeal = (day, mealType) => ({
    day,
    mealType,
    name: `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} for Day ${day}`,
    description: "No meal data available",
    ingredients: [],
    recipe: "No recipe available",
    protein: 0,
    carbs: 0,
    fat: 0
  });
  
  // Process meals for each day
  for (let day = 1; day <= 5; day++) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const nameKey = `${mealType}_${day}_name`;
      const descriptionKey = `${mealType}_${day}_description`;
      const ingredientsKey = `${mealType}_${day}_ingredients`;
      const recipeKey = `${mealType}_${day}_recipe`;
      const proteinKey = `${mealType}_${day}_protein`;
      const carbsKey = `${mealType}_${day}_carbs`;
      const fatKey = `${mealType}_${day}_fat`;
      
      if (existingMealPlan[nameKey]) {
        mealPlanData.meals.push({
          day,
          mealType,
          name: existingMealPlan[nameKey],
          description: existingMealPlan[descriptionKey] || '',
          ingredients: existingMealPlan[ingredientsKey] || [],
          recipe: existingMealPlan[recipeKey] || '',
          protein: existingMealPlan[proteinKey] || 0,
          carbs: existingMealPlan[carbsKey] || 0,
          fat: existingMealPlan[fatKey] || 0
        });
      } else {
        // This meal is missing, create an empty one
        console.warn(`Missing meal in database: Day ${day} ${mealType}`);
        mealPlanData.meals.push(createEmptyMeal(day, mealType));
      }
    }
  }
  
  // Process snacks
  for (let i = 1; i <= 2; i++) {
    const nameKey = `snack_${i}_name`;
    const proteinKey = `snack_${i}_protein`;
    const carbsKey = `snack_${i}_carbs`;
    const fatKey = `snack_${i}_fat`;
    
    if (existingMealPlan[nameKey]) {
      mealPlanData.snacks.push({
        name: existingMealPlan[nameKey],
        protein: existingMealPlan[proteinKey] || 0,
        carbs: existingMealPlan[carbsKey] || 0,
        fat: existingMealPlan[fatKey] || 0
      });
    }
  }
  
  // Process favorite meals
  for (let i = 1; i <= 2; i++) {
    const nameKey = `favorite_meal_${i}_name`;
    const proteinKey = `favorite_meal_${i}_protein`;
    const carbsKey = `favorite_meal_${i}_carbs`;
    const fatKey = `favorite_meal_${i}_fat`;
    
    if (existingMealPlan[nameKey]) {
      mealPlanData.favoriteMeals.push({
        name: existingMealPlan[nameKey],
        protein: existingMealPlan[proteinKey] || 0,
        carbs: existingMealPlan[carbsKey] || 0,
        fat: existingMealPlan[fatKey] || 0
      });
    }
  }
  
  return mealPlanData;
}

/**
 * Validate only the days that were changed in a meal plan
 * @param {Object} mealPlanData - The complete meal plan data
 * @param {Object} userData - The user data
 * @param {Set} daysToValidate - Set of day numbers to validate
 * @returns {Object} Validation result with isValid flag and reason if invalid
 */
function validateChangedDays(mealPlanData, userData, daysToValidate) {
  const { metricsAndGoals, dietAndMealPreferences, calorieCalculations } = userData;
  
  // Extract 5:2 split from the string format "weekdays:X weekends:Y" for validation
  let weekdayCalories = 0;
  if (calorieCalculations.five_two_split) {
    const splitMatch = calorieCalculations.five_two_split.match(/weekdays:(\d+)/);
    if (splitMatch) {
      weekdayCalories = parseInt(splitMatch[1]);
    }
  }
  
  // Define calorie distribution per meal type
  const mealCalorieDistribution = {
    breakfast: { min: 0.25, target: 0.30, max: 0.35 },
    lunch: { min: 0.30, target: 0.35, max: 0.40 },
    dinner: { min: 0.30, target: 0.35, max: 0.40 }
  };
  
  // Extract dietary restrictions for validation
  const dietaryRestrictions = Array.isArray(dietAndMealPreferences.dietary_restrictions) 
    ? dietAndMealPreferences.dietary_restrictions 
    : [dietAndMealPreferences.dietary_restrictions];
  
  // Group meals by day
  const mealsByDay = {};
  for (const meal of mealPlanData.meals) {
    const day = parseInt(meal.day);
    
    // Only validate the days that were changed
    if (!daysToValidate.has(day)) {
      continue;
    }
    
    if (!mealsByDay[day]) {
      mealsByDay[day] = [];
    }
    mealsByDay[day].push(meal);
  }
  
  // Check each changed day
  for (const day of daysToValidate) {
    const dayMeals = mealsByDay[day] || [];
    
    // Check if all meal types are present for this day
    const mealTypes = new Set(dayMeals.map(meal => meal.mealType));
    if (mealTypes.size < 3 || !mealTypes.has('breakfast') || !mealTypes.has('lunch') || !mealTypes.has('dinner')) {
      return {
        isValid: false,
        reason: `Day ${day} is missing one or more meals. All days must have breakfast, lunch, and dinner.`
      };
    }
    
    // Check each meal for dietary restrictions
    for (const meal of dayMeals) {
      // Skip meals without ingredients
      if (!meal.ingredients || !Array.isArray(meal.ingredients) || meal.ingredients.length === 0) {
        continue;
      }
      
      // Check ingredients against dietary restrictions
      for (const ingredient of meal.ingredients) {
        for (const restriction of dietaryRestrictions) {
          if (restriction && typeof restriction === 'string') {
            const restrictionLower = restriction.toLowerCase();
            const ingredientNameLower = ingredient.name ? ingredient.name.toLowerCase() : '';
            
            // Simple check for common dietary restrictions
            if (restrictionLower.includes('vegan') && 
                (ingredientNameLower.includes('meat') || 
                 ingredientNameLower.includes('chicken') || 
                 ingredientNameLower.includes('beef') || 
                 ingredientNameLower.includes('pork') || 
                 ingredientNameLower.includes('fish') || 
                 ingredientNameLower.includes('milk') || 
                 ingredientNameLower.includes('cheese') || 
                 ingredientNameLower.includes('egg'))) {
              return {
                isValid: false,
                reason: `Meal "${meal.name}" contains non-vegan ingredient "${ingredient.name}" despite vegan restriction`
              };
            }
            
            if (restrictionLower.includes('vegetarian') && 
                (ingredientNameLower.includes('meat') || 
                 ingredientNameLower.includes('chicken') || 
                 ingredientNameLower.includes('beef') || 
                 ingredientNameLower.includes('pork') || 
                 ingredientNameLower.includes('fish'))) {
              return {
                isValid: false,
                reason: `Meal "${meal.name}" contains non-vegetarian ingredient "${ingredient.name}" despite vegetarian restriction`
              };
            }
            
            if (restrictionLower.includes('gluten') && 
                (ingredientNameLower.includes('wheat') || 
                 ingredientNameLower.includes('gluten') || 
                 ingredientNameLower.includes('bread') || 
                 ingredientNameLower.includes('pasta') || 
                 ingredientNameLower.includes('flour'))) {
              return {
                isValid: false,
                reason: `Meal "${meal.name}" contains gluten ingredient "${ingredient.name}" despite gluten-free restriction`
              };
            }
            
            if (restrictionLower.includes('dairy') && 
                (ingredientNameLower.includes('milk') || 
                 ingredientNameLower.includes('cheese') || 
                 ingredientNameLower.includes('yogurt') || 
                 ingredientNameLower.includes('butter') || 
                 ingredientNameLower.includes('cream'))) {
              return {
                isValid: false,
                reason: `Meal "${meal.name}" contains dairy ingredient "${ingredient.name}" despite dairy-free restriction`
              };
            }
          }
        }
      }
    }
    
    // Check daily calorie totals (if we have calorie data)
    if (weekdayCalories > 0) {
      let dailyCalories = 0;
      const mealCalories = {};
      
      // Calculate calories for each meal
      for (const meal of dayMeals) {
        // Calculate calories from macros (rough estimate: 4 cal/g protein, 4 cal/g carbs, 9 cal/g fat)
        const calories = (meal.protein || 0) * 4 + (meal.carbs || 0) * 4 + (meal.fat || 0) * 9;
        mealCalories[meal.mealType] = calories;
        dailyCalories += calories;
      }
      
      // Allow for a 30% margin of error (more flexible than before)
      const minAcceptable = weekdayCalories * 0.7;
      const maxAcceptable = weekdayCalories * 1.3;
      
      if (dailyCalories < minAcceptable || dailyCalories > maxAcceptable) {
        // Create a detailed error message with specific guidance
        const calorieAdjustment = dailyCalories < minAcceptable 
          ? `Add ${Math.round(minAcceptable - dailyCalories)} more calories` 
          : `Reduce by ${Math.round(dailyCalories - maxAcceptable)} calories`;
        
        // Check individual meals for imbalances
        const mealAnalysis = [];
        for (const mealType in mealCalorieDistribution) {
          const calories = mealCalories[mealType] || 0;
          const targetCalories = weekdayCalories * mealCalorieDistribution[mealType].target;
          const minMealCalories = weekdayCalories * mealCalorieDistribution[mealType].min;
          const maxMealCalories = weekdayCalories * mealCalorieDistribution[mealType].max;
          
          // If this meal is significantly off target, add it to the analysis
          if (calories < minMealCalories * 0.7 || calories > maxMealCalories * 1.3) {
            const adjustment = calories < minMealCalories * 0.7
              ? `increase by ~${Math.round(minMealCalories - calories)} calories`
              : `decrease by ~${Math.round(calories - maxMealCalories)} calories`;
            
            mealAnalysis.push(`${mealType}: ${calories} calories (target: ~${Math.round(targetCalories)}), ${adjustment}`);
          }
        }
        
        // Create a detailed error message
        let errorMessage = `Day ${day} calorie total (${Math.round(dailyCalories)}) is outside acceptable range (${Math.round(minAcceptable)}-${Math.round(maxAcceptable)}). ${calorieAdjustment}.`;
        
        // Add meal-specific guidance if available
        if (mealAnalysis.length > 0) {
          errorMessage += ` Meal adjustments needed: ${mealAnalysis.join('; ')}`;
        }
        
        return {
          isValid: false,
          reason: errorMessage
        };
      }
    }
  }
  
  // All checks passed
  return {
    isValid: true
  };
}

// Export the functions
module.exports = {
  generateMealPlan,
  reviseMealPlan,
  parseMealPlanResponse,
  convertDatabaseMealPlanToStructured,
  validateChangedDays
};
