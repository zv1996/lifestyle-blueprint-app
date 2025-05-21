import { isAuthenticated, getCurrentUser, signOut, waitForAuth } from './auth.js';
import { initChatbot } from './chatbot.js';
import { socketClient } from './socket-client.js';
import { initMealHistory } from './meal-history.js';
import './calorie-calculator.js';
import './calorie-results-overlay.js';
import './calorie-calculation-collector.js';

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize the app in the correct order
    await initializeApp();
});

/**
 * Initialize the app in the correct order
 */
async function initializeApp() {
    try {
        console.log('Initializing app...');
        
        // 1. First register service worker
        await registerServiceWorker();
        
        // 2. Set up UI event listeners
        setupUIEventListeners();
        
        // 3. Wait for auth initialization
        await waitForAuth();
        
        // 4. Check authentication status
        await checkAuth();
        
        // 5. Update navigation based on auth status
        await updateNavigation();
        
        // 6. Initialize page-specific features
        initializePageFeatures();
        
        console.log('App initialization complete');
    } catch (error) {
        console.error('Error during app initialization:', error);
    }
}

/**
 * Set up UI event listeners
 */
function setupUIEventListeners() {
    // Mobile menu toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('nav');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            menuToggle.classList.toggle('active');
            nav.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (nav && nav.classList.contains('active') && 
            !nav.contains(event.target) && 
            !menuToggle.contains(event.target)) {
            nav.classList.remove('active');
            menuToggle.classList.remove('active');
        }
    });
    
    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.action === 'CLEAR_AUTH_STORAGE') {
            console.log('Received request to clear auth storage:', event.data.timestamp);
            localStorage.removeItem('supabase.auth.token');
            sessionStorage.removeItem('supabase.auth.token');
            localStorage.removeItem('auth_redirect_count');
        } else if (event.data && event.data.action === 'SERVICE_WORKER_READY') {
            console.log('Service worker is ready:', event.data.timestamp);
            // Dispatch a custom event that other parts of the app can listen for
            window.dispatchEvent(new CustomEvent('serviceWorkerReady', {
                detail: { timestamp: event.data.timestamp }
            }));
        } else if (event.data && event.data.action === 'CACHES_CLEARED') {
            console.log('Caches cleared:', event.data.timestamp);
            // Dispatch a custom event that other parts of the app can listen for
            window.dispatchEvent(new CustomEvent('cachesCleared', {
                detail: { timestamp: event.data.timestamp }
            }));
        }
    });
}

/**
 * Initialize page-specific features
 */
function initializePageFeatures() {
    // Set up socket cleanup for all pages
    socketClient.setupPageUnloadCleanup();
    
    // Initialize the chatbot if on the home page
    if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
        // Explicitly connect socket for chatbot
        socketClient.connect();
        initChatbot();
    }
    
    // Initialize the meal history page if on the meal history page
    if (window.location.pathname.includes('meal-history.html')) {
        initMealHistory();
    }
}

// Check if user is authenticated with improved safeguards against redirect loops
async function checkAuth() {
    console.log('Checking authentication status...');
    
    // Skip auth check for login page and cache clear page (robust version)
    const path = window.location.pathname;
    if (
      path.includes('login') || 
      path.includes('test-cache-clear') || 
      path === '/' || 
      path.endsWith('login.html') ||
      path.includes('contact.html')
    ) {
      console.log('On login or cache clear page, skipping auth check');
      return;
    }
    
    // Get the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if we're in a redirect loop (indicated by a 'no_redirect' parameter)
    if (urlParams.has('no_redirect')) {
        console.log('Skipping redirect due to no_redirect parameter');
        return;
    }
    
    try {
        // Wait for auth to be initialized before checking
        console.log('Waiting for auth initialization...');
        await waitForAuth();
        console.log('Auth initialization complete');
        
        // Check if user is authenticated using the auth module's function
        if (!isAuthenticated()) {
            console.log('Not authenticated, checking redirect count');
            
            // Add a redirect counter to localStorage to detect loops
            let redirectCount = parseInt(localStorage.getItem('auth_redirect_count') || '0');
            redirectCount++;
            localStorage.setItem('auth_redirect_count', redirectCount.toString());
            
            // If we've redirected too many times, something is wrong - break the loop
            if (redirectCount > 2) {
                console.error('Too many redirects detected, clearing auth state and redirecting to cache clear page');
                localStorage.removeItem('supabase.auth.token');
                sessionStorage.removeItem('supabase.auth.token');
                localStorage.removeItem('auth_redirect_count');
                
                // Redirect to the cache clear page instead of login with no_redirect
                window.location.href = 'test-cache-clear.html';
                return;
            } else {
                console.log('Redirecting to login page');
                window.location.href = 'login.html';
                return;
            }
        }
        
        // Reset redirect counter on successful auth
        localStorage.removeItem('auth_redirect_count');
        
        // User is authenticated, update UI
        const user = getCurrentUser();
        if (user && user.email) {
            console.log('Authenticated as:', user.email);
        }
    } catch (error) {
        console.error('Error during auth check:', error);
        // In case of error, redirect to the cache clear page to help recover
        window.location.href = 'test-cache-clear.html';
    }
}

// Update navigation based on auth status
async function updateNavigation() {
    console.log('Updating navigation based on auth status');
    const loginLink = document.querySelector('nav a[href="login.html"]');
    
    if (!loginLink) {
        return;
    }
    
    console.log('Found login link');
    
    try {
        // Wait for auth to be initialized before checking
        console.log('Waiting for auth initialization for navigation update...');
        await waitForAuth();
        console.log('Auth initialization complete for navigation update');
        
        // Check for session in localStorage
        const sessionStr = localStorage.getItem('supabase.auth.token');
        
        if (sessionStr) {
            try {
                // Parse the session
                const session = JSON.parse(sessionStr);
                console.log('Found session in localStorage for navigation update:', session);
                
                // Check if session is valid
                if (session && session.user) {
                    console.log('Session is valid, updating login link to logout');
                    
                    // Change login link to logout
                    loginLink.textContent = 'Logout';
                    loginLink.href = '#';
                    loginLink.classList.add('logout-btn');
                    loginLink.classList.remove('login-btn');
                    
                    // Remove existing event listeners by cloning the node
                    const newLoginLink = loginLink.cloneNode(true);
                    loginLink.parentNode.replaceChild(newLoginLink, loginLink);
                    
                    // Add new event listener
                    newLoginLink.addEventListener('click', async (e) => {
                        e.preventDefault();
                        console.log('Logout button clicked');
                        try {
                            await signOut();
                            localStorage.removeItem('supabase.auth.token');
                            console.log('User signed out, redirecting to login page');
                            window.location.href = 'login.html';
                        } catch (error) {
                            console.error('Logout error:', error);
                        }
                    });
                    
                    return;
                }
            } catch (error) {
                console.error('Error parsing session for navigation update:', error);
            }
        }
        
        // If we get here, user is not authenticated or session is invalid
        console.log('User is not authenticated, keeping login link as is');
    } catch (error) {
        console.error('Error during navigation update:', error);
    }
}


// Register service worker for PWA
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            // Check if we're in development mode
            const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            
            // Register the service worker
            navigator.serviceWorker.register('/service-worker.js')
                .then(function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    
                    // In development mode, update the service worker immediately
                    if (isDev) {
                        registration.update();
                        console.log('Development mode: Service worker update triggered');
                    }
                })
                .catch(function(error) {
                    console.log('ServiceWorker registration failed: ', error);
                });
            
            // Add a function to clear caches (useful for development)
            // WARNING: This function can cause redirect loops if used directly
            // Use window.safelyClearCacheAndReload() instead
            window.clearServiceWorkerCache = function() {
                console.warn('WARNING: Using window.clearServiceWorkerCache() directly can cause redirect loops.');
                console.warn('Please use window.safelyClearCacheAndReload() instead for safer cache clearing.');
                
                if (navigator.serviceWorker.controller) {
                    return new Promise((resolve, reject) => {
                        // Create a message channel for receiving a response
                        const messageChannel = new MessageChannel();
                        
                        // Set up the message handler
                        messageChannel.port1.onmessage = (event) => {
                            if (event.data && event.data.action === 'CACHES_CLEARED') {
                                console.log('Cache cleared successfully at:', event.data.timestamp);
                                resolve(true);
                            } else {
                                console.error('Unexpected message from service worker:', event.data);
                                reject(new Error('Unexpected response from service worker'));
                            }
                        };
                        
                        // Send message to service worker to clear caches
                        navigator.serviceWorker.controller.postMessage(
                            { action: 'CLEAR_CACHES' },
                            [messageChannel.port2]
                        );
                        
                        console.log('Cache clear request sent to service worker');
                    });
                } else {
                    console.log('No active service worker found to clear cache');
                    return Promise.resolve(false);
                }
            };
            
            // Manually clear auth state (separate from cache clearing)
            window.clearAuthState = function() {
                console.log('Manually clearing auth state');
                localStorage.removeItem('supabase.auth.token');
                sessionStorage.removeItem('supabase.auth.token');
                localStorage.removeItem('auth_redirect_count');
                return Promise.resolve(true);
            };
            
            // Add a helper function to safely clear cache and reload
            window.safelyClearCacheAndReload = async function() {
                try {
                    console.log('Safely clearing cache and reloading...');
                    
                    // First clear auth state
                    await window.clearAuthState();
                    
                    // Reset any redirect counters
                    localStorage.removeItem('auth_redirect_count');
                    
                    // Set up a listener for the caches cleared event
                    const cachesClearedPromise = new Promise((resolve) => {
                        const handleCachesCleared = (event) => {
                            console.log('Received caches cleared event:', event.detail);
                            window.removeEventListener('cachesCleared', handleCachesCleared);
                            resolve();
                        };
                        window.addEventListener('cachesCleared', handleCachesCleared);
                        
                        // Set a timeout in case the event never fires
                        setTimeout(() => {
                            window.removeEventListener('cachesCleared', handleCachesCleared);
                            console.warn('Timed out waiting for caches cleared event');
                            resolve();
                        }, 3000);
                    });
                    
                    // Then clear the cache
                    await window.clearServiceWorkerCache();
                    
                    // Wait for the caches cleared event or timeout
                    await cachesClearedPromise;
                    
                    console.log('Cache and auth state cleared, reloading page with no_redirect parameter...');
                    
                    // Reload the page with no_redirect parameter to prevent redirect loops
                    window.location.href = window.location.pathname + '?no_redirect=true';
                } catch (error) {
                    console.error('Error during safe cache clear:', error);
                    alert('Failed to clear cache. Please try again or restart your browser.');
                    
                    // As a fallback, try to reload the page anyway
                    window.location.href = window.location.pathname + '?no_redirect=true';
                }
            };
            
            // Add a function to completely reset the application state
            window.resetAppState = async function() {
                try {
                    console.log('Completely resetting application state...');
                    
                    // Clear all localStorage and sessionStorage
                    localStorage.clear();
                    sessionStorage.clear();
                    
                    // Clear all caches
                    await window.clearServiceWorkerCache();
                    
                    // Unregister service worker
                    if ('serviceWorker' in navigator) {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        for (let registration of registrations) {
                            await registration.unregister();
                            console.log('Service worker unregistered');
                        }
                    }
                    
                    console.log('Application state reset complete, reloading page...');
                    
                    // Reload the page with clean state
                    window.location.href = 'login.html?no_redirect=true';
                } catch (error) {
                    console.error('Error during app state reset:', error);
                    alert('Failed to reset application state. Please try again or restart your browser.');
                }
            };
            
            // Add a development helper message
            if (isDev) {
                console.log(
                    '%c Development Mode: Service Worker Info ',
                    'background: #6e48e4; color: white; padding: 2px 5px; border-radius: 3px;',
                    '\nIf you need to clear the cache manually, run: window.safelyClearCacheAndReload()'
                );
            }
        });
    }
}
