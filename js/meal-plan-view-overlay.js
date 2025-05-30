/**
 * Meal Plan View Overlay for Lifestyle Blueprint
 * 
 * This module handles the display of meal plans in an overlay for viewing purposes,
 * specifically for the meal history page.
 */

class MealPlanViewOverlay {
  /**
   * Create a new meal plan view overlay
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.mealPlan = options.mealPlan || {};
    this.overlay = null;
  }
  
  /**
   * Show the overlay
   */
  show() {
    // Create the overlay elements
    this.createOverlay();
    
    // Add to the DOM
    document.body.appendChild(this.overlay);
    
    // Prevent scrolling of the background content
    document.body.style.overflow = 'hidden';
    
    // Trigger animations
    requestAnimationFrame(() => {
      this.overlay.classList.add('show');
    });
  }
  
  /**
   * Hide the overlay
   */
  hide() {
    // Remove show classes to trigger animations
    if (this.overlay) {
      this.overlay.classList.remove('show');
    }
    
    // Restore scrolling of the background content
    document.body.style.overflow = '';
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.remove();
      }
    }, 400); // Match the CSS transition duration
  }
  
  /**
   * Create the overlay elements
   */
  createOverlay() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.className = 'meal-plan-overlay meal-plan-view-overlay';
    
    // Create inner container for content
    const container = document.createElement('div');
    container.className = 'meal-plan-container';
    
    // Populate the container with content
    container.innerHTML = this.createOverlayContent();
    
    // Add container to overlay
    this.overlay.appendChild(container);
    
    // Add event listeners
    this.addEventListeners();
  }
  
  /**
   * Create the HTML content for the overlay
   * @returns {string} HTML content
   */
  createOverlayContent() {
    return `
      <div class="meal-plan-header">
        <h2>Your Meal Plan</h2>
        <button class="close-button" aria-label="Close meal plan">×</button>
      </div>
      
      <div class="meal-plan-content">
        ${this.createMealPlanDays()}
        ${this.createSnacksSection()}
        ${this.createFavoriteMealsSection()}
      </div>
    `;
  }
  
  /**
   * Create the HTML for the meal plan days
   * @returns {string} HTML content
   */
  createMealPlanDays() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    let html = '';
    
    for (let day = 1; day <= 5; day++) {
      const dayName = days[day - 1];
      const breakfastMeal = this.getMealByDayAndType(day, 'breakfast');
      const lunchMeal = this.getMealByDayAndType(day, 'lunch');
      const dinnerMeal = this.getMealByDayAndType(day, 'dinner');
      
      html += `
        <div class="meal-plan-day">
          <h3 class="day-header">${dayName}</h3>
          <div class="day-meals">
            ${this.createMealCard(breakfastMeal, 'Breakfast')}
            ${this.createMealCard(lunchMeal, 'Lunch')}
            ${this.createMealCard(dinnerMeal, 'Dinner')}
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
   * @returns {string} HTML content
   */
  createMealCard(meal, mealTypeLabel) {
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
   * @returns {string} HTML content
   */
  createSnacksSection() {
    if (!this.mealPlan.snack_1_name && !this.mealPlan.snack_2_name) {
      return '';
    }
    
    return `
      <div class="meal-plan-section">
        <h3>Snacks</h3>
        <div class="snacks-container">
          ${this.mealPlan.snack_1_name ? `
            <div class="snack-card">
              <h4>${this.mealPlan.snack_1_name}</h4>
              <div class="snack-macros">
                <div class="macro-item">
                  <span class="macro-label">Protein</span>
                  <span class="macro-value">${this.mealPlan.snack_1_protein || 0}g</span>
                </div>
                <div class="macro-item">
                  <span class="macro-label">Carbs</span>
                  <span class="macro-value">${this.mealPlan.snack_1_carbs || 0}g</span>
                </div>
                <div class="macro-item">
                  <span class="macro-label">Fat</span>
                  <span class="macro-value">${this.mealPlan.snack_1_fat || 0}g</span>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${this.mealPlan.snack_2_name ? `
            <div class="snack-card">
              <h4>${this.mealPlan.snack_2_name}</h4>
              <div class="snack-macros">
                <div class="macro-item">
                  <span class="macro-label">Protein</span>
                  <span class="macro-value">${this.mealPlan.snack_2_protein || 0}g</span>
                </div>
                <div class="macro-item">
                  <span class="macro-label">Carbs</span>
                  <span class="macro-value">${this.mealPlan.snack_2_carbs || 0}g</span>
                </div>
                <div class="macro-item">
                  <span class="macro-label">Fat</span>
                  <span class="macro-value">${this.mealPlan.snack_2_fat || 0}g</span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  /**
   * Create the HTML for the favorite meals section
   * @returns {string} HTML content
   */
  createFavoriteMealsSection() {
    if (!this.mealPlan.favorite_meal_1_name && !this.mealPlan.favorite_meal_2_name) {
      return '';
    }
    
    return `
      <div class="meal-plan-section">
        <h3>Favorite Meals</h3>
        <div class="favorite-meals-container">
          ${this.mealPlan.favorite_meal_1_name ? `
            <div class="favorite-meal-card">
              <h4>${this.mealPlan.favorite_meal_1_name}</h4>
              <div class="favorite-meal-macros">
                <div class="macro-item">
                  <span class="macro-label">Protein</span>
                  <span class="macro-value">${this.mealPlan.favorite_meal_1_protein || 0}g</span>
                </div>
                <div class="macro-item">
                  <span class="macro-label">Carbs</span>
                  <span class="macro-value">${this.mealPlan.favorite_meal_1_carbs || 0}g</span>
                </div>
                <div class="macro-item">
                  <span class="macro-label">Fat</span>
                  <span class="macro-value">${this.mealPlan.favorite_meal_1_fat || 0}g</span>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${this.mealPlan.favorite_meal_2_name ? `
            <div class="favorite-meal-card">
              <h4>${this.mealPlan.favorite_meal_2_name}</h4>
              <div class="favorite-meal-macros">
                <div class="macro-item">
                  <span class="macro-label">Protein</span>
                  <span class="macro-value">${this.mealPlan.favorite_meal_2_protein || 0}g</span>
                </div>
                <div class="macro-item">
                  <span class="macro-label">Carbs</span>
                  <span class="macro-value">${this.mealPlan.favorite_meal_2_carbs || 0}g</span>
                </div>
                <div class="macro-item">
                  <span class="macro-label">Fat</span>
                  <span class="macro-value">${this.mealPlan.favorite_meal_2_fat || 0}g</span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  /**
   * Get a meal by day and type
   * @param {number} day - The day number (1-5)
   * @param {string} mealType - The meal type (breakfast, lunch, dinner)
   * @returns {Object|null} The meal data or null if not found
   */
  getMealByDayAndType(day, mealType) {
    // Check if we have structured meal data
    if (this.mealPlan.meals && Array.isArray(this.mealPlan.meals)) {
      return this.mealPlan.meals.find(meal => meal.day === day && meal.mealType === mealType) || null;
    }
    
    // Otherwise, extract from the flat structure
    const nameKey = `${mealType}_${day}_name`;
    const descriptionKey = `${mealType}_${day}_description`;
    const ingredientsKey = `${mealType}_${day}_ingredients`;
    const recipeKey = `${mealType}_${day}_recipe`;
    const proteinKey = `${mealType}_${day}_protein`;
    const carbsKey = `${mealType}_${day}_carbs`;
    const fatKey = `${mealType}_${day}_fat`;
    
    if (!this.mealPlan[nameKey]) {
      return null;
    }
    
    // Handle ingredients properly - ensure it's an array
    let ingredients = [];
    if (this.mealPlan[ingredientsKey]) {
      // If it's already an array, use it
      if (Array.isArray(this.mealPlan[ingredientsKey])) {
        ingredients = this.mealPlan[ingredientsKey];
      } else {
        // If it's an object with nested arrays (from JSON stringification/parsing)
        try {
          // Try to parse it if it's a string
          if (typeof this.mealPlan[ingredientsKey] === 'string') {
            ingredients = JSON.parse(this.mealPlan[ingredientsKey]);
          } else {
            // Otherwise, assume it's already an object
            ingredients = this.mealPlan[ingredientsKey];
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
      name: this.mealPlan[nameKey],
      description: this.mealPlan[descriptionKey] || '',
      ingredients: ingredients,
      recipe: this.mealPlan[recipeKey] || '',
      protein: this.mealPlan[proteinKey] || 0,
      carbs: this.mealPlan[carbsKey] || 0,
      fat: this.mealPlan[fatKey] || 0
    };
  }
  
  /**
   * Add event listeners to the overlay elements
   */
  addEventListeners() {
    try {
      if (!this.overlay) {
        console.error('Cannot add event listeners: overlay element is null');
        return;
      }
      
      // Close button
      const closeButton = this.overlay.querySelector('.close-button');
      if (closeButton) {
        closeButton.addEventListener('click', () => this.hide());
      }
      
      // Meal section headers (for collapsible sections)
      const mealSectionHeaders = this.overlay.querySelectorAll('.meal-section-header');
      if (mealSectionHeaders && mealSectionHeaders.length > 0) {
        mealSectionHeaders.forEach(header => {
          header.addEventListener('click', () => {
            const section = header.closest('.meal-section');
            if (section) {
              section.classList.toggle('expanded');
            }
          });
        });
      }
    } catch (error) {
      console.error('Error adding event listeners:', error);
    }
  }
}

export { MealPlanViewOverlay };
