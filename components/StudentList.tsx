
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, query, where, Timestamp, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile, Result, ClassGroup } from '../types';
import { Search, User, Mail, Calendar, Trash2, Edit2, Filter, Phone, Save, Power, Shield, BarChart2, Check, XOctagon, Clock, Wifi, Layers, Plus, X, ShieldAlert, Users, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from './ConfirmModal';

// Helper to check if user is online (active in last 5 mins for stricter realtime feel)
const isUserOnline = (lastLogin: any) => {
  if (!lastLogin) return false;
  // Handle Firestore Timestamp, Date object, or ISO string
  const loginTime = lastLogin instanceof Timestamp ? lastLogin.toMillis() : new Date(lastLogin).getTime();
  if (isNaN(loginTime)) return false;
  
  const diff = Date.now() - loginTime;
  return diff < 5 * 60 * 1000; // 5 minutes window
};

const StudentList = () => {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'banned'>('all');
  const [classFilter, setClassFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Class Management State
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [classPermissionError, setClassPermissionError] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newDivisionName, setNewDivisionName] = useState('');
  const [selectedClassForDiv, setSelectedClassForDiv] = useState<string | null>(null);

  // Managing State
  const [managingStudent, setManagingStudent] = useState<UserProfile | null>(null);
  const [viewingStudent, setViewingStudent] = useState<UserProfile | null>(null);
  const [studentResults, setStudentResults] = useState<Result[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    displayName: '',
    phoneNumber: '',
    role: 'student',
    status: 'active',
    assignedClass: '',
    assignedDivision: ''
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Update local timer every 10s for snappy status updates
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLoading(true);
    // Realtime listener for Users
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setStudents(users);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    // Realtime listener for Classes
    const unsubscribeClasses = onSnapshot(collection(db, 'class_groups'), (snapshot) => {
      const fetchedClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassGroup));
      setClasses(fetchedClasses);
      setClassPermissionError(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn("Class management features disabled: Insufficient permissions.");
        setClassPermissionError(true);
      } else {
        console.error("Error fetching classes:", error);
      }
    });

    return () => {
        unsubscribeUsers();
        unsubscribeClasses();
    };
  }, []);

  // Fetch results when viewing a student
  useEffect(() => {
    if (viewingStudent) {
        setResultsLoading(true);
        const q = query(
            collection(db, 'results'), 
            where('studentId', '==', viewingStudent.uid)
        );
        const unsub = onSnapshot(q, (snap) => {
            const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Result));
            
            // Helper to safely parse dates for sorting
            const parseDate = (val: any) => {
                if (!val) return 0;
                if (val instanceof Timestamp) return val.toMillis();
                return new Date(val).getTime();
            };

            // Sort client side safely
            results.sort((a,b) => parseDate(b.submittedAt) - parseDate(a.submittedAt));
            
            setStudentResults(results);
            setResultsLoading(false);
        }, (error) => {
            console.error("Error fetching student results:", error);
            setResultsLoading(false);
        });
        return () => unsub();
    }
  }, [viewingStudent]);

  const openManageModal = (user: UserProfile) => {
    setManagingStudent(user);
    setEditForm({
      displayName: user.displayName || '',
      phoneNumber: user.phoneNumber || '',
      role: (user.role as any) || 'student',
      status: (user.status as any) || 'active',
      assignedClass: user.assignedClass || '',
      assignedDivision: user.assignedDivision || ''
    });
  };

  const handleUpdateProfile = async () => {
    if (!managingStudent) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', managingStudent.uid), {
        displayName: editForm.displayName,
        phoneNumber: editForm.phoneNumber,
        role: editForm.role,
        status: editForm.status,
        assignedClass: editForm.assignedClass,
        assignedDivision: editForm.assignedDivision
      });
      setManagingStudent(null);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'users', deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user.");
    }
  };

  // Class Management Handlers
  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    try {
        await addDoc(collection(db, 'class_groups'), {
            name: newClassName.trim(),
            divisions: []
        });
        setNewClassName('');
    } catch (e: any) {
        console.error("Error adding class", e);
        if (e.code === 'permission-denied') {
            alert("Permission denied: You do not have access to create classes.");
        }
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!window.confirm("Delete this class? This does not remove assigned students.")) return;
    try {
        await deleteDoc(doc(db, 'class_groups', id));
    } catch (e: any) {
        console.error("Error deleting class", e);
        if (e.code === 'permission-denied') {
            alert("Permission denied: You do not have access to delete classes.");
        }
    }
  };

  const handleAddDivision = async (classId: string) => {
    if (!newDivisionName.trim()) return;
    const classGroup = classes.find(c => c.id === classId);
    if (!classGroup) return;

    const updatedDivisions = [...(classGroup.divisions || []), newDivisionName.trim()];
    try {
        await updateDoc(doc(db, 'class_groups', classId), { divisions: updatedDivisions });
        setNewDivisionName('');
        setSelectedClassForDiv(null);
    } catch (e) {
        console.error("Error adding division", e);
    }
  };

  const handleDeleteDivision = async (classId: string, divName: string) => {
    const classGroup = classes.find(c => c.id === classId);
    if (!classGroup) return;
    const updatedDivisions = classGroup.divisions.filter(d => d !== divName);
    try {
        await updateDoc(doc(db, 'class_groups', classId), { divisions: updatedDivisions });
    } catch (e) {
        console.error("Error removing division", e);
    }
  };

  const filteredStudents = students.filter(student => {
    const online = isUserOnline(student.lastLogin);
    const matchesSearch = (student.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (student.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || (student.role || 'student') === roleFilter;
    
    let matchesStatus = true;
    if (statusFilter === 'online') matchesStatus = online && student.status !== 'suspended';
    if (statusFilter === 'banned') matchesStatus = student.status === 'suspended';

    // Class & Division Filtering
    const matchesClass = classFilter === 'all' || student.assignedClass === classFilter;
    const matchesDivision = divisionFilter === 'all' || student.assignedDivision === divisionFilter;

    return matchesSearch && matchesRole && matchesStatus && matchesClass && matchesDivision;
  });

  return (
    <div>
      <ConfirmModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        message="Are you sure you want to delete this user? This will remove their profile and access immediately."
        isDestructive={true}
      />

      {/* Class Manager Modal */}
      <AnimatePresence>
        {isClassManagerOpen && !classPermissionError && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => setIsClassManagerOpen(false)}
                />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden flex flex-col max-h-[80vh]"
                >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Layers className="text-blue-500" /> Manage Structure
                        </h3>
                        <button onClick={() => setIsClassManagerOpen(false)}><X size={24} className="text-slate-400" /></button>
                    </div>
                    <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                        <div className="flex gap-2 mb-6">
                            <input 
                                type="text" 
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                                placeholder="New Class Name (e.g. Grade 10)"
                                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none text-sm font-bold"
                            />
                            <button onClick={handleAddClass} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl"><Plus size={20} /></button>
                        </div>

                        <div className="space-y-4">
                            {classes.map(cls => (
                                <div key={cls.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                    <div className="p-3 bg-slate-100 dark:bg-slate-800 flex justify-between items-center">
                                        <span className="font-bold text-slate-700 dark:text-slate-200">{cls.name}</span>
                                        <button onClick={() => handleDeleteClass(cls.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                    </div>
                                    <div className="p-3">
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {cls.divisions?.map(div => (
                                                <span key={div} className="px-2 py-1 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1">
                                                    {div}
                                                    <button onClick={() => handleDeleteDivision(cls.id, div)} className="hover:text-red-500"><X size={12}/></button>
                                                </span>
                                            ))}
                                            {cls.divisions?.length === 0 && <span className="text-xs text-slate-400 italic">No divisions</span>}
                                        </div>
                                        {selectedClassForDiv === cls.id ? (
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    value={newDivisionName}
                                                    onChange={(e) => setNewDivisionName(e.target.value)}
                                                    placeholder="Div Name (e.g. A)"
                                                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none"
                                                    autoFocus
                                                />
                                                <button onClick={() => handleAddDivision(cls.id)} className="bg-emerald-500 text-white px-2 rounded-lg text-xs font-bold">Add</button>
                                                <button onClick={() => setSelectedClassForDiv(null)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setSelectedClassForDiv(cls.id)} className="text-xs font-bold text-blue-500 hover:underline">+ Add Division</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {classes.length === 0 && <p className="text-center text-slate-400 text-sm">No classes created yet.</p>}
                        </div>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* View Performance Modal */}
      <AnimatePresence>
        {viewingStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setViewingStudent(null)}
            />
            <motion.div 
               initial={{ opacity: 0, scale: 0.95, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 20 }}
               className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 overflow-hidden flex flex-col max-h-[85vh]"
            >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                   <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                      <BarChart2 className="text-blue-500" />
                      Performance History
                   </h3>
                   <p className="text-sm text-slate-500 mt-1">{viewingStudent.displayName} ({viewingStudent.email})</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {resultsLoading ? (
                        <div className="text-center py-10 text-slate-400">Loading history...</div>
                    ) : studentResults.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                            <p className="text-slate-400 font-bold">No exams taken yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {studentResults.map(result => (
                                <div key={result.id} className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-200">{result.examTitle}</h4>
                                        <p className="text-xs text-slate-400 mt-1">
                                            {new Date(result.submittedAt instanceof Timestamp ? result.submittedAt.toDate() : result.submittedAt).toLocaleDateString()} 
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-lg font-black ${result.score/result.totalMarks >= 0.5 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {Math.round((result.score/result.totalMarks)*100)}%
                                        </div>
                                        <p className="text-xs text-slate-400">{result.score}/{result.totalMarks} pts</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                    <button 
                        onClick={() => setViewingStudent(null)}
                        className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {managingStudent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setManagingStudent(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {/* Header */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col items-center">
                 <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center mb-4 overflow-hidden border-4 border-white dark:border-slate-600 shadow-lg">
                    {managingStudent.photoURL ? (
                      <img src={managingStudent.photoURL} alt={managingStudent.displayName || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-slate-300" />
                    )}
                 </div>
                 <h3 className="text-xl font-bold text-slate-900 dark:text-white">{editForm.displayName || 'Unknown User'}</h3>
                 <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">{managingStudent.email}</p>
                 <div className="flex gap-2 mt-2">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${editForm.role === 'admin' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {editForm.role}
                    </span>
                 </div>
              </div>

              {/* Edit Form */}
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Full Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                value={editForm.displayName}
                                onChange={(e) => setEditForm({...editForm, displayName: e.target.value})}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white text-sm font-bold"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="tel"
                                value={editForm.phoneNumber}
                                onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                                placeholder="+1 234..."
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white text-sm font-bold"
                            />
                        </div>
                    </div>
                </div>

                {/* Class Assignment */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Class</label>
                        <select 
                            value={editForm.assignedClass}
                            onChange={(e) => setEditForm({...editForm, assignedClass: e.target.value, assignedDivision: ''})}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white text-sm font-bold appearance-none"
                        >
                            <option value="">Not Assigned</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Division</label>
                        <select 
                            value={editForm.assignedDivision}
                            onChange={(e) => setEditForm({...editForm, assignedDivision: e.target.value})}
                            disabled={!editForm.assignedClass}
                            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white text-sm font-bold appearance-none disabled:opacity-50"
                        >
                            <option value="">None</option>
                            {classes.find(c => c.name === editForm.assignedClass)?.divisions.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">System Role</label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <select
                                value={editForm.role}
                                onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-900 dark:text-white text-sm font-bold appearance-none cursor-pointer capitalize"
                            >
                                <option value="student">Student (Standard Access)</option>
                                <option value="instructor">Instructor (Create Exams)</option>
                                <option value="admin">Administrator (Full Access)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Account Status (Ban/Unban)</label>
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setEditForm({...editForm, status: 'active'})}
                            className={`flex items-center justify-center p-3 rounded-xl border-2 font-bold text-sm transition-all ${editForm.status === 'active' ? 'bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-900/20 dark:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                        >
                            <Check size={18} className="mr-2" /> Active
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditForm({...editForm, status: 'suspended'})}
                            className={`flex items-center justify-center p-3 rounded-xl border-2 font-bold text-sm transition-all ${editForm.status === 'suspended' ? 'bg-red-50 border-red-500 text-red-600 dark:bg-red-900/20 dark:border-red-500' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'}`}
                        >
                            <Power size={18} className="mr-2" /> Suspended
                        </button>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 p-3 rounded-xl flex items-start gap-3">
                    <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
                        <strong>Note:</strong> Suspended users cannot log in. Administrators have full access to settings and user management.
                    </p>
                </div>

                <div className="flex gap-3 pt-2">
                   <button 
                     onClick={() => setManagingStudent(null)}
                     className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleUpdateProfile}
                     disabled={updating}
                     className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20 flex items-center justify-center gap-2"
                   >
                     {updating ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white">User Management</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage profiles, roles, and access permissions.</p>
        </div>
        
        <div className="flex flex-col xl:flex-row gap-2 w-full xl:w-auto">
            <button 
                onClick={() => !classPermissionError && setIsClassManagerOpen(true)}
                disabled={classPermissionError}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl font-bold text-sm text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-center gap-2 shrink-0 ${classPermissionError ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                title={classPermissionError ? "Database permissions missing for 'class_groups'. Check Firebase Console." : "Manage Classes"}
            >
                {classPermissionError ? <ShieldAlert size={16} className="text-amber-500"/> : <Layers size={16} />} 
                {classPermissionError ? "Classes Locked" : "Manage Classes"}
            </button>

            <div className="relative flex-1 xl:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search users..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-medium w-full"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
                {/* Role Filter */}
                <div className="relative flex-1 min-w-[120px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select 
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-medium appearance-none cursor-pointer capitalize"
                    >
                        <option value="all">All Roles</option>
                        <option value="student">Student</option>
                        <option value="instructor">Instructor</option>
                        <option value="admin">Admin</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Status Filter */}
                <div className="relative flex-1 min-w-[120px]">
                    <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-medium appearance-none cursor-pointer capitalize"
                    >
                        <option value="all">All Status</option>
                        <option value="online">Online</option>
                        <option value="banned">Banned</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Class Filter */}
                <div className="relative flex-1 min-w-[120px]">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select 
                        value={classFilter}
                        onChange={(e) => { setClassFilter(e.target.value); setDivisionFilter('all'); }}
                        className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-medium appearance-none cursor-pointer"
                    >
                        <option value="all">All Classes</option>
                        {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Division Filter */}
                <div className="relative flex-1 min-w-[100px]">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select 
                        value={divisionFilter}
                        onChange={(e) => setDivisionFilter(e.target.value)}
                        disabled={classFilter === 'all'}
                        className="w-full pl-10 pr-8 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-200 text-sm font-medium appearance-none cursor-pointer disabled:opacity-50"
                    >
                        <option value="all">All Divs</option>
                        {classes.find(c => c.name === classFilter)?.divisions.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400">Loading users...</div>
        ) : filteredStudents.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                <User size={48} className="mx-auto mb-4 opacity-20" />
                <p>No users found matching your criteria.</p>
            </div>
        ) : (
            filteredStudents.map(user => {
                const online = isUserOnline(user.lastLogin);
                const lastSeenDate = user.lastLogin ? (user.lastLogin instanceof Timestamp ? user.lastLogin.toDate() : new Date(user.lastLogin)) : null;

                return (
                <motion.div 
                    key={user.uid}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all relative group ${user.status === 'suspended' ? 'border-red-200 dark:border-red-900/50 opacity-75' : 'border-slate-200 dark:border-slate-800'}`}
                >
                    <div className="absolute top-4 right-4 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => setViewingStudent(user)}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="View Performance"
                        >
                            <BarChart2 size={16} />
                        </button>
                        <button 
                            onClick={() => openManageModal(user)}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title="Edit Profile & Role"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => setDeleteId(user.uid)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Delete User"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>

                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative">
                            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 border-2 border-slate-100 dark:border-slate-700">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                                ) : (
                                    <User size={24} className="text-slate-400" />
                                )}
                                {user.status === 'suspended' && (
                                    <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center backdrop-blur-[1px]">
                                        <XOctagon size={20} className="text-red-600" />
                                    </div>
                                )}
                            </div>
                            {/* Online Indicator */}
                            <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center ${online && user.status !== 'suspended' ? 'bg-emerald-500' : 'bg-slate-400'}`} title={online ? "Online" : "Offline"}>
                                {online && user.status !== 'suspended' && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
                            </div>
                        </div>
                        
                        <div className="min-w-0 pr-8">
                            <h3 className="font-bold text-slate-900 dark:text-white truncate">{user.displayName || 'Unknown User'}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                                    user.role === 'admin' 
                                    ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900' 
                                    : user.role === 'instructor'
                                    ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900'
                                    : 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900'
                                }`}>
                                    {user.role || 'student'}
                                </span>
                                {user.assignedClass && (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                        {user.assignedClass} {user.assignedDivision ? `- ${user.assignedDivision}` : ''}
                                    </span>
                                )}
                                {user.status === 'suspended' && (
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-red-100 text-red-700 border-red-200">
                                        Banned
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 text-sm border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div className="flex items-center text-slate-500 dark:text-slate-400">
                            <Mail size={14} className="mr-2.5 shrink-0" />
                            <span className="truncate">{user.email}</span>
                        </div>
                        <div className="flex items-center text-slate-500 dark:text-slate-400">
                            {online && user.status !== 'suspended' ? (
                                <>
                                    <Wifi size={14} className="mr-2.5 text-emerald-500 shrink-0" />
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs">Active Now</span>
                                </>
                            ) : (
                                <>
                                    <Clock size={14} className="mr-2.5 shrink-0" />
                                    <span className="truncate text-xs">Seen {lastSeenDate ? lastSeenDate.toLocaleDateString() + ' ' + lastSeenDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'N/A'}</span>
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>
            )})
        )}
      </div>
    </div>
  );
};

export default StudentList;
