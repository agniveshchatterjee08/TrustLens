# TrustLens AI

TrustLens combines your original browser-side URL heuristics with Gemini AI explanations and a small cybersecurity Q&A assistant.

## Requirements
- Node.js 20 or later
- A Gemini API key from https://aistudio.google.com/apikey

## Setup
1. Open this folder in VS Code.
2. Open a terminal in this folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a file named `.env` in the project root. Copy `.env.example` into it and add your own key:

   ```env
   GEMINI_API_KEY=PASTE_YOUR_KEY_HERE
   GEMINI_MODEL=gemini-flash-latest
   PORT=3000
   ```

   Keep `.env` private. Never paste your key into `script.js`, `index.html`, GitHub, or a screenshot.

5. Start the app:

   ```bash
   npm start
   ```

6. Open http://localhost:3000 in your browser.

## How it works
- `public/script.js` runs the existing local heuristic checks first.
- It sends the URL text, hostname, score and findings to `/api/analyze`.
- `server.js` calls Gemini from the server and returns a structured explanation.
- The assistant sends questions to `/api/chat`.

## Privacy and limitations
The submitted URL and local findings are sent to your server and then to Google's Gemini API for AI analysis. Do not submit private, password-reset, invitation, or confidential URLs. The server never fetches/opens the URL. The AI does not establish that a website is safe or malicious. The local score is a heuristic, not a calibrated probability.

## Troubleshooting
- `Gemini API key is not configured`: check that `.env` exists in the same folder as `server.js`, and restart the server.
- `AI analysis failed`: verify the key, model availability, internet connection, and API quota.
- If the page doesn't load, make sure you opened `http://localhost:3000`, not the HTML file directly.
