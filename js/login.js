// ⚠️ DO NOT modify this file’s auth logic.
// Auth state is initialized centrally and must be awaited using `waitForAuth()`.
// Redirects based on session must come AFTER `waitForAuth()` resolves.

import { signIn, signUp, createUserProfile, waitForAuth, isAuthInitialized } from './auth.js';

// Wait for service worker to be ready - using the same implementation as auth.js
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

document.addEventListener('DOMContentLoaded', async function() {
    try {
        console.log('DOM loaded, waiting for service worker and auth to be ready...');
        
        // Set up a loading indicator
        const authCard = document.querySelector('.auth-card');
        if (authCard) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = '<div class="spinner"></div><p>Initializing application...</p>';
            loadingIndicator.style.position = 'absolute';
            loadingIndicator.style.top = '0';
            loadingIndicator.style.left = '0';
            loadingIndicator.style.width = '100%';
            loadingIndicator.style.height = '100%';
            loadingIndicator.style.display = 'flex';
            loadingIndicator.style.flexDirection = 'column';
            loadingIndicator.style.alignItems = 'center';
            loadingIndicator.style.justifyContent = 'center';
            loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            loadingIndicator.style.zIndex = '1000';
            
            // Add spinner styles
            const style = document.createElement('style');
            style.textContent = `
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 1s ease-in-out infinite;
                    margin-bottom: 10px;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            
            authCard.style.position = 'relative';
            authCard.appendChild(loadingIndicator);
            
            // Loading indicator will be removed in the try/catch block
        }
        
        // Initialize with a timeout
        try {
            const initPromise = Promise.all([
                waitForServiceWorkerReady(),
                waitForAuth()
            ]);

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Initialization timed out')), 15000);
            });

            // Race between initialization and timeout
            await Promise.race([initPromise, timeoutPromise]);
            
            console.log('Service worker and auth are ready, checking auth state...');
            checkAuthStateWithSafeguard();
        } finally {
            // Always remove loading indicator
            const loadingIndicator = document.querySelector('.loading-indicator');
            if (loadingIndicator && loadingIndicator.parentNode) {
                loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        // Show error message to user
        showMessage('error', 'There was a problem initializing the application. Please try refreshing the page.');
        
        // Remove loading indicator if it exists
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator && loadingIndicator.parentNode) {
            loadingIndicator.parentNode.removeChild(loadingIndicator);
        }
    }
    
    // Tab switching functionality
    const tabBtns = document.querySelectorAll('.tab-btn');
    const authForms = document.querySelectorAll('.auth-form');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all tabs
            tabBtns.forEach(tab => tab.classList.remove('active'));
            
            // Add active class to clicked tab
            btn.classList.add('active');
            
            // Hide all forms
            authForms.forEach(form => form.classList.remove('active'));
            
            // Show the corresponding form
            const formId = btn.getAttribute('data-tab') + 'Form';
            document.getElementById(formId).classList.add('active');
        });
    });
    
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        console.log('Login form found, adding submit event listener');
        
        loginForm.addEventListener('submit', async function(event) {
            console.log('Login form submitted');
            event.preventDefault();
            
            // Get form values
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            
            console.log('Form values:', { email, password: '***', rememberMe });
            
            // Simple validation
            if (!email || !password) {
                console.log('Validation failed: missing email or password');
                showMessage('error', 'Please fill in all fields');
                return;
            }
            
            // Get submit button and store its original text
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent || 'Sign In';
            
            try {
                // Show loading state
                submitBtn.textContent = 'Signing in...';
                submitBtn.disabled = true;
                
                // Attempt to sign in
                await signIn(email, password);
                
                showMessage('success', 'Login successful! Redirecting to dashboard...');
                
                // Reset redirect counter on successful login
                localStorage.removeItem('auth_redirect_count');
                
                // Set up a listener for the caches cleared event
                const cachesClearedPromise = new Promise((resolve) => {
                    const handleCachesCleared = (event) => {
                        console.log('Received caches cleared event during login redirect:', event.detail);
                        window.removeEventListener('cachesCleared', handleCachesCleared);
                        resolve();
                    };
                    window.addEventListener('cachesCleared', handleCachesCleared);
                    
                    // Set a timeout in case the event never fires
                    setTimeout(() => {
                        window.removeEventListener('cachesCleared', handleCachesCleared);
                        console.warn('Timed out waiting for caches cleared event during login redirect');
                        resolve();
                    }, 1000);
                });
                
                // Redirect to home page after a short delay
                console.log('Login successful, redirecting to index.html in 1 second...');
                setTimeout(async () => {
                    console.log('Redirecting now...');
                    
                    // Clear any stale caches before redirecting
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                            action: 'CLEAR_CACHES'
                        });
                        
                        // Wait for the cache to be cleared or timeout
                        await cachesClearedPromise;
                    }
                    
                    // Use absolute path to ensure proper redirection
                    window.location.href = window.location.origin + '/index.html?no_redirect=true';
                }, 1000);
            } catch (error) {
                console.error('Login error:', error);
                showMessage('error', `Login failed: ${error.message || 'Unknown error'}`);
                
                // Reset button
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // Register form submission
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            // Get form values
            const fullName = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const agreeTerms = document.getElementById('agreeTerms').checked;
            
            // Parse first and last name
            const nameParts = fullName.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
            
            // Simple validation
            if (!fullName || !email || !password || !confirmPassword) {
                showMessage('error', 'Please fill in all fields');
                return;
            }
            
            if (password !== confirmPassword) {
                showMessage('error', 'Passwords do not match');
                return;
            }
            
            if (!agreeTerms) {
                showMessage('error', 'You must agree to the Terms of Service and Privacy Policy');
                return;
            }
            
            // Get submit button and store its original text
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent || 'Create Account';
            
            try {
                // Show loading state
                submitBtn.textContent = 'Creating account...';
                submitBtn.disabled = true;
                
                // Attempt to sign up
                const { user } = await signUp(email, password);
                
                // Create user profile
                if (user) {
                    await createUserProfile({
                        firstName,
                        lastName
                    });
                }
                
                showMessage('success', 'Registration successful! Please check your email to confirm your account.');
                
                // Switch to login tab
                tabBtns.forEach(tab => tab.classList.remove('active'));
                document.querySelector('[data-tab="login"]').classList.add('active');
                
                authForms.forEach(form => form.classList.remove('active'));
                document.getElementById('loginForm').classList.add('active');
                
                // Pre-fill the login email field
                document.getElementById('loginEmail').value = email;
                
                // Reset button
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            } catch (error) {
                console.error('Registration error:', error);
                showMessage('error', `Registration failed: ${error.message || 'Unknown error'}`);
                
                // Reset button
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
    
    // Social login buttons
    const socialBtns = document.querySelectorAll('.social-btn');
    
    socialBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const provider = this.classList.contains('google') ? 'Google' : 'Facebook';
            showMessage('info', `${provider} login will be implemented in a future update.`);
        });
    });
    
    // Forgot password link
    const forgotPasswordLink = document.querySelector('.forgot-password');
    
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async function(event) {
            event.preventDefault();
            const email = document.getElementById('loginEmail').value;
            
            if (!email) {
                showMessage('error', 'Please enter your email address in the login form first.');
                return;
            }
            
            try {
                // In a real implementation, we would call the password reset function
                // await supabase.auth.resetPasswordForEmail(email);
                showMessage('info', `Password reset functionality will be implemented in a future update.`);
            } catch (error) {
                console.error('Password reset error:', error);
                showMessage('error', `Failed to send password reset email: ${error.message}`);
            }
        });
    }
});

// Check if user is already authenticated with improved safeguards against redirect loops
async function checkAuthStateWithSafeguard() {
    // Wait for auth to be fully initialized
    if (!isAuthInitialized()) {
        console.error('Auth not initialized yet, cannot check state');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.has('no_redirect')) {
        console.log('Skipping redirect check due to no_redirect parameter');
        localStorage.removeItem('auth_redirect_count');
        return;
    }

    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
            console.error('Error fetching session:', error.message);
            return;
        }

        if (session && session.user) {
            console.log('Active session detected, redirecting to index.html');

            let redirectCount = parseInt(localStorage.getItem('auth_redirect_count') || '0');
            redirectCount++;
            localStorage.setItem('auth_redirect_count', redirectCount.toString());

            if (redirectCount > 2) {
                console.error('Too many redirects detected, clearing auth state');
                await supabase.auth.signOut();
                localStorage.removeItem('auth_redirect_count');
                showMessage('error', 'Detected a redirect loop. Auth state has been cleared. Please try logging in again.');
                return;
            }

            setTimeout(() => {
                if (!window.location.pathname.includes('index.html')) {
                    console.log('Redirecting to index.html');
                    window.location.href = window.location.origin + '/index.html?no_redirect=true';
                } else {
                    console.log('Already on index.html, skipping redirect.');
                }
            }, 300);
        } else {
            console.log('No active session found, staying on login page');
            localStorage.removeItem('auth_redirect_count');
        }
    } catch (error) {
        console.error('Unexpected error during auth check:', error);
        showMessage('error', 'There was a problem checking your session. Please log in again.');
        localStorage.removeItem('auth_redirect_count');
    }
}

// Show message to user
function showMessage(type, message) {
    // Check if message container exists, if not create it
    let messageContainer = document.querySelector('.message-container');
    
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        document.querySelector('.auth-card').prepend(messageContainer);
    }
    
    // Create message element
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;
    
    // Add to container
    messageContainer.innerHTML = '';
    messageContainer.appendChild(messageElement);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageElement.remove();
    }, 5000);
}
