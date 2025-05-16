import { isAuthenticated, getCurrentUser, signOut } from './auth.js';
import { initChatbot } from './chatbot.js';
import { socketClient } from './socket-client.js';
import './calorie-calculator.js';
import './calorie-results-overlay.js';
import './calorie-calculation-collector.js';

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication status
    checkAuth();
    
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
    
    // Update navigation based on auth status
    updateNavigation();
    
    // Initialize the chatbot
    initChatbot();
    
    // Service Worker Registration for PWA
    registerServiceWorker();
});

// Check if user is authenticated
function checkAuth() {
    console.log('Checking authentication status...');
    
    // Skip auth check for login page
    if (window.location.pathname.includes('login.html')) {
        console.log('On login page, skipping auth check');
        return;
    }
    
    // Check for session in localStorage
    const sessionStr = localStorage.getItem('supabase.auth.token');
    
    if (sessionStr) {
        try {
            // Parse the session
            const session = JSON.parse(sessionStr);
            console.log('Found session in localStorage:', session);
            
            // Check if session is valid
            if (session && session.user) {
                console.log('Session is valid, user is authenticated');
                return;
            }
        } catch (error) {
            console.error('Error parsing session:', error);
        }
    }
    
    // Redirect to login if not authenticated
    if (!isAuthenticated()) {
        console.log('Not authenticated, redirecting to login page');
        window.location.href = 'login.html';
        return;
    }
    
    // User is authenticated, update UI
    const user = getCurrentUser();
    console.log('Authenticated as:', user.email);
}

// Update navigation based on auth status
function updateNavigation() {
    console.log('Updating navigation based on auth status');
    const loginLink = document.querySelector('nav a[href="login.html"]');
    
    if (loginLink) {
        console.log('Found login link');
        
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
            window.clearServiceWorkerCache = function() {
                if (navigator.serviceWorker.controller) {
                    // Send message to service worker to clear caches
                    navigator.serviceWorker.controller.postMessage({
                        action: 'CLEAR_CACHES'
                    });
                    console.log('Cache clear request sent to service worker');
                    
                    // Also reload the page after a short delay
                    setTimeout(() => {
                        window.location.reload(true);
                    }, 500);
                    
                    return true;
                } else {
                    console.log('No active service worker found to clear cache');
                    return false;
                }
            };
            
            // Add a development helper message
            if (isDev) {
                console.log(
                    '%c Development Mode: Service Worker Info ',
                    'background: #6e48e4; color: white; padding: 2px 5px; border-radius: 3px;',
                    '\nIf you need to clear the cache manually, run: window.clearServiceWorkerCache()'
                );
            }
        });
    }
}
