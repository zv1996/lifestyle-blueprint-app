/**
 * User Data Preloader for Lifestyle Blueprint
 * 
 * This module handles fetching existing user data to enable
 * sophisticated question skipping and confirmation flows.
 * 
 * Designed to be standalone and non-invasive to existing functionality.
 */

import config from './config.js';
import { getCurrentUser } from './auth.js';

/**
 * UserDataPreloader class for fetching complete user profile
 */
class UserDataPreloader {
  constructor() {
    this.cache = null;
    this.lastFetchTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get complete user profile with all data
   * @returns {Promise<Object>} Complete user profile or null
   */
  async getCompleteProfile() {
    try {
      // Check cache first
      if (this.isCacheValid()) {
        console.log('UserDataPreloader: Using cached data');
        return this.cache;
      }

      console.log('UserDataPreloader: Fetching fresh user data');
      
      // Get current user
      const user = getCurrentUser();
      if (!user) {
        console.warn('UserDataPreloader: No authenticated user found');
        return null;
      }

      // Fetch complete profile from API
      const response = await fetch(`${config.getApiBaseUrl()}/api/user/complete-profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': user.id
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log('UserDataPreloader: No existing user data found (new user)');
          return this.createEmptyProfile();
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const profileData = await response.json();
      
      // Cache the result
      this.cache = this.processProfileData(profileData);
      this.lastFetchTime = Date.now();
      
      console.log('UserDataPreloader: Successfully fetched user profile');
      return this.cache;
      
    } catch (error) {
      console.error('UserDataPreloader: Error fetching user profile:', error);
      
      // Return empty profile on error to ensure graceful fallback
      return this.createEmptyProfile();
    }
  }

  /**
   * Check if cached data is still valid
   * @returns {boolean} Whether cache is valid
   */
  isCacheValid() {
    return this.cache && 
           this.lastFetchTime && 
           (Date.now() - this.lastFetchTime) < this.CACHE_DURATION;
  }

  /**
   * Process raw profile data and add convenience flags
   * @param {Object} rawData - Raw data from API
   * @returns {Object} Processed profile data
   */
  processProfileData(rawData) {
    const profile = {
      basicInfo: {
        data: rawData.basicInfo || {},
        isComplete: this.isBasicInfoComplete(rawData.basicInfo),
        lastUpdated: rawData.basicInfo?.lastUpdated || null
      },
      metrics: {
        data: rawData.metrics || {},
        isComplete: this.isMetricsComplete(rawData.metrics),
        lastUpdated: rawData.metrics?.lastUpdated || null,
        isFresh: this.isDataFresh(rawData.metrics?.lastUpdated, 30) // 30 days for weight
      },
      dietPreferences: {
        data: rawData.dietPreferences || {},
        isComplete: this.isDietPreferencesComplete(rawData.dietPreferences),
        lastUpdated: rawData.dietPreferences?.lastUpdated || null,
        isFresh: this.isDataFresh(rawData.dietPreferences?.lastUpdated, 90) // 90 days for diet prefs
      },
      hasAnyData: false,
      isReturningUser: false
    };

    // Set convenience flags
    profile.hasAnyData = profile.basicInfo.isComplete || 
                        profile.metrics.isComplete || 
                        profile.dietPreferences.isComplete;
    
    profile.isReturningUser = profile.basicInfo.isComplete;

    return profile;
  }

  /**
   * Check if basic info is complete
   * @param {Object} basicInfo - Basic info data
   * @returns {boolean} Whether basic info is complete
   */
  isBasicInfoComplete(basicInfo) {
    if (!basicInfo) return false;
    
    return !!(basicInfo.first_name && 
              basicInfo.last_name && 
              basicInfo.phone_number && 
              basicInfo.birth_date && 
              basicInfo.biological_sex);
  }

  /**
   * Check if metrics data is complete
   * @param {Object} metrics - Metrics data
   * @returns {boolean} Whether metrics is complete
   */
  isMetricsComplete(metrics) {
    if (!metrics) return false;
    
    return !!(metrics.height_inches && 
              metrics.weight_pounds && 
              metrics.activity_level && 
              metrics.health_fitness_goal);
  }

  /**
   * Check if diet preferences data is complete
   * @param {Object} dietPrefs - Diet preferences data
   * @returns {boolean} Whether diet preferences is complete
   */
  isDietPreferencesComplete(dietPrefs) {
    if (!dietPrefs) return false;
    
    // Basic completion check - has dietary restrictions and preferences answered
    return (dietPrefs.dietary_restrictions !== undefined && 
            dietPrefs.dietary_preferences !== undefined);
  }

  /**
   * Check if data is fresh (within specified days)
   * @param {string} lastUpdated - ISO date string
   * @param {number} maxDays - Maximum age in days
   * @returns {boolean} Whether data is fresh
   */
  isDataFresh(lastUpdated, maxDays) {
    if (!lastUpdated) return false;
    
    const updatedDate = new Date(lastUpdated);
    const now = new Date();
    const daysDiff = (now - updatedDate) / (1000 * 60 * 60 * 24);
    
    return daysDiff <= maxDays;
  }

  /**
   * Create empty profile structure for new users
   * @returns {Object} Empty profile structure
   */
  createEmptyProfile() {
    return {
      basicInfo: {
        data: {},
        isComplete: false,
        lastUpdated: null
      },
      metrics: {
        data: {},
        isComplete: false,
        lastUpdated: null,
        isFresh: false
      },
      dietPreferences: {
        data: {},
        isComplete: false,
        lastUpdated: null,
        isFresh: false
      },
      hasAnyData: false,
      isReturningUser: false
    };
  }

  /**
   * Clear cached data (useful for testing or after data updates)
   */
  clearCache() {
    this.cache = null;
    this.lastFetchTime = null;
    console.log('UserDataPreloader: Cache cleared');
  }

  /**
   * Get specific data section with fallback
   * @param {string} section - Section name ('basicInfo', 'metrics', 'dietPreferences')
   * @returns {Promise<Object>} Section data or empty object
   */
  async getSection(section) {
    const profile = await this.getCompleteProfile();
    return profile?.[section]?.data || {};
  }

  /**
   * Check if user should skip a specific stage
   * @param {string} stage - Stage name
   * @returns {Promise<boolean>} Whether to skip the stage
   */
  async shouldSkipStage(stage) {
    const profile = await this.getCompleteProfile();
    if (!profile) return false;

    switch (stage) {
      case 'basicInfo':
        return profile.basicInfo.isComplete;
      
      case 'metrics':
        // Never fully skip metrics - at least need to confirm weight
        return false;
      
      case 'dietPreferences':
        // Never fully skip diet preferences - some questions always asked
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Get confirmation data for a specific stage
   * @param {string} stage - Stage name
   * @returns {Promise<Object>} Confirmation data structure
   */
  async getConfirmationData(stage) {
    const profile = await this.getCompleteProfile();
    if (!profile) return null;

    switch (stage) {
      case 'metrics':
        return {
          height: profile.metrics.data.height_inches,
          hasHeight: !!profile.metrics.data.height_inches,
          activityLevel: profile.metrics.data.activity_level,
          hasActivityLevel: !!profile.metrics.data.activity_level,
          fitnessGoal: profile.metrics.data.health_fitness_goal,
          hasFitnessGoal: !!profile.metrics.data.health_fitness_goal,
          needsWeightUpdate: true // Always ask for current weight
        };
      
      case 'dietPreferences':
        return {
          restrictions: profile.dietPreferences.data.dietary_restrictions,
          hasRestrictions: profile.dietPreferences.data.dietary_restrictions !== undefined,
          preferences: profile.dietPreferences.data.dietary_preferences,
          hasPreferences: profile.dietPreferences.data.dietary_preferences !== undefined,
          isFresh: profile.dietPreferences.isFresh
        };
      
      default:
        return null;
    }
  }
}

// Export singleton instance
const userDataPreloader = new UserDataPreloader();
export default userDataPreloader;

// Named export for direct class access if needed
export { UserDataPreloader };
