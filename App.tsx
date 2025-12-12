import React, { useState, useEffect, useRef } from 'react';
import { StudyData } from './types';
import { loadFromCookie, saveToCookie, processWeekRollover } from './utils/storage';
import { GOAL_HOURS, GOAL_MINUTES, MIN_SESSION_MINUTES, GUILT_MESSAGES } from './constants';
import { FireIcon, FrownIcon, SmileIcon, NeutralIcon, LockIcon, AlertIcon } from './components/Icons';

const App: React.FC = () => {
  const [data, setData] = useState<StudyData | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize
  useEffect(() => {
    const loaded = loadFromCookie();
    const { data: processedData, weekFailed, weekPassed } = processWeekRollover(loaded);
    setData(processedData);
    saveToCookie(processedData);

    if (weekFailed) setShowFailModal(true);
    if (weekPassed) setShowSuccessModal(true);

    if (processedData.isSessionActive && processedData.sessionStartTime) {
      // Resume timer visual
      const diff = Math.floor((Date.now() - processedData.sessionStartTime) / 1000);
      setElapsedSeconds(diff > 0 ? diff : 0);
    }
  }, []);

  // Timer Tick
  useEffect(() => {
    if (data?.isSessionActive && data.sessionStartTime) {
      timerRef.current = setInterval(() => {
        const diff = Math.floor((Date.now() - (data.sessionStartTime as number)) / 1000);
        setElapsedSeconds(diff > 0 ? diff : 0);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [data?.isSessionActive, data?.sessionStartTime]);

  // Anti-cheat / Leave prevention
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (data?.isSessionActive) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [data?.isSessionActive]);

  const startSession = () => {
    if (!data) return;
    const now = Date.now();
    const newData = {
      ...data,
      isSessionActive: true,
      sessionStartTime: now,
    };
    setData(newData);
    saveToCookie(newData);
    setElapsedSeconds(0);
  };

  const attemptStopSession = () => {
    const minutes = elapsedSeconds / 60;
    if (minutes < MIN_SESSION_MINUTES) {
      alert(`You can't be done studying already. It's been less than ${MIN_SESSION_MINUTES} minutes. Don't lie to yourself!`);
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmStopSession = (confirmed: boolean) => {
    if (!data) return;
    
    setShowConfirmModal(false);

    if (!confirmed) {
      return;
    }

    const sessionMinutes = Math.floor(elapsedSeconds / 60);
    let finalMinutes = sessionMinutes;

    // Punishment Logic: If session is strangely short (< 1 min) despite controls,
    // we punish the user by subtracting 5 minutes.
    if (sessionMinutes < 1) {
       finalMinutes = -5;
       triggerShame();
    }

    // Pay off debt first, then add to weekly
    let remainingMinutesToAdd = finalMinutes;
    let newDebt = data.debtMinutes;

    if (remainingMinutesToAdd > 0) {
      if (newDebt > 0) {
        if (remainingMinutesToAdd >= newDebt) {
          remainingMinutesToAdd -= newDebt;
          newDebt = 0;
        } else {
          newDebt -= remainingMinutesToAdd;
          remainingMinutesToAdd = 0;
        }
      }
    } else {
       // Negative progress (punishment) increases debt or reduces weekly
       // Simplified: just reduce weeklyMinutes, allowing it to go negative if needed (or handle debt increase)
       // Let's just deduct from weeklyMinutes directly.
    }

    const newData: StudyData = {
      ...data,
      isSessionActive: false,
      sessionStartTime: null,
      weeklyMinutes: data.weeklyMinutes + remainingMinutesToAdd,
      debtMinutes: newDebt,
      totalSessions: data.totalSessions + 1
    };

    setData(newData);
    saveToCookie(newData);
    setElapsedSeconds(0);
  };

  const triggerShame = () => {
    setFlashRed(true);
    setTimeout(() => setFlashRed(false), 2000);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatHours = (mins: number) => (mins / 60).toFixed(1);

  if (!data) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading GrimFocus...</div>;

  const progressPercent = Math.min(100, (data.weeklyMinutes / GOAL_MINUTES) * 100);
  const remainingMinutes = Math.max(0, GOAL_MINUTES - data.weeklyMinutes);
  const totalDebt = data.debtMinutes;
  
  // Avatar State
  let AvatarComponent = NeutralIcon;
  let avatarClass = "text-gray-400";
  
  if (totalDebt > 0) {
    AvatarComponent = FrownIcon;
    avatarClass = "text-red-500 animate-pulse";
  } else if (progressPercent >= 100) {
    AvatarComponent = SmileIcon;
    avatarClass = "text-green";
  } else if (data.isSessionActive) {
    AvatarComponent = NeutralIcon;
    avatarClass = "text-blue-400";
  }

  return (
    <div className={`min-h-screen bg-black transition-colors ${flashRed ? 'bg-red-900' : ''}`}>
      {/* Background Ambience */}
      {data.isSessionActive && (
        <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none">
            <div className="ambience-text animate-pulse">FOCUS</div>
        </div>
      )}

      <div className="relative z-10 max-w-md mx-auto p-6 flex flex-col min-h-screen">
        
        {/* Header */}
        <header className="mb-8 text-center relative">
          <h1 className="text-3xl font-bold uppercase text-white mb-2">Study Session</h1>
          <div className="top-right-badge text-xs text-gray-600 font-mono">
            TOP STUDENT: 28h
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 font-mono">
            <FireIcon className={data.streak > 0 ? "text-green" : "text-gray-700"} />
            <span className={data.streak > 0 ? "text-green font-bold" : ""}>
              Streak: {data.streak} Weeks
            </span>
          </div>
        </header>

        {/* Status Messages */}
        {totalDebt > 0 && (
          <div className="mb-6 p-4 alert-box animate-shake">
            <div className="flex items-start gap-3">
              <AlertIcon className="text-red-500 mt-1" />
              <div>
                <h3 className="text-red-500 font-bold uppercase text-sm">Debt Owed</h3>
                <p className="text-xs text-red-200 mt-1">
                  You are behind. You owe <span className="font-bold">{formatHours(totalDebt)} hours</span>.
                  Failure is accumulating.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Progress Ring */}
        <div className="mb-10 flex flex-col items-center">
          <div className="relative w-full mb-6 flex justify-center">
             <div style={{ width: '12rem', height: '12rem', position: 'relative' }}>
               <svg className="w-full h-full" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke={totalDebt > 0 ? "#e74c3c" : "#00ff00"}
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - progressPercent / 100)}`}
                    style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                  />
               </svg>
               <div className="absolute inset-0 flex items-center justify-center">
                 <AvatarComponent className={`${avatarClass}`} style={{ width: '5rem', height: '5rem' }} />
               </div>
             </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-white">
              {formatHours(data.weeklyMinutes)} <span className="text-gray-500 text-lg">/ {GOAL_HOURS} hrs</span>
            </div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Weekly Progress</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex-col justify-center" style={{ flex: 1, display: 'flex' }}>
           {data.isSessionActive ? (
             <div className="w-full text-center">
               <div className="text-6xl font-mono font-bold text-white mb-2 tracking-wider">
                 {formatTime(elapsedSeconds)}
               </div>
               <p className="text-red-500 italic text-sm mb-8 animate-pulse">
                 Resist temptation. Do not stop early.
               </p>
               <button
                  onClick={attemptStopSession}
                  className="btn btn-stop shadow-red"
               >
                 END STUDY SESSION
               </button>
               {elapsedSeconds < MIN_SESSION_MINUTES * 60 && (
                 <p className="text-xs text-gray-600 mt-4 flex items-center justify-center gap-1">
                   <LockIcon className="text-gray-600" style={{ width: 12, height: 12 }} /> Locked for {Math.ceil(MIN_SESSION_MINUTES - elapsedSeconds/60)} more mins
                 </p>
               )}
             </div>
           ) : (
             <div className="w-full">
                <button
                  onClick={startSession}
                  className="btn btn-start shadow-green"
                >
                  Start Study (Be Honest)
                </button>
                <p className="text-center text-gray-500 text-xs mt-4">
                  {GUILT_MESSAGES[Math.floor(Math.random() * GUILT_MESSAGES.length)]}
                </p>
             </div>
           )}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-xs text-gray-700 uppercase tracking-widest" style={{ fontSize: '10px' }}>
           GrimFocus v1.0 • No Mercy
        </footer>

        {/* MODALS */}
        
        {/* Confirm Stop Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm">
            <div className="bg-black border border-red-900 p-6 rounded-lg max-w-md w-full shadow-red">
              <h3 className="text-xl font-bold text-white mb-4">Oath of Honesty</h3>
              <p className="text-gray-300 mb-6 text-sm" style={{ lineHeight: 1.6 }}>
                I declare that I have truly studied for <span className="text-white font-bold">{formatTime(elapsedSeconds)}</span>. 
                This time was spent purely on learning, without distraction. 
                <br/><br/>
                <span className="text-red-500 italic">Lying here is a betrayal of my potential.</span>
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => confirmStopSession(false)}
                  className="btn-modal-cancel rounded"
                  style={{ flex: 1 }}
                >
                  Cancel (Keep Studying)
                </button>
                <button 
                  onClick={() => confirmStopSession(true)}
                  className="btn-modal-confirm rounded font-bold"
                  style={{ flex: 1 }}
                >
                  I Promise (End)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Fail Modal */}
        {showFailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-900 backdrop-blur-md" style={{ backgroundColor: 'rgba(127, 29, 29, 0.95)' }}>
            <div className="bg-black border-2 border-red-500 p-8 rounded-lg max-w-md w-full text-center shadow-red">
              <FrownIcon className="text-red-500 mx-auto mb-4" style={{ width: '4rem', height: '4rem' }} />
              <h2 className="text-3xl font-black text-red-500 mb-2 uppercase tracking-tighter">Week Failed</h2>
              <p className="text-white mb-6">
                You did not meet your goal. The deficit has been added to your debt. 
                <br/>
                <span className="text-sm text-gray-400 mt-2 block">Your streak has been reset to 0.</span>
              </p>
              <button 
                onClick={() => setShowFailModal(false)}
                className="btn btn-stop"
              >
                Accept Shame & Continue
              </button>
            </div>
          </div>
        )}

        {/* Weekly Success Modal */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-green-600 backdrop-blur-md" style={{ backgroundColor: 'rgba(0, 170, 0, 0.9)' }}>
            <div className="bg-black border-2 border-green-500 p-8 rounded-lg max-w-md w-full text-center shadow-green">
              <div className="relative">
                 <SmileIcon className="text-green mx-auto mb-4 animate-bounce" style={{ width: '4rem', height: '4rem' }} />
              </div>
              <h2 className="text-3xl font-black text-green mb-2 uppercase tracking-tighter">Week Complete</h2>
              <p className="text-white mb-6">
                Excellent work. You have met the standard.
                <br/>
                <span className="text-sm text-gray-400 mt-2 block">Streak increased! Keep the momentum.</span>
              </p>
              <button 
                onClick={() => setShowSuccessModal(false)}
                className="btn btn-start"
              >
                Accept Victory
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;