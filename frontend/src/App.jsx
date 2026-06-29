import { useState, useEffect } from 'react';
import axios from 'axios';
import { googleLogout, useGoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { CheckCircle2, Flame, Zap, Clock, ArrowRight, Sparkles, Mic, LogOut, Database, ShieldCheck } from 'lucide-react';



function App() {
  const [taskInput, setTaskInput] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isGoalMode, setIsGoalMode] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  // Re-authenticate user session from local storage on load
  useEffect(() => {
    const cachedUser = localStorage.getItem('agent_user');
    if (cachedUser) {
      const parsedUser = JSON.parse(cachedUser);
      setUser(parsedUser);
      fetchTasks(parsedUser.email);
    }
  }, []);

  const fetchTasks = async (email) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/tasks?email=${email}`);
      setTasks(res.data.data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const handleInitiateTask = async () => {
    if (!taskInput.trim() || !user) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/tasks/initiate`, {
        taskDescription: taskInput,
        userEmail: user.email,
        accessToken: user.accessToken,
        isGoal: isGoalMode
      });
      setTaskInput('');
      fetchTasks(user.email);
      
      // NEW: Dynamic Notification based on backend orchestration
      setNotification(`⚡ Agent Executed: ${res.data.actions || "Workspace mapped"}`);
      setTimeout(() => setNotification(null), 10000);
      
    } catch (error) {
      console.error("Error communicating with backend:", error);
    }
    setLoading(false);
  };


  const handleClearWorkspace = async (taskId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/tasks/${taskId}?email=${user.email}`);
      fetchTasks(user.email); // Refresh dashboard instantly
      setNotification('🗑️ Workspace archived and cleared.');
      setTimeout(() => setNotification(null), 5000);
    } catch (error) {
      console.error("Error clearing workspace:", error);
    }
  };

  const handleIncrementStreak = async (taskId) => {
    try {
      await axios.put(`${API_BASE_URL}/api/tasks/${taskId}/streak?email=${user.email}`);
      fetchTasks(user.email);
      setNotification('🔥 Streak increased! The Agent will prepare your next milestone tomorrow.');
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      if (error.response?.data?.error) {
        setNotification(`⚠️ ${error.response.data.error}`);
        setTimeout(() => setNotification(null), 4000);
      }
    }
  };

  const handleVoiceRecord = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      // Append the voice text to whatever is already in the text area
      setTaskInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false); // Ensure the mic button stops glowing
      
      if (event.error === 'network') {
        alert("Microphone network error. If you are using Brave or an ad-blocker, please disable shields or switch to Google Chrome.");
      } else if (event.error === 'not-allowed') {
        alert("Microphone access was denied. Please allow permissions in your browser address bar.");
      }
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };


  // Add this custom login hook
  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const userInfo = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
        );
        
        const userData = {
          name: userInfo.data.name,
          email: userInfo.data.email,
          picture: userInfo.data.picture,
          accessToken: tokenResponse.access_token 
        };
        
        setUser(userData);
        localStorage.setItem('agent_user', JSON.stringify(userData));
        fetchTasks(userData.email);
      } catch (err) {
        console.error("Failed to fetch user data:", err);
      }
    },
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/youtube.readonly', 
  });

  const handleLoginSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    const userData = {
      name: decoded.name,
      email: decoded.email,
      picture: decoded.picture
    };
    setUser(userData);
    localStorage.setItem('agent_user', JSON.stringify(userData));
    fetchTasks(decoded.email);
  };

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setTasks([]);
    localStorage.removeItem('agent_user');
  };

  const getUrgencyColor = (level) => {
    switch (level?.toLowerCase()) {
      case 'high': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'low': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const displayedWorkspaces = tasks.filter(task => 
    activeTab === 'goals' ? task.isGoal : !task.isGoal
  );

  

  // Auth Screen State
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 font-sans">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800/80 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="mx-auto w-12 h-12 bg-zinc-950 border border-zinc-800 flex items-center justify-center rounded-xl">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Access Agent Workspace</h1>
            <p className="text-sm text-zinc-400 max-w-xs mx-auto">
              Sign in with your verified Google identity to initialize compute tasks securely.
            </p>
          </div>
          <div className="flex justify-center pt-2">
            <button 
              onClick={() => login()}
              className="flex items-center gap-3 px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-full transition-all active:scale-[0.98] shadow-lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard Screen State
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-5xl mx-auto space-y-12">
        
        {/* Navigation / User Profile Header */}
        <div className="flex justify-between items-center bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-zinc-700 shadow-sm" referrerPolicy="no-referrer" />
            <div>
              <p className="text-xs text-zinc-500 font-medium">Authenticated Account</p>
              <p className="text-sm font-semibold text-zinc-200">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-900 text-xs font-semibold text-zinc-400 rounded-lg transition-colors group"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:text-red-400 transition-colors" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Header & Input Section */}
        <div className="space-y-8">
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-zinc-100 via-zinc-300 to-zinc-600">
              The Last-Minute Life Saver
            </h1>
            <p className="text-zinc-400 text-lg">
              Agentic pre-computation and friction-aware scheduling.
            </p>
          </div>

          <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800/50 rounded-2xl p-6 shadow-2xl max-w-3xl mx-auto">
            <textarea 
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              placeholder="Dump your chaotic thoughts here. e.g., I need to prepare a 7-slide presentation on matrix lighting by tomorrow..."
              rows={3}
              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all resize-none shadow-inner"
            />

            <div className="flex justify-end mt-3">
              <button
                onClick={() => setIsGoalMode(!isGoalMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                  isGoalMode 
                    ? 'bg-orange-500/10 border-orange-500/50 text-orange-400' 
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Flame className={`w-4 h-4 ${isGoalMode ? 'text-orange-500' : 'text-zinc-500'}`} />
                {isGoalMode ? 'Goal/Habit Mode Active' : 'Switch to Goal Mode'}
              </button>
            </div>
            <div className="mt-4 flex justify-between items-center">
              
              {/* Voice Button */}
              <button
                onClick={handleVoiceRecord}
                disabled={loading || isListening}
                className={`p-3 rounded-xl border transition-all flex items-center justify-center ${
                  isListening 
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' 
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-emerald-400'
                }`}
                title="Dictate Task"
              >
                <Mic className="w-5 h-5" />
              </button>

              {/* Initiate button */}
              <button 
                onClick={handleInitiateTask} 
                disabled={loading || !taskInput.trim()}
                className="group relative inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all active:scale-[0.98] overflow-hidden"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Agent Compiling...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 group-hover:text-emerald-200 transition-colors" />
                    <span>Initiate Task</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="space-y-6">

          {notification && (
          <div className="animate-in slide-in-from-top-4 fade-in duration-300 max-w-3xl mx-auto mb-6">
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-semibold">{notification}</span>
            </div>
          </div>
        )}
          
          {/* Dashboard Header & Sliding Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <Database className="w-6 h-6 text-emerald-500" />
              Active Workspaces
            </h2>

            {/* Animated Sliding Toggle */}
            <div className="relative flex items-center bg-zinc-950 border border-zinc-800 p-1 rounded-xl w-full sm:w-auto">
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-zinc-800 border border-zinc-700 rounded-lg transition-transform duration-300 ease-out shadow-md ${
                  activeTab === 'goals' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
                }`}
              />
              
              <button
                onClick={() => setActiveTab('tasks')}
                className={`relative z-10 flex-1 sm:w-32 py-2 text-sm font-bold flex items-center justify-center gap-2 transition-colors duration-300 ${
                  activeTab === 'tasks' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Tasks
              </button>
              
              <button
                onClick={() => setActiveTab('goals')}
                className={`relative z-10 flex-1 sm:w-32 py-2 text-sm font-bold flex items-center justify-center gap-2 transition-colors duration-300 ${
                  activeTab === 'goals' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Flame className={`w-4 h-4 ${activeTab === 'goals' ? 'text-orange-500' : 'text-zinc-500'}`} />
                Goals
              </button>
            </div>
          </div>
          
          {/* Dynamic Empty State */}
          {displayedWorkspaces.length === 0 ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center border-2 border-dashed border-zinc-800/50 bg-zinc-950/20 rounded-2xl animate-in fade-in duration-500">
              <div className={`w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800 shadow-inner ${activeTab === 'goals' ? 'shadow-orange-900/20' : 'shadow-emerald-900/20'}`}>
                {activeTab === 'goals' 
                  ? <Flame className="w-8 h-8 text-orange-500/50" />
                  : <Zap className="w-8 h-8 text-zinc-600" />
                }
              </div>
              <h3 className="text-xl font-semibold text-zinc-300">
                {activeTab === 'goals' ? "No Active Habits" : "Zero Active Workspaces"}
              </h3>
              <p className="text-sm text-zinc-500 mt-2 max-w-md mx-auto">
                {activeTab === 'goals' 
                  ? "Toggle the Habit Mode above and declare a long-term goal for the agent to track and evolve."
                  : "Your slate is clean. Dictate or type a massive task above, and the agent will dynamically scaffold your execution environment."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {displayedWorkspaces.map((task) => (
                <div key={task._id} className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors flex flex-col">
                  
                  {/* Task Header */}
                  <div className="bg-zinc-950/50 border-b border-zinc-800 p-5">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <h3 className="text-lg font-bold text-zinc-100">{task.taskTitle}</h3>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className={`px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1 ${getUrgencyColor(task.urgencyLevel)}`}>
                          <Clock className="w-3 h-3" />
                          {task.urgencyLevel}
                        </div>
                        {task.isGoal ? (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-950/40 border border-orange-500/30 rounded-full">
                              <Flame className="w-3.5 h-3.5 text-orange-500" />
                              <span className="text-xs font-bold text-orange-400">{task.streakCount}</span>
                            </div>
                            <button
                              onClick={() => handleIncrementStreak(task._id)}
                              className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-orange-500/50 text-zinc-500 hover:text-orange-400 rounded-lg transition-all"
                              title="Complete Daily Micro-Action"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleClearWorkspace(task._id)}
                            className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-zinc-500 hover:text-emerald-400 rounded-lg transition-all"
                            title="Complete & Clear Workspace"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Friction Score Bar */}
                    <div className="flex items-center gap-2">
                      <Flame className={`w-4 h-4 ${task.frictionScore > 7 ? 'text-red-500' : task.frictionScore > 4 ? 'text-amber-500' : 'text-emerald-500'}`} />
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${task.frictionScore > 7 ? 'bg-red-500' : task.frictionScore > 4 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${(task.frictionScore / 10) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">F-Score: {task.frictionScore}/10</span>
                    </div>
                  </div>

                  {/* Task Content Body */}
                  <div className="p-5 space-y-5 flex-1">
                    
                    {/* Micro Steps */}
                    {task.microSteps && task.microSteps.length > 0 && (
                      <div className="space-y-4">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Execution Blueprint</span>
                        
                        <div className="relative border-l border-zinc-800 ml-3 space-y-4 pb-2">
                          {task.microSteps.map((step, idx) => (
                            <div key={idx} className="relative pl-6 group">
                              <div className="absolute w-3 h-3 bg-zinc-900 border-2 border-emerald-500/50 rounded-full -left-[6.5px] top-1.5 group-hover:bg-emerald-500 group-hover:border-emerald-400 group-hover:shadow-[0_0_12px_rgba(52,211,153,0.6)] transition-all duration-300" />
                              <div className="absolute w-[2px] h-full bg-emerald-500/0 group-hover:bg-emerald-500/20 -left-[1px] top-4 transition-colors duration-300" />
                              
                              <div className="bg-zinc-950/40 border border-zinc-800/80 group-hover:border-emerald-500/30 p-3 rounded-xl transition-all duration-300 shadow-sm">
                                <div className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  Milestone 0{idx + 1}
                                </div>
                                <p className="text-sm text-zinc-300 leading-relaxed">{step}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pre-Work */}
                    {task.preWorkCompleted && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Generated Pre-Work</span>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                          <pre className="font-mono text-xs text-zinc-400 whitespace-pre-wrap">
                            {task.preWorkCompleted}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Conditional Cloud Assets */}
                    {(task.googleDocLink || task.youtubeVideoId) && (
                      <div className="space-y-3 pt-2">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cloud Assets</span>
                        <div className="grid grid-cols-1 gap-3">
                          
                          {/* Google Docs Button */}
                          {task.googleDocLink && (
                            <a 
                              href={task.googleDocLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between bg-blue-900/20 border border-blue-900/40 hover:bg-blue-900/30 p-3 rounded-xl transition-all group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="bg-blue-500/20 p-2 rounded-lg">
                                  <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-blue-100">Scaffolded Google Doc</span>
                              </div>
                              <ArrowRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          )}

                          {/* YouTube Embedded Player */}
                          {task.youtubeVideoId && (
                            <div className="rounded-xl overflow-hidden border border-red-900/30 aspect-video shadow-lg">
                              <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${task.youtubeVideoId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              ></iframe>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Immediate Action Footer */}
                  <div className="bg-emerald-950/20 border-t border-zinc-800 p-4">
                    <div className="flex items-start gap-3">
                      <ArrowRight className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block mb-1">Do This Now</span>
                        <p className="text-sm text-zinc-200">{task.nextImmediateStep}</p>
                      </div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;