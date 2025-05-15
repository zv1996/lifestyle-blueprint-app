// Authentication service for Lifestyle Blueprint app
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm';

// Initialize Supabase client (using public anon key, not service key)
const supabaseUrl = 'https://mzudbdooytyxxlnekjke.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16dWRiZG9veXR5eHhsbmVramtlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYwNDk5OTMsImV4cCI6MjA2MTYyNTk5M30.kP_-TPSSKl-KxR0SC2PffiWTC3W5CL2VEdUPctwoOBU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth state
let currentUser = null;
let authStateChangeCallbacks = [];

// Initialize auth state
async function initAuth() {
  console.log('Initializing auth state...');
  
  // Check for existing session
  const { data: { session } } = await supabase.auth.getSession();
  
  console.log('Existing session:', session);
  
  if (session) {
    currentUser = session.user;
    // Store session in localStorage for our custom check
    localStorage.setItem('supabase.auth.token', JSON.stringify(session));
    console.log('User is authenticated:', currentUser);
    notifyAuthStateChange();
  } else {
    console.log('No existing session found');
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
  const { error } = await supabase.auth.signOut();
  
  if (error) {
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
  createUserProfile
};
