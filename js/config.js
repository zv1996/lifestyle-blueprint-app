/**
 * Configuration for Lifestyle Blueprint App
 * 
 * This module provides configuration settings for the application,
 * including API URLs for different environments.
 */

const config = {
  // Determine if we're in development or production
  isDevelopment: () => {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
  },
  
  // API base URL - automatically switches between development and production
  getApiBaseUrl: () => {
    if (config.isDevelopment()) {
      return 'http://localhost:3001'; // Local development API
    } else {
      // Production API URL from Render.com
      return 'https://lifestyle-blueprint-app.onrender.com'; // Production API
    }
  }
};

export default config;
