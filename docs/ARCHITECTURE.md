# System Architecture & Orchestration Logic

The Last-Minute Life Saver operates on a strict "Agentic Orchestration" model. Rather than writing direct scripts for every possible user request, the backend relies on Gemini as a deterministic decision engine.

## The Execution Flow

1. **Multimodal Ingestion (Frontend)**
   Users input data via text or the Web Speech API. This data, alongside the user's OAuth access token and current timezone data, is packaged and sent to the Node.js backend.

2. **Zero-Shot Contextual Parsing (Backend Brain)**
   The backend injects the user's prompt into a heavily engineered system prompt. Gemini is instructed to act as a project manager, returning a strict JSON payload that includes boolean execution flags:
   * `requiresEmail`: Boolean
   * `requiresDocument`: Boolean
   * `requiresTutorial`: Boolean
   * `isGoal`: Boolean

3. **Conditional API Orchestration (Execution)**
   The Node.js server parses the JSON payload. It does not blindly execute APIs. Instead, it reads the boolean flags to determine which parts of the Google Cloud ecosystem to spin up:
   * **Calendar:** Always executed (with a hardcoded 60-minute maximum safety catch to override AI temporal hallucinations).
   * **Docs/Drive:** Only executed if `requiresDocument` is true. Scaffolds the text and returns the live `documentId`.
   * **Gmail:** Only executed if `requiresEmail` is true. Uses base64 encoding to silently draft messages.
   * **YouTube:** Only executed if `requiresTutorial` is true (usually triggered by a Friction Score > 7).

4. **Dynamic Evolution (The Streak Route)**
   If a task is flagged as a `Goal`, the standard completion route is bypassed. Instead, the backend hits a custom `PUT` route that updates the streak counter and immediately fires a background query to Gemini to generate tomorrow's curriculum, creating an infinite, auto-correcting learning loop.