/**
 * OpenAI Meal Plan Generator for Lifestyle Blueprint
 * 
 * This module handles the generation of meal plans using OpenAI's GPT-4 model.
 * Implements day-by-day generation with macro validation and similarity checking.
 */

require('dotenv').config();
const { OpenAI } = require('openai');
const crypto = require('crypto');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Emit a progress event for the meal plan generation process
 * @param {Object} progressData - The progress data to emit
 */
function emitProgressEvent(progressData) {
  // In a real implementation, this would emit an event to the client
  // For now, we'll just log it to the console
  console.log('Meal Plan Progress:', progressData);
  
  // If we're running in a server context, we could use WebSockets or SSE
  // to send progress updates to the client
  if (global.io) {
    global.io.emit('meal-plan-progress', progressData);
  }
}

/**
 * MacroValidator class for validating meal plan macronutrients
 * Ensures meals meet calorie and macro targets with adaptive tolerances
 */
class MacroValidator {
  constructor(userData) {
    this.baseTolerances = {
      calories: 0.20,  // ±20%
      protein: 0.20,   // ±20%
      carbs: 0.20,     // ±20%
      fat: 0.20        // ±20%
    };
    
    // Extract calorie data
    const { calorieCalculations } = userData;
    
    // Parse the 5:2 split
    let weekdayCalories = 0;
    if (calorieCalculations.five_two_split) {
      const splitMatch = calorieCalculations.five_two_split.match(/weekdays:(\d+)/);
      if (splitMatch) {
        weekdayCalories = parseInt(splitMatch[1]);
      }
    }
    this.weekdayCalories = weekdayCalories;
    
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
    this.macroTargets = {
      calories: weekdayCalories,
      protein: Math.round((weekdayCalories * (proteinPercent / 100)) / 4), // 4 calories per gram of protein
      carbs: Math.round((weekdayCalories * (carbsPercent / 100)) / 4),     // 4 calories per gram of carbs
      fat: Math.round((weekdayCalories * (fatPercent / 100)) / 9)          // 9 calories per gram of fat
    };
    
    // Adjust tolerances based on total calories
    this.adjustTolerances(calorieCalculations.weekly_calorie_intake);
  }
  
  adjustTolerances(weeklyCalories) {
    // Higher calorie plans can have slightly more flexibility
    const calorieAdjustment = Math.min(
      ((weeklyCalories / 7) / 2000) * 0.02, // Base on 2000/day
      0.05 // Max 5% additional tolerance
    );
    
    this.tolerances = {
      calories: this.baseTolerances.calories + calorieAdjustment,
      protein: this.baseTolerances.protein + calorieAdjustment,
      carbs: this.baseTolerances.carbs + calorieAdjustment,
      fat: this.baseTolerances.fat + calorieAdjustment
    };
    
    console.log('Adjusted macro tolerances:', this.tolerances);
  }
  
  validateDayMacros(day, meals) {
    const dayTotal = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };
    
    // Calculate day totals
    meals.forEach(meal => {
      dayTotal.protein += meal.protein || 0;
      dayTotal.carbs += meal.carbs || 0;
      dayTotal.fat += meal.fat || 0;
      dayTotal.calories += ((meal.protein || 0) * 4) + ((meal.carbs || 0) * 4) + ((meal.fat || 0) * 9);
    });
    
    // Check if within acceptable ranges
    const validations = {};
    let isValid = true;
    
    for (const macro of ['calories', 'protein', 'carbs', 'fat']) {
      const target = this.macroTargets[macro];
      const tolerance = this.tolerances[macro];
      const min = target * (1 - tolerance);
      const max = target * (1 + tolerance);
      
      const macroValid = dayTotal[macro] >= min && dayTotal[macro] <= max;
      
      validations[macro] = {
        isValid: macroValid,
        current: dayTotal[macro],
        target: target,
        deviation: ((dayTotal[macro] - target) / target) * 100,
        min: min,
        max: max
      };
      
      if (!macroValid) {
        isValid = false;
      }
    }
    
    return {
      isValid,
      dayTotal,
      validations,
      deviations: Object.keys(validations).map(macro => {
        const val = validations[macro];
        return `${macro}: ${Math.round(val.current)} vs target ${val.target} (${val.deviation.toFixed(1)}% off)`;
      })
    };
  }
  
  suggestAdjustments(validationResult) {
    const suggestions = [];
    
    for (const macro in validationResult.validations) {
      const validation = validationResult.validations[macro];
      
      if (!validation.isValid) {
        const difference = validation.target - validation.current;
        const direction = difference > 0 ? 'increase' : 'decrease';
        const amount = Math.abs(difference);
        
        suggestions.push(this.getAdjustmentSuggestion(macro, direction, amount));
      }
    }
    
    return suggestions;
  }
  
  getAdjustmentSuggestion(macro, direction, amount) {
    // Format the suggestion based on the macro and direction
    const formattedAmount = Math.round(amount);
    
    if (macro === 'calories') {
      return `${direction} calories by ~${formattedAmount} calories`;
    } else {
      return `${direction} ${macro} by ~${formattedAmount}g`;
    }
  }
}

/**
 * MealSimilarityChecker class for detecting similar meals
 * Prevents duplicate or too-similar meals in the meal plan
 * Enhanced with cuisine detection and more nuanced similarity checks
 */
class MealSimilarityChecker {
  constructor() {
    this.mealHashes = new Set();
    this.similarityThreshold = 0.7;
    
    // Detailed cooking methods grouped by category
    this.cookingMethodCategories = {
      'dry-heat': ['baked', 'roasted', 'grilled', 'broiled', 'toasted'],
      'wet-heat': ['boiled', 'steamed', 'poached', 'simmered', 'braised', 'stewed'],
      'fat-based': ['fried', 'sautéed', 'sauteed', 'stir-fried', 'pan-fried', 'deep-fried'],
      'cold-prep': ['raw', 'cured', 'marinated', 'pickled', 'fermented'],
      'combination': ['braised', 'stewed', 'slow-cooked', 'pressure-cooked', 'sous-vide']
    };
    
    // Flattened cooking methods for detection
    this.cookingMethods = new Set([].concat(...Object.values(this.cookingMethodCategories)));
    
    // Protein categories for comparison
    this.proteinCategories = {
      'chicken-breast': ['chicken breast', 'chicken breasts', 'boneless chicken', 'skinless chicken'],
      'chicken-thigh': ['chicken thigh', 'chicken thighs', 'dark meat chicken', 'chicken leg'],
      'chicken-whole': ['whole chicken', 'rotisserie chicken', 'chicken pieces'],
      'turkey': ['turkey', 'ground turkey', 'turkey breast'],
      'beef-steak': ['steak', 'sirloin', 'ribeye', 'filet mignon', 'beef steak', 'flank steak'],
      'beef-ground': ['ground beef', 'beef mince', 'hamburger meat'],
      'beef-other': ['beef', 'brisket', 'chuck', 'roast beef'],
      'pork-chop': ['pork chop', 'pork chops', 'pork loin'],
      'pork-ground': ['ground pork', 'pork mince'],
      'pork-other': ['pork', 'ham', 'bacon', 'pork shoulder', 'pork belly'],
      'fish-salmon': ['salmon', 'salmon fillet'],
      'fish-white': ['cod', 'tilapia', 'halibut', 'haddock', 'white fish'],
      'fish-tuna': ['tuna', 'ahi tuna', 'tuna steak'],
      'seafood': ['shrimp', 'prawn', 'scallop', 'lobster', 'crab', 'clam', 'mussel'],
      'tofu': ['tofu', 'bean curd'],
      'tempeh': ['tempeh'],
      'beans': ['beans', 'black beans', 'kidney beans', 'chickpeas', 'lentils', 'legumes'],
      'eggs': ['egg', 'eggs', 'omelette', 'frittata', 'quiche'],
      'dairy': ['yogurt', 'cottage cheese', 'greek yogurt', 'cheese']
    };
    
    // Cuisine categories for comparison
    this.cuisineCategories = {
      'italian': ['pasta', 'pizza', 'risotto', 'lasagna', 'italian', 'parmesan', 'mozzarella', 'pesto', 'marinara'],
      'mexican': ['taco', 'burrito', 'quesadilla', 'enchilada', 'mexican', 'salsa', 'guacamole', 'tortilla'],
      'asian': ['stir-fry', 'asian', 'soy sauce', 'sesame oil', 'wok', 'rice noodles'],
      'indian': ['curry', 'indian', 'masala', 'tikka', 'tandoori', 'naan', 'chutney', 'garam masala'],
      'mediterranean': ['greek', 'mediterranean', 'hummus', 'feta', 'olive oil', 'tahini', 'pita'],
      'american': ['burger', 'sandwich', 'american', 'bbq', 'barbecue', 'mac and cheese'],
      'french': ['french', 'ratatouille', 'coq au vin', 'béchamel', 'bechamel', 'croissant'],
      'middle-eastern': ['falafel', 'shawarma', 'kebab', 'middle eastern', 'tahini', 'za\'atar'],
      'thai': ['thai', 'curry', 'pad thai', 'coconut milk', 'fish sauce', 'lemongrass'],
      'japanese': ['japanese', 'sushi', 'teriyaki', 'miso', 'tempura', 'ramen']
    };
    
    // Dish types for comparison
    this.dishTypes = {
      'soup': ['soup', 'stew', 'chowder', 'bisque', 'broth'],
      'salad': ['salad', 'slaw', 'greens'],
      'sandwich': ['sandwich', 'wrap', 'burger', 'sub', 'panini'],
      'pasta': ['pasta', 'noodle', 'spaghetti', 'fettuccine', 'linguine', 'penne', 'macaroni'],
      'rice-dish': ['rice', 'risotto', 'pilaf', 'fried rice', 'paella'],
      'casserole': ['casserole', 'bake', 'gratin', 'lasagna'],
      'stir-fry': ['stir-fry', 'stir fry', 'wok'],
      'roast': ['roast', 'roasted', 'baked'],
      'curry': ['curry', 'masala', 'tikka masala'],
      'bowl': ['bowl', 'buddha bowl', 'grain bowl', 'power bowl']
    };
  }
  
  // Generate a hash for a meal based on its key characteristics
  getMealHash(meal) {
    return `${meal.name.toLowerCase()}_${meal.protein}_${meal.carbs}_${meal.fat}`;
  }
  
  // Check if a meal is too similar to existing meals
  isMealDuplicate(meal, existingMeals) {
    // Check exact matches using hash
    const mealHash = this.getMealHash(meal);
    if (this.mealHashes.has(mealHash)) {
      return {
        isDuplicate: true,
        reason: 'Exact match with existing meal'
      };
    }
    
    // Check name similarity
    for (const existingMeal of existingMeals) {
      // Skip comparing with meals of the same day
      if (existingMeal.day === meal.day) {
        continue;
      }
      
      // Check name similarity
      if (this.areNamesVerySimilar(meal.name, existingMeal.name)) {
        return {
          isDuplicate: true,
          reason: `Name too similar to "${existingMeal.name}"`
        };
      }
      
      // Check ingredient similarity only if names are somewhat similar
      if (this.areNamesSomewhatSimilar(meal.name, existingMeal.name) && 
          meal.ingredients && existingMeal.ingredients &&
          this.calculateIngredientSimilarity(meal, existingMeal) > this.similarityThreshold) {
        return {
          isDuplicate: true,
          reason: `Ingredients too similar to "${existingMeal.name}"`
        };
      }
      
      // Check for exact same protein, cooking method, AND dish type
      // This is more specific than the previous check
      if (this.haveSameProteinCookingMethodAndDishType(meal, existingMeal)) {
        return {
          isDuplicate: true,
          reason: `Same protein, cooking method, and dish type as "${existingMeal.name}"`
        };
      }
    }
    
    // Not a duplicate - add to hash set
    this.mealHashes.add(mealHash);
    return { isDuplicate: false };
  }
  
  areNamesVerySimilar(name1, name2) {
    // Normalize names
    const norm1 = name1.toLowerCase().replace(/\s+/g, ' ').trim();
    const norm2 = name2.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Check for exact match or one being substring of the other
    if (norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1)) {
      return true;
    }
    
    // Check for word overlap
    const words1 = new Set(norm1.split(' ').filter(w => w.length > 3));
    const words2 = new Set(norm2.split(' ').filter(w => w.length > 3));
    
    // Count overlapping significant words
    const overlap = [...words1].filter(word => words2.has(word)).length;
    const totalWords = Math.max(words1.size, words2.size);
    
    // If more than 70% of significant words overlap, consider similar
    return totalWords > 0 && (overlap / totalWords) > 0.7;
  }
  
  areNamesSomewhatSimilar(name1, name2) {
    // Normalize names
    const norm1 = name1.toLowerCase().replace(/\s+/g, ' ').trim();
    const norm2 = name2.toLowerCase().replace(/\s+/g, ' ').trim();
    
    // Check for word overlap
    const words1 = new Set(norm1.split(' ').filter(w => w.length > 3));
    const words2 = new Set(norm2.split(' ').filter(w => w.length > 3));
    
    // Count overlapping significant words
    const overlap = [...words1].filter(word => words2.has(word)).length;
    const totalWords = Math.max(words1.size, words2.size);
    
    // If more than 40% of significant words overlap, consider somewhat similar
    return totalWords > 0 && (overlap / totalWords) > 0.4;
  }
  
  calculateIngredientSimilarity(meal1, meal2) {
    if (!meal1.ingredients || !meal2.ingredients || 
        !Array.isArray(meal1.ingredients) || !Array.isArray(meal2.ingredients) ||
        meal1.ingredients.length === 0 || meal2.ingredients.length === 0) {
      return 0;
    }
    
    // Extract ingredient names
    const ingredients1 = new Set(
      meal1.ingredients
        .filter(i => i && i.name)
        .map(i => i.name.toLowerCase().replace(/\s+/g, ' ').trim())
    );
    
    const ingredients2 = new Set(
      meal2.ingredients
        .filter(i => i && i.name)
        .map(i => i.name.toLowerCase().replace(/\s+/g, ' ').trim())
    );
    
    // Calculate Jaccard similarity
    const intersection = new Set([...ingredients1].filter(x => ingredients2.has(x)));
    const union = new Set([...ingredients1, ...ingredients2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  haveSameProteinCookingMethodAndDishType(meal1, meal2) {
    const protein1 = this.categorizeProtein(meal1);
    const protein2 = this.categorizeProtein(meal2);
    
    const method1 = this.extractCookingMethod(meal1);
    const method2 = this.extractCookingMethod(meal2);
    
    const dishType1 = this.categorizeDishType(meal1);
    const dishType2 = this.categorizeDishType(meal2);
    
    const cuisine1 = this.categorizeCuisine(meal1);
    const cuisine2 = this.categorizeCuisine(meal2);
    
    // If protein categories match (but not 'other')
    const proteinMatch = protein1 === protein2 && protein1 !== 'other';
    
    // If cooking method categories match (but not 'other')
    const methodMatch = this.getCookingMethodCategory(method1) === this.getCookingMethodCategory(method2) && 
                        method1 !== 'other' && method2 !== 'other';
    
    // If dish types match (but not 'other')
    const dishTypeMatch = dishType1 === dishType2 && dishType1 !== 'other';
    
    // If cuisines are different, it's not a duplicate even if other factors match
    const cuisineDifferent = cuisine1 !== cuisine2 && cuisine1 !== 'other' && cuisine2 !== 'other';
    
    // Consider it a duplicate only if protein, cooking method AND dish type all match
    // AND the cuisines are not explicitly different
    return proteinMatch && methodMatch && dishTypeMatch && !cuisineDifferent;
  }
  
  getCookingMethodCategory(method) {
    for (const [category, methods] of Object.entries(this.cookingMethodCategories)) {
      if (methods.includes(method)) {
        return category;
      }
    }
    return 'other';
  }
  
  categorizeProtein(meal) {
    // Create a text blob from meal name and ingredients
    let mealText = meal.name.toLowerCase();
    
    if (meal.ingredients && Array.isArray(meal.ingredients)) {
      mealText += ' ' + meal.ingredients
        .filter(i => i && i.name)
        .map(i => i.name.toLowerCase())
        .join(' ');
    }
    
    if (meal.description) {
      mealText += ' ' + meal.description.toLowerCase();
    }
    
    // Check against protein categories
    for (const [category, keywords] of Object.entries(this.proteinCategories)) {
      if (keywords.some(keyword => mealText.includes(keyword))) {
        return category;
      }
    }
    
    return 'other';
  }
  
  extractCookingMethod(meal) {
    // Create a text blob from meal name, description and recipe
    let mealText = meal.name.toLowerCase();
    
    if (meal.description) {
      mealText += ' ' + meal.description.toLowerCase();
    }
    
    if (meal.recipe && typeof meal.recipe === 'string') {
      mealText += ' ' + meal.recipe.toLowerCase();
    }
    
    // Check for cooking methods
    for (const method of this.cookingMethods) {
      if (mealText.includes(method)) {
        return method;
      }
    }
    
    return 'other';
  }
  
  categorizeDishType(meal) {
    // Create a text blob from meal name and description
    let mealText = meal.name.toLowerCase();
    
    if (meal.description) {
      mealText += ' ' + meal.description.toLowerCase();
    }
    
    // Check against dish type categories
    for (const [category, keywords] of Object.entries(this.dishTypes)) {
      if (keywords.some(keyword => mealText.includes(keyword))) {
        return category;
      }
    }
    
    return 'other';
  }
  
  categorizeCuisine(meal) {
    // Create a text blob from meal name, description, and ingredients
    let mealText = meal.name.toLowerCase();
    
    if (meal.description) {
      mealText += ' ' + meal.description.toLowerCase();
    }
    
    if (meal.ingredients && Array.isArray(meal.ingredients)) {
      mealText += ' ' + meal.ingredients
        .filter(i => i && i.name)
        .map(i => i.name.toLowerCase())
        .join(' ');
    }
    
    // Check against cuisine categories
    for (const [category, keywords] of Object.entries(this.cuisineCategories)) {
      if (keywords.some(keyword => mealText.includes(keyword))) {
        return category;
      }
    }
    
    return 'other';
  }
}

/**
 * Generate meals for a single day
 * @param {number} day - The day number (1-5)
 * @param {Object} userData - User data from database
 * @param {Array} previousMeals - Meals from previous days
 * @returns {Promise<Array>} The generated meals for this day
 */
async function generateDayMeals(day, userData, previousMeals = []) {
  try {
    console.log(`Generating meals for day ${day}`);
    
    // Extract relevant data for the prompt
    const { user, metricsAndGoals, dietAndMealPreferences, calorieCalculations } = userData;
    
    if (!metricsAndGoals || !dietAndMealPreferences || !calorieCalculations) {
      throw new Error('Missing required user data for meal plan generation');
    }
    
    // Create similarity checker for duplicate detection
    const similarityChecker = new MealSimilarityChecker();
    
    // Add all previous meals to the similarity checker
    previousMeals.forEach(meal => {
      similarityChecker.getMealHash(meal);
    });
    
    // Create macro validator
    const macroValidator = new MacroValidator(userData);
    
    // Maximum number of retry attempts
    const maxRetries = 3;
    let attempts = 0;
    let dayMeals = null;
    let lastError = null;
    
    // Retry loop with incremental backoff
    while (attempts < maxRetries && !dayMeals) {
      try {
        attempts++;
        console.log(`Attempt ${attempts} of ${maxRetries} to generate meals for day ${day}`);
        
        // Adjust temperature based on retry attempt (lower temperature for more focused responses)
        const temperature = Math.max(0.3, 0.7 - (attempts - 1) * 0.2);
        
        // Create the prompt for GPT-4, adding feedback from previous attempts if available
        const prompt = createDayMealPlanPrompt(day, userData, previousMeals, lastError);
        
        // Call GPT-4 to generate the meals for this day
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { 
              role: 'system', 
              content: `You are an expert nutritionist and meal planner specializing in high-calorie, nutrient-dense meal plans. You create detailed, personalized meals based on user data and nutritional requirements.

⚠️ CRITICAL CALORIE REQUIREMENTS (HIGHEST PRIORITY) ⚠️
1. EVERY SINGLE MEAL MUST MEET OR EXCEED its MINIMUM calorie requirement - this is your #1 priority
2. NEVER create a meal below the minimum calorie threshold specified for each meal type
3. ALWAYS verify each meal's calories by calculating: protein × 4 + carbs × 4 + fat × 9
4. If a meal is below the minimum calories, INCREASE portion sizes or add calorie-dense ingredients
5. NEVER use low-calorie substitutes (egg whites instead of whole eggs, skim milk instead of whole milk)

MEAL PORTION GUIDELINES TO ENSURE ADEQUATE CALORIES:
- Protein: 6-8oz (170-225g) portions minimum (NOT 3-4oz which is too small)
  * To reach ${proteinGrams}g protein daily, you need approximately:
  * 8oz chicken breast = 50g protein
  * 8oz beef = 56g protein
  * 8oz salmon = 46g protein
  * 6oz tuna = 40g protein
  * 3 whole eggs = 18g protein
  * 1.5 cups Greek yogurt = 36g protein

- Oils/Fats: 1-2 tbsp (15-30ml) per meal minimum
  * 1 tbsp olive oil = 14g fat, 120 calories
  * 1 tbsp butter = 12g fat, 100 calories
  * 2 tbsp peanut butter = 16g fat, 190 calories
  * 1/4 cup nuts = 15-20g fat, 200 calories

- Starches: 1-1.5 cups cooked minimum (rice, pasta, potatoes)
  * 1 cup cooked rice = 45g carbs, 200 calories
  * 1 cup cooked pasta = 40g carbs, 200 calories
  * 1 large potato = 50g carbs, 220 calories

- Dairy: Use full-fat versions, never low-fat or skim options
  * 1 cup whole milk = 8g protein, 12g carbs, 8g fat, 150 calories
  * 1 cup full-fat Greek yogurt = 20g protein, 9g carbs, 10g fat, 200 calories

CALORIE BOOSTERS (ADD THESE TO REACH CALORIE TARGETS):
1. Add 1-2 tbsp olive oil to any dish (+120-240 calories)
2. Include a side of nuts with meals (+160 calories per oz)
3. Add avocado to meals (+120 calories per half)
4. Use full-fat coconut milk in sauces (+120 calories per 1/4 cup)
5. Add a drizzle of honey or maple syrup to breakfast (+60 calories per tbsp)
6. Include a slice of cheese in sandwiches (+100 calories per slice)
7. Add an extra tbsp of nut butter to breakfast (+90 calories)
8. Use full-fat dressings for salads (+120 calories per 2 tbsp)
9. Add an extra 1/4 cup of rice or pasta to meals (+100 calories)
10. Include a side of dried fruit (+100 calories per 1/4 cup)

CRITICAL REQUIREMENTS:
1. You MUST provide exactly 3 meals (breakfast, lunch, dinner) for the specified day
2. You MUST ensure EACH INDIVIDUAL MEAL has the MINIMUM required calories
3. You MUST calculate calories accurately using: protein × 4 + carbs × 4 + fat × 9 calories
4. You MUST ensure the day's total calories match the target (within acceptable range)
5. You MUST strictly adhere to all dietary restrictions
6. You MUST format your response as PURE, VALID JSON that can be parsed
7. You MUST create meals that are DIFFERENT from previous days' meals

JSON FORMAT REQUIREMENTS (EXTREMELY IMPORTANT):
- Your response MUST be PURE JSON only - no comments, no explanations, no extra text
- DO NOT include any JavaScript comments (// or /* */) in your JSON
- DO NOT include any explanatory text before or after the JSON
- DO NOT use trailing commas in arrays or objects
- DO NOT include any markdown formatting
- ONLY return a single, valid JSON object`
            },
            { role: 'user', content: prompt }
          ],
          temperature: temperature,
          max_tokens: 2000
        });
        
        // Parse the response
        const dayMealsText = response.choices[0].message.content;
        console.log(`Attempt ${attempts} day ${day} meals text:`, dayMealsText);
        
        // Parse the day meals data
        const parsedData = parseMealPlanResponse(dayMealsText);
        
        // Check for duplicates with previous days
        const duplicateChecks = [];
        for (const meal of parsedData.meals) {
          const duplicateCheck = similarityChecker.isMealDuplicate(meal, previousMeals);
          if (duplicateCheck.isDuplicate) {
            duplicateChecks.push(`Meal "${meal.name}" is a duplicate: ${duplicateCheck.reason}`);
          }
        }
        
        if (duplicateChecks.length > 0) {
          throw new Error(`Duplicate meals detected: ${duplicateChecks.join('; ')}`);
        }
        
        // Validate the day's macros
        const dayMealsArray = parsedData.meals.filter(meal => meal.day === day);
        const macroValidation = macroValidator.validateDayMacros(day, dayMealsArray);
        
        if (!macroValidation.isValid) {
          throw new Error(`Day ${day} macro validation failed: ${macroValidation.deviations.join('; ')}`);
        }
        
        // If we get here, the day's meals are valid
        dayMeals = dayMealsArray;
        
      } catch (retryError) {
        console.error(`Attempt ${attempts} for day ${day} failed:`, retryError.message);
        lastError = retryError.message;
        
        // If this was the last attempt, throw the error
        if (attempts >= maxRetries) {
          throw new Error(`Failed to generate valid meals for day ${day} after ${maxRetries} attempts: ${lastError}`);
        }
        
        // Wait before retrying (exponential backoff)
        const backoffMs = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
    
    return dayMeals;
  } catch (error) {
    console.error(`Error generating meals for day ${day}:`, error);
    throw error;
  }
}

/**
 * Format previous meals for inclusion in the prompt (optimized for token usage)
 * @param {Array} previousMeals - Array of previously generated meals
 * @returns {string} Formatted string of previous meals
 */
function formatPreviousMeals(previousMeals) {
  if (!previousMeals || previousMeals.length === 0) {
    return "No previous meals yet.";
  }
  
  // Group meals by day
  const mealsByDay = {};
  for (const meal of previousMeals) {
    if (!mealsByDay[meal.day]) {
      mealsByDay[meal.day] = [];
    }
    mealsByDay[meal.day].push(meal);
  }
  
  // Format each day's meals in a concise format
  let result = "";
  for (const day in mealsByDay) {
    result += `DAY ${day}: `;
    
    // Sort meals by type (breakfast, lunch, dinner)
    const sortedMeals = mealsByDay[day].sort((a, b) => {
      const order = { breakfast: 1, lunch: 2, dinner: 3 };
      return order[a.mealType] - order[b.mealType];
    });
    
    // Add each meal with minimal details
    const mealSummaries = sortedMeals.map(meal => 
      `${meal.mealType.charAt(0).toUpperCase()}${meal.mealType.slice(1)}: ${meal.name} (${extractProteinType(meal)})`
    );
    
    result += mealSummaries.join("; ") + "\n";
  }
  
  return result;
}

/**
 * Extract protein type from a meal
 * @param {Object} meal - The meal object
 * @returns {string} The main protein type
 */
function extractProteinType(meal) {
  // Create a text blob from meal name and ingredients
  let mealText = meal.name.toLowerCase();
  
  if (meal.ingredients && Array.isArray(meal.ingredients)) {
    mealText += ' ' + meal.ingredients
      .filter(i => i && i.name)
      .map(i => i.name.toLowerCase())
      .join(' ');
  }
  
  // Define protein categories
  const proteinCategories = {
    chicken: ['chicken', 'poultry'],
    beef: ['beef', 'steak', 'ground beef'],
    fish: ['salmon', 'tuna', 'fish', 'seafood', 'tilapia', 'cod'],
    pork: ['pork', 'ham', 'bacon'],
    legumes: ['beans', 'lentils', 'chickpeas', 'tofu', 'tempeh'],
    eggs: ['egg', 'eggs', 'omelette', 'frittata'],
    dairy: ['yogurt', 'cottage cheese', 'greek yogurt']
  };
  
  // Check against protein categories
  for (const [category, keywords] of Object.entries(proteinCategories)) {
    if (keywords.some(keyword => mealText.includes(keyword))) {
      return category;
    }
  }
  
  return "other";
}

/**
 * Generate a meal plan based on user data using day-by-day approach with conversation context
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
    
    // Initialize conversation context with system message
    const conversationMessages = [
      { 
        role: 'system', 
        content: `You are an expert nutritionist and meal planner specializing in high-calorie, nutrient-dense meal plans. You create detailed, personalized meals based on user data and nutritional requirements.

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
1. You MUST provide exactly 3 meals (breakfast, lunch, dinner) for the specified day
2. You MUST ensure EACH INDIVIDUAL MEAL has the MINIMUM required calories
3. You MUST calculate calories accurately using: protein × 4 + carbs × 4 + fat × 9 calories
4. You MUST ensure the day's total calories match the target (within acceptable range)
5. You MUST strictly adhere to all dietary restrictions
6. You MUST format your response as PURE, VALID JSON that can be parsed
7. You MUST create meals that are DIFFERENT from previous days' meals

MEAL VARIETY REQUIREMENTS:
1. NEVER repeat a meal that was used on a previous day
2. Vary protein sources across days (don't use chicken every day)
3. Vary cooking methods (don't use the same cooking method for every meal)
4. Vary meal structures (don't always use the same format like "protein with sides")
5. Vary cuisines (include different cultural influences across the meal plan)

JSON FORMAT REQUIREMENTS (EXTREMELY IMPORTANT):
- Your response MUST be PURE JSON only - no comments, no explanations, no extra text
- DO NOT include any JavaScript comments (// or /* */) in your JSON
- DO NOT include any explanatory text before or after the JSON
- DO NOT use trailing commas in arrays or objects
- DO NOT include any markdown formatting
- ONLY return a single, valid JSON object`
      }
    ];
    
    // Generate meals day by day
    const allMeals = [];
    
    // Generate each day sequentially
    for (let day = 1; day <= 5; day++) {
      try {
        // Add previous days' meals to the conversation context
        if (allMeals.length > 0) {
          conversationMessages.push({
            role: 'user',
            content: `Here are the meals I've already created for previous days:\n${formatPreviousMeals(allMeals)}\n\nNow I need to create meals for Day ${day}. Please make sure these meals are DIFFERENT from the previous days' meals.`
          });
          
          conversationMessages.push({
            role: 'assistant',
            content: `I understand. I'll create unique meals for Day ${day} that are different from the previous days' meals. I'll ensure there's no repetition in meal types, proteins, or cooking methods.`
          });
        }
        
        // Generate meals for this day, passing conversation context
        const dayMeals = await generateDayMealsWithContext(day, userData, allMeals, conversationMessages);
        
        // Add the day's meals to the complete meal plan
        allMeals.push(...dayMeals);
        
        // Add the successful generation to the conversation context
        conversationMessages.push({
          role: 'user',
          content: `Thank you for creating the meals for Day ${day}. These look good.`
        });
        
        conversationMessages.push({
          role: 'assistant',
          content: `You're welcome! I'm glad the Day ${day} meals meet your requirements. Let me know when you're ready for the next day's meals.`
        });
        
        console.log(`Successfully generated meals for day ${day}`);
      } catch (dayError) {
        console.error(`Error generating day ${day}:`, dayError);
        
        // Add the error to the conversation context
        conversationMessages.push({
          role: 'user',
          content: `There was an error with the meals for Day ${day}: ${dayError.message}. Please try again with completely different meals.`
        });
        
        conversationMessages.push({
          role: 'assistant',
          content: `I apologize for the error. I'll create completely different meals for Day ${day} that avoid the issues mentioned.`
        });
        
        // Try one more time with the updated conversation context
        try {
          const retryMeals = await generateDayMealsWithContext(day, userData, allMeals, conversationMessages);
          allMeals.push(...retryMeals);
          
          // Add the successful retry to the conversation context
          conversationMessages.push({
            role: 'user',
            content: `Thank you, these new meals for Day ${day} look good.`
          });
          
          conversationMessages.push({
            role: 'assistant',
            content: `You're welcome! I'm glad the revised Day ${day} meals meet your requirements.`
          });
          
          console.log(`Successfully generated meals for day ${day} on retry`);
        } catch (retryError) {
          console.error(`Error on retry for day ${day}:`, retryError);
          throw new Error(`Failed to generate meal plan: Error on day ${day}: ${retryError.message}`);
        }
      }
    }
    
    // Create the complete meal plan
    const mealPlanData = {
      meals: allMeals,
      mealPlanId: crypto.randomUUID()
    };
    
    // Add snacks if needed
    if (dietAndMealPreferences.include_snacks) {
      mealPlanData.snacks = generateSnacks(userData);
    }
    
    // Add favorite meals if needed
    if (dietAndMealPreferences.include_favorite_meals) {
      mealPlanData.favoriteMeals = extractFavoriteMeals(userData);
    }
    
    return mealPlanData;
  } catch (error) {
    console.error('Error generating meal plan:', error);
    throw error;
  }
}

/**
 * Generate meals for a single day using optimized conversation context
 * @param {number} day - The day number (1-5)
 * @param {Object} userData - User data from database
 * @param {Array} previousMeals - Meals from previous days
 * @param {Array} conversationMessages - Conversation context
 * @returns {Promise<Array>} The generated meals for this day
 */
async function generateDayMealsWithContext(day, userData, previousMeals = [], conversationMessages = []) {
  try {
    console.log(`Generating meals for day ${day} with optimized conversation context`);
    
    // Emit progress event for this day
    emitProgressEvent({
      day,
      message: `Creating meals for Day ${day}...`,
      progress: (day - 1) * 20 // 0%, 20%, 40%, 60%, 80% for days 1-5
    });
    
    // Extract relevant data for the prompt
    const { user, metricsAndGoals, dietAndMealPreferences, calorieCalculations } = userData;
    
    if (!metricsAndGoals || !dietAndMealPreferences || !calorieCalculations) {
      throw new Error('Missing required user data for meal plan generation');
    }
    
    // Create similarity checker for duplicate detection
    const similarityChecker = new MealSimilarityChecker();
    
    // Add all previous meals to the similarity checker
    previousMeals.forEach(meal => {
      similarityChecker.getMealHash(meal);
    });
    
    // Create macro validator
    const macroValidator = new MacroValidator(userData);
    
    // Maximum number of retry attempts
    const maxRetries = 3;
    let attempts = 0;
    let dayMeals = null;
    let lastError = null;
    
    // Retry loop with incremental backoff
    while (attempts < maxRetries && !dayMeals) {
      try {
        attempts++;
        console.log(`Attempt ${attempts} of ${maxRetries} to generate meals for day ${day}`);
        
        // Adjust temperature based on retry attempt (lower temperature for more focused responses)
        const temperature = Math.max(0.3, 0.7 - (attempts - 1) * 0.2);
        
        // Create the prompt for GPT-4, adding feedback from previous attempts if available
        const prompt = createDayMealPlanPrompt(day, userData, previousMeals, lastError);
        
        // Create an optimized version of the conversation context
        // Only keep the most recent and relevant messages to reduce token usage
        const optimizedConversation = optimizeConversationContext(conversationMessages, day);
        
        // Add the current prompt to the optimized conversation
        optimizedConversation.push({ role: 'user', content: prompt });
        
        // Call GPT-4 to generate the meals for this day using the optimized conversation context
        const response = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: optimizedConversation,
          temperature: temperature,
          max_tokens: 2000
        });
        
        // Parse the response
        const dayMealsText = response.choices[0].message.content;
        console.log(`Attempt ${attempts} day ${day} meals text:`, dayMealsText);
        
        // Add a condensed version of the response to the conversation context
        // This helps maintain context while reducing token usage
        conversationMessages.push({ 
          role: 'assistant', 
          content: `I've created meals for Day ${day}. Here's a summary: ${summarizeMeals(dayMealsText)}`
        });
        
        // Parse the day meals data
        const parsedData = parseMealPlanResponse(dayMealsText);
        
        // Check for duplicates with previous days
        const duplicateChecks = [];
        for (const meal of parsedData.meals) {
          const duplicateCheck = similarityChecker.isMealDuplicate(meal, previousMeals);
          if (duplicateCheck.isDuplicate) {
            duplicateChecks.push(`Meal "${meal.name}" is a duplicate: ${duplicateCheck.reason}`);
          }
        }
        
        if (duplicateChecks.length > 0) {
          throw new Error(`Duplicate meals detected: ${duplicateChecks.join('; ')}`);
        }
        
        // Validate the day's macros
        const dayMealsArray = parsedData.meals.filter(meal => meal.day === day);
        const macroValidation = macroValidator.validateDayMacros(day, dayMealsArray);
        
        if (!macroValidation.isValid) {
          throw new Error(`Day ${day} macro validation failed: ${macroValidation.deviations.join('; ')}`);
        }
        
        // If we get here, the day's meals are valid
        dayMeals = dayMealsArray;
        
      } catch (retryError) {
        console.error(`Attempt ${attempts} for day ${day} failed:`, retryError.message);
        lastError = retryError.message;
        
        // Add a concise error message to the conversation context
        conversationMessages.push({
          role: 'user',
          content: `Error with Day ${day} meals: ${retryError.message.substring(0, 200)}${retryError.message.length > 200 ? '...' : ''}. Please create different meals.`
        });
        
        // If this was the last attempt, throw the error
        if (attempts >= maxRetries) {
          throw new Error(`Failed to generate valid meals for day ${day} after ${maxRetries} attempts: ${lastError}`);
        }
        
        // Wait before retrying (exponential backoff)
        const backoffMs = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
    
    return dayMeals;
  } catch (error) {
    console.error(`Error generating meals for day ${day}:`, error);
    throw error;
  }
}

/**
 * Optimize conversation context to reduce token usage
 * @param {Array} conversationMessages - Full conversation context
 * @param {number} currentDay - The current day being generated
 * @returns {Array} Optimized conversation context
 */
function optimizeConversationContext(conversationMessages, currentDay) {
  // Always keep the system message
  const systemMessage = conversationMessages.find(msg => msg.role === 'system');
  
  // Create a simplified system message with only the most critical requirements
  const simplifiedSystemMessage = {
    role: 'system',
    content: `You are an expert nutritionist creating meals for Day ${currentDay} of a meal plan. 
CRITICAL REQUIREMENTS:
1. Create 3 meals (breakfast, lunch, dinner) with adequate calories
2. Ensure meals are different from previous days
3. Follow dietary restrictions exactly
4. Return PURE JSON only - no comments or explanations
5. Format: {"meals": [{day, mealType, name, description, ingredients, recipe, protein, carbs, fat}]}`
  };
  
  // For days 1-2, use the full system message
  // For days 3+, use the simplified system message to save tokens
  const optimizedMessages = [
    currentDay <= 2 && systemMessage ? systemMessage : simplifiedSystemMessage
  ];
  
  // Only include the most recent and relevant messages
  // For each day, we want to keep:
  // 1. The most recent summary of previous days' meals
  // 2. The most recent error message (if any)
  // 3. The most recent successful generation (if any)
  
  // Find the most recent meal summary message
  const mealSummaryMessages = conversationMessages.filter(msg => 
    msg.role === 'user' && 
    msg.content.includes('Here are the meals I\'ve already created')
  );
  
  if (mealSummaryMessages.length > 0) {
    optimizedMessages.push(mealSummaryMessages[mealSummaryMessages.length - 1]);
  }
  
  // Find the most recent error message for the current day
  const errorMessages = conversationMessages.filter(msg => 
    msg.role === 'user' && 
    msg.content.includes(`Error with Day ${currentDay} meals:`)
  );
  
  if (errorMessages.length > 0) {
    optimizedMessages.push(errorMessages[errorMessages.length - 1]);
  }
  
  // Find the most recent successful generation acknowledgment
  const successMessages = conversationMessages.filter(msg => 
    msg.role === 'user' && 
    msg.content.includes('Thank you for creating the meals')
  );
  
  if (successMessages.length > 0) {
    optimizedMessages.push(successMessages[successMessages.length - 1]);
    
    // Also include the assistant's response to the success message
    const successIndex = conversationMessages.indexOf(successMessages[successMessages.length - 1]);
    if (successIndex >= 0 && successIndex + 1 < conversationMessages.length) {
      optimizedMessages.push(conversationMessages[successIndex + 1]);
    }
  }
  
  return optimizedMessages;
}

/**
 * Summarize meals from GPT-4 response
 * @param {string} mealsText - The JSON response from GPT-4
 * @returns {string} A summary of the meals
 */
function summarizeMeals(mealsText) {
  try {
    // Extract JSON from the response
    const jsonMatch = mealsText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return "Could not parse meal data";
    }
    
    const jsonStr = jsonMatch[0];
    const mealPlanData = JSON.parse(jsonStr);
    
    if (!mealPlanData.meals || !Array.isArray(mealPlanData.meals)) {
      return "Invalid meal data format";
    }
    
    // Create a concise summary
    return mealPlanData.meals.map(meal => 
      `${meal.mealType.charAt(0).toUpperCase()}${meal.mealType.slice(1)}: ${meal.name}`
    ).join('; ');
  } catch (error) {
    return "Error summarizing meals";
  }
}

/**
 * Generate snacks based on user preferences
 * @param {Object} userData - User data from database
 * @returns {Array} Generated snacks
 */
function generateSnacks(userData) {
  const { dietAndMealPreferences } = userData;
  const snacks = [];
  
  // Add user's preferred snacks if available
  if (dietAndMealPreferences.snack_1) {
    snacks.push({
      name: dietAndMealPreferences.snack_1,
      protein: 10,
      carbs: 15,
      fat: 8
    });
  } else {
    // Add a default snack
    snacks.push({
      name: "Greek Yogurt with Honey and Nuts",
      protein: 15,
      carbs: 20,
      fat: 10
    });
  }
  
  if (dietAndMealPreferences.snack_2) {
    snacks.push({
      name: dietAndMealPreferences.snack_2,
      protein: 8,
      carbs: 12,
      fat: 6
    });
  } else if (snacks.length === 1) {
    // Add a second default snack
    snacks.push({
      name: "Apple with Almond Butter",
      protein: 5,
      carbs: 25,
      fat: 15
    });
  }
  
  return snacks;
}

/**
 * Extract favorite meals from user preferences
 * @param {Object} userData - User data from database
 * @returns {Array} Favorite meals
 */
function extractFavoriteMeals(userData) {
  const { dietAndMealPreferences } = userData;
  const favoriteMeals = [];
  
  if (dietAndMealPreferences.favorite_meal_1) {
    favoriteMeals.push({
      name: dietAndMealPreferences.favorite_meal_1,
      protein: 30,
      carbs: 40,
      fat: 15
    });
  }
  
  if (dietAndMealPreferences.favorite_meal_2) {
    favoriteMeals.push({
      name: dietAndMealPreferences.favorite_meal_2,
      protein: 25,
      carbs: 35,
      fat: 20
    });
  }
  
  return favoriteMeals;
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
 * Create a prompt for generating meals for a single day
 * @param {number} day - The day number (1-5)
 * @param {Object} userData - User data from database
 * @param {Array} previousMeals - Meals from previous days
 * @param {string} lastError - Error from previous attempt, if any
 * @returns {string} The prompt for GPT-4
 */
function createDayMealPlanPrompt(day, userData, previousMeals = [], lastError = null) {
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
  
  // Format previous meals to avoid duplicates
  const previousMealsText = previousMeals.length > 0 
    ? previousMeals.map(meal => `- Day ${meal.day} ${meal.mealType}: ${meal.name}`).join('\n')
    : 'No previous meals yet.';
  
  // Map day number to day name
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayName = dayNames[day - 1] || `Day ${day}`;
  
  // Create the prompt
  let prompt = `
I need you to create 3 meals (breakfast, lunch, dinner) for Day ${day} (${dayName}) of a 5-day meal plan for a real user with specific dietary needs and goals.

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
- Daily Calorie Target: ${weekdayCalories} calories
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

MEAL VARIETY REQUIREMENTS (EXTREMELY IMPORTANT):
1. CUISINE VARIETY: Use different cuisines for each meal. Options include:
   - Italian (pasta, risotto, etc.)
   - Mexican (tacos, burritos, etc.)
   - Asian (stir-fry, rice bowls, etc.)
   - Mediterranean (Greek, Middle Eastern, etc.)
   - American (sandwiches, burgers, etc.)
   - Indian (curry, masala, etc.)
   - Thai (pad thai, curry, etc.)
   - Japanese (teriyaki, sushi, etc.)
   - French (ratatouille, coq au vin, etc.)

2. PROTEIN VARIETY: Use different protein sources than previous days:
   - If chicken was used in previous days, try beef, fish, pork, tofu, or legumes
   - If beef was used in previous days, try chicken, fish, pork, tofu, or legumes
   - If fish was used in previous days, try chicken, beef, pork, tofu, or legumes
   - Even within protein categories, vary the cuts (chicken breast vs. thighs)

3. COOKING METHOD VARIETY: Use different cooking methods:
   - Dry heat: baking, roasting, grilling, broiling
   - Wet heat: boiling, steaming, poaching, simmering
   - Fat-based: sautéing, stir-frying, pan-frying
   - Cold preparation: raw, cured, marinated
   - Combination: braising, stewing, slow-cooking

4. DISH TYPE VARIETY: Use different dish types:
   - Soups and stews
   - Salads and bowls
   - Sandwiches and wraps
   - Pasta and noodle dishes
   - Rice and grain dishes
   - Casseroles and bakes
   - Stir-fries and sautés
   - Roasted dishes

PREVIOUS MEALS (DO NOT DUPLICATE):
${previousMealsText}

FORMAT YOUR RESPONSE AS A VALID JSON OBJECT:
{
  "meals": [
    {
      "day": ${day},
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
    {
      "day": ${day},
      "mealType": "lunch",
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
    {
      "day": ${day},
      "mealType": "dinner",
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
    }
  ]
}

CRITICAL REQUIREMENTS:
1. You MUST include ALL 3 meals (breakfast, lunch, dinner) for Day ${day}
2. Each meal MUST meet or exceed its MINIMUM calorie requirement
3. The day's meals MUST add up to approximately ${weekdayCalories} calories
4. The macronutrient ratios MUST match the specified split of ${macroSplitStr}
5. All dietary restrictions MUST be strictly followed
6. Dietary preferences MUST be incorporated where possible
7. Recipes MUST be practical and easy to follow
8. Ingredients MUST be common and accessible
9. Portion sizes MUST be appropriate for ${dietAndMealPreferences.meal_portion_people_count} people
10. Your response MUST be valid JSON that can be parsed
11. Meals MUST be DIFFERENT from previous days' meals

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
