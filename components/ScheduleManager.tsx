
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Exam } from '../types';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const ScheduleManager = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'exams'), (snapshot) => {
        const fetchedExams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
        setExams(fetchedExams);
    }, (error) => {
        console.error("Error fetching exams:", error);
    });
    return () => unsubscribe();
  }, []);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const getExamsForDay = (day: number) => {
    return exams.filter(e => {
      if (!e.scheduledDate) return false;
      const d = new Date(e.scheduledDate);
      return d.getDate() === day && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
    });
  };

  return (
    <div className="h-full flex flex-col">
       <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Exam Schedule</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Calendar view of upcoming examinations</p>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
           <div className="flex items-center space-x-4">
             <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
               {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
             </h3>
             <div className="flex space-x-1">
               <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                 <ChevronLeft size={20} className="text-slate-500" />
               </button>
               <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                 <ChevronRight size={20} className="text-slate-500" />
               </button>
             </div>
           </div>
           <button 
             onClick={() => setCurrentDate(new Date())}
             className="text-sm text-red-600 dark:text-red-400 font-medium"
           >
             Today
           </button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
           {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
             <div key={day} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
               {day}
             </div>
           ))}
        </div>
        
        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
           {/* Empty cells for previous month */}
           {Array.from({ length: firstDayOfMonth }).map((_, i) => (
             <div key={`empty-${i}`} className="border-b border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50"></div>
           ))}

           {/* Days */}
           {Array.from({ length: daysInMonth }).map((_, i) => {
             const day = i + 1;
             const dayExams = getExamsForDay(day);
             const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

             return (
               <div key={day} className={`border-b border-r border-slate-100 dark:border-slate-800 p-2 min-h-[100px] relative hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isToday ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                 <span className={`text-sm font-medium ${isToday ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                   {day}
                 </span>
                 <div className="mt-2 space-y-1">
                   {dayExams.map(exam => (
                     <motion.div 
                        key={exam.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-1.5 rounded bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50 text-xs text-red-700 dark:text-red-300 truncate cursor-pointer hover:shadow-sm"
                     >
                        <div className="flex items-center space-x-1">
                           <Clock size={10} />
                           <span className="truncate font-medium">{exam.title}</span>
                        </div>
                     </motion.div>
                   ))}
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};

export default ScheduleManager;
