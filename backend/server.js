import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Task from './models/Task.js';
import { google } from 'googleapis';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', 
    methods: ['GET', 'POST', 'DELETE','PUT'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 AI generations per 15 minutes
    message: { success: false, error: "System cooling down. Too many AI requests from this IP." }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB securely'))
  .catch((err) => console.error('MongoDB connection error:', err));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.use('/api/tasks/initiate', apiLimiter);

// UPDATED ENDPOINT: Retrieve saved tasks filtered securely by user email
app.get('/api/tasks', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ success: false, error: "User email parameter is required." });
        }
        
        // Find tasks belonging only to this specific user
        const tasks = await Task.find({ userEmail: email }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: tasks });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch tasks." });
    }
});

// UPDATED ENDPOINT: Master Orchestrator (Calendar, Gmail, Docs, YouTube)
app.post('/api/tasks/initiate', async (req, res) => {
    try {
        const { taskDescription, userEmail, accessToken, isGoal } = req.body;
        if (!userEmail) return res.status(400).json({ success: false, error: "User email identity is required." });

        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const currentTime = new Date().toLocaleString('en-US', { timeZoneName: 'short' }); 

        // 2. Inject Dynamic Context
        const systemContext = isGoal 
            ? `The user wants to build a long-term habit/goal: "${taskDescription}". Break this down into the absolute easiest "Day 1" micro-action to guarantee they don't fail.`
            : `The user needs to complete a specific task: "${taskDescription}".`;

        const prompt = `
            You are an elite, autonomous zero-shot execution agent. Current time: ${currentTime}.
            ${systemContext}

            CRITICAL RULES:
            1. Analyze the task to determine REQUIRED APIs.
            2. requiresEmail: TRUE ONLY if the task explicitly involves sending a message, email, or post.
            3. requiresDocument: TRUE ONLY if the task requires writing a report, essay, proposal, or extensive code blueprint.
            4. requiresTutorial: TRUE ONLY if the friction score is 7 or higher, or the user asks "how to".
            5. SCHEDULING RULES (CRITICAL):
               - Identify the user's deadline (e.g., "by 2 PM").
               - scheduleStartTime MUST be set 30 to 60 minutes BEFORE that deadline.
               - scheduleDurationMinutes MUST be a realistic focus block between 15 and 60 minutes. NEVER exceed 60 minutes.
               - Do not schedule in the past.
               - Do not schedule after the deadline.

            Provide JSON exactly:
            {
                "taskTitle": "Concise title",
                "urgencyLevel": "High", 
                "frictionScore": 8,
                "microSteps": ["step 1", "step 2", "step 3"],
                "preWorkCompleted": "Detailed draft, snippet, or outline.",
                "nextImmediateStep": "One microscopic physical action.",
                "requiresEmail": boolean,
                "emailSubject": "Subject if requiresEmail is true",
                "requiresDocument": boolean,
                "requiresTutorial": boolean,
                "tutorialSearchQuery": "Highly specific YouTube search query if requiresTutorial is true (e.g., 'React hooks tutorial')",
                "scheduleStartTime": "ISO 8601 string in the future",
                "scheduleDurationMinutes": integer
            }
        `;

        const result = await model.generateContent(prompt);
        const cleanJson = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const taskData = JSON.parse(cleanJson);

        let actionsReport = [];
        let createdDocLink = null;
        let foundVideoId = null;

        // --- GOOGLE APIs: INTELLIGENT CONDITIONAL EXECUTION ---
        if (accessToken) {
            const oauth2Client = new google.auth.OAuth2();
            oauth2Client.setCredentials({ access_token: accessToken });
            
            // 1. ALWAYS DO CALENDAR
            try {
                const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
                let startTime = new Date(taskData.scheduleStartTime);
                
                // Fallback if AI schedules in the past or fails parsing
                if (isNaN(startTime.getTime()) || startTime < new Date()) {
                    startTime.setTime(new Date().getTime() + 30 * 60 * 1000); // 30 mins from now
                }
                
                // NEW: Backend Safety Catch (Cap duration at 60 mins max)
                let safeDuration = parseInt(taskData.scheduleDurationMinutes) || 30;
                if (safeDuration > 60) {
                    console.log(`⚠️ AI suggested ${safeDuration} mins. Overriding to 45 mins.`);
                    safeDuration = 45; 
                }

                const endTime = new Date(startTime.getTime() + (safeDuration * 60000));

                await calendar.events.insert({
                    calendarId: 'primary',
                    requestBody: {
                        summary: `[Agent] ${taskData.taskTitle}`,
                        description: `Action: ${taskData.nextImmediateStep}\n\n1. ${taskData.microSteps[0]}\n2. ${taskData.microSteps[1]}\n3. ${taskData.microSteps[2]}`,
                        start: { dateTime: startTime.toISOString() },
                        end: { dateTime: endTime.toISOString() },
                        colorId: taskData.urgencyLevel === 'High' ? '11' : '5', 
                    },
                });
                actionsReport.push(`Calendar blocked for ${taskData.scheduleDurationMinutes}m`);
            } catch (err) { console.error("Calendar Err:", err.message); }

            // 2. CONDITION: GMAIL
            if (taskData.requiresEmail) {
                try {
                    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
                    const emailContent = `Subject: ${taskData.emailSubject}\n\n${taskData.preWorkCompleted}`;
                    const encodedMessage = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                    await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw: encodedMessage } } });
                    actionsReport.push("Gmail Draft saved");
                } catch (err) { console.error("Gmail Err:", err.message); }
            }

            // 3. CONDITION: GOOGLE DOCS
            if (taskData.requiresDocument) {
                try {
                    const docs = google.docs({ version: 'v1', auth: oauth2Client });
                    const doc = await docs.documents.create({ requestBody: { title: `[Agent] ${taskData.taskTitle}` } });
                    createdDocLink = `https://docs.google.com/document/d/${doc.data.documentId}/edit`;
                    
                    // Insert the pre-work text into the doc
                    await docs.documents.batchUpdate({
                        documentId: doc.data.documentId,
                        requestBody: { requests: [{ insertText: { location: { index: 1 }, text: taskData.preWorkCompleted } }] }
                    });
                    actionsReport.push("Google Doc generated");
                } catch (err) { console.error("Docs Err:", err.message); }
            }

            // 4. CONDITION: YOUTUBE
            if (taskData.requiresTutorial && taskData.tutorialSearchQuery) {
                try {
                    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
                    const ytRes = await youtube.search.list({
                        part: 'snippet', q: taskData.tutorialSearchQuery, type: 'video', maxResults: 1
                    });
                    if (ytRes.data.items.length > 0) {
                        foundVideoId = ytRes.data.items[0].id.videoId;
                        actionsReport.push("Tutorial video embedded");
                    }
                } catch (err) { console.error("YouTube Err:", err.message); }
            }
        }

        // Save everything to DB
        const newTask = new Task({
            userEmail: userEmail,
            originalDescription: taskDescription,
            taskTitle: taskData.taskTitle,
            urgencyLevel: taskData.urgencyLevel,
            frictionScore: taskData.frictionScore,
            microSteps: taskData.microSteps,
            preWorkCompleted: taskData.preWorkCompleted,
            nextImmediateStep: taskData.nextImmediateStep,
            isGoal: isGoal || false,
            googleDocLink: createdDocLink,
            youtubeVideoId: foundVideoId
        });

        await newTask.save();
        
        // Return the dynamic action report to the frontend
        res.status(200).json({ success: true, data: newTask, actions: actionsReport.join(' • ') });

    } catch (error) {
        console.error("AI Studio Error:", error);
        res.status(500).json({ success: false, error: "Failed to generate agent response." });
    }
});


// NEW ENDPOINT: Remove a completed task from the active workspace
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.query; // Ensure users can only delete their own tasks

        if (!email) {
            return res.status(400).json({ success: false, error: "User verification required." });
        }

        const deletedTask = await Task.findOneAndDelete({ _id: id, userEmail: email });

        if (!deletedTask) {
            return res.status(404).json({ success: false, error: "Task not found or unauthorized." });
        }

        res.status(200).json({ success: true, message: "Workspace cleared successfully." });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to clear workspace." });
    }
});


app.put('/api/tasks/:id/streak', async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.query;

        const task = await Task.findOne({ _id: id, userEmail: email });
        if (!task) return res.status(404).json({ success: false, error: "Goal not found." });

        const today = new Date().setHours(0,0,0,0);
        const last = task.lastCompleted ? new Date(task.lastCompleted).setHours(0,0,0,0) : null;

        if (last === today) {
            return res.status(400).json({ success: false, error: "Streak already updated for today. Come back tomorrow!" });
        }

        // --- NEW: AGENTIC NEXT-STEP GENERATION ---
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const nextDay = task.streakCount + 2; // If they just finished Day 1, we want Day 2

        const prompt = `
            The user is on Day ${nextDay} of building this long-term habit/goal: "${task.originalDescription}".
            They successfully completed yesterday's task.
            Generate the next logical, single micro-step for today to keep their momentum going. 
            It must be slightly more advanced than Day 1, but still take less than 15 minutes to complete.
            
            Return ONLY a plain text string describing the step. No markdown, no JSON, no conversational filler.
        `;

        const result = await model.generateContent(prompt);
        const nextMilestone = result.response.text().trim();

        // Update the database with the new step AND the streak
        task.streakCount += 1;
        task.lastCompleted = new Date();
        
        // We replace the old micro-step with the brand new one for tomorrow
        task.microSteps = [nextMilestone]; 
        
        await task.save();

        res.status(200).json({ 
            success: true, 
            message: "Streak updated! The Agent has prepared your next milestone.",
            nextMilestone: nextMilestone
        });
    } catch (error) {
        console.error("Streak Generation Error:", error);
        res.status(500).json({ success: false, error: "Failed to update streak." });
    }
});

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: "Agent Engine Awake", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Pre-Action Agent Server running on port ${PORT}`));