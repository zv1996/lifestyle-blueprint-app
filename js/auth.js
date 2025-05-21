// Authentication service for Lifestyle Blueprint app
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';

// Initialize Supabase client (using public anon key, not service key)
const supabaseUrl = 'https://mzudbdooytyxxlnekjke.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dWRiZG9veXR5eHhsbmVramtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNDk5OTMsImV4cCI6MjA2MTYyNTk5M30.kP_-TPSSKl-KxR0SC2PffiWTC3W5CL2VEdUPctwoOBU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth state
let currentUser = null;
let authStateChangeCallbacks = [];

// Auth initialization state
let authInitialized = false;
let authInitPromise = null;

// Check if service worker is ready
async function waitForServiceWorkerReady() {
  // If service worker is not supported, resolve immediately
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported in this browser');
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    // If service worker is already active, resolve immediately
    if (navigator.serviceWorker.controller) {
      console.log('Service Worker is already active');
      resolve();
      return;
    }

    // Set up a listener for the custom serviceWorkerReady event
    const handleServiceWorkerReady = (event) => {
      console.log('Received service worker ready event:', event.detail);
      window.removeEventListener('serviceWorkerReady', handleServiceWorkerReady);
      resolve();
    };
    window.addEventListener('serviceWorkerReady', handleServiceWorkerReady);

    // Otherwise wait for the service worker to be ready
    const onControllerChange = () => {
      console.log('Service Worker controller changed, now ready');
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve();
    };

    // Listen for the controllerchange event
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // If no service worker activates within 5 seconds, proceed anyway
    setTimeout(() => {
      console.log('Service Worker ready timeout - proceeding anyway');
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.removeEventListener('serviceWorkerReady', handleServiceWorkerReady);
      resolve();
    }, 5000);
  });
}

// Initialize auth state
async function initAuth() {
  console.log('Initializing auth state...');
  
  // Create a promise that resolves when auth is initialized
  if (!authInitPromise) {
    authInitPromise = (async () => {
      try {
        // Set up a timeout for auth initialization
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Auth initialization timed out')), 10000);
        });

        // Create the initialization promise
        const initializationPromise = (async () => {
          // Wait for service worker to be ready before initializing auth
          await waitForServiceWorkerReady();
          console.log('Service worker ready, proceeding with auth initialization');
          
          let session;
          try {
            const result = await supabase.auth.getSession();
            session = result?.data?.session;
            console.log('Session fetch result:', result);
          } catch (err) {
            console.error('Error fetching session from Supabase:', err);
          }
          
          if (session?.user) {
            currentUser = session.user;
            localStorage.setItem('supabase.auth.token', JSON.stringify(session));
            console.log('User is authenticated:', currentUser);
            notifyAuthStateChange();
          } else {
            console.log('No valid session found or user is missing');
            localStorage.removeItem('supabase.auth.token');
          }
          
          // Listen for auth state changes
          supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state changed:', event, session);
            
            if (event === 'SIGNED_IN' && session) {
              currentUser = session.user;
              // Store session in localStorage for our custom check
              localStorage.setItem('supabase.auth.token', JSON.stringify(session));
              console.log('User signed in:', currentUser);
              notifyAuthStateChange();
            } else if (event === 'SIGNED_OUT') {
              currentUser = null;
              localStorage.removeItem('supabase.auth.token');
              console.log('User signed out');
              notifyAuthStateChange();
            }
          });
          
          // Mark auth as initialized
          authInitialized = true;
          console.log('Auth initialization complete');
        })();

        // Race between initialization and timeout
        await Promise.race([initializationPromise, timeoutPromise]);
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Mark as initialized even if there was an error, to prevent hanging
        authInitialized = true;
        throw error;
      }
    })();
  }
  
  return authInitPromise;
}

// Check if auth is initialized
function isAuthInitialized() {
  return authInitialized;
}

// Wait for auth to be initialized
async function waitForAuth() {
  if (authInitialized) {
    return Promise.resolve();
  }
  
  return authInitPromise || initAuth();
}

// Sign in with email and password
async function signIn(email, password) {
  console.log('Attempting to sign in with:', email);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    console.log('Sign in response:', { data, error });
    
    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }
    
    console.log('Sign in successful:', data);
    return data;
  } catch (err) {
    console.error('Unexpected error during sign in:', err);
    throw err;
  }
}

// Sign up with email and password
async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (error) {
    throw error;
  }
  
  return data;
}

// Sign out
async function signOut() {
  console.log('Signing out user...');
  try {
    // First clear any cached auth data
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.removeItem('supabase.auth.token');
    localStorage.removeItem('auth_redirect_count');
    
    // Then sign out from Supabase
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error during sign out:', error);
      throw error;
    }
    
    // Set up a listener for the caches cleared event
    const cachesClearedPromise = new Promise((resolve) => {
      const handleCachesCleared = (event) => {
        console.log('Received caches cleared event during signout:', event.detail);
        window.removeEventListener('cachesCleared', handleCachesCleared);
        resolve();
      };
      window.addEventListener('cachesCleared', handleCachesCleared);
      
      // Set a timeout in case the event never fires
      setTimeout(() => {
        window.removeEventListener('cachesCleared', handleCachesCleared);
        console.warn('Timed out waiting for caches cleared event during signout');
        resolve();
      }, 2000);
    });
    
    // Clear service worker cache if possible
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        action: 'CLEAR_CACHES'
      });
      
      // Wait for the cache to be cleared or timeout
      await cachesClearedPromise;
    }
    
    console.log('Sign out successful');
    
    // Force a clean reload after signout
    setTimeout(() => {
      window.location.href = window.location.origin + '/login.html?no_redirect=true';
    }, 500);
  } catch (error) {
    console.error('Unexpected error during sign out:', error);
    // Even if there's an error, try to redirect to login page
    window.location.href = window.location.origin + '/login.html?no_redirect=true';
    throw error;
  }
}

// Get current user
function getCurrentUser() {
  return currentUser;
}

// Check if user is authenticated
function isAuthenticated() {
  return !!currentUser;
}

// Subscribe to auth state changes
function onAuthStateChange(callback) {
  authStateChangeCallbacks.push(callback);
  
  // Immediately call with current state
  if (currentUser) {
    callback(currentUser);
  }
  
  // Return unsubscribe function
  return () => {
    authStateChangeCallbacks = authStateChangeCallbacks.filter(cb => cb !== callback);
  };
}

// Notify all subscribers of auth state change
function notifyAuthStateChange() {
  authStateChangeCallbacks.forEach(callback => callback(currentUser));
}

// Create user profile after signup
async function createUserProfile(userData) {
  if (!currentUser) {
    throw new Error('No authenticated user');
  }
  
  const { data, error } = await supabase
    .from('users')
    .insert({
      user_id: currentUser.id,
      first_name: userData.firstName,
      last_name: userData.lastName,
      // Other fields will be collected via chatbot
    })
    .select();
  
  if (error) {
    throw error;
  }
  
  return data;
}

// Initialize auth on script load
initAuth();

// Export auth functions
export {
  signIn,
  signUp,
  signOut,
  getCurrentUser,
  isAuthenticated,
  onAuthStateChange,
  createUserProfile,
  isAuthInitialized,
  waitForAuth
};
