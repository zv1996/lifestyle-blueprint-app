/**
 * Shared Meal Plan Page for Lifestyle Blueprint
 * 
 * This module handles the public viewing of shared meal plans,
 * including displaying meal plan content and shopping lists
 * without requiring user authentication.
 */

import config from './config.js';

// State
let sharedMealPlan = null;
let sharedShoppingList = null;

/**
 * Initialize the shared meal plan page
 */
async function initSharedMealPlan() {
  try {
    // Get the share token from the URL
    const shareToken = getShareTokenFromUrl();
    
    if (!shareToken) {
      showError('Invalid share link. Please check the URL and try again.');
      return;
    }

    console.log('Loading shared meal plan with token:', shareToken);

    // Load the shared meal plan
    await loadSharedMealPlan(shareToken);
    
    // Load the shared shopping list
    await loadSharedShoppingList(shareToken);

  } catch (error) {
    console.error('Error initializing shared meal plan:', error);
    showError('Failed to load the shared meal plan. The link may have expired or be invalid.');
  }
}

/**
 * Get the share token from the URL
 * @returns {string|null} The share token or null if not found
 */
function getShareTokenFromUrl() {
  // Check if we're on a path like /s/abc123 or have a query parameter
  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);
  
  // Check for /s/{token} format
  const pathMatch = pathname.match(/\/s\/([a-zA-Z0-9]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  // Check for ?token={token} format
  const tokenParam = searchParams.get('token');
  if (tokenParam) {
    return tokenParam;
  }
  
  return null;
}

/**
 * Load the shared meal plan data
 * @param {string} shareToken - The share token
 */
async function loadSharedMealPlan(shareToken) {
  try {
    const response = await fetch(`${config.getApiBaseUrl()}/api/shared/${shareToken}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('This share link has expired or is no longer available.');
      }
      throw new Error(`Failed to load meal plan: ${response.statusText}`);
    }
    
    const data = await response.json();
    sharedMealPlan = data.mealPlan;
    
    console.log('Loaded shared meal plan:', sharedMealPlan);
    
    // Update the page title and nutrition info
    updateMealPlanHeader();
    
    // Render the meal plan content
    renderMealPlan();
    
  } catch (error) {
    console.error('Error loading shared meal plan:', error);
    throw error;
  }
}

/**
 * Load the shared shopping list data
 * @param {string} shareToken - The share token
 */
async function loadSharedShoppingList(shareToken) {
  try {
    const response = await fetch(`${config.getApiBaseUrl()}/api/shared/${shareToken}/shopping-list`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('No shopping list found for this shared meal plan');
        showShoppingListNotAvailable();
        return;
      }
      throw new Error(`Failed to load shopping list: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    sharedShoppingList = data.items;
    
    console.log('Loaded shopping list with', sharedShoppingList?.length || 0, 'items');
    
    // Render the shopping list
    renderShoppingList();
    
  } catch (error) {
    console.error('Error loading shared shopping list:', error);
    showShoppingListError();
  }
}

/**
 * Update the meal plan header with title and nutrition info
 */
function updateMealPlanHeader() {
  if (!sharedMealPlan) return;
  
  // Update the page title
  const titleElement = document.getElementById('mealPlanTitleText');
  const title = sharedMealPlan.title || 'Shared Meal Plan';
  
  if (titleElement) {
    titleElement.textContent = title;
    
    // Update browser title too
    document.title = `${title} - Lifestyle Blueprint`;
  }
  
  // Calculate and display nutrition information
  const nutritionSummary = document.getElementById('nutritionSummary');
  if (nutritionSummary) {
    const nutrition = calculateSharedMealPlanStats(sharedMealPlan);
    
    nutritionSummary.innerHTML = `
      <div class="nutrition-stats">
        <div class="nutrition-stat">
          <span class="stat-value">${nutrition.calories}</span>
          <span class="stat-label">calories per day</span>
        </div>
        <div class="nutrition-divider">|</div>
        <div class="nutrition-stat">
          <span class="stat-value">${nutrition.protein}g</span>
          <span class="stat-label">protein</span>
        </div>
        <div class="nutrition-divider">|</div>
        <div class="nutrition-stat">
          <span class="stat-value">${nutrition.carbs}g</span>
          <span class="stat-label">carbs</span>
        </div>
        <div class="nutrition-divider">|</div>
        <div class="nutrition-stat">
          <span class="stat-value">${nutrition.fat}g</span>
          <span class="stat-label">fat</span>
        </div>
      </div>
    `;
  }
}

/**
 * Calculate nutrition statistics for a shared meal plan
 * @param {Object} mealPlan - The meal plan data
 * @returns {Object} Nutrition statistics
 */
function calculateSharedMealPlanStats(mealPlan) {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let dayCount = 0;
  
  // Calculate totals for each day
  for (let day = 1; day <= 5; day++) {
    let dayCalories = 0;
    let dayProtein = 0;
    let dayCarbs = 0;
    let dayFat = 0;
    let hasMeals = false;
    
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const proteinKey = `${mealType}_${day}_protein`;
      const carbsKey = `${mealType}_${day}_carbs`;
      const fatKey = `${mealType}_${day}_fat`;
      
      if (
        mealPlan[proteinKey] && !isNaN(mealPlan[proteinKey]) &&
        mealPlan[carbsKey] && !isNaN(mealPlan[carbsKey]) &&
        mealPlan[fatKey] && !isNaN(mealPlan[fatKey])
      ) {
        const protein = parseInt(mealPlan[proteinKey]);
        const carbs = parseInt(mealPlan[carbsKey]);
        const fat = parseInt(mealPlan[fatKey]);
        
        dayProtein += protein;
        dayCarbs += carbs;
        dayFat += fat;
        
        // Calculate calories (4 cal/g protein, 4 cal/g carbs, 9 cal/g fat)
        dayCalories += (protein * 4) + (carbs * 4) + (fat * 9);
        hasMeals = true;
      }
    }
    
    if (hasMeals) {
      totalCalories += dayCalories;
      totalProtein += dayProtein;
      totalCarbs += dayCarbs;
      totalFat += dayFat;
      dayCount++;
    }
  }
  
  // Calculate daily averages
  if (dayCount > 0) {
    return {
      calories: Math.round(totalCalories / dayCount),
      protein: Math.round(totalProtein / dayCount),
      carbs: Math.round(totalCarbs / dayCount),
      fat: Math.round(totalFat / dayCount)
    };
  }
  
  // Default values if we can't calculate
  return {
    calories: 'N/A',
    protein: 'N/A',
    carbs: 'N/A',
    fat: 'N/A'
  };
}

/**
 * Render the meal plan content
 */
function renderMealPlan() {
  if (!sharedMealPlan) return;
  
  const mealPlanContent = document.getElementById('mealPlanContent');
  
  if (!mealPlanContent) return;
  
  // Clear loading state
  mealPlanContent.innerHTML = '';
  
  // Create meal plan HTML
  const mealPlanHTML = generateMealPlanHTML(sharedMealPlan);
  mealPlanContent.innerHTML = mealPlanHTML;
}

/**
 * Generate HTML for the meal plan
 * @param {Object} mealPlan - The meal plan data
 * @returns {string} HTML string
 */
function generateMealPlanHTML(mealPlan) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let html = '<div class="meal-plan-days">';
  
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const dayNumber = dayIndex + 1;
    const dayName = days[dayIndex];
    
    html += `<div class="meal-plan-day">`;
    html += `<h3 class="day-header">${dayName}</h3>`;
    html += `<div class="day-meals">`;
    
    // Render meals for this day
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const meal = getMealData(mealPlan, mealType, dayNumber);
      const mealTypeLabel = capitalizeFirst(mealType);
      
      if (meal.name) {
        html += `
          <div class="meal-card" data-day="${dayNumber}" data-meal-type="${mealType}">
            <h4>${mealTypeLabel}: ${meal.name}</h4>
            ${meal.description ? `<p class="meal-description">${meal.description}</p>` : ''}
            
            <div class="meal-details">
              ${meal.ingredients ? `
                <div class="meal-section">
                  <h5 class="meal-section-header">Ingredients</h5>
                  <div class="meal-section-content">
                    <div class="ingredients-list">
                      ${meal.ingredients}
                    </div>
                  </div>
                </div>
              ` : ''}
              
              ${meal.recipe ? `
                <div class="meal-section">
                  <h5 class="meal-section-header">Recipe</h5>
                  <div class="meal-section-content">
                    <p class="recipe-instructions">${meal.recipe}</p>
                  </div>
                </div>
              ` : ''}
              
              ${generateMacroInfo(meal)}
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="meal-card empty">
            <h4>${mealTypeLabel}</h4>
            <p>No meal data available</p>
          </div>
        `;
      }
    }
    
    html += `</div>`; // day-meals
    html += `</div>`; // meal-plan-day
  }
  
  html += `</div>`; // meal-plan-days
  
  // Add snacks and favorite meals sections if available
  html += generateSnacksSectionHTML(mealPlan);
  html += generateFavoriteMealsSectionHTML(mealPlan);
  
  return html;
}

/**
 * Get meal data for a specific meal type and day
 * @param {Object} mealPlan - The meal plan data
 * @param {string} mealType - The meal type (breakfast, lunch, dinner)
 * @param {number} day - The day number (1-5)
 * @returns {Object} Meal data
 */
function getMealData(mealPlan, mealType, day) {
  return {
    name: mealPlan[`${mealType}_${day}_name`] || '',
    description: mealPlan[`${mealType}_${day}_description`] || '',
    protein: mealPlan[`${mealType}_${day}_protein`] || '',
    carbs: mealPlan[`${mealType}_${day}_carbs`] || '',
    fat: mealPlan[`${mealType}_${day}_fat`] || '',
    ingredients: mealPlan[`${mealType}_${day}_ingredients`] || '',
    recipe: mealPlan[`${mealType}_${day}_recipe`] || ''
  };
}

/**
 * Generate nutrition information HTML for a meal
 * @param {Object} meal - The meal data
 * @returns {string} HTML string
 */
function generateNutritionInfo(meal) {
  if (!meal.protein && !meal.carbs && !meal.fat) {
    return '';
  }
  
  const macros = [];
  if (meal.protein) macros.push(`${meal.protein}g protein`);
  if (meal.carbs) macros.push(`${meal.carbs}g carbs`);
  if (meal.fat) macros.push(`${meal.fat}g fat`);
  
  if (macros.length === 0) return '';
  
  return `<div class="nutrition-info">${macros.join(' • ')}</div>`;
}

/**
 * Generate macro information HTML for a meal (matching meal-plan-results structure)
 * @param {Object} meal - The meal data
 * @returns {string} HTML string
 */
function generateMacroInfo(meal) {
  if (!meal.protein && !meal.carbs && !meal.fat) {
    return '';
  }
  
  return `
    <div class="meal-macros">
      <div class="macro-item">
        <span class="macro-label">Protein</span>
        <span class="macro-value">${meal.protein || 0}g</span>
      </div>
      <div class="macro-item">
        <span class="macro-label">Carbs</span>
        <span class="macro-value">${meal.carbs || 0}g</span>
      </div>
      <div class="macro-item">
        <span class="macro-label">Fat</span>
        <span class="macro-value">${meal.fat || 0}g</span>
      </div>
    </div>
  `;
}

/**
 * Generate snacks section HTML
 * @param {Object} mealPlan - The meal plan data
 * @returns {string} HTML string
 */
function generateSnacksSectionHTML(mealPlan) {
  if (!mealPlan.snack_1_name && !mealPlan.snack_2_name) {
    return '';
  }
  
  let html = '<h3 class="meal-plan-section-title">Snacks</h3>';
  html += '<div class="snacks-container">';
  
  if (mealPlan.snack_1_name) {
    html += `
      <div class="snack-card">
        <h4>${mealPlan.snack_1_name}</h4>
        <div class="snack-macros">
          <div class="macro-item">
            <span class="macro-label">Protein</span>
            <span class="macro-value">${mealPlan.snack_1_protein || 0}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Carbs</span>
            <span class="macro-value">${mealPlan.snack_1_carbs || 0}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Fat</span>
            <span class="macro-value">${mealPlan.snack_1_fat || 0}g</span>
          </div>
        </div>
      </div>
    `;
  }
  
  if (mealPlan.snack_2_name) {
    html += `
      <div class="snack-card">
        <h4>${mealPlan.snack_2_name}</h4>
        <div class="snack-macros">
          <div class="macro-item">
            <span class="macro-label">Protein</span>
            <span class="macro-value">${mealPlan.snack_2_protein || 0}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Carbs</span>
            <span class="macro-value">${mealPlan.snack_2_carbs || 0}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Fat</span>
            <span class="macro-value">${mealPlan.snack_2_fat || 0}g</span>
          </div>
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

/**
 * Generate favorite meals section HTML
 * @param {Object} mealPlan - The meal plan data
 * @returns {string} HTML string
 */
function generateFavoriteMealsSectionHTML(mealPlan) {
  if (!mealPlan.favorite_meal_1_name && !mealPlan.favorite_meal_2_name) {
    return '';
  }
  
  let html = '<h3 class="meal-plan-section-title">Favorite Meals</h3>';
  html += '<div class="favorite-meals-container">';
  
  if (mealPlan.favorite_meal_1_name) {
    html += `
      <div class="favorite-meal-card">
        <h4>${mealPlan.favorite_meal_1_name}</h4>
        <div class="favorite-meal-macros">
          <div class="macro-item">
            <span class="macro-label">Protein</span>
            <span class="macro-value">${mealPlan.favorite_meal_1_protein || 0}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Carbs</span>
            <span class="macro-value">${mealPlan.favorite_meal_1_carbs || 0}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Fat</span>
            <span class="macro-value">${mealPlan.favorite_meal_1_fat || 0}g</span>
          </div>
        </div>
      </div>
    `;
  }
  
  if (mealPlan.favorite_meal_2_name) {
    html += `
      <div class="favorite-meal-card">
        <h4>${mealPlan.favorite_meal_2_name}</h4>
        <div class="favorite-meal-macros">
          <div class="macro-item">
            <span class="macro-label">Protein</span>
            <span class="macro-value">${mealPlan.favorite_meal_2_protein || 0}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Carbs</span>
            <span class="macro-value">${mealPlan.favorite_meal_2_carbs || 0}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Fat</span>
            <span class="macro-value">${mealPlan.favorite_meal_2_fat || 0}g</span>
          </div>
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

/**
 * Render the shopping list content (matching meal-plan-results structure)
 */
function renderShoppingList() {
  if (!sharedShoppingList) {
    return;
  }
  
  const shoppingListContent = document.getElementById('shoppingListContent');
  
  if (!shoppingListContent) {
    return;
  }
  
  // Clear loading state
  shoppingListContent.innerHTML = '';
  
  if (!Array.isArray(sharedShoppingList) || sharedShoppingList.length === 0) {
    shoppingListContent.innerHTML = `
      <div class="empty-list">
        <p>No items found in your shopping list.</p>
      </div>
    `;
    return;
  }
  
  // Group items by category
  const itemsByCategory = {};
  
  sharedShoppingList.forEach(item => {
    const category = item.category || 'Other';
    
    if (!itemsByCategory[category]) {
      itemsByCategory[category] = [];
    }
    
    itemsByCategory[category].push(item);
  });
  
  // Sort categories alphabetically
  const sortedCategories = Object.keys(itemsByCategory).sort();
  
  // Create HTML for each category
  let html = '';
  
  sortedCategories.forEach((category, index) => {
    const items = itemsByCategory[category];
    
    // First category is expanded by default, others are collapsed
    const collapsedClass = index === 0 ? '' : 'collapsed';
    
    html += `
      <div class="category-section ${collapsedClass}">
        <h3 class="category-header">${category}</h3>
        <ul class="category-items">
          ${items.map(item => `
            <li class="shopping-item">
              <div class="item-details">
                <span class="item-name">${item.ingredient_name}</span>
                <span class="item-quantity">${item.quantity} ${item.unit || ''}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  });
  
  shoppingListContent.innerHTML = html;
  
  // Add event listeners for collapsible categories
  addShoppingListEventListeners();
}

/**
 * Group shopping list items by category
 * @param {Array} items - The shopping list items
 * @returns {Object} Items grouped by category
 */
function groupItemsByCategory(items) {
  const grouped = {};
  
  items.forEach(item => {
    const category = item.category || 'Other';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(item);
  });
  
  // Sort categories and items within each category
  const sortedGrouped = {};
  const sortedCategories = Object.keys(grouped).sort();
  
  sortedCategories.forEach(category => {
    sortedGrouped[category] = grouped[category].sort((a, b) => 
      a.ingredient_name.localeCompare(b.ingredient_name)
    );
  });
  
  return sortedGrouped;
}

/**
 * Show shopping list not available message
 */
function showShoppingListNotAvailable() {
  const shoppingListContent = document.getElementById('shoppingListContent');
  if (shoppingListContent) {
    shoppingListContent.innerHTML = '<p class="no-items">Shopping list not available for this meal plan.</p>';
  }
}

/**
 * Show shopping list error message
 */
function showShoppingListError() {
  const shoppingListContent = document.getElementById('shoppingListContent');
  if (shoppingListContent) {
    shoppingListContent.innerHTML = '<p class="error-message">Failed to load shopping list.</p>';
  }
}

/**
 * Add event listeners for shopping list collapsible sections
 */
function addShoppingListEventListeners() {
  // Add event listeners for category headers
  document.querySelectorAll('.category-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.category-section');
      if (section) {
        section.classList.toggle('collapsed');
      }
    });
  });
}

/**
 * Show an error message
 * @param {string} message - The error message
 */
function showError(message) {
  // Update both sections with error
  const mealPlanContent = document.getElementById('mealPlanContent');
  const shoppingListContent = document.getElementById('shoppingListContent');
  
  const errorHTML = `<div class="error-message">${message}</div>`;
  
  if (mealPlanContent) {
    mealPlanContent.innerHTML = errorHTML;
  }
  
  if (shoppingListContent) {
    shoppingListContent.innerHTML = errorHTML;
  }
  
  // Update the title
  const titleElement = document.getElementById('mealPlanTitleText');
  if (titleElement) {
    titleElement.textContent = 'Meal Plan Not Available';
  }
}

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} The capitalized string
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initSharedMealPlan);

// Export functions for testing
export { 
  initSharedMealPlan,
  calculateSharedMealPlanStats,
  getShareTokenFromUrl
};
