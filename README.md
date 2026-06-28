# ⚡ The Last-Minute Life Saver
**An Autonomous, Context-Aware Agentic Workspace**

Unlike standard chatbots that wait for instructions and output plain text, this application is a proactive execution engine. It listens to your chaotic, last-minute tasks, calculates your psychological "Friction Score", and physically manipulates your cloud environment to start the work for you.

## 🚀 Agentic Features
* **Zero-Click Cloud Scaffolding:** Autonomously generates and formats starter Google Docs in your Drive for heavy writing tasks.
* **Proactive Draft-in-Box:** Analyzes communication intent and silently places pre-written emails directly into your Gmail Drafts.
* **Autonomous Time-Blocking:** Calculates estimated completion time and physically blocks focus sessions on your real Google Calendar before the deadline.
* **Dynamic Skill-Gap Bridging:** If the agent detects a highly technical task (Friction Score > 7), it autonomously embeds targeted YouTube tutorials directly into your execution node graph.
* **Friction-Aware Decomposition:** Breaks massive, overwhelming projects into microscopic, actionable nodes via an interactive UI.
* **Voice-to-Execution:** Hands-free, multimodal input using the native Web Speech API.

## 🛠️ Technology Stack
* **Core AI Engine:** Google AI Studio (Gemini Flash-Lite)
* **Orchestrated Google APIs:** Google Auth, Calendar API, Gmail API, Google Docs API, Google Drive API, YouTube Data API v3.
* **Frontend:** React (Vite), Tailwind CSS, Lucide Icons, Axios.
* **Backend:** Node.js, Express, MongoDB Atlas, Mongoose.
* **Deployment:** Vercel (Client) & Render (Server).

## ⚙️ Local Development Setup
1. Clone the repository.
2. Navigate to `/backend`, run `npm install`, and create a `.env` file with `MONGO_URI`, `FRONTEND_URL`, and `GEMINI_API_KEY`. Start the server with `node server.js`.
3. Navigate to `/frontend`, run `npm install`, and create a `.env` file with `VITE_BACKEND_URL`. Start the client with `npm run dev`.