
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Result, UserProfile, Exam, ClassGroup } from '../types';
import { Search, BarChart2, Eye, Clock, Edit2, Trash2, User, Download, Filter, TrendingUp, CheckCircle2, XCircle, Trophy, Zap, Hash, EyeOff, Undo2, ArrowUpDown, Mail, Calendar, Check, X, Layers, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from './ConfirmModal';

// Helper to safely parse dates
const parseDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === 'object' && val.seconds) return new Date(val.seconds * 1000); 
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

interface ExtendedResult extends Result {
  isHidden?: boolean;
  studentClass?: string;
  studentDivision?: string;
}

type SortOption = 'date_desc' | 'date_asc' | 'score_desc' | 'score_asc' | 'name_asc';

const ResultsManager = () => {
  const [rawResults, setRawResults] = useState<ExtendedResult[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, UserProfile>>({});
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [examFilter, setExamFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('date_desc');
  const [showHidden, setShowHidden] = useState(false);
  
  // Selection
  const [selectedResult, setSelectedResult] = useState<ExtendedResult | null>(null);
  const [reviewExam, setReviewExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Action States
  const [editingResult, setEditingResult] = useState<ExtendedResult | null>(null);
  const [resultToDelete, setResultToDelete] = useState<ExtendedResult | null>(null);
  const [newScore, setNewScore] = useState<number>(0);

  // Computed state for analysis
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [totalAttempts, setTotalAttempts] = useState(1);

  // 1. Fetch Users independently to build a cache map
  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const cache: Record<string, UserProfile> = {};
        snapshot.docs.forEach(doc => {
            cache[doc.id] = { ...doc.data(), uid: doc.id } as UserProfile;
        });
        setUsersMap(cache);
    }, (error) => {
        console.warn("ResultsManager: Error fetching users", error.code);
    });
    return () => unsubscribeUsers();
  }, []);

  // 2. Fetch Classes for Filters
  useEffect(() => {
    const unsubscribeClasses = onSnapshot(collection(db, 'class_groups'), (snapshot) => {
      const fetchedClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassGroup));
      setClasses(fetchedClasses);
    });
    return () => unsubscribeClasses();
  }, []);

  // 3. Fetch Results independently
  useEffect(() => {
    setLoading(true);
    const unsubscribeResults = onSnapshot(collection(db, 'results'), (snapshot) => {
        const fetchedResults = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            isHidden: doc.data().isHidden || false
        } as ExtendedResult));
        setRawResults(fetchedResults);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching results", error);
        setLoading(false);
    });

    return () => unsubscribeResults();
  }, []);

  // 4. Derive Display Results by merging Raw Results with User Data
  const results = useMemo(() => {
    const merged = rawResults.map(r => {
        const userProfile = usersMap[r.studentId];
        // Prefer profile display name, then result stored name, then fallback
        const resolvedName = userProfile?.displayName || r.studentName || 'Unknown Student';
        // Prefer profile email, then result stored email, then fallback
        const resolvedEmail = userProfile?.email || r.studentEmail || 'No Email';
        
        return {
            ...r,
            studentName: resolvedName,
            studentEmail: resolvedEmail,
            studentClass: userProfile?.assignedClass || 'Unassigned',
            studentDivision: userProfile?.assignedDivision || ''
        };
    });

    return merged;
  }, [rawResults, usersMap]);

  const handleEditClick = (result: ExtendedResult) => {
    setEditingResult(result);
    setNewScore(result.score);
  };

  const handleSaveScore = async () => {
    if (!editingResult) return;
    try {
      await updateDoc(doc(db, 'results', editingResult.id), { score: newScore });
      setEditingResult(null);
    } catch (error) {
      console.error("Error updating score", error);
      alert("Failed to update score");
    }
  };

  const handleToggleHide = async (result: ExtendedResult) => {
    try {
      const newStatus = !result.isHidden;
      await updateDoc(doc(db, 'results', result.id), { isHidden: newStatus });
    } catch (error) {
      console.error("Error toggling visibility", error);
      alert("Failed to update visibility");
    }
  };

  const handleDeleteResult = async () => {
    if (!resultToDelete) return;
    try {
      await deleteDoc(doc(db, 'results', resultToDelete.id));
      setResultToDelete(null);
    } catch (error) {
      console.error("Error deleting result", error);
      alert("Failed to delete result");
    }
  };

  const exportToCSV = () => {
    const headers = ['Student Name', 'Email', 'ID', 'Class', 'Division', 'Exam Title', 'Score', 'Total Marks', 'Percentage', 'Time Taken (s)', 'Date', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredResults.map(r => {
        const dateStr = parseDate(r.submittedAt)?.toLocaleString().replace(/,/g, '') || 'N/A'; // Remove commas to keep CSV clean
        const name = (r.studentName || 'Unknown').replace(/"/g, '""'); // Escape quotes
        const email = (r.studentEmail || '').replace(/"/g, '""');
        const examTitle = (r.examTitle || '').replace(/"/g, '""');
        
        return [
            `"${name}"`,
            `"${email}"`,
            `"${r.studentId}"`,
            `"${r.studentClass}"`,
            `"${r.studentDivision}"`,
            `"${examTitle}"`,
            r.score,
            r.totalMarks,
            `${Math.round((r.score / r.totalMarks) * 100)}%`,
            r.timeTakenSeconds || 0,
            `"${dateStr}"`,
            r.isHidden ? 'Hidden' : 'Visible'
        ].join(',')
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (selectedResult) {
      const studentExamResults = results.filter(r => 
        r.studentId === selectedResult.studentId && 
        r.examId === selectedResult.examId
      );
      
      studentExamResults.sort((a, b) => {
          const dateA = parseDate(a.submittedAt)?.getTime() || 0;
          const dateB = parseDate(b.submittedAt)?.getTime() || 0;
          return dateA - dateB;
      });
      
      const index = studentExamResults.findIndex(r => r.id === selectedResult.id);
      setAttemptNumber(index + 1);
      setTotalAttempts(studentExamResults.length);

      // Fetch Exam Data for Review
      const fetchExam = async () => {
         try {
            const docRef = doc(db, 'exams', selectedResult.examId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setReviewExam(docSnap.data() as Exam);
            }
         } catch (e) {
            console.error("Error fetching exam details for review", e);
         }
      };
      fetchExam();
    } else {
        setReviewExam(null);
    }
  }, [selectedResult, results]);

  const uniqueExams = Array.from(new Set(results.map(r => r.examTitle))).sort();

  const filteredResults = useMemo(() => {
    let filtered = results.filter(r => {
      const searchLower = searchTerm.toLowerCase();
      // Safe checks for null properties
      const nameMatch = (r.studentName || '').toLowerCase().includes(searchLower);
      const emailMatch = (r.studentEmail || '').toLowerCase().includes(searchLower);
      const titleMatch = (r.examTitle || '').toLowerCase().includes(searchLower);
      const idMatch = (r.studentId || '').toLowerCase().includes(searchLower);

      const matchesSearch = nameMatch || emailMatch || titleMatch || idMatch;
      
      const matchesExam = examFilter === 'all' || r.examTitle === examFilter;
      const matchesClass = classFilter === 'all' || r.studentClass === classFilter;
      const matchesDivision = divisionFilter === 'all' || r.studentDivision === divisionFilter;
      const matchesVisibility = showHidden ? true : !r.isHidden;
      
      return matchesSearch && matchesExam && matchesClass && matchesDivision && matchesVisibility;
    });

    // Sorting Logic
    filtered.sort((a, b) => {
        switch (sortOption) {
            case 'date_desc':
                return (parseDate(b.submittedAt)?.getTime() || 0) - (parseDate(a.submittedAt)?.getTime() || 0);
            case 'date_asc':
                return (parseDate(a.submittedAt)?.getTime() || 0) - (parseDate(b.submittedAt)?.getTime() || 0);
            case 'score_desc':
                return (b.score / b.totalMarks) - (a.score / a.totalMarks);
            case 'score_asc':
                return (a.score / a.totalMarks) - (b.score / b.totalMarks);
            case 'name_asc':
                return (a.studentName || '').localeCompare(b.studentName || '');
            default:
                return 0;
        }
    });

    return filtered;
  }, [results, searchTerm, examFilter, classFilter, divisionFilter, showHidden, sortOption]);

  const totalResults = filteredResults.length;
  const avgScore = totalResults > 0 ? filteredResults.reduce((acc, r) => acc + (r.score / r.totalMarks), 0) / totalResults * 100 : 0;
  const passedCount = filteredResults.filter(r => (r.score / r.totalMarks) >= 0.5).length;
  const passRate = totalResults > 0 ? (passedCount / totalResults) * 100 : 0;
  
  const topPerformer = filteredResults.reduce((prev, current) => {
    return ((current.score / current.totalMarks) > (prev ? prev.score / prev.totalMarks : -1)) ? current : prev;
  }, null as ExtendedResult | null);

  return (
    <div>
       <ConfirmModal 
        isOpen={!!resultToDelete}
        onClose={() => setResultToDelete(null)}
        onConfirm={handleDeleteResult}
        title="Delete Result"
        message="Are you sure you want to delete this attempt? The student will be able to retake the exam if permitted. This cannot be undone."
        isDestructive={true}
        confirmText="Delete Attempt"
      />

      <AnimatePresence>
        {editingResult && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
               onClick={() => setEditingResult(null)}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm relative z-10 p-6 border border-slate-200 dark:border-slate-800"
             >
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Edit Score</h3>
                <div className="mb-6">
                   <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adjusted Score</label>
                   <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        value={newScore}
                        onChange={(e) => setNewScore(Number(e.target.value))}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-white focus:border-red-500 outline-none transition-colors"
                      />
                      <span className="text-slate-400 font-bold text-lg">/ {editingResult.totalMarks}</span>
                   </div>
                </div>
                <div className="flex gap-3">
                   <button onClick={() => setEditingResult(null)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
                   <button onClick={handleSaveScore} className="flex-1 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-500/30 transition-colors">Save Score</button>
                </div>
             </motion.div>
           </div>
        )}

        {selectedResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
               onClick={() => setSelectedResult(null)}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
             >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start shrink-0">
                   <div>
                     <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Detailed Review</h3>
                     <div className="flex items-center gap-3 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{selectedResult.studentName}</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-slate-500 dark:text-slate-400">{selectedResult.examTitle}</span>
                     </div>
                   </div>
                   <button onClick={() => setSelectedResult(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                      <XCircle size={24} className="text-slate-400" />
                   </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {/* Summary Stats in Modal */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Score</p>
                            <p className={`text-2xl font-black ${(selectedResult.score/selectedResult.totalMarks) >= 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {Math.round((selectedResult.score/selectedResult.totalMarks)*100)}%
                            </p>
                            <p className="text-xs text-slate-400">{selectedResult.score} / {selectedResult.totalMarks}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                             <p className="text-xs font-bold text-slate-400 uppercase mb-1">Time</p>
                             <p className="text-xl font-black text-slate-800 dark:text-white">
                                {selectedResult.timeTakenSeconds ? `${Math.floor(selectedResult.timeTakenSeconds / 60)}m` : '-'}
                             </p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                             <p className="text-xs font-bold text-slate-400 uppercase mb-1">Attempt</p>
                             <p className="text-xl font-black text-slate-800 dark:text-white">#{attemptNumber}</p>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-center">
                             <p className="text-xs font-bold text-slate-400 uppercase mb-1">Date</p>
                             <p className="text-sm font-bold text-slate-800 dark:text-white mt-1">
                                {parseDate(selectedResult.submittedAt)?.toLocaleDateString()}
                             </p>
                        </div>
                    </div>

                    <h4 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <Hash size={18} className="text-blue-500" /> Answer Key Breakdown
                    </h4>

                    {reviewExam && reviewExam.questions ? (
                        <div className="space-y-4">
                            {reviewExam.questions.map((q, idx) => {
                                const studentAnswerIdx = selectedResult.answers[idx];
                                const isCorrect = studentAnswerIdx === q.correctAnswer;
                                const isSkipped = studentAnswerIdx === -1 || studentAnswerIdx === undefined;

                                return (
                                    <div key={idx} className={`p-4 rounded-xl border-l-4 ${isCorrect ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10'} border-y border-r border-slate-100 dark:border-slate-800`}>
                                        <div className="flex items-start gap-3 mb-3">
                                            <span className="text-xs font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">Q{idx+1}</span>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{q.text}</p>
                                        </div>
                                        
                                        <div className="space-y-2 ml-2 md:ml-10">
                                            {q.type === 'short-answer' ? (
                                                <div className="text-sm">
                                                    <p className="text-slate-500 text-xs font-bold uppercase mb-1">Answer:</p>
                                                    <div className="flex items-center gap-2">
                                                        {isCorrect ? <CheckCircle2 size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />}
                                                        <span className={isCorrect ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-red-700 dark:text-red-400 font-bold'}>
                                                            {/* Result object stores simple answers, real implementation needs text storage for short answer */}
                                                            {isCorrect ? "Correct" : "Incorrect"}
                                                        </span>
                                                        <span className="text-slate-400 text-xs ml-2">(Detailed text comparison not available in summary)</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                q.options.map((opt, optIdx) => {
                                                    const isSelected = studentAnswerIdx === optIdx;
                                                    const isRealCorrect = q.correctAnswer === optIdx;
                                                    
                                                    let rowClass = "text-slate-500 dark:text-slate-400";
                                                    if (isSelected && isRealCorrect) rowClass = "text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/30 rounded px-2 py-1 -mx-2";
                                                    else if (isSelected && !isRealCorrect) rowClass = "text-red-600 dark:text-red-400 font-bold bg-red-100 dark:bg-red-900/30 rounded px-2 py-1 -mx-2";
                                                    else if (!isSelected && isRealCorrect) rowClass = "text-emerald-600 dark:text-emerald-400 font-bold";

                                                    return (
                                                        <div key={optIdx} className={`text-sm flex items-center gap-2 ${rowClass}`}>
                                                            {isSelected ? (isRealCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />) : (isRealCorrect ? <Check size={14} /> : <div className="w-3.5" />)}
                                                            {opt}
                                                            {isSelected && <span className="text-[10px] uppercase ml-auto opacity-70 font-black">Selected</span>}
                                                            {!isSelected && isRealCorrect && <span className="text-[10px] uppercase ml-auto opacity-70 font-black">Correct Answer</span>}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            <p>Exam data not available or deleted.</p>
                        </div>
                    )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mb-8">
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Results Analysis</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">Detailed performance tracking and grading.</p>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={exportToCSV} 
                 disabled={filteredResults.length === 0}
                 className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center disabled:opacity-50"
               >
                 <Download size={16} className="mr-2" /> Export CSV
               </button>
               <button 
                 className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                 onClick={() => setSortOption(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc')}
                 title="Sort by Date"
               >
                 <ArrowUpDown size={16} />
               </button>
            </div>
         </div>

         {/* Filters Row - Improved Layout */}
         <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6 shadow-sm">
             <div className="flex flex-col lg:flex-row gap-4">
                 <div className="relative flex-[2]">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                     <input 
                         type="text" 
                         placeholder="Search student, email or exam..." 
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-bold"
                     />
                 </div>
                 
                 <div className="flex flex-1 gap-2 overflow-x-auto pb-1 lg:pb-0">
                     {/* Class Filter */}
                     <div className="relative min-w-[140px]">
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select 
                            value={classFilter}
                            onChange={(e) => { setClassFilter(e.target.value); setDivisionFilter('all'); }}
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-bold appearance-none cursor-pointer"
                        >
                            <option value="all">All Classes</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                     </div>

                     {/* Division Filter */}
                     <div className="relative min-w-[120px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select 
                            value={divisionFilter}
                            onChange={(e) => setDivisionFilter(e.target.value)}
                            disabled={classFilter === 'all'}
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-bold appearance-none cursor-pointer disabled:opacity-50"
                        >
                            <option value="all">All Divs</option>
                            {classes.find(c => c.name === classFilter)?.divisions.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                     </div>
                 </div>

                 <div className="flex flex-1 gap-2">
                     <div className="relative flex-1 min-w-[160px]">
                         <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                         <select 
                             value={examFilter}
                             onChange={(e) => setExamFilter(e.target.value)}
                             className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-bold appearance-none cursor-pointer truncate"
                         >
                             <option value="all">All Exams</option>
                             {uniqueExams.map(e => <option key={e} value={e}>{e}</option>)}
                         </select>
                         <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                     </div>
                     
                     <button 
                         onClick={() => setShowHidden(!showHidden)}
                         className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-sm transition-colors ${showHidden ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-800 dark:border-slate-100' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}
                         title="Toggle Hidden Results"
                     >
                         {showHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                     </button>
                 </div>
             </div>
         </div>

         {/* Stats */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Results Count</p>
               <h3 className="text-2xl font-black text-slate-800 dark:text-white">{totalResults}</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Pass Rate</p>
               <h3 className="text-2xl font-black text-emerald-500">{Math.round(passRate)}%</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Score</p>
               <h3 className="text-2xl font-black text-blue-500">{Math.round(avgScore)}%</h3>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Top Student</p>
               <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate pt-1">{topPerformer?.studentName || '-'}</h3>
            </div>
         </div>

         {/* List */}
         <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
             <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 text-xs uppercase tracking-widest text-slate-500 font-bold">
                            <th className="p-4">Student</th>
                            <th className="p-4">Exam Details</th>
                            <th className="p-4 w-48">Score</th>
                            <th className="p-4">Submitted</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading results...</td></tr>
                        ) : filteredResults.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">No results found matching your filters.</td></tr>
                        ) : (
                            filteredResults.map(result => {
                                const percentage = Math.round((result.score/result.totalMarks)*100);
                                const isPassed = percentage >= 50;

                                return (
                                <tr key={result.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                                                {result.studentName.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-slate-800 dark:text-white text-sm">{result.studentName}</p>
                                                    {result.studentClass && result.studentClass !== 'Unassigned' && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                                                            {result.studentClass} {result.studentDivision ? `- ${result.studentDivision}` : ''}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400">{result.studentEmail}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm block">{result.examTitle}</span>
                                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                            <Clock size={10} /> 
                                            {result.timeTakenSeconds ? `${Math.floor(result.timeTakenSeconds / 60)}m ${result.timeTakenSeconds % 60}s` : 'N/A'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-end text-xs">
                                                <span className={`font-black text-sm ${isPassed ? 'text-emerald-500' : 'text-red-500'}`}>{percentage}%</span>
                                                <span className="text-slate-400 font-medium">{result.score}/{result.totalMarks}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full ${isPassed ? 'bg-emerald-500' : 'bg-red-500'}`} 
                                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-xs font-bold text-slate-500">
                                            {parseDate(result.submittedAt)?.toLocaleDateString()}
                                        </span>
                                        <p className="text-[10px] text-slate-400">
                                            {parseDate(result.submittedAt)?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </p>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setSelectedResult(result)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="View Breakdown">
                                                <BarChart2 size={16} />
                                            </button>
                                            <button onClick={() => handleEditClick(result)} className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Edit Score">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleToggleHide(result)} className={`p-2 rounded-lg transition-colors ${result.isHidden ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`} title={result.isHidden ? "Unhide" : "Hide"}>
                                                {result.isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                            <button onClick={() => setResultToDelete(result)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                )
                            })
                        )}
                    </tbody>
                 </table>
             </div>
         </div>
      </div>
    </div>
  );
};

export default ResultsManager;
