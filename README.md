# Lifestyle Blueprint App

A Progressive Web App (PWA) that helps users create personalized meal plans based on their dietary preferences, health metrics, and fitness goals.

## Project Overview

The Lifestyle Blueprint App is a chatbot-driven application that:

1. Collects user information through a conversational interface
2. Calculates calorie needs based on user metrics and goals
3. Generates personalized meal plans using OpenAI
4. Stores user data and meal plans in a Supabase database

## Project Structure

- `api/` - Backend Node.js/Express server
- `js/` - Frontend JavaScript modules
- `css/` - Stylesheets
- `images/` - Image assets
- `scripts/` - Utility scripts

## Deployment Guide

This guide will help you deploy the application with:
- Frontend hosted on PHP/Cloudways
- Backend hosted on Render.com
- Database hosted on Supabase

### Step 1: Deploy the Backend to Render

1. Create a GitHub repository for your project:
   - Create a new repository on GitHub
   - Push your code to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. Sign up for a Render account at [render.com](https://render.com)

3. Create a new Web Service:
   - Click "New" and select "Web Service"
   - Connect your GitHub repository
   - Configure the service:
     - Name: `lifestyle-blueprint-api` (or your preferred name)
     - Environment: `Node`
     - Build Command: `npm install`
     - Start Command: `node api/server.js`
     - Plan: Free (or select a paid plan for production)

4. Add Environment Variables:
   - Go to the "Environment" tab
   - Add the following variables from your `.env` file:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_KEY`
     - `OPENAI_API_KEY`
     - `PORT` (set to `10000` for Render)
     - `ADMIN_PASSWORD`

5. Deploy the service:
   - Click "Create Web Service"
   - Wait for the deployment to complete
   - Note the service URL (e.g., `https://lifestyle-blueprint-api.onrender.com`)

### Step 2: Configure CORS for Your Domain

1. Update the CORS configuration in `api/server.js`:
   - Open the file and find the CORS configuration section
   - Add your PHP hosted domain to the `allowedDomains` array:
   ```javascript
   const allowedDomains = [
     'https://your-php-domain.com'
   ];
   ```

2. Commit and push the changes:
   ```bash
   git add api/server.js
   git commit -m "Add production domain to CORS configuration"
   git push
   ```

3. Render will automatically redeploy your backend with the updated CORS settings

### Step 3: Configure the Frontend

1. Update the `js/config.js` file:
   - Open the file and update the production API URL:
   ```javascript
   getApiBaseUrl: () => {
     if (config.isDevelopment()) {
       return 'http://localhost:3001';
     } else {
       return 'https://lifestyle-blueprint-api.onrender.com'; // Your Render URL
     }
   }
   ```

2. Upload the frontend files to your PHP hosting:
   - Connect to your PHP hosting via SFTP
   - Upload all files except:
     - `.git/`
     - `.env`
     - `api/`
     - `node_modules/`
     - Any other server-side files

### Step 4: Test the Deployment

1. Use the included test utility:
   - Open `test-connection.html` in your browser
   - Test both local and production connections
   - Verify that your backend is accessible

2. Visit your PHP hosted website:
   - Create a new account
   - Start a conversation
   - Verify that data is being stored in Supabase

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup

1. Clone the repository:
   ```bash
   git clone <your-github-repo-url>
   cd lifestyle-blueprint-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_key
   OPENAI_API_KEY=your_openai_api_key
   PORT=3001
   ADMIN_PASSWORD=your_admin_password
   ```

4. Start the development server:
   ```bash
   node api/server.js
   ```

5. Open `index.html` in your browser or use a local server:
   ```bash
   npx serve .
   ```

## Updating the Application

When you make changes to the application:

1. For backend changes:
   - Commit and push to GitHub
   - Render will automatically redeploy

2. For frontend changes:
   - Upload the updated files to your PHP hosting via SFTP

## Troubleshooting

If you encounter issues with the chatbot not storing data:

1. Check the browser console for errors
2. Verify that the API URL in `js/config.js` is correct
3. Ensure CORS is properly configured in `api/server.js`
4. Check that your Supabase credentials are valid
5. Verify that the Render service is running

## License

This project is licensed under the MIT License - see the LICENSE file for details.