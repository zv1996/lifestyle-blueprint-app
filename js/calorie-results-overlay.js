/**
 * Calorie Results Overlay for Lifestyle Blueprint
 * 
 * This module handles the creation and display of the calorie calculation results overlay.
 */

/**
 * Class to create and manage the calorie results overlay
 */
class CalorieResultsOverlay {
  /**
   * Create a new calorie results overlay
   * @param {Object} results - The calculation results
   * @param {Function} onCreatePlanClick - Callback for when the Create Plan button is clicked
   */
  constructor(results, onCreatePlanClick) {
    this.results = results;
    this.onCreatePlanClick = onCreatePlanClick;
    this.overlay = null;
    this.backdrop = null;
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
    this.backdrop.classList.remove('show');
    this.overlay.classList.remove('show');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      this.backdrop.remove();
      this.overlay.remove();
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
    this.overlay.className = 'results-overlay';
    
    // Populate the overlay with content
    this.overlay.innerHTML = this.createOverlayContent();
    
    // Add event listener to the Create Plan button
    const createPlanButton = this.overlay.querySelector('.create-plan-button');
    createPlanButton.addEventListener('click', () => {
      this.hide();
      if (this.onCreatePlanClick) {
        this.onCreatePlanClick(this.results);
      }
    });
  }
  
  /**
   * Create the HTML content for the overlay
   * @returns {string} HTML content
   */
  createOverlayContent() {
    const { userData, calculations, split, macroSplit } = this.results;
    
    return `
      <div class="results-header">
        <h2>Your Personalized Calorie Plan</h2>
      </div>
      
      <div class="results-section">
        <h3>Weekly Calorie Target</h3>
        <div class="calorie-summary">
          <div class="weekly-calories">${calculations.weeklyCalories.toLocaleString()} calories/week</div>
          <div class="daily-calories">${calculations.dailyAverage.toLocaleString()} calories/day average</div>
        </div>
        
        <div class="goal-info">
          <span class="goal-label">Your Goal:</span>
          <span class="goal-value">${userData.fitnessGoal}</span>
        </div>
      </div>
      
      <div class="results-section">
        <h3>5:2 Split (Weekday/Weekend)</h3>
        <div class="split-grid">
          <div class="split-card weekday">
            <h4>Weekdays (Mon-Fri)</h4>
            <div class="calories">${split.weekday.calories.toLocaleString()} calories/day</div>
            <div class="macro-distribution">
              ${this.createMacroRows(split.weekday.macroPercentages, split.weekday.macroGrams)}
            </div>
            ${this.createMacroChart(split.weekday.macroPercentages)}
          </div>
          
          <div class="split-card weekend">
            <h4>Weekends (Sat-Sun)</h4>
            <div class="calories">${split.weekend.calories.toLocaleString()} calories/day</div>
            <div class="macro-distribution">
              ${this.createMacroRows(split.weekend.macroPercentages, split.weekend.macroGrams)}
            </div>
            ${this.createMacroChart(split.weekend.macroPercentages)}
          </div>
        </div>
      </div>
      
      <div class="results-section">
        <h3>Recommended Macronutrient Split</h3>
        <div class="macro-split-info">
          <p>We recommend a <strong>${macroSplit.type}</strong> split for you.</p>
          <p class="macro-reason">${macroSplit.reason}</p>
        </div>
      </div>
      
      <button class="create-plan-button">Create Meal Plan</button>
    `;
  }
  
  /**
   * Create the macro distribution rows
   * @param {Object} macroPercentages - The macro percentages
   * @param {Object} macroGrams - The macro grams
   * @returns {string} HTML content
   */
  createMacroRows(macroPercentages, macroGrams) {
    return `
      <div class="macro-row">
        <div class="macro-label">
          <div class="macro-color protein"></div>
          Protein
        </div>
        <div class="macro-value">
          ${macroPercentages.protein}%
          <span class="macro-grams">(${macroGrams.protein}g)</span>
        </div>
      </div>
      <div class="macro-row">
        <div class="macro-label">
          <div class="macro-color carbs"></div>
          Carbs
        </div>
        <div class="macro-value">
          ${macroPercentages.carbs}%
          <span class="macro-grams">(${macroGrams.carbs}g)</span>
        </div>
      </div>
      <div class="macro-row">
        <div class="macro-label">
          <div class="macro-color fat"></div>
          Fat
        </div>
        <div class="macro-value">
          ${macroPercentages.fat}%
          <span class="macro-grams">(${macroGrams.fat}g)</span>
        </div>
      </div>
    `;
  }
  
  /**
   * Create the macro chart
   * @param {Object} macroPercentages - The macro percentages
   * @returns {string} HTML content
   */
  createMacroChart(macroPercentages) {
    return `
      <div class="macro-chart">
        <div class="macro-chart-segment protein" style="width: ${macroPercentages.protein}%"></div>
        <div class="macro-chart-segment carbs" style="width: ${macroPercentages.carbs}%"></div>
        <div class="macro-chart-segment fat" style="width: ${macroPercentages.fat}%"></div>
      </div>
    `;
  }
  
  /**
   * Format the activity level for display
   * @param {string} activityLevel - The activity level description
   * @returns {string} Formatted activity level
   */
  formatActivityLevel(activityLevel) {
    // Extract just the level name from the full description
    if (activityLevel.includes('Level 1')) {
      return 'Light';
    } else if (activityLevel.includes('Level 2')) {
      return 'Moderate';
    } else if (activityLevel.includes('Level 3')) {
      return 'High';
    } else if (activityLevel.includes('Level 4')) {
      return 'Athletic';
    } else if (activityLevel.includes('Level 5')) {
      return 'Professional';
    } else {
      return activityLevel;
    }
  }
  
  /**
   * Create HTML for the chat message with calorie results
   * @returns {string} HTML content
   */
  static createChatMessageContent(results) {
    const { calculations, split, macroSplit } = results;
    
    return `
      <p><strong>Your Calorie Calculation Results:</strong></p>
      <p class="result-highlight">${calculations.weeklyCalories.toLocaleString()} calories/week</p>
      <p>${calculations.dailyAverage.toLocaleString()} calories/day average</p>
      
      <p style="text-align: center;"><strong>5:2 Split:</strong></p>
      <p>Weekdays: ${split.weekday.calories.toLocaleString()} calories/day</p>
      <div class="macro-mini-chart">
        <div class="macro-mini-segment protein" style="width: ${split.weekday.macroPercentages.protein}%"></div>
        <div class="macro-mini-segment carbs" style="width: ${split.weekday.macroPercentages.carbs}%"></div>
        <div class="macro-mini-segment fat" style="width: ${split.weekday.macroPercentages.fat}%"></div>
      </div>
      <p>Weekends: ${split.weekend.calories.toLocaleString()} calories/day</p>
      <div class="macro-mini-chart">
        <div class="macro-mini-segment protein" style="width: ${split.weekend.macroPercentages.protein}%"></div>
        <div class="macro-mini-segment carbs" style="width: ${split.weekend.macroPercentages.carbs}%"></div>
        <div class="macro-mini-segment fat" style="width: ${split.weekend.macroPercentages.fat}%"></div>
      </div>
      
      <p style="text-align: center;"><strong>Recommended Macro Split:</strong> ${macroSplit.type}</p>
    `;
  }
}

// Export the overlay class
export { CalorieResultsOverlay };
