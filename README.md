<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: <https://ai.studio/apps/drive/1f750jiDE4va-BhyPTrJ_L7Dg-u1i3bT1>

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:
   - Copy `.env.example` to `.env` (or create a new `.env` file)
   - Set the required variables:
     - `GEMINI_API_KEY`: Your Gemini API key
     - `VITE_GOOGLE_DRIVE_CLIENT_ID`: Your Google OAuth Client ID
     - `VITE_GOOGLE_DRIVE_API_KEY`: Your Google API Key
   - Optional variables:
     - `VITE_GOOGLE_SHEETS_LOG_ID`: Google Sheets spreadsheet ID for activity logging
     - `VITE_DRIVE_TEMPLATES_FOLDER_ID`: Google Drive folder ID for templates
     - `VITE_DRIVE_DESTINATION_FOLDER_ID`: Google Drive folder ID for destination

3. Run the app:

   ```bash
   npm run dev
   ```

For detailed configuration instructions, see [CONFIGURACION_GOOGLE_DRIVE.md](CONFIGURACION_GOOGLE_DRIVE.md)

## test
