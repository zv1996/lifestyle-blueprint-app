/**
 * Meal History Page for Lifestyle Blueprint
 * 
 * This module handles the meal history page functionality,
 * including fetching and displaying meal plans, filtering,
 * and favorite functionality.
 */

import config from './config.js';
import { getCurrentUser, waitForAuth } from './auth.js';

// State for meal plans
let allMealPlans = [];
let filteredMealPlans = [];
let currentPage = 1;
const plansPerPage = 5; // Show 5 plans per page since we're using 1 column

/**
 * Initialize the meal history page
 */
async function initMealHistory() {
  try {
    // Show loading state immediately
    showLoadingState();

    // Wait for authentication to be ready
    await waitForAuth();
    const user = getCurrentUser();

    if (!user) {
      console.error('User not authenticated');
      hideLoadingState();
      window.location.href = 'login.html';
      return;
    }

    // Set up event listeners
    setupEventListeners();

    // Fetch meal plans
    await fetchMealPlans(user.id);

    // Apply initial filters
    applyFilters();

    // Hide loading state
    hideLoadingState();
  } catch (error) {
    console.error('Error initializing meal history:', error);
    hideLoadingState();
    showErrorMessage('Failed to load meal plans. Please try again later.');
  }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Search input
  const searchInput = document.querySelector('.search-bar input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      applyFilters();
    });
  }
  
  // Sort dropdown
  const sortDropdown = document.getElementById('sortBy');
  if (sortDropdown) {
    sortDropdown.addEventListener('change', () => {
      applyFilters();
    });
  }
  
  // Filter dropdown
  const filterDropdown = document.getElementById('filterBy');
  if (filterDropdown) {
    filterDropdown.addEventListener('change', () => {
      applyFilters();
    });
  }
  
  // Delegate event listener for meal plan cards
  document.addEventListener('click', async (event) => {
    // View Plan button
    if (event.target.classList.contains('view-btn') && !event.target.classList.contains('shopping-list')) {
      const mealPlanCard = event.target.closest('.meal-plan-card');
      if (mealPlanCard && mealPlanCard.dataset.id) {
        await viewMealPlan(mealPlanCard.dataset.id);
      }
    }
    
    // View Shopping List button
    if (event.target.classList.contains('view-btn') && event.target.classList.contains('shopping-list')) {
      const mealPlanCard = event.target.closest('.meal-plan-card');
      if (mealPlanCard && mealPlanCard.dataset.id) {
        await viewShoppingList(mealPlanCard.dataset.id);
      }
    }
    
    // Favorite checkbox
    if (event.target.closest('.favorite-checkbox input')) {
      const checkbox = event.target;
      const mealPlanCard = checkbox.closest('.meal-plan-card');
      if (mealPlanCard && mealPlanCard.dataset.id) {
        await toggleFavorite(mealPlanCard.dataset.id, checkbox.checked);
      }
    }
    
    // Clone button
    if (event.target.closest('.action-btn[aria-label="Clone"]')) {
      const mealPlanCard = event.target.closest('.meal-plan-card');
      if (mealPlanCard && mealPlanCard.dataset.id) {
        await cloneMealPlan(mealPlanCard.dataset.id);
      }
    }
    
    // Share button
    if (event.target.closest('.action-btn[aria-label="Share"]')) {
      const mealPlanCard = event.target.closest('.meal-plan-card');
      if (mealPlanCard && mealPlanCard.dataset.id) {
        await shareMealPlan(mealPlanCard.dataset.id);
      }
    }
  });
  
  // Pagination buttons
  document.addEventListener('click', (event) => {
    // Previous page button
    if (event.target.closest('.pagination-btn[aria-label="Previous page"]')) {
      if (currentPage > 1) {
        currentPage--;
        renderMealPlans();
        updatePagination();
      }
    }
    
    // Next page button
    if (event.target.closest('.pagination-btn[aria-label="Next page"]')) {
      const totalPages = Math.ceil(filteredMealPlans.length / plansPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        renderMealPlans();
        updatePagination();
      }
    }
    
    // Page number buttons
    if (event.target.closest('.page-numbers button')) {
      const pageButton = event.target.closest('.page-numbers button');
      const pageNumber = parseInt(pageButton.textContent);
      if (!isNaN(pageNumber)) {
        currentPage = pageNumber;
        renderMealPlans();
        updatePagination();
      }
    }
  });
}

/**
 * View a meal plan
 * @param {string} mealPlanId - The meal plan ID
 */
async function viewMealPlan(mealPlanId) {
  try {
    // Show loading state
    showMessage('Loading meal plan...');
    
    // Fetch the meal plan data
    const response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/${mealPlanId}`);
    
    if (!response.ok) {
      throw new Error(`Error loading meal plan: ${response.statusText}`);
    }
    
    // Parse the response
    const mealPlanData = await response.json();
    
    // Import the MealPlanViewOverlay class
    const { MealPlanViewOverlay } = await import('./meal-plan-view-overlay.js');
    
    // Create and show the overlay
    const overlay = new MealPlanViewOverlay({
      mealPlan: mealPlanData
    });
    
    overlay.show();
  } catch (error) {
    console.error('Error viewing meal plan:', error);
    showErrorMessage('Failed to load meal plan. Please try again later.');
  }
}

/**
 * View a shopping list
 * @param {string} mealPlanId - The meal plan ID
 */
async function viewShoppingList(mealPlanId) {
  try {
    console.log('Loading shopping list for meal plan ID:', mealPlanId);
    
    // Show loading state
    showMessage('Loading shopping list...');
    
    // Fetch the shopping list data
    const response = await fetch(`${config.getApiBaseUrl()}/api/shopping-list/by-meal-plan/${mealPlanId}`);
    
    console.log('Shopping list API response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`Error loading shopping list: ${response.statusText}`);
    }
    
    // Parse the response
    const data = await response.json();
    console.log('Shopping list data received:', data);
    
    // Prepare shopping list data
    const shoppingListData = {
      items: data.items || [],
      mealPlanId: mealPlanId
    };
    
    console.log('Prepared shopping list data:', shoppingListData);
    
    // Import the ShoppingListViewOverlay class
    const { ShoppingListViewOverlay } = await import('./shopping-list-view-overlay.js');
    
    // Create and show the overlay
    const overlay = new ShoppingListViewOverlay({
      shoppingList: shoppingListData
    });
    
    console.log('Created shopping list overlay, showing now...');
    overlay.show();
  } catch (error) {
    console.error('Error viewing shopping list:', error);
    showErrorMessage('Failed to load shopping list. Please try again later.');
  }
}

// Track cloning operations to prevent duplicates
const cloningInProgress = new Set();

// Track sharing operations to prevent duplicates
const sharingInProgress = new Set();

/**
 * Share a meal plan
 * @param {string} mealPlanId - The meal plan ID to share
 */
async function shareMealPlan(mealPlanId) {
  try {
    // Prevent duplicate sharing operations
    if (sharingInProgress.has(mealPlanId)) {
      console.log('Share operation already in progress for meal plan:', mealPlanId);
      return;
    }
    
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      console.error('User not authenticated');
      showErrorMessage('Please log in to share meal plans.');
      return;
    }
    
    console.log('Sharing meal plan:', mealPlanId);
    
    // Mark this meal plan as being shared
    sharingInProgress.add(mealPlanId);
    
    // Disable the share button for this meal plan
    const mealPlanCard = document.querySelector(`[data-id="${mealPlanId}"]`);
    const shareButton = mealPlanCard?.querySelector('.action-btn[aria-label="Share"]');
    if (shareButton) {
      shareButton.disabled = true;
      shareButton.style.opacity = '0.5';
      shareButton.style.cursor = 'not-allowed';
    }
    
    // Show loading state
    showMessage('Generating share link...');
    
    // Call the share API
    const response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/${mealPlanId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error creating share link: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Share link created successfully:', data);
    
    // Show the share overlay with the generated URL
    showShareOverlay(data.shareUrl, data.expiresAt);
    
  } catch (error) {
    console.error('Error sharing meal plan:', error);
    showErrorMessage(error.message || 'Failed to create share link. Please try again later.');
  } finally {
    // Always clean up - remove from sharing set and re-enable button
    sharingInProgress.delete(mealPlanId);
    
    // Re-enable the share button for this meal plan
    const mealPlanCard = document.querySelector(`[data-id="${mealPlanId}"]`);
    const shareButton = mealPlanCard?.querySelector('.action-btn[aria-label="Share"]');
    if (shareButton) {
      shareButton.disabled = false;
      shareButton.style.opacity = '';
      shareButton.style.cursor = '';
    }
  }
}

/**
 * Show the share overlay with the generated URL
 * @param {string} shareUrl - The share URL
 * @param {string} expiresAt - When the share link expires
 */
function showShareOverlay(shareUrl, expiresAt) {
  // Create the overlay
  const overlay = document.createElement('div');
  overlay.classList.add('share-overlay');
  overlay.innerHTML = `
    <div class="share-overlay-content">
      <div class="share-header">
        <h3>Share Meal Plan</h3>
        <button class="close-btn" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      
      <div class="share-content">
        <p class="share-description">Anyone with this link can view your meal plan and shopping list (no account required).</p>
        
        <div class="share-url-container">
          <input type="text" class="share-url" value="${window.location.origin}${shareUrl}" readonly>
          <button class="copy-btn" title="Copy to clipboard">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
        </div>
        
        <p class="share-expiry">Link expires on ${new Date(expiresAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</p>
      </div>
    </div>
  `;
  
  // Add event listeners
  const closeBtn = overlay.querySelector('.close-btn');
  const copyBtn = overlay.querySelector('.copy-btn');
  const shareUrlInput = overlay.querySelector('.share-url');
  
  // Close overlay
  closeBtn.addEventListener('click', () => {
    overlay.remove();
  });
  
  // Copy URL to clipboard
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrlInput.value);
      
      // Show success feedback
      copyBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      copyBtn.style.background = 'linear-gradient(to right, var(--gradient-start), var(--gradient-end))';
      
      // Show success message
      showMessage('Link copied to clipboard!');
      
      // Reset button after 2 seconds
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        `;
        copyBtn.style.background = '';
      }, 2000);
      
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      
      // Fallback: select the text
      shareUrlInput.select();
      shareUrlInput.setSelectionRange(0, 99999); // For mobile devices
      
      showMessage('Please copy the selected text');
    }
  });
  
  // Close overlay when clicking outside
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });
  
  // Add to page
  document.body.appendChild(overlay);
  
  // Focus the input for easy copying
  shareUrlInput.focus();
  shareUrlInput.select();
}

/**
 * Clone a meal plan
 * @param {string} mealPlanId - The meal plan ID to clone
 */
async function cloneMealPlan(mealPlanId) {
  try {
    // Prevent duplicate cloning operations
    if (cloningInProgress.has(mealPlanId)) {
      console.log('Clone operation already in progress for meal plan:', mealPlanId);
      return;
    }
    
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      console.error('User not authenticated');
      showErrorMessage('Please log in to clone meal plans.');
      return;
    }
    
    console.log('Cloning meal plan:', mealPlanId);
    
    // Mark this meal plan as being cloned
    cloningInProgress.add(mealPlanId);
    
    // Disable the clone button for this meal plan
    const mealPlanCard = document.querySelector(`[data-id="${mealPlanId}"]`);
    const cloneButton = mealPlanCard?.querySelector('.action-btn[aria-label="Clone"]');
    if (cloneButton) {
      cloneButton.disabled = true;
      cloneButton.style.opacity = '0.5';
      cloneButton.style.cursor = 'not-allowed';
    }
    
    // Show loading state
    showMessage('Cloning meal plan...');
    
    // Call the clone API
    const response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/clone/${mealPlanId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error cloning meal plan: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Meal plan cloned successfully:', data);
    
    // Show success message
    showMessage('Meal plan cloned successfully!');
    
    // Refresh the meal plans list to show the new cloned plan
    await fetchMealPlans(user.id);
    
    // Apply filters to update the UI (this will show the new plan at the top)
    applyFilters();
    
  } catch (error) {
    console.error('Error cloning meal plan:', error);
    showErrorMessage(error.message || 'Failed to clone meal plan. Please try again later.');
  } finally {
    // Always clean up - remove from cloning set and re-enable button
    cloningInProgress.delete(mealPlanId);
    
    // Re-enable the clone button for this meal plan
    const mealPlanCard = document.querySelector(`[data-id="${mealPlanId}"]`);
    const cloneButton = mealPlanCard?.querySelector('.action-btn[aria-label="Clone"]');
    if (cloneButton) {
      cloneButton.disabled = false;
      cloneButton.style.opacity = '';
      cloneButton.style.cursor = '';
    }
  }
}

/**
 * Toggle favorite status for a meal plan
 * @param {string} mealPlanId - The meal plan ID
 * @param {boolean} isFavorite - Whether the meal plan is a favorite
 */
async function toggleFavorite(mealPlanId, isFavorite) {
  try {
    // Get the current user
    const user = getCurrentUser();
    
    if (!user) {
      console.error('User not authenticated');
      return;
    }
    
    // Update the meal plan in the database
    const response = await fetch(`${config.getApiBaseUrl()}/api/meal-plan/${mealPlanId}/favorite`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id,
        isFavorite
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error updating favorite status: ${response.statusText}`);
    }
    
    // Update the meal plan in the local state
    allMealPlans = allMealPlans.map(mealPlan => {
      if (mealPlan.meal_plan_id === mealPlanId) {
        return {
          ...mealPlan,
          is_favorite: isFavorite
        };
      }
      return mealPlan;
    });
    
    // Apply filters to update the UI
    applyFilters();
  } catch (error) {
    console.error('Error toggling favorite:', error);
    showErrorMessage('Failed to update favorite status. Please try again later.');
  }
}

/**
 * Fetch meal plans from the server
 * @param {string} userId - The user ID
 */
async function fetchMealPlans(userId) {
  try {
    const response = await fetch(`${config.getApiBaseUrl()}/api/meal-plans/user/${userId}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching meal plans: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Store the meal plans
    allMealPlans = data;
    
    // Generate titles for meal plans that don't have descriptive titles
    allMealPlans = allMealPlans.map(mealPlan => {
      if (!mealPlan.title) {
        mealPlan.title = generateMealPlanTitle(mealPlan);
      }
      return mealPlan;
    });
    
    console.log('Fetched meal plans:', allMealPlans);
  } catch (error) {
    console.error('Error fetching meal plans:', error);
    throw error;
  }
}

/**
 * Apply filters to the meal plans
 */
function applyFilters() {
  // Get filter values
  const searchTerm = document.querySelector('.search-bar input')?.value.toLowerCase() || '';
  const sortBy = document.getElementById('sortBy')?.value || 'newest';
  const filterBy = document.getElementById('filterBy')?.value || 'all';
  
  // Filter meal plans
  filteredMealPlans = allMealPlans.filter(mealPlan => {
    // Apply search filter
    if (searchTerm) {
      const title = mealPlan.title || '';
      const description = getMealPlanDescription(mealPlan) || '';
      
      if (!title.toLowerCase().includes(searchTerm) && !description.toLowerCase().includes(searchTerm)) {
        return false;
      }
    }
    
    // Apply favorites filter
    if (filterBy === 'favorites' && !mealPlan.is_favorite) {
      return false;
    }
    
    return true;
  });
  
  // Sort meal plans
  filteredMealPlans.sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at) - new Date(a.created_at);
    } else if (sortBy === 'oldest') {
      return new Date(a.created_at) - new Date(b.created_at);
    } else if (sortBy === 'name') {
      return (a.title || '').localeCompare(b.title || '');
    }
    
    return 0;
  });
  
  // Reset to first page
  currentPage = 1;
  
  // Render meal plans
  renderMealPlans();
  
  // Update pagination
  updatePagination();
}

/**
 * Get a description of a meal plan
 * @param {Object} mealPlan - The meal plan
 * @returns {string} The description
 */
function getMealPlanDescription(mealPlan) {
  const meals = [];
  
  // Get meal names
  for (let day = 1; day <= 5; day++) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const nameKey = `${mealType}_${day}_name`;
      if (mealPlan[nameKey]) {
        meals.push(mealPlan[nameKey]);
      }
    }
  }
  
  // Get snack names
  if (mealPlan.snack_1_name) {
    meals.push(mealPlan.snack_1_name);
  }
  
  if (mealPlan.snack_2_name) {
    meals.push(mealPlan.snack_2_name);
  }
  
  // Get favorite meal names
  if (mealPlan.favorite_meal_1_name) {
    meals.push(mealPlan.favorite_meal_1_name);
  }
  
  if (mealPlan.favorite_meal_2_name) {
    meals.push(mealPlan.favorite_meal_2_name);
  }
  
  // Return a description
  if (meals.length > 0) {
    // Get unique meals
    const uniqueMeals = [...new Set(meals)];
    
    // Limit to 4 meals
    const limitedMeals = uniqueMeals.slice(0, 4);
    
    return `Includes: ${limitedMeals.join(', ')}${uniqueMeals.length > 4 ? '...' : ''}`;
  }
  
  return '';
}

/**
 * Generate a descriptive title for a meal plan
 * @param {Object} mealPlan - The meal plan
 * @returns {string} The generated title
 */
function generateMealPlanTitle(mealPlan) {
  // Default title if we can't generate a better one
  let title = "Custom Meal Plan";
  
  try {
    // Check for dietary preferences
    const dietaryPreferences = [];
    
    // Check for vegetarian meals
    const vegetarianMeals = countMealsWithIngredient(mealPlan, ['tofu', 'tempeh', 'seitan', 'lentil', 'bean']);
    const totalMeals = countTotalMeals(mealPlan);
    
    if (vegetarianMeals / totalMeals > 0.7) {
      dietaryPreferences.push('Vegetarian');
    }
    
    // Check for high protein
    const highProtein = checkHighProtein(mealPlan);
    if (highProtein) {
      dietaryPreferences.push('High-Protein');
    }
    
    // Check for keto
    const ketoMeals = countMealsWithIngredient(mealPlan, ['avocado', 'bacon', 'butter', 'cheese', 'cream']);
    if (ketoMeals / totalMeals > 0.7) {
      dietaryPreferences.push('Keto');
    }
    
    // Check for paleo
    const paleoMeals = countMealsWithIngredient(mealPlan, ['grass-fed', 'wild-caught', 'sweet potato', 'almond', 'coconut']);
    if (paleoMeals / totalMeals > 0.7) {
      dietaryPreferences.push('Paleo');
    }
    
    // Check for vegan
    const veganMeals = countMealsWithIngredient(mealPlan, ['tofu', 'tempeh', 'seitan', 'nutritional yeast', 'plant-based']);
    if (veganMeals / totalMeals > 0.7) {
      dietaryPreferences.push('Vegan');
    }
    
    // If we have dietary preferences, use them in the title
    if (dietaryPreferences.length > 0) {
      title = `${dietaryPreferences[0]} Meal Plan`;
    } else {
      // If no specific dietary preference, check for balanced
      title = "Balanced Nutrition Plan";
    }
    
    // Add calorie information if available
    if (mealPlan.breakfast_1_protein && mealPlan.breakfast_1_carbs && mealPlan.breakfast_1_fat) {
      const caloriesPerDay = estimateDailyCalories(mealPlan);
      if (caloriesPerDay > 2200) {
        title = `High-Calorie ${title}`;
      } else if (caloriesPerDay < 1600) {
        title = `Low-Calorie ${title}`;
      }
    }
  } catch (error) {
    console.error('Error generating meal plan title:', error);
    // Fall back to default title
    title = "Custom Meal Plan";
  }
  
  return title;
}

/**
 * Count meals with specific ingredients
 * @param {Object} mealPlan - The meal plan
 * @param {Array} ingredients - The ingredients to look for
 * @returns {number} The number of meals with the ingredients
 */
function countMealsWithIngredient(mealPlan, ingredients) {
  let count = 0;
  
  // Check each meal type and day
  for (let day = 1; day <= 5; day++) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const ingredientsKey = `${mealType}_${day}_ingredients`;
      const descriptionKey = `${mealType}_${day}_description`;
      
      // Check ingredients if available
      if (mealPlan[ingredientsKey]) {
        try {
          const mealIngredients = typeof mealPlan[ingredientsKey] === 'string' 
            ? JSON.parse(mealPlan[ingredientsKey]) 
            : mealPlan[ingredientsKey];
          
          if (Array.isArray(mealIngredients)) {
            for (const ingredient of mealIngredients) {
              const ingredientName = typeof ingredient === 'string' ? ingredient : ingredient.name;
              if (ingredientName && ingredients.some(i => ingredientName.toLowerCase().includes(i))) {
                count++;
                break;
              }
            }
          }
        } catch (e) {
          // If parsing fails, try to check the string directly
          if (typeof mealPlan[ingredientsKey] === 'string') {
            if (ingredients.some(i => mealPlan[ingredientsKey].toLowerCase().includes(i))) {
              count++;
            }
          }
        }
      }
      
      // Check description as fallback
      if (mealPlan[descriptionKey] && typeof mealPlan[descriptionKey] === 'string') {
        if (ingredients.some(i => mealPlan[descriptionKey].toLowerCase().includes(i))) {
          count++;
        }
      }
    }
  }
  
  return count;
}

/**
 * Count total meals in a meal plan
 * @param {Object} mealPlan - The meal plan
 * @returns {number} The total number of meals
 */
function countTotalMeals(mealPlan) {
  let count = 0;
  
  // Count each meal type and day
  for (let day = 1; day <= 5; day++) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const nameKey = `${mealType}_${day}_name`;
      if (mealPlan[nameKey]) {
        count++;
      }
    }
  }
  
  return count || 15; // Default to 15 if we can't count
}

/**
 * Check if a meal plan is high protein
 * @param {Object} mealPlan - The meal plan
 * @returns {boolean} Whether the meal plan is high protein
 */
function checkHighProtein(mealPlan) {
  let totalProtein = 0;
  let mealCount = 0;
  
  // Sum up protein for each meal
  for (let day = 1; day <= 5; day++) {
    for (const mealType of ['breakfast', 'lunch', 'dinner']) {
      const proteinKey = `${mealType}_${day}_protein`;
      if (mealPlan[proteinKey] && !isNaN(mealPlan[proteinKey])) {
        totalProtein += parseInt(mealPlan[proteinKey]);
        mealCount++;
      }
    }
  }
  
  // Calculate average protein per meal
  const avgProtein = mealCount > 0 ? totalProtein / mealCount : 0;
  
  // Consider high protein if average is > 25g per meal
  return avgProtein > 25;
}

/**
 * Estimate daily calories for a meal plan
 * @param {Object} mealPlan - The meal plan
 * @returns {number} The estimated daily calories
 */
function estimateDailyCalories(mealPlan) {
  let totalCalories = 0;
  let dayCount = 0;
  
  // Calculate calories for each day
  for (let day = 1; day <= 5; day++) {
    let dayCalories = 0;
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
        // Calculate calories using macronutrients (4 cal/g protein, 4 cal/g carbs, 9 cal/g fat)
        const protein = parseInt(mealPlan[proteinKey]);
        const carbs = parseInt(mealPlan[carbsKey]);
        const fat = parseInt(mealPlan[fatKey]);
        
        dayCalories += (protein * 4) + (carbs * 4) + (fat * 9);
        hasMeals = true;
      }
    }
    
    if (hasMeals) {
      totalCalories += dayCalories;
      dayCount++;
    }
  }
  
  // Calculate average daily calories
  return dayCount > 0 ? Math.round(totalCalories / dayCount) : 2000; // Default to 2000 if we can't calculate
}

/**
 * Show a loading state
 */
function showLoadingState() {
  const mealPlansGrid = document.querySelector('.meal-plans-grid');
  
  if (!mealPlansGrid) {
    return;
  }
  
  // Clear existing meal plans
  mealPlansGrid.innerHTML = '';
  
  // Add loading message
  const loadingMessage = document.createElement('div');
  loadingMessage.classList.add('loading-message');
  loadingMessage.innerHTML = `
    <div class="loading-spinner"></div>
    <p>Loading meal plans...</p>
  `;
  
  mealPlansGrid.appendChild(loadingMessage);
}

/**
 * Hide loading state
 */
function hideLoadingState() {
  const loadingMessage = document.querySelector('.loading-message');
  
  if (loadingMessage) {
    loadingMessage.remove();
  }
}

/**
 * Show an error message
 * @param {string} message - The error message
 */
function showErrorMessage(message) {
  // Create a toast element
  const toast = document.createElement('div');
  toast.classList.add('toast', 'error');
  toast.textContent = message;
  
  // Add the toast to the body
  document.body.appendChild(toast);
  
  // Show the toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Hide the toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    
    // Remove the toast after the animation
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

/**
 * Show a message
 * @param {string} message - The message
 */
function showMessage(message) {
  // Create a toast element
  const toast = document.createElement('div');
  toast.classList.add('toast');
  toast.textContent = message;
  
  // Add the toast to the body
  document.body.appendChild(toast);
  
  // Show the toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Hide the toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    
    // Remove the toast after the animation
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

/**
 * Render meal plans
 */
function renderMealPlans() {
  const mealPlansGrid = document.querySelector('.meal-plans-grid');
  
  if (!mealPlansGrid) {
    return;
  }
  
  // Clear existing meal plans
  mealPlansGrid.innerHTML = '';
  
  // Calculate start and end indices for pagination
  const startIndex = (currentPage - 1) * plansPerPage;
  const endIndex = startIndex + plansPerPage;
  
  // Get meal plans for the current page
  const mealPlansToShow = filteredMealPlans.slice(startIndex, endIndex);
  
  // If no meal plans, show a message
  if (mealPlansToShow.length === 0) {
    const noPlansMessage = document.createElement('div');
    noPlansMessage.classList.add('no-plans-message');
    noPlansMessage.textContent = 'No meal plans found.';
    mealPlansGrid.appendChild(noPlansMessage);
    return;
  }
  
  // Render each meal plan
  mealPlansToShow.forEach(mealPlan => {
    const mealPlanCard = createMealPlanCard(mealPlan);
    mealPlansGrid.appendChild(mealPlanCard);
  });
}

/**
 * Create a meal plan card
 * @param {Object} mealPlan - The meal plan data
 * @returns {HTMLElement} The meal plan card
 */
function createMealPlanCard(mealPlan) {
  const mealPlanCard = document.createElement('div');
  mealPlanCard.classList.add('meal-plan-card');
  mealPlanCard.dataset.id = mealPlan.meal_plan_id;
  
  // Format date
  const date = new Date(mealPlan.created_at);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Calculate calories and meals
  const caloriesPerDay = estimateDailyCalories(mealPlan);
  const totalMeals = countTotalMeals(mealPlan);
  
  // Check if this is a cloned meal plan
  const isCloned = mealPlan.based_on_plan_id || (mealPlan.title && mealPlan.title.startsWith('🔄'));
  
  // Create subtitle for cloned plans
  let cloneSubtitle = '';
  if (isCloned && mealPlan.based_on_plan_id) {
    // Find the original meal plan to get its creation date
    const originalPlan = allMealPlans.find(plan => plan.meal_plan_id === mealPlan.based_on_plan_id);
    if (originalPlan) {
      const originalDate = new Date(originalPlan.created_at);
      const originalFormattedDate = originalDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      cloneSubtitle = `<div class="clone-subtitle">Based on plan from ${originalFormattedDate}</div>`;
    } else {
      cloneSubtitle = `<div class="clone-subtitle">Cloned meal plan</div>`;
    }
  }
  
  // Create the card HTML
  mealPlanCard.innerHTML = `
    <div class="meal-plan-header">
      <span class="date">${formattedDate}</span>
      <label class="favorite-checkbox">
        <input type="checkbox" class="sr-only" ${mealPlan.is_favorite ? 'checked' : ''}>
        <svg class="star-icon" viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
        </svg>
        <span>Favorite</span>
      </label>
    </div>
    
    <div class="meal-plan-card-content">
      <div class="meal-plan-info">
        <h3 ${isCloned ? 'data-cloned="true"' : ''}>${mealPlan.title || 'Custom Meal Plan'}</h3>
        ${cloneSubtitle}
        <div class="meal-plan-preview">
          <p>${getMealPlanDescription(mealPlan)}</p>
        </div>
      </div>
      
      <div class="meal-plan-stats">
        <div class="stat">
          <span class="value">${caloriesPerDay}</span>
          <span class="label">Calories</span>
        </div>
        <div class="stat">
          <span class="value">${totalMeals}</span>
          <span class="label">Meals</span>
        </div>
      </div>
    </div>
    
    <div class="meal-plan-actions">
      <div class="primary-actions">
        <button class="view-btn">View Plan</button>
        <button class="view-btn shopping-list">View Shopping List</button>
      </div>
      
      <div class="secondary-actions">
        <button class="action-btn" aria-label="Download" title="Download Meal Plan">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button class="action-btn" aria-label="Clone" title="Clone Meal Plan">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="action-btn" aria-label="Share" title="Share Meal Plan">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
  
  return mealPlanCard;
}

/**
 * Update pagination
 */
function updatePagination() {
  const pagination = document.querySelector('.pagination');
  
  if (!pagination) {
    return;
  }
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredMealPlans.length / plansPerPage);
  
  // Update page numbers
  const pageNumbers = pagination.querySelector('.page-numbers');
  
  if (pageNumbers) {
    pageNumbers.innerHTML = '';
    
    // Add page numbers
    if (totalPages <= 5) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        if (i === currentPage) {
          pageButton.classList.add('active');
        }
        pageNumbers.appendChild(pageButton);
      }
    } else {
      // Show first, current, last, and ellipses
      
      // First page
      const firstPageButton = document.createElement('button');
      firstPageButton.textContent = '1';
      if (currentPage === 1) {
        firstPageButton.classList.add('active');
      }
      pageNumbers.appendChild(firstPageButton);
      
      // Ellipsis before current page
      if (currentPage > 2) {
        const ellipsisBefore = document.createElement('span');
        ellipsisBefore.textContent = '...';
        pageNumbers.appendChild(ellipsisBefore);
      }
      
      // Current page (if not first or last)
      if (currentPage !== 1 && currentPage !== totalPages) {
        const currentPageButton = document.createElement('button');
        currentPageButton.textContent = currentPage;
        currentPageButton.classList.add('active');
        pageNumbers.appendChild(currentPageButton);
      }
      
      // Ellipsis after current page
      if (currentPage < totalPages - 1) {
        const ellipsisAfter = document.createElement('span');
        ellipsisAfter.textContent = '...';
        pageNumbers.appendChild(ellipsisAfter);
      }
      
      // Last page
      const lastPageButton = document.createElement('button');
      lastPageButton.textContent = totalPages;
      if (currentPage === totalPages) {
        lastPageButton.classList.add('active');
      }
      pageNumbers.appendChild(lastPageButton);
    }
  }
  
  // Update previous button
  const prevButton = pagination.querySelector('.pagination-btn[aria-label="Previous page"]');
  if (prevButton) {
    prevButton.disabled = currentPage === 1;
  }
  
  // Update next button
  const nextButton = pagination.querySelector('.pagination-btn[aria-label="Next page"]');
  if (nextButton) {
    nextButton.disabled = currentPage === totalPages;
  }
}

// Initialize the meal history page when the DOM is loaded
document.addEventListener('DOMContentLoaded', initMealHistory);

// Export the functions
export { initMealHistory };
