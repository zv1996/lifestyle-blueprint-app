/**
 * Meal Plan Loading Overlay for Lifestyle Blueprint
 * 
 * This module provides a full-screen loading overlay with animated status updates
 * for the meal plan creation process.
 */

/**
 * Class to create and manage the meal plan loading overlay
 */
class MealPlanLoadingOverlay {
  /**
   * Create a new meal plan loading overlay
   */
  constructor() {
    this.overlay = null;
    this.loadingContainer = null;
    this.statusText = null;
    this.progressBar = null;
    this.currentDay = 0;
    this.totalDays = 5;
  }
  
  /**
   * Show the overlay
   */
  show() {
    // Create the overlay elements
    this.createOverlay();
    
    // Add to the DOM
    document.body.appendChild(this.overlay);
    
    // Trigger animations
    requestAnimationFrame(() => {
      this.overlay.classList.add('show');
    });
  }
  
  /**
   * Hide the overlay
   */
  hide() {
    if (this.overlay) {
      this.overlay.classList.remove('show');
      
      // Remove from DOM after animation completes
      setTimeout(() => {
        if (this.overlay && this.overlay.parentNode) {
          this.overlay.remove();
        }
      }, 500); // Match the CSS transition duration
    }
  }
  
  /**
   * Create the overlay elements
   */
  createOverlay() {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.className = 'meal-plan-loading-overlay';
    
    // Create loading container
    this.loadingContainer = document.createElement('div');
    this.loadingContainer.className = 'loading-container';
    
    // Create title
    const title = document.createElement('h2');
    title.className = 'loading-title';
    title.textContent = 'Crafting Your Personalized Meal Plan';
    
    // Create loading spinner
    const spinner = document.createElement('div');
    spinner.className = 'fancy-spinner';
    
    // Create spinner inner elements
    for (let i = 0; i < 3; i++) {
      const spinnerRing = document.createElement('div');
      spinnerRing.className = `spinner-ring ring-${i + 1}`;
      spinner.appendChild(spinnerRing);
    }
    
    // Create progress bar container
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar-container';
    
    // Create progress bar
    this.progressBar = document.createElement('div');
    this.progressBar.className = 'progress-bar';
    this.progressBar.style.width = '0%';
    
    progressBarContainer.appendChild(this.progressBar);
    
    // Create status text
    this.statusText = document.createElement('div');
    this.statusText.className = 'status-text';
    this.statusText.textContent = 'Initializing...';
    
    // Assemble the elements
    this.loadingContainer.appendChild(title);
    this.loadingContainer.appendChild(spinner);
    this.loadingContainer.appendChild(progressBarContainer);
    this.loadingContainer.appendChild(this.statusText);
    this.overlay.appendChild(this.loadingContainer);
  }
  
  /**
   * Update the status text and progress
   * @param {string} day - The day being processed (e.g., "Monday")
   * @param {number} dayNumber - The day number (1-5)
   */
  updateStatus(day, dayNumber) {
    if (!this.statusText || !this.progressBar) {
      return;
    }
    
    this.currentDay = dayNumber;
    
    // Update progress bar
    const progress = (this.currentDay / this.totalDays) * 100;
    this.progressBar.style.width = `${progress}%`;
    
    // Fade out current text
    this.statusText.style.opacity = '0';
    
    // After fade out, update text and fade in
    setTimeout(() => {
      this.statusText.textContent = `Creating Meals for ${day}...`;
      this.statusText.style.opacity = '1';
    }, 300);
  }
  
  /**
   * Update with a custom status message
   * @param {string} message - The status message
   * @param {number} progress - Optional progress percentage (0-100)
   */
  updateStatusMessage(message, progress = null) {
    if (!this.statusText) {
      return;
    }
    
    // Update progress bar if provided
    if (progress !== null && this.progressBar) {
      this.progressBar.style.width = `${progress}%`;
    }
    
    // Fade out current text
    this.statusText.style.opacity = '0';
    
    // After fade out, update text and fade in
    setTimeout(() => {
      this.statusText.textContent = message;
      this.statusText.style.opacity = '1';
    }, 300);
  }
  
  /**
   * Show an error message in the overlay
   * @param {string} errorMessage - The error message to display
   */
  showError(errorMessage) {
    if (!this.loadingContainer) {
      return;
    }
    
    // Change background color to indicate error
    this.overlay.classList.add('error');
    
    // Update status text
    if (this.statusText) {
      this.statusText.textContent = `Error: ${errorMessage}`;
      this.statusText.classList.add('error');
    }
    
    // Remove any existing retry buttons first
    const existingButtons = this.loadingContainer.querySelectorAll('.retry-button');
    existingButtons.forEach(button => button.remove());
    
    // Add a retry button
    const retryButton = document.createElement('button');
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Try Again';
    retryButton.addEventListener('click', () => {
      window.location.reload();
    });
    
    this.loadingContainer.appendChild(retryButton);
  }
  
  /**
   * Show a success message and transition to the meal plan
   * @param {string} message - The success message
   */
  showSuccess(message) {
    if (!this.statusText || !this.progressBar) {
      return;
    }
    
    // Complete the progress bar
    this.progressBar.style.width = '100%';
    
    // Update with success message
    this.statusText.textContent = message;
    this.overlay.classList.add('success');
    
    // Hide after a delay
    setTimeout(() => {
      this.hide();
    }, 1500);
  }
}

export { MealPlanLoadingOverlay };
