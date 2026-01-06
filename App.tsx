
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { auth, db } from './services/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { uploadToCloudinary } from './services/cloudinaryService';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  Bell, 
  Users, 
  LogOut, 
  X,
  Settings as SettingsIcon,
  Search,
  PieChart,
  Home,
  Sun,
  Moon,
  User as UserIcon,
  Phone,
  Camera,
  Upload,
  Menu as MenuIcon,
  MessageSquare
} from 'lucide-react';

import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ExamManager from './components/ExamManager';
import ResourceManager from './components/ResourceManager';
import NoticeManager from './components/NoticeManager';
import StudentList from './components/StudentList';
import Settings from './components/Settings';
import ResultsManager from './components/ResultsManager';
import CommandPalette from './components/CommandPalette';
import AboutModal from './components/AboutModal';
import SupportInbox from './components/SupportInbox';

// Protected Route Component
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

const SidebarItem = ({ to, icon: Icon, label, active, onClick, isCollapsed }: { to: string, icon: any, label: string, active: boolean, onClick?: () => void, isCollapsed?: boolean }) => (
  <Link 
    to={to} 
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 my-1 mx-2 rounded-xl transition-all duration-200 group relative ${
      active 
        ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
    }`}
    title={isCollapsed ? label : ''}
  >
    <Icon size={20} className={`shrink-0 transition-colors duration-200 ${active ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-200'}`} />
    {!isCollapsed && (
      <span className="font-semibold tracking-wide text-sm whitespace-nowrap overflow-hidden">{label}</span>
    )}
    {active && !isCollapsed && (
      <motion.div 
        layoutId="activeSidebar"
        className="absolute left-0 w-1 h-6 bg-white rounded-r-full opacity-30"
      />
    )}
  </Link>
);

const BottomNavItem = ({ to, icon: Icon, label, active, onClick }: { to?: string, icon: any, label: string, active?: boolean, onClick?: () => void }) => {
  const Content = (
    <div className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 ${
      active 
        ? 'text-red-600 dark:text-red-400' 
        : 'text-slate-500 dark:text-slate-400 active:scale-95'
    }`}>
      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </div>
  );

  if (onClick) {
    return <button onClick={onClick} className="w-full h-full touch-manipulation">{Content}</button>;
  }
  
  return <Link to={to!} className="w-full h-full flex justify-center touch-manipulation">{Content}</Link>;
};

// --- Admin Profile Modal ---
const AdminProfileModal = ({ isOpen, onClose, user }: { isOpen: boolean, onClose: () => void, user: firebase.User }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [phoneNumber, setPhoneNumber] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch stored phone number
    const fetchUserData = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setPhoneNumber(snap.data().phoneNumber || '');
        }
      } catch (e) {
        console.error("Error fetching user data", e);
      }
    };
    if (isOpen) fetchUserData();
  }, [isOpen, user.uid]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Update Firebase Auth Profile
      await user.updateProfile({
        displayName,
        photoURL
      });

      // 2. Update Firestore User Document (Syncing)
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName,
        photoURL,
        phoneNumber 
      });

      onClose();
    } catch (error) {
      console.error("Failed to update profile", error);
      alert("Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImg(true);
    try {
      const url = await uploadToCloudinary(file);
      setPhotoURL(url);
    } catch (error) {
      console.error("Image upload failed", error);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploadingImg(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 overflow-hidden"
        >
          {/* Header Background */}
          <div className="h-32 bg-gradient-to-r from-red-600 to-rose-600 relative">
             <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 rounded-full text-white transition-colors backdrop-blur-md">
                <X size={20} />
             </button>
          </div>

          <div className="px-8 pb-8">
            <div className="relative -mt-16 mb-6 flex justify-center">
               <div 
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="h-32 w-32 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 overflow-hidden border-4 border-white dark:border-slate-900 shadow-2xl relative">
                    {uploadingImg ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                        <div className="w-8 h-8 border-3 border-white/50 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : null}
                    {photoURL ? (
                      <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={48} />
                    )}
                  </div>
                  <div className="absolute bottom-1 right-1 p-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-lg border-2 border-white dark:border-slate-900 group-hover:scale-110 transition-transform">
                    <Camera size={16} />
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
            </div>

            <div className="text-center mb-8">
               <h3 className="text-2xl font-black text-slate-900 dark:text-white">Edit Profile</h3>
               <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Update your administrator details</p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="space-y-4">
                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Display Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 dark:text-white font-bold transition-all"
                      placeholder="Your Name"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Avatar URL</label>
                  <div className="relative">
                    <Upload className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      value={photoURL}
                      onChange={e => setPhotoURL(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 dark:text-white font-medium transition-all"
                      placeholder="https://example.com/photo.jpg"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                    <input 
                      type="tel" 
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-slate-900 dark:text-white font-bold transition-all"
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading || uploadingImg}
                className="w-full py-4 bg-slate-900 dark:bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-slate-900/10 dark:shadow-red-900/20 hover:bg-slate-800 dark:hover:bg-red-700 transition-all disabled:opacity-50 mt-4 uppercase tracking-widest text-sm"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    className="max-w-7xl mx-auto"
  >
    {children}
  </motion.div>
);

// Wrapper for Routes to handle key prop issue in TypeScript with react-router-dom v6
const AnimatedRoutes: React.FC<{ children: React.ReactNode; location: any }> = ({ children, location }) => (
  <Routes location={location}>{children}</Routes>
);

const AdminLayout = () => {
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(auth.currentUser);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Keyboard shortcut for command palette
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSignOut = () => {
    auth.signOut();
  };

  const getPageTitle = (path: string) => {
    switch(path) {
        case '/': return 'Dashboard';
        case '/exams': return 'Exam Manager';
        case '/students': return 'Students';
        case '/results': return 'Results';
        case '/resources': return 'Resources';
        case '/notices': return 'Notices';
        case '/inbox': return 'Support Inbox';
        case '/settings': return 'Settings';
        default: return 'LMS Portal';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-500 ease-in-out">
      <CommandPalette isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      
      {currentUser && (
        <AdminProfileModal 
          isOpen={isProfileOpen} 
          onClose={() => setIsProfileOpen(false)} 
          user={currentUser} 
        />
      )}

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowLogoutConfirm(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm relative z-10 p-6 border border-slate-200 dark:border-slate-800 transition-colors duration-300"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-600 dark:text-red-400 transition-colors duration-300">
                  <LogOut size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Sign Out?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                  Are you sure you want to log out of the admin dashboard?
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200 touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSignOut}
                    className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 shadow-lg shadow-red-500/30 transition-colors duration-200 touch-manipulation"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar (Desktop) */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-[#0f172a] text-white transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'} ${isSidebarCollapsed ? 'md:w-20' : 'md:w-72'} shadow-2xl md:shadow-none border-r border-slate-800/50 flex flex-col`}>
        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} p-6 h-20`}>
          <button 
            onClick={() => setIsAboutOpen(true)}
            className="flex items-center space-x-3 group hover:scale-105 transition-transform"
          >
            <div className="h-10 w-10 bg-gradient-to-br from-red-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/20 group-hover:shadow-red-500/40 transition-shadow cursor-pointer shrink-0">
              <span className="font-bold text-white text-xl">L</span>
            </div>
            {!isSidebarCollapsed && (
              <div className="text-left overflow-hidden">
                <h1 className="text-lg font-bold text-white tracking-tight leading-none group-hover:text-red-400 transition-colors whitespace-nowrap">
                  LMS Admin
                </h1>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest whitespace-nowrap">Portal</span>
              </div>
            )}
          </button>
          <button onClick={() => setIsMobileOpen(false)} className="md:hidden text-slate-400 hover:text-white p-2 transition-colors">
            <X size={24} />
          </button>
        </div>

        <nav className="mt-4 flex flex-col space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] custom-scrollbar px-3 flex-1">
          {!isSidebarCollapsed && (
            <div className="px-3 pb-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Menu</p>
            </div>
          )}
          <SidebarItem isCollapsed={isSidebarCollapsed} to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} onClick={() => setIsMobileOpen(false)} />
          <SidebarItem isCollapsed={isSidebarCollapsed} to="/exams" icon={BookOpen} label="Exams" active={location.pathname === '/exams'} onClick={() => setIsMobileOpen(false)} />
          <SidebarItem isCollapsed={isSidebarCollapsed} to="/students" icon={Users} label="Students" active={location.pathname === '/students'} onClick={() => setIsMobileOpen(false)} />
          <SidebarItem isCollapsed={isSidebarCollapsed} to="/results" icon={PieChart} label="Results" active={location.pathname === '/results'} onClick={() => setIsMobileOpen(false)} />
          <SidebarItem isCollapsed={isSidebarCollapsed} to="/resources" icon={FileText} label="Resources" active={location.pathname === '/resources'} onClick={() => setIsMobileOpen(false)} />
          <SidebarItem isCollapsed={isSidebarCollapsed} to="/notices" icon={Bell} label="Notices" active={location.pathname === '/notices'} onClick={() => setIsMobileOpen(false)} />
          <SidebarItem isCollapsed={isSidebarCollapsed} to="/inbox" icon={MessageSquare} label="Support Inbox" active={location.pathname === '/inbox'} onClick={() => setIsMobileOpen(false)} />
          <SidebarItem isCollapsed={isSidebarCollapsed} to="/settings" icon={SettingsIcon} label="Settings" active={location.pathname === '/settings'} onClick={() => setIsMobileOpen(false)} />
        </nav>

        <div className="p-4 border-t border-slate-800/50 bg-[#0f172a] shrink-0">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'space-x-3'} text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-xl transition-all w-full group p-3`}
            title="Sign Out"
          >
            <LogOut size={20} className="group-hover:translate-x-1 transition-transform shrink-0" />
            {!isSidebarCollapsed && <span className="text-sm font-semibold whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative transition-colors duration-500 ease-in-out bg-slate-50 dark:bg-slate-950">
        {/* Top Navigation Bar */}
        <header className="h-20 z-30 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-800/50 px-4 md:px-8 flex items-center justify-between transition-colors duration-300">
           <div className="flex items-center">
              <button 
                onClick={() => setIsMobileOpen(true)} 
                className="md:hidden mr-4 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                 <MenuIcon size={24} />
              </button>
              
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden md:block mr-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                 <MenuIcon size={20} />
              </button>

              <div>
                 <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-white tracking-tight">
                    {getPageTitle(location.pathname)}
                 </h2>
              </div>
           </div>

           <div className="flex items-center gap-2 md:gap-4">
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="hidden md:flex items-center text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-4 py-2 rounded-xl hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-sm font-medium w-48 lg:w-64 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              >
                 <Search size={16} className="mr-3" />
                 <span className="mr-auto">Search...</span>
                 <kbd className="hidden lg:inline text-[10px] font-bold bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-slate-400">⌘K</kbd>
              </button>
              
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="md:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                 <Search size={20} />
              </button>

              <button 
                onClick={toggleTheme}
                className="p-2 text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors relative overflow-hidden group"
              >
                 <div className="relative z-10">
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                 </div>
              </button>

              <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

              <button 
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center gap-3 group pl-1"
              >
                 <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">{currentUser?.displayName || 'Admin'}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Administrator</p>
                 </div>
                 <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-red-500 to-rose-600 p-[2px] shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform cursor-pointer">
                     {currentUser?.photoURL ? (
                       <img src={currentUser.photoURL} alt="Profile" className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-900" />
                     ) : (
                       <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center text-red-500 font-bold text-sm">
                         {currentUser?.displayName?.charAt(0) || 'A'}
                       </div>
                     )}
                  </div>
              </button>
           </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-28 md:pb-8 pt-6 transition-colors duration-500 ease-in-out scroll-smooth">
          <AnimatePresence mode="wait">
            <AnimatedRoutes location={location}>
                <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
                <Route path="/exams" element={<PageWrapper><ExamManager /></PageWrapper>} />
                <Route path="/students" element={<PageWrapper><StudentList /></PageWrapper>} />
                <Route path="/results" element={<PageWrapper><ResultsManager /></PageWrapper>} />
                <Route path="/resources" element={<PageWrapper><ResourceManager /></PageWrapper>} />
                <Route path="/notices" element={<PageWrapper><NoticeManager /></PageWrapper>} />
                <Route path="/inbox" element={<PageWrapper><SupportInbox /></PageWrapper>} />
                <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </AnimatedRoutes>
          </AnimatePresence>
        </main>

        {/* Bottom Navigation (Mobile Only) */}
        <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 px-4 py-2 pb-safe z-40 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] h-[calc(60px+env(safe-area-inset-bottom))] transition-colors duration-300">
           <BottomNavItem to="/" icon={Home} label="Home" active={location.pathname === '/'} />
           <BottomNavItem to="/exams" icon={BookOpen} label="Exams" active={location.pathname === '/exams'} />
           <BottomNavItem to="/students" icon={Users} label="Students" active={location.pathname === '/students'} />
           <BottomNavItem to="/results" icon={PieChart} label="Results" active={location.pathname === '/results'} />
           <BottomNavItem onClick={() => setShowLogoutConfirm(true)} icon={LogOut} label="Logout" />
        </nav>
      </div>
    </div>
  );
};

// Main App Component wrapping everything with Router
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
