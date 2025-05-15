import { signIn, signUp, createUserProfile } from './auth.js';

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    checkAuthState();
    
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
                
                // Redirect to home page after a short delay
                console.log('Login successful, redirecting to index.html in 1 second...');
                setTimeout(() => {
                    console.log('Redirecting now...');
                    // Use absolute path to ensure proper redirection
                    window.location.href = window.location.origin + '/index.html';
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

// Check if user is already authenticated
function checkAuthState() {
    // This will be implemented with the auth service
    // For now, we'll just check if there's a token in localStorage
    const token = localStorage.getItem('supabase.auth.token');
    if (token) {
        window.location.href = 'index.html';
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
