
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Notice } from '../types';
import { Plus, Trash2, Pin, Bell, Send, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from './ConfirmModal';

const NoticeManager = () => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  
  const [newNotice, setNewNotice] = useState<Partial<Notice>>({
    title: '',
    content: '',
    priority: 'medium',
    isPinned: false
  });

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'notices'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notice));
      setNotices(fetchedNotices);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notices:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const initiatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotice.title || !newNotice.content) return;
    setShowPostConfirm(true);
  };

  const handlePostNotice = async () => {
    setShowPostConfirm(false);
    try {
      const noticeData = {
        ...newNotice,
        date: new Date().toISOString()
      };
      await addDoc(collection(db, 'notices'), noticeData);
      setNewNotice({ title: '', content: '', priority: 'medium', isPinned: false });
    } catch (error) {
      console.error("Error posting notice", error);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'notices', deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting notice", error);
    }
  };

  return (
    <div>
      <ConfirmModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Announcement"
        message="Are you sure you want to remove this notice? It will disappear from all student feeds immediately."
      />

      <ConfirmModal 
        isOpen={showPostConfirm}
        onClose={() => setShowPostConfirm(false)}
        onConfirm={handlePostNotice}
        title="Broadcast Notice?"
        message={`You are about to send "${newNotice.title}" to all enrolled students. Proceed?`}
        confirmText="Post Now"
        isDestructive={false}
      />

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Announcements</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Broadcast critical updates and schedules to the entire student body.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 h-fit xl:sticky xl:top-8 z-10"
        >
          <h3 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center">
            <Send size={22} className="mr-3 text-red-500" />
            Create Announcement
          </h3>
          <form onSubmit={initiatePost} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Subject Title</label>
              <input 
                type="text" 
                value={newNotice.title}
                onChange={e => setNewNotice(prev => ({...prev, title: e.target.value}))}
                className="w-full rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-5 py-4 focus:border-red-500 outline-none transition-all font-semibold"
                required
                placeholder="Important: Mid-Term Schedule Update"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Detailed Content</label>
              <textarea 
                value={newNotice.content}
                onChange={e => setNewNotice(prev => ({...prev, content: e.target.value}))}
                rows={6}
                className="w-full rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-5 py-4 focus:border-red-500 outline-none transition-all resize-none font-medium leading-relaxed"
                required
                placeholder="Compose your message here..."
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
               <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 ml-1">Priority Level</label>
                <select 
                  value={newNotice.priority}
                  onChange={e => setNewNotice(prev => ({...prev, priority: e.target.value as any}))}
                  className="w-full rounded-2xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-5 py-4 focus:border-red-500 outline-none transition-all appearance-none cursor-pointer font-bold"
                >
                  <option value="low">Standard (Low)</option>
                  <option value="medium">Important (Medium)</option>
                  <option value="high">Urgent (High)</option>
                </select>
              </div>
              <div className="flex items-center mt-6">
                <label className="flex items-center space-x-3 cursor-pointer group w-full bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <input 
                    type="checkbox"
                    checked={newNotice.isPinned}
                    onChange={e => setNewNotice(prev => ({...prev, isPinned: e.target.checked}))}
                    className="h-6 w-6 text-red-600 border-slate-300 rounded-lg focus:ring-red-500"
                  />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Pin to Top</span>
                </label>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-950 dark:bg-red-600 text-white py-4 px-6 rounded-2xl hover:bg-slate-800 dark:hover:bg-red-700 transition-all shadow-2xl shadow-slate-950/20 font-black uppercase tracking-[0.2em]"
            >
              Post Announcement
            </button>
          </form>
        </motion.div>

        <div className="space-y-6">
          <AnimatePresence>
            {notices.map((notice, index) => (
              <motion.div 
                key={notice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.1 }}
                layout
                className={`bg-white dark:bg-slate-900 p-8 rounded-[2rem] shadow-sm border transition-all hover:shadow-lg relative overflow-hidden group ${notice.isPinned ? 'border-red-500/30' : 'border-slate-200 dark:border-slate-800'}`}
              >
                {notice.isPinned && (
                  <div className="absolute top-0 right-0 p-4 bg-red-500 text-white rounded-bl-3xl shadow-lg">
                    <Pin size={14} className="fill-current" />
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border
                        ${notice.priority === 'high' ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900' :
                          notice.priority === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900' :
                          'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900'
                        }
                      `}>
                        {notice.priority} Priority
                      </span>
                    </div>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-tight">{notice.title}</h4>
                  </div>
                  <button onClick={() => setDeleteId(notice.id)} className="text-slate-300 hover:text-red-500 transition-all p-2 bg-slate-50 dark:bg-slate-800 rounded-xl opacity-0 group-hover:opacity-100">
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line text-sm leading-relaxed font-medium">{notice.content}</p>
                
                <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center text-slate-400 font-bold uppercase tracking-widest text-[9px]">
                    <Bell size={12} className="mr-2 text-red-500" /> System Broadcast
                  </div>
                  <span className="text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-full">{new Date(notice.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {notices.length === 0 && !loading && (
             <div className="p-20 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800">
                <AlertCircle size={40} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active announcements</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoticeManager;
