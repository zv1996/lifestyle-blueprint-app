/**
 * Meal Plan Results for Lifestyle Blueprint
 * 
 * This module handles loading and displaying the meal plan and shopping list
 * on the results page after the user completes the chatbot conversation.
 */

import config from './config.js';
import { getCurrentUser, isAuthenticated, onAuthStateChange } from './auth.js';

// DOM elements
let mealPlanContent;
let shoppingListContent;

// Data storage
let mealPlanData = null;
let shoppingListData = null;

/**
 * Initialize the meal plan results page
 */
async function initMealPlanResults() {
  // Get DOM elements
  mealPlanContent = document.getElementById('mealPlanContent');
  shoppingListContent = document.getElementById('shoppingListContent');
  
  // Add event listener for mobile menu toggle
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('nav');
  
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      nav.classList.toggle('active');
    });
  }
  
  // Get the meal plan ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const mealPlanId = urlParams.get('mealPlanId');
  
  if (!mealPlanId) {
    showError('No meal plan ID provided. Please go back and try again.');
    return;
  }
  
  // Show loading state initially
  if (mealPlanContent) {
    showLoading(mealPlanContent);
  }
  if (shoppingListContent) {
    showLoading(shoppingListContent);
  }
  
  // Check if user is already authenticated
  const user = getCurrentUser();
  if (user) {
    // User is already authenticated, load data
    loadData(mealPlanId, user.id);
  } else {
    // Check if there's a session in localStorage
    const sessionStr = localStorage.getItem('supabase.auth.token');
    if (sessionStr) {
      try {
        // Parse the session
        const session = JSON.parse(sessionStr);
        console.log('Found session in localStorage:', session);
        
        // Check if session is valid
        if (session && session.user) {
          console.log('Session is valid, proceeding with data loading');
          // Wait a short time for auth.js to initialize
          setTimeout(() => {
            const user = getCurrentUser();
            if (user) {
              loadData(mealPlanId, user.id);
            } else {
              // Subscribe to auth state changes
              waitForAuthentication(mealPlanId);
            }
          }, 500);
          return;
        }
      } catch (error) {
        console.error('Error parsing session:', error);
      }
    }
    
    // If we get here, we need to wait for authentication
    waitForAuthentication(mealPlanId);
  }
}

/**
 * Wait for authentication to complete
 * @param {string} mealPlanId - The meal plan ID
 */
function waitForAuthentication(mealPlanId) {
  console.log('Waiting for authentication...');
  
  // Set a timeout for auth check
  const authTimeout = setTimeout(() => {
    if (!isAuthenticated()) {
      showError('User not authenticated. Please log in to view your meal plan and shopping list.');
    }
  }, 3000); // 3 second timeout
  
  // Subscribe to auth state changes
  const unsubscribe = onAuthStateChange(user => {
    console.log('Auth state changed:', user);
    clearTimeout(authTimeout);
    
    if (user) {
      // User is authenticated, load data
      loadData(mealPlanId, user.id);
      // Unsubscribe from auth state changes
      unsubscribe();
    }
  });
}

/**
 * Load meal plan and shopping list data
 * @param {string} mealPlanId - The meal plan ID
 * @param {string} userId - The user ID
 */
async function loadData(mealPlanId, userId) {
  try {
    console.log('Loading data for meal plan:', mealPlanId, 'and user:', userId);
    
    // Load the meal plan and shopping list data
    await Promise.all([
      loadMealPlan(mealPlanId, userId),
      loadShoppingList(mealPlanId, userId)
    ]);
    
    // Add event listeners for collapsible sections
    addCollapsibleSectionListeners();
    
  } catch (error) {
    console.error('Error loading data:', error);
    showError('An error occurred while loading your meal plan and shopping list. Please try again later.');
  }
}

/**
 * Load the meal plan data
 * @param {string} mealPlanId - The meal plan ID
 * @param {string} userId - The user ID
 */
async function loadMealPlan(mealPlanId, userId) {
  try {
    // Show loading state
    showLoading(mealPlanContent);
    
    // Fetch the meal plan data from the API
    const response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/${mealPlanId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error loading meal plan: ${response.statusText}`);
    }
    
    // Parse the response
    const data = await response.json();
    
    if (!data) {
      throw new Error('No meal plan data found');
    }
    
    // Store the meal plan data
    mealPlanData = data;
    
    // Render the meal plan
    renderMealPlan();
    
  } catch (error) {
    console.error('Error loading meal plan:', error);
    showError('Failed to load meal plan data. Please try again later.', mealPlanContent);
  }
}

/**
 * Load the shopping list data
 * @param {string} mealPlanId - The meal plan ID
 * @param {string} userId - The user ID
 */
async function loadShoppingList(mealPlanId, userId) {
  try {
    // Show loading state
    showLoading(shoppingListContent);
    
    // Fetch the shopping list data from the API
    const response = await fetch(`${config.getApiBaseUrl()}/api/shopping-list/by-meal-plan/${mealPlanId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error loading shopping list: ${response.statusText}`);
    }
    
    // Parse the response
    const data = await response.json();
    
    if (!data || !data.items || !Array.isArray(data.items)) {
      throw new Error('No shopping list data found');
    }
    
    // Store the shopping list data
    shoppingListData = {
      items: data.items,
      mealPlanId: mealPlanId
    };
    
    // Render the shopping list
    renderShoppingList();
    
  } catch (error) {
    console.error('Error loading shopping list:', error);
    showError('Failed to load shopping list data. Please try again later.', shoppingListContent);
  }
}

/**
 * Render the meal plan
 */
function renderMealPlan() {
  if (!mealPlanData || !mealPlanContent) {
    return;
  }
  
  // Clear the content
  mealPlanContent.innerHTML = '';
  
  // Create the meal plan days
  const mealPlanDaysHtml = createMealPlanDaysHtml();
  
  // Create the snacks section if applicable
  const snacksSectionHtml = createSnacksSectionHtml();
  
  // Create the favorite meals section if applicable
  const favoriteMealsSectionHtml = createFavoriteMealsSectionHtml();
  
  // Combine all sections
  mealPlanContent.innerHTML = `
    <div class="meal-plan-days">
      ${mealPlanDaysHtml}
    </div>
    ${snacksSectionHtml}
    ${favoriteMealsSectionHtml}
  `;
}

/**
 * Create the HTML for the meal plan days
 * @returns {string} The HTML for the meal plan days
 */
function createMealPlanDaysHtml() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  let html = '';
  
  for (let day = 1; day <= 5; day++) {
    const dayName = days[day - 1];
    const breakfastMeal = getMealByDayAndType(day, 'breakfast');
    const lunchMeal = getMealByDayAndType(day, 'lunch');
    const dinnerMeal = getMealByDayAndType(day, 'dinner');
    
    html += `
      <div class="meal-plan-day">
        <h3 class="day-header">${dayName}</h3>
        <div class="day-meals">
          ${createMealCardHtml(breakfastMeal, 'Breakfast')}
          ${createMealCardHtml(lunchMeal, 'Lunch')}
          ${createMealCardHtml(dinnerMeal, 'Dinner')}
        </div>
      </div>
    `;
  }
  
  return html;
}

/**
 * Create the HTML for a meal card
 * @param {Object} meal - The meal data
 * @param {string} mealTypeLabel - The label for the meal type
 * @returns {string} The HTML for the meal card
 */
function createMealCardHtml(meal, mealTypeLabel) {
  if (!meal) {
    return `
      <div class="meal-card empty">
        <h4>${mealTypeLabel}</h4>
        <p>No meal data available</p>
      </div>
    `;
  }
  
  return `
    <div class="meal-card" data-day="${meal.day}" data-meal-type="${meal.mealType}">
      <h4>${mealTypeLabel}: ${meal.name}</h4>
      <p class="meal-description">${meal.description}</p>
      
      <div class="meal-details">
        <div class="meal-section">
          <h5 class="meal-section-header">Ingredients</h5>
          <div class="meal-section-content">
            <ul class="ingredients-list">
              ${meal.ingredients.map(ingredient => `
                <li>${ingredient.quantity} ${ingredient.unit} ${ingredient.name}</li>
              `).join('')}
            </ul>
          </div>
        </div>
        
        <div class="meal-section">
          <h5 class="meal-section-header">Recipe</h5>
          <div class="meal-section-content">
            <p class="recipe-instructions">${meal.recipe}</p>
          </div>
        </div>
        
        <div class="meal-macros">
          <div class="macro-item">
            <span class="macro-label">Protein</span>
            <span class="macro-value">${meal.protein}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Carbs</span>
            <span class="macro-value">${meal.carbs}g</span>
          </div>
          <div class="macro-item">
            <span class="macro-label">Fat</span>
            <span class="macro-value">${meal.fat}g</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Create the HTML for the snacks section
 * @returns {string} The HTML for the snacks section
 */
function createSnacksSectionHtml() {
  if (!mealPlanData.snack_1_name && !mealPlanData.snack_2_name) {
    return '';
  }
  
  return `
    <h3 class="meal-plan-section-title">Snacks</h3>
    <div class="snacks-container">
      ${mealPlanData.snack_1_name ? `
        <div class="snack-card">
          <h4>${mealPlanData.snack_1_name}</h4>
          <div class="snack-macros">
            <div class="macro-item">
              <span class="macro-label">Protein</span>
              <span class="macro-value">${mealPlanData.snack_1_protein || 0}g</span>
            </div>
            <div class="macro-item">
              <span class="macro-label">Carbs</span>
              <span class="macro-value">${mealPlanData.snack_1_carbs || 0}g</span>
            </div>
            <div class="macro-item">
              <span class="macro-label">Fat</span>
              <span class="macro-value">${mealPlanData.snack_1_fat || 0}g</span>
            </div>
          </div>
        </div>
      ` : ''}
      
      ${mealPlanData.snack_2_name ? `
        <div class="snack-card">
          <h4>${mealPlanData.snack_2_name}</h4>
          <div class="snack-macros">
            <div class="macro-item">
              <span class="macro-label">Protein</span>
              <span class="macro-value">${mealPlanData.snack_2_protein || 0}g</span>
            </div>
            <div class="macro-item">
              <span class="macro-label">Carbs</span>
              <span class="macro-value">${mealPlanData.snack_2_carbs || 0}g</span>
            </div>
            <div class="macro-item">
              <span class="macro-label">Fat</span>
              <span class="macro-value">${mealPlanData.snack_2_fat || 0}g</span>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create the HTML for the favorite meals section
 * @returns {string} The HTML for the favorite meals section
 */
function createFavoriteMealsSectionHtml() {
  if (!mealPlanData.favorite_meal_1_name && !mealPlanData.favorite_meal_2_name) {
    return '';
  }
  
  return `
    <h3 class="meal-plan-section-title">Favorite Meals</h3>
    <div class="favorite-meals-container">
      ${mealPlanData.favorite_meal_1_name ? `
        <div class="favorite-meal-card">
          <h4>${mealPlanData.favorite_meal_1_name}</h4>
          <div class="favorite-meal-macros">
            <div class="macro-item">
              <span class="macro-label">Protein</span>
              <span class="macro-value">${mealPlanData.favorite_meal_1_protein || 0}g</span>
            </div>
            <div class="macro-item">
              <span class="macro-label">Carbs</span>
              <span class="macro-value">${mealPlanData.favorite_meal_1_carbs || 0}g</span>
            </div>
            <div class="macro-item">
              <span class="macro-label">Fat</span>
              <span class="macro-value">${mealPlanData.favorite_meal_1_fat || 0}g</span>
            </div>
          </div>
        </div>
      ` : ''}
      
      ${mealPlanData.favorite_meal_2_name ? `
        <div class="favorite-meal-card">
          <h4>${mealPlanData.favorite_meal_2_name}</h4>
          <div class="favorite-meal-macros">
            <div class="macro-item">
              <span class="macro-label">Protein</span>
              <span class="macro-value">${mealPlanData.favorite_meal_2_protein || 0}g</span>
            </div>
            <div class="macro-item">
              <span class="macro-label">Carbs</span>
              <span class="macro-value">${mealPlanData.favorite_meal_2_carbs || 0}g</span>
            </div>
            <div class="macro-item">
              <span class="macro-label">Fat</span>
              <span class="macro-value">${mealPlanData.favorite_meal_2_fat || 0}g</span>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render the shopping list
 */
function renderShoppingList() {
  if (!shoppingListData || !shoppingListContent) {
    return;
  }
  
  // Clear the content
  shoppingListContent.innerHTML = '';
  
  // Check if we have items
  if (!shoppingListData.items || !Array.isArray(shoppingListData.items) || shoppingListData.items.length === 0) {
    shoppingListContent.innerHTML = `
      <div class="empty-list">
        <p>No items found in your shopping list.</p>
      </div>
    `;
    return;
  }
  
  // Group items by category
  const itemsByCategory = {};
  
  shoppingListData.items.forEach(item => {
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
                <span class="item-quantity">${item.quantity} ${item.unit}</span>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  });
  
  shoppingListContent.innerHTML = html;
}

/**
 * Get a meal by day and type
 * @param {number} day - The day number (1-5)
 * @param {string} mealType - The meal type (breakfast, lunch, dinner)
 * @returns {Object|null} The meal data or null if not found
 */
function getMealByDayAndType(day, mealType) {
  // Check if we have structured meal data
  if (mealPlanData.meals && Array.isArray(mealPlanData.meals)) {
    return mealPlanData.meals.find(meal => meal.day === day && meal.mealType === mealType) || null;
  }
  
  // Otherwise, extract from the flat structure
  const nameKey = `${mealType}_${day}_name`;
  const descriptionKey = `${mealType}_${day}_description`;
  const ingredientsKey = `${mealType}_${day}_ingredients`;
  const recipeKey = `${mealType}_${day}_recipe`;
  const proteinKey = `${mealType}_${day}_protein`;
  const carbsKey = `${mealType}_${day}_carbs`;
  const fatKey = `${mealType}_${day}_fat`;
  
  if (!mealPlanData[nameKey]) {
    return null;
  }
  
  // Handle ingredients properly - ensure it's an array
  let ingredients = [];
  if (mealPlanData[ingredientsKey]) {
    // If it's already an array, use it
    if (Array.isArray(mealPlanData[ingredientsKey])) {
      ingredients = mealPlanData[ingredientsKey];
    } else {
      // If it's an object with nested arrays (from JSON stringification/parsing)
      try {
        // Try to parse it if it's a string
        if (typeof mealPlanData[ingredientsKey] === 'string') {
          ingredients = JSON.parse(mealPlanData[ingredientsKey]);
        } else {
          // Otherwise, assume it's already an object
          ingredients = mealPlanData[ingredientsKey];
        }
      } catch (e) {
        console.error(`Error parsing ingredients for ${mealType} on day ${day}:`, e);
        ingredients = [];
      }
    }
  }
  
  return {
    day,
    mealType,
    name: mealPlanData[nameKey],
    description: mealPlanData[descriptionKey] || '',
    ingredients: ingredients,
    recipe: mealPlanData[recipeKey] || '',
    protein: mealPlanData[proteinKey] || 0,
    carbs: mealPlanData[carbsKey] || 0,
    fat: mealPlanData[fatKey] || 0
  };
}

/**
 * Add event listeners for collapsible sections
 */
function addCollapsibleSectionListeners() {
  // Add event listeners for meal section headers
  document.querySelectorAll('.meal-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.meal-section');
      if (section) {
        section.classList.toggle('expanded');
      }
    });
  });
  
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
 * Show a loading indicator
 * @param {HTMLElement} container - The container to show the loading indicator in
 */
function showLoading(container) {
  if (!container) {
    return;
  }
  
  container.innerHTML = `
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading...</p>
    </div>
  `;
}

/**
 * Show an error message
 * @param {string} message - The error message to show
 * @param {HTMLElement} container - The container to show the error message in (optional)
 */
function showError(message, container = null) {
  if (container) {
    container.innerHTML = `
      <div class="error-container">
        <p class="error-message">${message}</p>
      </div>
    `;
  } else {
    alert(message);
  }
}

// Initialize the page when the DOM is loaded
document.addEventListener('DOMContentLoaded', initMealPlanResults);
