# Google Cloud Platform (GCP) Configuration Guide

To run this application locally or deploy it to production, you must configure a Google Cloud Console project with the correct API scopes and OAuth credentials.

## Step 1: Create a Project
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `life-saver-agent`).

## Step 2: Enable Required APIs
Navigate to **APIs & Services > Library** and enable the following five APIs:
* Google Calendar API
* Gmail API
* Google Docs API
* Google Drive API
* YouTube Data API v3

## Step 3: Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** (unless you have a Google Workspace organization).
3. Fill in the required App Name and Support Email fields.
4. **Critical:** Under "Scopes", you must manually add the following scopes to allow the agent to execute actions:
   * `https://www.googleapis.com/auth/calendar.events`
   * `https://www.googleapis.com/auth/gmail.compose`
   * `https://www.googleapis.com/auth/documents`
   * `https://www.googleapis.com/auth/drive.file`
   * `https://www.googleapis.com/auth/youtube.readonly`

## Step 4: Generate Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Select **Web application**.
4. Under **Authorized JavaScript origins**, add your URIs:
   * Local: `http://localhost:5173`
   * Production: `https://your-vercel-domain.vercel.app`
5. Under **Authorized redirect URIs**, add the exact same URLs.
6. Copy the generated **Client ID** and place it in your frontend code (typically inside the `main.jsx` GoogleOAuthProvider wrapper).

## Step 5: Gemini AI Studio
1. Navigate to [Google AI Studio](https://aistudio.google.com/).
2. Generate an API Key for Gemini 3.1 Flash-Lite.
3. Add this key to your backend `.env` file as `GEMINI_API_KEY`.