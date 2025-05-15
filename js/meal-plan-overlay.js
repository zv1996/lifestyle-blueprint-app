/**
 * Meal Plan Overlay for Lifestyle Blueprint
 * 
 * This module handles the display of meal plans in an overlay,
 * allowing users to view, approve, or request changes to their meal plans.
 */

/**
 * Class to create and manage the meal plan overlay
 */
class MealPlanOverlay {
  /**
   * Create a new meal plan overlay
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.mealPlan = options.mealPlan || {};
    this.onApprove = options.onApprove || (() => {});
    this.onRequestChanges = options.onRequestChanges || (() => {});
    this.overlay = null;
    this.backdrop = null;
    this.changeRequests = [];
  }
  
  /**
   * Show the overlay
   */
  show() {
    // Create the overlay elements
    this.createOverlay();
    
    // Add to the DOM
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.overlay);
    
    // Trigger animations
    requestAnimationFrame(() => {
      this.backdrop.classList.add('show');
      this.overlay.classList.add('show');
    });
  }
  
  /**
   * Hide the overlay
   */
  hide() {
    // Remove show classes to trigger animations
    if (this.backdrop) {
      this.backdrop.classList.remove('show');
    }
    
    if (this.overlay) {
      this.overlay.classList.remove('show');
    }
    
    // Hide loading spinner if visible
    this.hideLoadingState();
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      if (this.backdrop && this.backdrop.parentNode) {
        this.backdrop.remove();
      }
      
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.remove();
      }
      
      if (this.loadingSpinner && this.loadingSpinner.parentNode) {
        this.loadingSpinner.remove();
      }
    }, 400); // Match the CSS transition duration
  }
  
  /**
   * Create the overlay elements
   */
  createOverlay() {
    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'overlay-backdrop';
    
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.className = 'meal-plan-overlay';
    
    // Create loading spinner container
    this.loadingSpinner = document.createElement('div');
    this.loadingSpinner.className = 'loading-spinner-container';
    this.loadingSpinner.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">Updating meal plan...</div>
    `;
    
    // Populate the overlay with content
    this.overlay.innerHTML = this.createOverlayContent();
    
    // Add event listeners
    this.addEventListeners();
    
    // Add loading spinner to the body
    document.body.appendChild(this.loadingSpinner);
  }
  
  /**
   * Show the loading state
   */
  showLoadingState() {
    if (this.overlay) {
      this.overlay.classList.add('loading');
    }
    
    if (this.loadingSpinner) {
      this.loadingSpinner.classList.add('show');
    }
  }
  
  /**
   * Hide the loading state
   */
  hideLoadingState() {
    if (this.overlay) {
      this.overlay.classList.remove('loading');
    }
    
    if (this.loadingSpinner) {
      this.loadingSpinner.classList.remove('show');
    }
  }
  
  /**
   * Create the HTML content for the overlay
   * @returns {string} HTML content
   */
  createOverlayContent() {
    return `
      <div class="meal-plan-header">
        <h2>Your Personalized Meal Plan</h2>
        <button class="close-button" aria-label="Close meal plan">×</button>
      </div>
      
      <div class="meal-plan-content">
        ${this.createMealPlanDays()}
        
        ${this.createSnacksSection()}
        
        ${this.createFavoriteMealsSection()}
      </div>
      
      <div class="meal-plan-actions">
        <button class="approve-button">Approve Plan</button>
        <button class="request-changes-button">Request Changes</button>
      </div>
      
      <div class="change-request-form" style="display: none;">
        <h3>Request Changes</h3>
        <div class="change-requests-container">
          ${this.createChangeRequestForm(0)}
        </div>
        <button class="add-change-request-button">+ Add Another Change</button>
        <div class="change-request-actions">
          <button class="submit-changes-button">Submit Changes</button>
          <button class="cancel-changes-button">Cancel</button>
        </div>
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
   * Create the HTML for a change request form
   * @param {number} index - The index of the change request
   * @returns {string} HTML content
   */
  createChangeRequestForm(index) {
    return `
      <div class="change-request" data-index="${index}">
        <div class="form-group">
          <label for="change-day-${index}">Day:</label>
          <select id="change-day-${index}" class="change-day">
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="change-meal-${index}">Meal:</label>
          <select id="change-meal-${index}" class="change-meal">
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="change-description-${index}">Requested Change:</label>
          <textarea id="change-description-${index}" class="change-description" rows="3" placeholder="Describe the changes you'd like to make to this meal..."></textarea>
        </div>
        
        ${index > 0 ? `<button class="remove-change-request-button" data-index="${index}">Remove</button>` : ''}
      </div>
    `;
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
      
      // Approve button
      const approveButton = this.overlay.querySelector('.approve-button');
      if (approveButton) {
        approveButton.addEventListener('click', () => this.handleApprove());
      }
      
      // Request changes button
      const requestChangesButton = this.overlay.querySelector('.request-changes-button');
      if (requestChangesButton) {
        requestChangesButton.addEventListener('click', () => this.showChangeRequestForm());
      }
      
      // Add change request button
      const addChangeRequestButton = this.overlay.querySelector('.add-change-request-button');
      if (addChangeRequestButton) {
        addChangeRequestButton.addEventListener('click', () => this.addChangeRequest());
      }
      
      // Submit changes button
      const submitChangesButton = this.overlay.querySelector('.submit-changes-button');
      if (submitChangesButton) {
        submitChangesButton.addEventListener('click', () => this.handleSubmitChanges());
      }
      
      // Cancel changes button
      const cancelChangesButton = this.overlay.querySelector('.cancel-changes-button');
      if (cancelChangesButton) {
        cancelChangesButton.addEventListener('click', () => this.hideChangeRequestForm());
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
      
      // Delegate event listener for remove change request buttons
      const changeRequestsContainer = this.overlay.querySelector('.change-requests-container');
      if (changeRequestsContainer) {
        changeRequestsContainer.addEventListener('click', (event) => {
          if (event.target && event.target.classList.contains('remove-change-request-button')) {
            const index = parseInt(event.target.dataset.index);
            if (!isNaN(index)) {
              this.removeChangeRequest(index);
            }
          }
        });
      }
    } catch (error) {
      console.error('Error adding event listeners:', error);
    }
  }
  
  /**
   * Show the change request form
   */
  showChangeRequestForm() {
    if (!this.overlay) {
      console.error('Cannot show change request form: overlay element is null');
      return;
    }
    
    try {
      // Hide the main actions
      const actionsContainer = this.overlay.querySelector('.meal-plan-actions');
      if (actionsContainer) {
        actionsContainer.style.display = 'none';
      }
      
      // Show the change request form
      const changeRequestForm = this.overlay.querySelector('.change-request-form');
      if (changeRequestForm) {
        changeRequestForm.style.display = 'block';
      }
      
      // Reset the change requests
      this.changeRequests = [];
    } catch (error) {
      console.error('Error showing change request form:', error);
    }
  }
  
  /**
   * Hide the change request form
   */
  hideChangeRequestForm() {
    if (!this.overlay) {
      console.error('Cannot hide change request form: overlay element is null');
      return;
    }
    
    try {
      // Show the main actions
      const actionsContainer = this.overlay.querySelector('.meal-plan-actions');
      if (actionsContainer) {
        actionsContainer.style.display = 'flex';
      }
      
      // Hide the change request form
      const changeRequestForm = this.overlay.querySelector('.change-request-form');
      if (changeRequestForm) {
        changeRequestForm.style.display = 'none';
      }
      
      // Reset the change requests container
      const changeRequestsContainer = this.overlay.querySelector('.change-requests-container');
      if (changeRequestsContainer) {
        changeRequestsContainer.innerHTML = this.createChangeRequestForm(0);
      }
    } catch (error) {
      console.error('Error hiding change request form:', error);
    }
  }
  
  /**
   * Add a new change request form
   */
  addChangeRequest() {
    if (!this.overlay) {
      console.error('Cannot add change request: overlay element is null');
      return;
    }
    
    try {
      const changeRequestsContainer = this.overlay.querySelector('.change-requests-container');
      if (!changeRequestsContainer) {
        console.error('Cannot add change request: change requests container not found');
        return;
      }
      
      const changeRequests = changeRequestsContainer.querySelectorAll('.change-request');
      const newIndex = changeRequests ? changeRequests.length : 0;
      
      // Create a new change request form
      const newChangeRequestHtml = this.createChangeRequestForm(newIndex);
      
      // Append it to the container
      changeRequestsContainer.insertAdjacentHTML('beforeend', newChangeRequestHtml);
    } catch (error) {
      console.error('Error adding change request:', error);
    }
  }
  
  /**
   * Remove a change request form
   * @param {number} index - The index of the change request to remove
   */
  removeChangeRequest(index) {
    if (!this.overlay) {
      console.error('Cannot remove change request: overlay element is null');
      return;
    }
    
    try {
      const changeRequestsContainer = this.overlay.querySelector('.change-requests-container');
      if (!changeRequestsContainer) {
        console.error('Cannot remove change request: change requests container not found');
        return;
      }
      
      const changeRequest = changeRequestsContainer.querySelector(`.change-request[data-index="${index}"]`);
      
      if (changeRequest) {
        changeRequest.remove();
        
        // Renumber the remaining change requests
        const remainingChangeRequests = changeRequestsContainer.querySelectorAll('.change-request');
        if (remainingChangeRequests && remainingChangeRequests.length > 0) {
          remainingChangeRequests.forEach((request, newIndex) => {
            request.dataset.index = newIndex;
            
            // Update the IDs and labels
            const daySelect = request.querySelector('.change-day');
            const mealSelect = request.querySelector('.change-meal');
            const descriptionTextarea = request.querySelector('.change-description');
            const removeButton = request.querySelector('.remove-change-request-button');
            
            if (daySelect) daySelect.id = `change-day-${newIndex}`;
            if (mealSelect) mealSelect.id = `change-meal-${newIndex}`;
            if (descriptionTextarea) descriptionTextarea.id = `change-description-${newIndex}`;
            if (removeButton) removeButton.dataset.index = newIndex;
            
            // Update the labels
            const labels = request.querySelectorAll('label');
            if (labels && labels.length > 0) {
              labels.forEach(label => {
                if (label.htmlFor && label.htmlFor.startsWith('change-day-')) label.htmlFor = `change-day-${newIndex}`;
                if (label.htmlFor && label.htmlFor.startsWith('change-meal-')) label.htmlFor = `change-meal-${newIndex}`;
                if (label.htmlFor && label.htmlFor.startsWith('change-description-')) label.htmlFor = `change-description-${newIndex}`;
              });
            }
          });
        }
      }
    } catch (error) {
      console.error('Error removing change request:', error);
    }
  }
  
  /**
   * Handle approving the meal plan
   */
  handleApprove() {
    if (this.onApprove) {
      this.onApprove(this.mealPlan);
    }
  }
  
  /**
   * Handle submitting change requests
   */
  handleSubmitChanges() {
    if (!this.overlay) {
      console.error('Cannot submit change requests: overlay element is null');
      return;
    }
    
    try {
      // Collect the change requests
      const changeRequests = [];
      const changeRequestElements = this.overlay.querySelectorAll('.change-request');
      
      if (changeRequestElements && changeRequestElements.length > 0) {
        changeRequestElements.forEach(element => {
          const daySelect = element.querySelector('.change-day');
          const mealSelect = element.querySelector('.change-meal');
          const descriptionTextarea = element.querySelector('.change-description');
          
          if (daySelect && mealSelect && descriptionTextarea && descriptionTextarea.value.trim()) {
            const dayValue = parseInt(daySelect.value);
            if (!isNaN(dayValue)) {
              changeRequests.push({
                day: dayValue,
                mealType: mealSelect.value,
                description: descriptionTextarea.value.trim()
              });
            }
          }
        });
      }
      
      if (changeRequests.length === 0) {
        alert('Please describe at least one change you would like to make.');
        return;
      }
      
      // Call the onRequestChanges callback
      if (this.onRequestChanges) {
        this.onRequestChanges(this.mealPlan, changeRequests);
      }
      
      // Hide the change request form
      this.hideChangeRequestForm();
    } catch (error) {
      console.error('Error submitting change requests:', error);
    }
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
}

export { MealPlanOverlay };
