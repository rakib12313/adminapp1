
import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Users, BookOpen, FileText, Bell, ArrowRight, Activity, Clock, TrendingUp, Wifi, CheckCircle2, AlertCircle, UserPlus, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

const DashboardCard = ({ title, count, subtext, icon: Icon, color, delay, pulsing }: { title: string, count: number, subtext?: string, icon: any, color: string, delay: number, pulsing?: boolean }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
    className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl md:rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center space-x-4 cursor-pointer touch-manipulation"
  >
    <div className={`p-4 rounded-xl ${color} text-white shadow-lg shadow-opacity-20 ${pulsing ? 'animate-pulse' : ''}`}>
      <Icon size={24} />
    </div>
    <div>
      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</p>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-end gap-2">
        {count}
        {subtext && <span className="text-xs font-normal text-slate-400 mb-1">{subtext}</span>}
      </h3>
    </div>
  </motion.div>
);

const QuickAction = ({ icon: Icon, label, color, delay, to }: { icon: any, label: string, color: string, delay: number, to: string }) => (
  <Link to={to} className="w-full">
    <motion.button 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ scale: 1.02, borderColor: color }}
      whileTap={{ scale: 0.98 }}
      className={`w-full h-full p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl md:rounded-xl shadow-sm hover:shadow-md transition-all group flex flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-300 touch-manipulation`}
    >
      <div className={`p-3 rounded-full bg-slate-50 dark:bg-slate-800 group-hover:bg-opacity-10 transition-colors`} style={{ color }}>
        <Icon size={28} />
      </div>
      <span className="font-medium text-sm md:text-base">{label}</span>
    </motion.button>
  </Link>
);

// Helper to safely parse dates from Firestore (Timestamp, String, or Number)
const parseDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === 'object' && val.seconds) return new Date(val.seconds * 1000); 
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    students: 0,
    onlineStudents: 0,
    exams: 0,
    resources: 0,
    openTickets: 0
  });

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<{name: string, students: number}[]>([]);
  const [performanceData, setPerformanceData] = useState<{name: string, score: number}[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every 15 seconds to refresh "Live Users" status locally
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  // Recalculate Live Users whenever user list updates or time passes
  useEffect(() => {
    const activeCount = allUsers.filter(u => {
        const lastLogin = parseDate(u.lastLogin);
        if (!lastLogin) return false;
        // User is considered live if active in last 15 minutes
        return (currentTime - lastLogin.getTime()) < 15 * 60 * 1000;
    }).length;
    
    // Count actual students
    const studentCount = allUsers.filter(u => u.role === 'student').length;
    
    setStats(prev => ({ ...prev, onlineStudents: activeCount, students: studentCount }));
  }, [allUsers, currentTime]);

  useEffect(() => {
    // 1. Real-time listener for ALL Users (to calculate stats more accurately)
    const usersQuery = collection(db, 'users');
    const unsubUsers = onSnapshot(usersQuery, (snap) => {
      const usersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(usersData);
      
      // Calculate Chart Data (Enrollment over last 4 weeks) - Filter for students only
      const studentsOnly = usersData.filter((u: any) => u.role === 'student');
      const now = new Date();
      const weeksData = [0, 0, 0, 0];
      
      studentsOnly.forEach((data: any) => {
          const d = parseDate(data.joinedAt || data.createdAt);
          if (d) {
              const diffTime = Math.abs(now.getTime() - d.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
              
              if (diffDays <= 7) weeksData[3]++;
              else if (diffDays <= 14) weeksData[2]++;
              else if (diffDays <= 21) weeksData[1]++;
              else if (diffDays <= 28) weeksData[0]++;
          }
      });
      
      let runningTotal = 0;
      const formattedChartData = weeksData.map((count, idx) => {
           runningTotal += count;
           return { name: `Wk ${idx + 1}`, students: runningTotal };
      });
      
      setEnrollmentData(formattedChartData);
    }, (error) => {
        console.warn("Dashboard: Error fetching users stats", error.code);
    });

    // 2. Stats Listeners
    const unsubExams = onSnapshot(
        collection(db, 'exams'), 
        (snap) => setStats(prev => ({ ...prev, exams: snap.size })),
        (error) => console.warn("Dashboard: Error fetching exams stats", error.code)
    );
    
    const unsubResources = onSnapshot(
        collection(db, 'resources'), 
        (snap) => setStats(prev => ({ ...prev, resources: snap.size })),
        (error) => console.warn("Dashboard: Error fetching resources stats", error.code)
    );
    
    // Help Inbox Stats
    const qTickets = query(collection(db, 'help_requests'), where('status', '==', 'open'));
    const unsubTickets = onSnapshot(
        qTickets, 
        (snap) => setStats(prev => ({...prev, openTickets: snap.size})),
        (error) => console.warn("Dashboard: Error fetching ticket stats", error.code)
    );

    // 3. Results for Activity Feed and Performance Chart
    const recentResultsQuery = query(collection(db, 'results'), orderBy('submittedAt', 'desc'), limit(20)); // Fetch last 20 for charts
    const unsubResults = onSnapshot(recentResultsQuery, (snap) => {
        const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRecentResults(results.slice(0, 5)); // Only keep top 5 for activity feed

        // Process Performance Data (Avg Score of last 5 exams taken)
        const scores = results.map(r => ({
           name: (r as any).studentName ? (r as any).studentName.split(' ')[0] : 'Unknown',
           score: Math.round(((r as any).score / (r as any).totalMarks) * 100)
        })).slice(0, 7).reverse(); // Show last 7
        setPerformanceData(scores);
    }, (error) => {
        console.warn("Dashboard: Error fetching results stats", error.code);
    });

    return () => {
      unsubUsers();
      unsubExams();
      unsubResources();
      unsubTickets();
      unsubResults();
    };
  }, []);

  // Effect to merge and sort recent activity
  useEffect(() => {
    const formattedResults = recentResults.map(r => ({ ...r, type: 'submission', timestamp: parseDate(r.submittedAt) }));
    
    const newestStudents = allUsers
        .filter(u => u.role === 'student')
        .sort((a, b) => {
            const dateA = parseDate(a.createdAt || a.joinedAt)?.getTime() || 0;
            const dateB = parseDate(b.createdAt || b.joinedAt)?.getTime() || 0;
            return dateB - dateA;
        })
        .slice(0, 5)
        .map(s => ({ ...s, type: 'join', timestamp: parseDate(s.createdAt || s.joinedAt) }));

    const combined = [
        ...formattedResults,
        ...newestStudents
    ].sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0))
     .slice(0, 6);
    
    setRecentActivity(combined);
  }, [allUsers, recentResults]);

  const getTimeAgo = (date: Date | null) => {
    if (!date) return '';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "Just now";
  };

  return (
    <div>
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white">Dashboard Overview</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">Real-time insights and quick actions.</p>
      </motion.div>
      
      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <DashboardCard 
          title="Total Students" 
          count={stats.students} 
          icon={Users} 
          color="bg-gradient-to-br from-red-500 to-red-600"
          delay={0.1}
        />
        <DashboardCard 
          title="Live Users" 
          count={stats.onlineStudents}
          subtext="Active now"
          icon={Wifi} 
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
          delay={0.15}
          pulsing={true}
        />
        <DashboardCard 
          title="Active Exams" 
          count={stats.exams} 
          icon={BookOpen} 
          color="bg-gradient-to-br from-rose-500 to-rose-600"
          delay={0.2} 
        />
        <DashboardCard 
          title="Open Tickets" 
          count={stats.openTickets} 
          icon={MessageSquare} 
          color="bg-gradient-to-br from-amber-500 to-amber-600"
          delay={0.3} 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
        <div className="xl:col-span-2 space-y-6 md:space-y-8">
           {/* Charts Section - Side by Side on Desktop */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Enrollment Chart */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800"
              >
                 <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <TrendingUp className="mr-2 text-red-500" size={16} /> Growth (30d)
                 </h3>
                 <div className="h-48 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <AreaChart data={enrollmentData}>
                       <defs>
                         <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                           <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                       <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                       <Area type="monotone" dataKey="students" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" />
                     </AreaChart>
                   </ResponsiveContainer>
                 </div>
              </motion.div>

              {/* Performance Chart */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800"
              >
                 <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center">
                    <Activity className="mr-2 text-blue-500" size={16} /> Recent Performance (%)
                 </h3>
                 <div className="h-48 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={performanceData}>
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                       <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                       <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
              </motion.div>
           </div>

           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
              Quick Actions <ArrowRight size={16} className="ml-2 text-slate-400" />
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <QuickAction to="/exams" icon={BookOpen} label="New Exam" color="#dc2626" delay={0.6} />
              <QuickAction to="/resources" icon={FileText} label="Upload" color="#e11d48" delay={0.7} />
              <QuickAction to="/notices" icon={Bell} label="Broadcast" color="#f59e0b" delay={0.8} />
              <QuickAction to="/inbox" icon={MessageSquare} label="Support" color="#8b5cf6" delay={0.9} />
            </div>
          </motion.div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 md:p-6 h-fit min-h-[400px]">
           <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center">
              <Activity className="mr-2 text-red-500" size={20} /> Recent Activity
           </h3>
           <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + (i * 0.1) }}
                    key={`${activity.type}-${activity.id}`} 
                    className="flex gap-4 relative z-10"
                  >
                     <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-sm 
                        ${activity.type === 'submission' 
                            ? ((activity.score / activity.totalMarks >= 0.5) ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-500' : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-500')
                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-500'
                        }`}>
                        {activity.type === 'submission' 
                            ? ((activity.score / activity.totalMarks >= 0.5) ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />)
                            : <UserPlus size={16} />
                        }
                     </div>
                     <div className="pt-1 min-w-0">
                        {activity.type === 'submission' ? (
                            <>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                {activity.studentName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                Submitted <span className="font-semibold text-slate-700 dark:text-slate-300">{activity.examTitle}</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                New Student
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{activity.displayName}</span> joined the portal
                                </p>
                            </>
                        )}
                        <div className="flex items-center text-[10px] text-slate-400 mt-2 font-medium">
                          <Clock size={10} className="mr-1" /> {getTimeAgo(activity.timestamp)}
                        </div>
                     </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center relative z-10 bg-white dark:bg-slate-900">
                   <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-full mb-3">
                     <Activity className="text-slate-300" size={24} />
                   </div>
                   <p className="text-sm text-slate-400 font-medium">No recent activity found.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
