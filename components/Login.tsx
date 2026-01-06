
import React, { useState } from 'react';
import { auth, googleProvider, db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, ArrowRight, Chrome, User, Sparkles, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const ensureAdminRole = async (user: any, nameOverwrite?: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: nameOverwrite || user.displayName || 'Admin User',
        photoURL: user.photoURL,
        lastLogin: new Date().toISOString()
      };

      if (!userSnap.exists()) {
        // New User via Admin Portal -> Assign Admin Role
        await setDoc(userRef, {
          ...userData,
          role: 'admin',
          createdAt: serverTimestamp(),
          status: 'active'
        });
      } else {
        // Existing User -> CHECK ROLE
        const currentData = userSnap.data();
        if (currentData.role !== 'admin') {
           // DENY ACCESS if not an admin
           await auth.signOut();
           throw new Error("Access Denied: You do not have administrator privileges.");
        }

        // Valid Admin -> Update metadata
        await setDoc(userRef, { 
          ...userData,
          role: 'admin' 
        }, { merge: true });
      }
    } catch (err) {
      console.error("Error checking admin role:", err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        if (!displayName.trim()) {
           setError('Please enter your full name.');
           setLoading(false);
           return;
        }
        const result = await auth.createUserWithEmailAndPassword(email, password);
        if (result.user) {
          await result.user.updateProfile({ displayName: displayName });
          await ensureAdminRole(result.user, displayName);
        }
      } else {
        const result = await auth.signInWithEmailAndPassword(email, password);
        await ensureAdminRole(result.user);
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("Access Denied")) {
        setError(err.message);
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use by another account.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters long.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError('Authentication failed. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await auth.signInWithPopup(googleProvider);
      await ensureAdminRole(result.user);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("Access Denied")) {
        setError(err.message);
      } else {
        setError('Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    try {
      setLoading(true);
      await auth.sendPasswordResetEmail(email);
      setSuccessMsg('Password reset email sent! Check your inbox (and spam folder).');
      setError('');
    } catch (err: any) {
      setError('Failed to send reset email. Verify the address is correct.');
    } finally {
      setLoading(false);
    }
  };

  // Animation variants
  const backgroundBlobVariant = {
    animate: {
      scale: [1, 1.2, 0.9, 1],
      x: [0, 50, -50, 0],
      y: [0, -50, 50, 0],
      rotate: [0, 45, -45, 0],
      transition: {
        duration: 20,
        ease: "easeInOut",
        repeat: Infinity,
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20,
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Fluid Dynamic Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <motion.div
           variants={backgroundBlobVariant}
           animate="animate"
           className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-gradient-to-br from-red-600/20 to-rose-600/5 rounded-full blur-[120px]"
         />
         <motion.div
           variants={backgroundBlobVariant}
           animate="animate"
           transition={{ delay: 2, duration: 25, ease: "easeInOut", repeat: Infinity }}
           className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-gradient-to-tl from-red-500/20 to-orange-600/5 rounded-full blur-[120px]"
         />
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        layout
        className="bg-slate-900/60 backdrop-blur-3xl border border-slate-800/60 p-8 md:p-10 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] w-full max-w-md z-10 relative overflow-hidden"
      >
        {/* Glossy overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

        <motion.div variants={itemVariants} className="text-center mb-10 relative z-10">
           <motion.div 
             whileHover={{ rotate: 15, scale: 1.1 }}
             transition={{ type: "spring", stiffness: 300 }}
             className="mx-auto w-16 h-16 bg-gradient-to-tr from-red-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_-10px_rgba(220,38,38,0.6)] mb-6"
           >
              <Sparkles className="text-white drop-shadow-md" size={32} />
            </motion.div>
          <motion.h1 
            key={isSignUp ? 'signup-title' : 'signin-title'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2 tracking-tight"
          >
            {isSignUp ? 'Join LMS' : 'Admin Portal'}
          </motion.h1>
          <motion.p 
            key={isSignUp ? 'signup-desc' : 'signin-desc'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-slate-400 font-medium"
          >
            {isSignUp ? 'Create your administrator account' : 'Welcome back to the dashboard'}
          </motion.p>
        </motion.div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center space-x-2">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            </motion.div>
          )}
          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center space-x-2">
                <Sparkles size={16} className="text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <AnimatePresence mode="popLayout">
            {isSignUp && (
              <motion.div 
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -20, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pb-1">
                  <label className="block text-[10px] font-black text-slate-500 ml-4 uppercase tracking-[0.2em] mb-1">Full Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-600 group-focus-within:text-red-500 transition-colors duration-300" />
                    </div>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="block w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-300 outline-none font-medium text-sm"
                      placeholder="e.g. Dr. Jane Smith"
                      required={isSignUp}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 ml-4 uppercase tracking-[0.2em] mb-1">Email Address</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-600 group-focus-within:text-red-500 transition-colors duration-300" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-12 pr-4 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-300 outline-none font-medium text-sm"
                placeholder="admin@institution.edu"
                required
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="space-y-1">
            <label className="block text-[10px] font-black text-slate-500 ml-4 uppercase tracking-[0.2em] mb-1">Secret Key</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-600 group-focus-within:text-red-500 transition-colors duration-300" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-12 pr-12 py-4 bg-slate-950/50 border border-slate-800 rounded-2xl text-white placeholder-slate-600 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all duration-300 outline-none font-medium text-sm"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-600 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </motion.div>

          {!isSignUp && (
            <motion.div variants={itemVariants} className="flex items-center justify-between py-2">
              <button 
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center space-x-2 text-slate-400 hover:text-slate-200 transition-colors group"
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-700 text-transparent'}`}>
                   <CheckSquare size={14} />
                </div>
                <span className="text-sm font-medium">Remember me</span>
              </button>
              
              <button
                type="button" 
                onClick={handleForgotPassword}
                className="text-sm font-bold text-slate-500 hover:text-red-400 transition-colors"
              >
                Forgot Password?
              </button>
            </motion.div>
          )}

          <motion.button
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center py-4 px-6 border border-transparent rounded-2xl shadow-[0_10px_30px_-10px_rgba(220,38,38,0.5)] text-base font-bold text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 focus:outline-none transition-all duration-300 relative overflow-hidden group"
          >
             <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="flex items-center relative z-10">
                {isSignUp ? 'Register Account' : 'Authenticate'} <ArrowRight size={20} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </motion.button>
        </form>

        <motion.div variants={itemVariants} className="mt-8 relative z-10">
          <div className="flex items-center gap-4 my-8">
            <div className="h-px bg-slate-800 flex-1" />
            <span className="text-xs text-slate-500 uppercase tracking-[0.2em] font-black">Or Continue With</span>
            <div className="h-px bg-slate-800 flex-1" />
          </div>

          <div>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(30, 41, 59, 0.6)" }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center py-4 px-6 border border-slate-700/50 rounded-2xl bg-slate-900/30 text-sm font-bold text-white transition-all hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/20"
            >
              <Chrome size={20} className="mr-3" />
              Google Workspace
            </motion.button>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-8 text-center relative z-10">
          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
              setSuccessMsg('');
            }}
            className="text-slate-500 hover:text-red-400 text-sm font-bold transition-colors flex items-center justify-center w-full group py-2"
          >
            <span className="opacity-70 group-hover:opacity-100 transition-opacity">
              {isSignUp ? 'Already a member?' : 'New administrator?'}
            </span>
            <span className="ml-2 text-white group-hover:text-red-500 transition-colors underline decoration-transparent group-hover:decoration-red-500 underline-offset-4 duration-300">
              {isSignUp ? 'Sign In' : 'Create Account'}
            </span>
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;
