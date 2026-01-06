
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, BookOpen, Users, FileText, ArrowRight, X } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

interface SearchResult {
  id: string;
  title: string;
  type: 'exam' | 'student' | 'resource';
  path: string;
}

const CommandPalette = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [allData, setAllData] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (isOpen && !hasFetched.current) {
      setLoading(true);
      const fetchAllData = async () => {
        try {
          // Fetch all searchable items once
          const [examsSnap, usersSnap, resSnap] = await Promise.all([
            getDocs(collection(db, 'exams')),
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'resources'))
          ]);

          const exams = examsSnap.docs.map(d => ({
            id: d.id,
            title: d.data().title || 'Untitled Exam',
            type: 'exam' as const,
            path: '/exams'
          }));

          const users = usersSnap.docs.map(d => ({
            id: d.id,
            title: d.data().displayName || d.data().email || 'Unknown',
            type: 'student' as const,
            path: '/students'
          }));

          const resources = resSnap.docs.map(d => ({
             id: d.id,
             title: d.data().title || 'Untitled Resource',
             type: 'resource' as const,
             path: '/resources'
          }));

          setAllData([...exams, ...users, ...resources]);
          hasFetched.current = true;
        } catch (e) {
          console.error("Error fetching command palette data", e);
        } finally {
          setLoading(false);
        }
      };
      fetchAllData();
    }
    
    // Reset query when closed/opened
    if (!isOpen) {
        setQuery('');
        setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim().length > 0) {
      const lowerQ = query.toLowerCase();
      const filtered = allData.filter(item => 
        (item.title || '').toLowerCase().includes(lowerQ)
      ).slice(0, 8); // Limit results
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, [query, allData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-center p-4 border-b border-slate-100 dark:border-slate-800">
          <Search className="text-slate-400 mr-3" size={20} />
          <input
            type="text"
            className="flex-1 bg-transparent outline-none text-lg text-slate-800 dark:text-slate-100 placeholder-slate-400"
            placeholder="Search students, exams, resources..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        <div className="max-h-96 overflow-y-auto p-2">
          {loading && <div className="p-4 text-center text-slate-500">Loading index...</div>}
          {!loading && query.length > 0 && results.length === 0 && (
            <div className="p-4 text-center text-slate-500">No results found.</div>
          )}
          {!loading && query.length === 0 && (
             <div className="p-8 text-center text-slate-400 text-sm">Type to search across the platform</div>
          )}
          
          <div className="space-y-1">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => {
                  navigate(result.path);
                  onClose();
                }}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 group transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg 
                    ${result.type === 'exam' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 
                      result.type === 'student' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                      'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                    {result.type === 'exam' ? <BookOpen size={18} /> : 
                     result.type === 'student' ? <Users size={18} /> : <FileText size={18} />}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-slate-800 dark:text-slate-200">{result.title}</p>
                    <p className="text-xs text-slate-500 capitalize">{result.type}</p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
        
        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-400 flex justify-between px-6 border-t border-slate-100 dark:border-slate-800">
           <span>Navigate with keyboard</span>
           <span>ESC to close</span>
        </div>
      </motion.div>
    </div>
  );
};

export default CommandPalette;
