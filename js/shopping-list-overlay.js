/**
 * Shopping List Overlay for Lifestyle Blueprint
 * 
 * This module handles the display of shopping lists in an overlay,
 * allowing users to view and save their shopping lists.
 */

/**
 * Class to create and manage the shopping list overlay
 */
class ShoppingListOverlay {
  /**
   * Create a new shopping list overlay
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.shoppingList = options.shoppingList || {};
    this.onSave = options.onSave || (() => {});
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
    this.overlay.className = 'shopping-list-overlay';
    
    // Create inner container for content
    const container = document.createElement('div');
    container.className = 'shopping-list-container';
    
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
      <div class="shopping-list-header">
        <h2>Your Shopping List</h2>
        <button class="close-button" aria-label="Close shopping list">×</button>
      </div>
      
      <div class="shopping-list-content">
        ${this.createShoppingListCategories()}
      </div>
      
      <div class="shopping-list-actions">
        <button class="save-button">Save Shopping List</button>
      </div>
    `;
  }
  
  /**
   * Create the HTML for the shopping list categories
   * @returns {string} HTML content
   */
  createShoppingListCategories() {
    // Check if we have items
    if (!this.shoppingList.items || !Array.isArray(this.shoppingList.items) || this.shoppingList.items.length === 0) {
      return `
        <div class="empty-list">
          <p>No items found in your shopping list.</p>
        </div>
      `;
    }
    
    // Group items by category
    const itemsByCategory = {};
    
    this.shoppingList.items.forEach(item => {
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
    
    sortedCategories.forEach(category => {
      const items = itemsByCategory[category];
      
      html += `
        <div class="category-section">
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
    
    return html;
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
      
      // Save button
      const saveButton = this.overlay.querySelector('.save-button');
      if (saveButton) {
        saveButton.addEventListener('click', () => this.handleSave());
      }
      
      // Category headers (for collapsible sections)
      const categoryHeaders = this.overlay.querySelectorAll('.category-header');
      if (categoryHeaders && categoryHeaders.length > 0) {
        categoryHeaders.forEach(header => {
          header.addEventListener('click', () => {
            const section = header.closest('.category-section');
            if (section) {
              section.classList.toggle('collapsed');
            }
          });
        });
      }
    } catch (error) {
      console.error('Error adding event listeners:', error);
    }
  }
  
  /**
   * Handle saving the shopping list
   */
  handleSave() {
    // Call the onSave callback with the original shopping list
    if (this.onSave) {
      this.onSave(this.shoppingList);
    }
    
    // Hide the overlay
    this.hide();
    
    // Redirect to the meal plan results page if we have a meal plan ID
    if (this.shoppingList && this.shoppingList.mealPlanId) {
      // Small delay to allow the overlay to close smoothly
      setTimeout(() => {
        window.location.href = `meal-plan-results.html?mealPlanId=${this.shoppingList.mealPlanId}`;
      }, 500);
    } else {
      console.error('Cannot redirect to results page: No meal plan ID found in shopping list');
    }
  }
}

export { ShoppingListOverlay };
