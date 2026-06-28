import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Task from './models/Task.js';
import { google } from 'googleapis';

dotenv.config();
const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB securely'))
  .catch((err) => console.error('MongoDB connection error:', err));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
        const { taskDescription, userEmail, accessToken } = req.body;
        if (!userEmail) return res.status(400).json({ success: false, error: "User email identity is required." });

        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const currentTime = new Date().toISOString(); 

        const prompt = `
            You are an elite, autonomous zero-shot execution agent. Current time: ${currentTime}.
            User task: "${taskDescription}".

            CRITICAL RULES:
            1. Analyze the task to determine REQUIRED APIs.
            2. requiresEmail: TRUE ONLY if the task explicitly involves sending a message, email, or post.
            3. requiresDocument: TRUE ONLY if the task requires writing a report, essay, proposal, or extensive code blueprint.
            4. requiresTutorial: TRUE ONLY if the friction score is 7 or higher, or the user asks "how to" do something technical.

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
                if (isNaN(startTime.getTime()) || startTime < new Date()) {
                    startTime.setTime(new Date().getTime() + 60 * 60 * 1000); 
                }
                const endTime = new Date(startTime.getTime() + (taskData.scheduleDurationMinutes * 60000));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Pre-Action Agent Server running on port ${PORT}`));