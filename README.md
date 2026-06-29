# ⚡ The Last-Minute Life Saver
**An Autonomous, Context-Aware Agentic Workspace**

Unlike standard chatbots that wait for instructions and output plain text, this application is a proactive execution engine. It listens to your chaotic, last-minute tasks, calculates your psychological "Friction Score", and physically manipulates your cloud environment to start the work for you.

## 🚀 The Agentic Architecture
* **Zero-Click Cloud Scaffolding:** Autonomously generates, titles, and formats starter Google Docs in your Drive for heavy writing tasks.
* **The Auto-Correcting Goal Protocol:** Tracks long-term habits. When a daily milestone is completed, the agent dynamically queries Gemini in the background to generate tomorrow's progressively scaled micro-step.
* **Proactive Draft-in-Box:** Analyzes communication intent and silently places context-aware emails directly into your Gmail Drafts.
* **Autonomous Time-Blocking:** Calculates estimated completion time, prevents hallucinated timeframes via a backend safety catch, and physically blocks focus sessions on your Google Calendar.
* **Dynamic Skill-Gap Bridging:** If the agent detects a highly technical task (Friction Score > 7), it autonomously queries the YouTube API and embeds highly specific, playable tutorial videos directly into the UI node graph.
* **Friction-Aware Decomposition:** Breaks massive, overwhelming projects into microscopic, actionable milestones via an interactive Node Graph UI.

## 🛠️ Technology & Security Stack
* **Core AI Engine:** Google AI Studio (Gemini 3.1 Flash-Lite)
* **Frontend:** React (Vite), Tailwind CSS, Lucide Icons, Axios.
* **Backend:** Node.js, Express, MongoDB Atlas, Mongoose.
* **Security Edge:** `helmet` for HTTP header protection, `express-rate-limit` to prevent AI quota drain, and strict CORS policies.
* **Infrastructure:** Vercel (Client Edge), Render (Server), and UptimeRobot (Zero-sleep heartbeat).

## ☁️ Google Technologies Utilized
This project heavily orchestrates the Google Cloud ecosystem to convert text into real-world action:
1. **Google OAuth 2.0:** Secure, multi-scope cloud authentication.
2. **Google Calendar API (v3):** Temporal focus-block injection.
3. **Gmail API (v1):** Background draft creation via base64 encoded RFC 2822 messages.
4. **Google Docs & Drive APIs (v1/v3):** Zero-click generation of cloud assets.
5. **YouTube Data API (v3):** Fetching targeted educational embeds based on AI-derived skill gaps.

## ⚙️ Local Development Setup
1. Clone the repository.
2. Navigate to `/backend`, run `npm install`, and create a `.env` file with `MONGO_URI`, `FRONTEND_URL`, and `GEMINI_API_KEY`. Start the server with `node server.js`.
3. Navigate to `/frontend`, run `npm install`, and create a `.env` file with `VITE_BACKEND_URL`. Start the client with `npm run dev`.