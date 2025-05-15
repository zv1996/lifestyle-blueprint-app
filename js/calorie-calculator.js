/**
 * Calorie Calculator for Lifestyle Blueprint
 * 
 * This module handles the calculation of calorie needs, 5:2 split,
 * and macronutrient recommendations based on user data.
 */

/**
 * Calculate calorie needs and macronutrient splits
 */
class CalorieCalculator {
  /**
   * Calculate Basal Metabolic Rate (BMR) using the Mifflin-St Jeor equation
   * @param {number} heightInches - Height in inches
   * @param {number} weightPounds - Weight in pounds
   * @param {number} age - Age in years
   * @param {string} sex - Biological sex ('MALE' or 'FEMALE')
   * @returns {number} BMR in calories per day
   */
  calculateBMR(heightInches, weightPounds, age, sex) {
    // Convert pounds to kg and inches to cm
    const weightKg = weightPounds * 0.453592;
    const heightCm = heightInches * 2.54;
    
    // Mifflin-St Jeor equation
    let bmr;
    if (sex === 'MALE') {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
    } else {
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
    }
    
    return Math.round(bmr);
  }
  
  /**
   * Calculate Total Daily Energy Expenditure (TDEE) based on activity level
   * @param {number} bmr - Basal Metabolic Rate
   * @param {string} activityLevel - Activity level description
   * @returns {number} TDEE in calories per day
   */
  calculateTDEE(bmr, activityLevel) {
    let multiplier;
    
    // Determine multiplier based on activity level
    if (activityLevel.includes('Level 1') || activityLevel.includes('Light:')) {
      multiplier = 1.2; // Sedentary
    } else if (activityLevel.includes('Level 2') || activityLevel.includes('Moderate:')) {
      multiplier = 1.375; // Lightly active
    } else if (activityLevel.includes('Level 3') || activityLevel.includes('High:')) {
      multiplier = 1.55; // Moderately active
    } else if (activityLevel.includes('Level 4') || activityLevel.includes('Athletic:')) {
      multiplier = 1.725; // Very active
    } else if (activityLevel.includes('Level 5') || activityLevel.includes('Professional:')) {
      multiplier = 1.9; // Super active
    } else {
      // Default to lightly active if activity level is unknown
      multiplier = 1.375;
    }
    
    return Math.round(bmr * multiplier);
  }
  
  /**
   * Calculate weekly calorie needs
   * @param {number} tdee - Total Daily Energy Expenditure
   * @returns {number} Weekly calorie needs
   */
  calculateWeeklyCalories(tdee) {
    return tdee * 7;
  }
  
  /**
   * Calculate 5:2 split for weekday and weekend calories
   * @param {number} weeklyCalories - Total weekly calorie needs
   * @param {string} sex - Biological sex ('MALE' or 'FEMALE')
   * @param {string} fitnessGoal - Health and fitness goal
   * @returns {Object} Weekday and weekend calorie targets
   */
  calculate52Split(weeklyCalories, sex, fitnessGoal) {
    // Base calculation
    const weekendIncrease = 300; // 300 extra calories per weekend day
    const totalWeekendIncrease = weekendIncrease * 2; // For both Saturday and Sunday
    
    // Gender-specific adjustments
    const genderAdjustment = sex === 'MALE' ? 400 : 200;
    
    // Calculate weekday reduction to balance weekend increase
    const weekdayReduction = totalWeekendIncrease / 5;
    
    // Calculate base daily calories (without adjustments)
    const baseDailyCalories = weeklyCalories / 7;
    
    // Apply adjustments
    const weekdayCalories = Math.round(baseDailyCalories - weekdayReduction + (genderAdjustment / 5));
    const weekendCalories = Math.round(baseDailyCalories + weekendIncrease - ((genderAdjustment * 2) / 5));
    
    // Adjust based on fitness goal
    let goalAdjustment = 0;
    if (fitnessGoal.includes('Lose Weight')) {
      goalAdjustment = -200; // Calorie deficit for weight loss
    } else if (fitnessGoal.includes('Gain Muscle')) {
      goalAdjustment = 200; // Calorie surplus for muscle gain
    }
    
    return {
      weekday: {
        calories: weekdayCalories + goalAdjustment,
        daysPerWeek: 5
      },
      weekend: {
        calories: weekendCalories + goalAdjustment,
        daysPerWeek: 2
      },
      adjustments: {
        genderAdjustment,
        goalAdjustment,
        weekendIncrease
      }
    };
  }
  
  /**
   * Calculate macronutrient split based on activity level and fitness goal
   * @param {string} activityLevel - Activity level description
   * @param {string} fitnessGoal - Health and fitness goal
   * @returns {Object} Macronutrient split for weekdays and weekends
   */
  calculateMacroSplit(activityLevel, fitnessGoal) {
    // Determine if advanced split (40/30/30) is needed
    const needsAdvancedSplit = 
      activityLevel.includes('Level 4') || 
      activityLevel.includes('Level 5') || 
      activityLevel.includes('Athletic:') || 
      activityLevel.includes('Professional:') ||
      fitnessGoal.includes('Gain Muscle');
    
    // Weekday macros (Monday-Friday)
    const weekdayMacros = needsAdvancedSplit 
      ? { protein: 40, carbs: 30, fat: 30 } // Advanced split
      : { protein: 35, carbs: 35, fat: 30 }; // Standard split
    
    // Weekend macros (Saturday-Sunday) - higher carbs for flexibility
    const weekendMacros = {
      protein: 30,
      carbs: 45,
      fat: 25
    };
    
    return {
      type: needsAdvancedSplit ? '40/30/30' : '35/35/30',
      weekday: weekdayMacros,
      weekend: weekendMacros,
      reason: needsAdvancedSplit 
        ? 'Based on your high activity level or muscle gain goal'
        : 'Standard balanced macronutrient distribution'
    };
  }
  
  /**
   * Convert macro percentages to grams based on calorie intake
   * @param {Object} macroPercentages - Percentages for protein, carbs, and fat
   * @param {number} calories - Daily calorie intake
   * @returns {Object} Macronutrients in grams
   */
  calculateMacroGrams(macroPercentages, calories) {
    // Protein and carbs have 4 calories per gram, fat has 9 calories per gram
    const proteinGrams = Math.round((calories * (macroPercentages.protein / 100)) / 4);
    const carbsGrams = Math.round((calories * (macroPercentages.carbs / 100)) / 4);
    const fatGrams = Math.round((calories * (macroPercentages.fat / 100)) / 9);
    
    return {
      protein: proteinGrams,
      carbs: carbsGrams,
      fat: fatGrams
    };
  }
  
  /**
   * Calculate all calorie and macro data based on user information
   * @param {Object} userData - User data from database
   * @returns {Object} Complete calculation results
   */
  calculateAll(userData) {
    try {
      // Extract required data
      const { user, metricsAndGoals } = userData;
      
      if (!user) {
        throw new Error('Missing user data: basic user information is required for calculations');
      }
      
      if (!metricsAndGoals) {
        throw new Error('Missing metrics and goals data: height, weight, and activity level are required for calculations');
      }
      
      // Calculate age from birth date
      const birthDate = new Date(user.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      // Get other required data
      const heightInches = metricsAndGoals.height_inches;
      const weightPounds = metricsAndGoals.weight_pounds;
      const activityLevel = metricsAndGoals.activity_level;
      const fitnessGoal = metricsAndGoals.health_fitness_goal;
      const sex = user.biological_sex;
      
      // Perform calculations
      const bmr = this.calculateBMR(heightInches, weightPounds, age, sex);
      const tdee = this.calculateTDEE(bmr, activityLevel);
      const weeklyCalories = this.calculateWeeklyCalories(tdee);
      const split = this.calculate52Split(weeklyCalories, sex, fitnessGoal);
      const macroSplit = this.calculateMacroSplit(activityLevel, fitnessGoal);
      
      // Calculate macro grams
      const weekdayMacroGrams = this.calculateMacroGrams(macroSplit.weekday, split.weekday.calories);
      const weekendMacroGrams = this.calculateMacroGrams(macroSplit.weekend, split.weekend.calories);
      
      // Return complete results
      return {
        userData: {
          firstName: user.first_name,
          age,
          heightInches,
          weightPounds,
          activityLevel,
          fitnessGoal,
          sex
        },
        calculations: {
          bmr,
          tdee,
          weeklyCalories,
          dailyAverage: Math.round(weeklyCalories / 7)
        },
        split: {
          weekday: {
            calories: split.weekday.calories,
            daysPerWeek: split.weekday.daysPerWeek,
            macroPercentages: macroSplit.weekday,
            macroGrams: weekdayMacroGrams
          },
          weekend: {
            calories: split.weekend.calories,
            daysPerWeek: split.weekend.daysPerWeek,
            macroPercentages: macroSplit.weekend,
            macroGrams: weekendMacroGrams
          }
        },
        macroSplit: {
          type: macroSplit.type,
          reason: macroSplit.reason
        }
      };
    } catch (error) {
      console.error('Error calculating calorie needs:', error);
      throw error;
    }
  }
}

// Export the calculator
export { CalorieCalculator };
