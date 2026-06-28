import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
    userEmail: { type: String, required: true }, 
    originalDescription: { type: String, required: true },
    taskTitle: { type: String, required: true },
    urgencyLevel: { type: String, enum: ['High', 'Medium', 'Low'], required: true },
    frictionScore: { type: Number, required: true },
    microSteps: [{ type: String }],
    preWorkCompleted: { type: String, required: true },
    nextImmediateStep: { type: String, required: true },
    youtubeVideoId: { type: String },
    googleDocLink: { type: String },
    status: { type: String, enum: ['Initiated', 'In Progress', 'Completed'], default: 'Initiated' },
    createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);
export default Task;