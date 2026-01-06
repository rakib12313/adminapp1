
import React, { useState, useEffect } from 'react';
import { Moon, Sun, Bell, Shield, Monitor, Download, Lock, Mail, Smartphone } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../services/firebase';

const Settings = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [emailNotify, setEmailNotify] = useState(true);
  const [pushNotify, setPushNotify] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    
    setPassLoading(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.updatePassword(newPassword);
        alert("Password updated successfully.");
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert("No active user found.");
      }
    } catch (error: any) {
      console.error("Error updating password", error);
      if (error.code === 'auth/requires-recent-login') {
        const shouldLogout = window.confirm("Security Alert: Your session is too old to change your password. You need to sign out and sign in again. Do you want to sign out now?");
        if (shouldLogout) {
          await auth.signOut();
        }
      } else if (error.code === 'auth/weak-password') {
        alert("The password is too weak. Please choose a stronger password.");
      } else {
        alert("Failed to update password: " + error.message);
      }
    } finally {
      setPassLoading(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Fetch all core collections for a complete system backup
      const [examsSnap, usersSnap, resSnap, resultsSnap, classesSnap, noticesSnap, helpSnap] = await Promise.all([
        getDocs(collection(db, 'exams')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'resources')),
        getDocs(collection(db, 'results')),
        getDocs(collection(db, 'class_groups')),
        getDocs(collection(db, 'notices')),
        getDocs(collection(db, 'help_requests'))
      ]);

      const data = {
        metadata: {
          version: '1.0',
          exportDate: new Date().toISOString(),
          exportedBy: auth.currentUser?.email || 'system'
        },
        exams: examsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        resources: resSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        results: resultsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        notices: noticesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        helpRequests: helpSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lms_full_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export data. Check console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Settings</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage platform preferences, security, and data.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Appearance */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
           <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
                <Monitor className="mr-3 text-red-500" size={20} /> Interface & Appearance
              </h3>
           </div>
           <div className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-200">Theme Preference</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose how the admin dashboard looks to you.</p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl shrink-0 w-full sm:w-auto">
                  <button 
                    onClick={() => setTheme('light')}
                    className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold transition-all touch-manipulation min-h-[44px] sm:min-h-0 ${theme === 'light' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                  >
                    <Sun size={16} className="mr-2" /> Light
                  </button>
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-bold transition-all touch-manipulation min-h-[44px] sm:min-h-0 ${theme === 'dark' ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                  >
                    <Moon size={16} className="mr-2" /> Dark
                  </button>
                </div>
              </div>
           </div>
        </section>

        {/* Notifications */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
             <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
               <Bell className="mr-3 text-blue-500" size={20} /> Notifications
             </h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between touch-manipulation">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Mail size={18} />
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-200">Email Notifications</span>
              </div>
              <button 
                onClick={() => setEmailNotify(!emailNotify)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${emailNotify ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${emailNotify ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between touch-manipulation">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                    <Smartphone size={18} />
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-200">Push Notifications</span>
              </div>
              <button 
                onClick={() => setPushNotify(!pushNotify)}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${pushNotify ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${pushNotify ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Security & Data */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
           <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
                <Lock className="mr-3 text-emerald-500" size={20} /> Security & Data
              </h3>
           </div>
           
           <div className="p-6">
              <div className="bg-slate-50 dark:bg-slate-950/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <h4 className="flex items-center text-sm font-black text-slate-700 dark:text-white uppercase tracking-wider mb-4">
                      <Shield size={16} className="mr-2 text-emerald-500" /> Change Password
                  </h4>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">New Password</label>
                          <input 
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Minimum 6 characters"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Confirm Password</label>
                          <input 
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Re-enter password"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                      </div>
                      <button 
                          onClick={handleUpdatePassword}
                          disabled={passLoading || !newPassword}
                          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                      >
                          {passLoading ? 'Updating...' : 'Update Password'}
                      </button>
                  </div>
              </div>
              
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="text-center sm:text-left">
                    <p className="font-bold text-slate-700 dark:text-slate-200">Full System Backup</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Download all system data (Users, Exams, Results, etc.) as JSON.</p>
                 </div>
                 <button 
                   onClick={handleExportData}
                   disabled={isExporting}
                   className="w-full sm:w-auto flex justify-center items-center px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors touch-manipulation min-h-[48px]"
                 >
                   {isExporting ? (
                     <span className="flex items-center"><div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"/> Exporting...</span>
                   ) : (
                     <><Download size={16} className="mr-2" /> Export All Data</>
                   )}
                 </button>
              </div>
           </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
