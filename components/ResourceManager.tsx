
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Resource, ClassGroup } from '../types';
import { uploadToCloudinary } from '../services/cloudinaryService';
import { Trash2, Link as LinkIcon, FileText, Image, Lock, Unlock, Upload, Download, CloudOff, CheckCircle2, Edit2, X, Eye, Shield, ShieldAlert, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from './ConfirmModal';

const DEFAULT_CATEGORIES = ['General', 'Mathematics', 'Science', 'History', 'Programming'];

const ResourceManager = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  
  // Form State
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isProtected, setIsProtected] = useState(true);
  const [canDownload, setCanDownload] = useState(true);
  const [targetClass, setTargetClass] = useState('');
  const [targetDivision, setTargetDivision] = useState('');

  // Edit State
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'resources'), (snapshot) => {
      const fetchedResources = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource));
      setResources(fetchedResources);
      
      // Extract unique categories from existing resources to populate dropdown
      const existingCategories = Array.from(new Set(fetchedResources.map(r => r.category)));
      const merged = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCategories]));
      setCustomCategories(merged);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching resources", error);
      setLoading(false);
    });

    // Fetch Classes
    const unsubClasses = onSnapshot(collection(db, 'class_groups'), (snapshot) => {
        const fetchedClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassGroup));
        setClasses(fetchedClasses);
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error("Error fetching classes:", error);
        }
    });

    return () => {
        unsubscribe();
        unsubClasses();
    };
  }, []);

  const initiateUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    setShowUploadConfirm(true);
  };

  const handleUpload = async () => {
    if (!file || !title) return;
    setShowUploadConfirm(false);
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      const type = file.type.includes('pdf') ? 'pdf' : 'image';
      
      const finalCategory = isCustomCategory && newCategoryInput.trim() ? newCategoryInput.trim() : category;

      const newResource: Omit<Resource, 'id'> = {
        title,
        type,
        url,
        isProtected,
        category: finalCategory,
        canDownload,
        targetClass: targetClass || '',
        targetDivision: targetDivision || ''
      };

      await addDoc(collection(db, 'resources'), newResource);
      
      // Reset form
      setFile(null);
      setTitle('');
      setCategory('General');
      setNewCategoryInput('');
      setIsCustomCategory(false);
      setIsUploading(false);
      setIsProtected(true); // Reset to default safety
      setTargetClass('');
      setTargetDivision('');
      setCanDownload(true);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload resource. Check your Cloudinary configuration.");
      setIsUploading(false);
    }
  };

  const handleUpdateResource = async () => {
    if (!editingResource) return;
    try {
      await updateDoc(doc(db, 'resources', editingResource.id), {
        title: editingResource.title,
        category: editingResource.category,
        isProtected: editingResource.isProtected,
        canDownload: editingResource.canDownload,
        targetClass: editingResource.targetClass || '',
        targetDivision: editingResource.targetDivision || ''
      });
      setEditingResource(null);
    } catch (error) {
      console.error("Update failed", error);
      alert("Failed to update resource");
    }
  };

  // Quick Toggle for Download Permission
  const handleToggleDownload = async (resource: Resource) => {
    try {
        const newStatus = !resource.canDownload;
        await updateDoc(doc(db, 'resources', resource.id), {
            canDownload: newStatus
        });
    } catch (error) {
        console.error("Error toggling download permission", error);
    }
  };

  // Quick Toggle for Protection Status
  const handleToggleProtection = async (resource: Resource) => {
    try {
        const newStatus = !resource.isProtected;
        await updateDoc(doc(db, 'resources', resource.id), {
            isProtected: newStatus
        });
    } catch (error) {
        console.error("Error toggling protection", error);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'resources', deleteId));
      setDeleteId(null);
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  return (
    <div>
      <ConfirmModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Resource"
        message="Are you sure you want to permanently remove this resource? It will be removed from the student app immediately."
        isDestructive={true}
      />

      <ConfirmModal 
        isOpen={showUploadConfirm}
        onClose={() => setShowUploadConfirm(false)}
        onConfirm={handleUpload}
        title="Confirm Upload"
        message={`You are about to upload "${title}" to the ${isCustomCategory ? newCategoryInput : category} library${targetClass ? ` for ${targetClass}` : ''}. Continue?`}
        confirmText="Upload Now"
        isDestructive={false}
      />

      {/* Edit Modal */}
      <AnimatePresence>
        {editingResource && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setEditingResource(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md relative z-10 p-6 border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Resource</h3>
                <button onClick={() => setEditingResource(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-1">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Title</label>
                  <input 
                    type="text" 
                    value={editingResource.title}
                    onChange={(e) => setEditingResource({...editingResource, title: e.target.value})}
                    className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-900 dark:text-white focus:border-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Category</label>
                  <input 
                    type="text" 
                    value={editingResource.category}
                    onChange={(e) => setEditingResource({...editingResource, category: e.target.value})}
                    className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-900 dark:text-white focus:border-red-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Target Class</label>
                        <select 
                            value={editingResource.targetClass || ''} 
                            onChange={e => setEditingResource({...editingResource, targetClass: e.target.value, targetDivision: ''})} 
                            className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-900 dark:text-white focus:border-red-500 outline-none"
                        >
                            <option value="">All Students</option>
                            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Division</label>
                        <select 
                            value={editingResource.targetDivision || ''} 
                            onChange={e => setEditingResource({...editingResource, targetDivision: e.target.value})} 
                            disabled={!editingResource.targetClass}
                            className="w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-900 dark:text-white focus:border-red-500 outline-none disabled:opacity-50"
                        >
                            <option value="">All Divisions</option>
                            {classes.find(c => c.name === editingResource.targetClass)?.divisions.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div 
                        onClick={() => setEditingResource({...editingResource, isProtected: !editingResource.isProtected})}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${editingResource.isProtected ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800' : 'border-slate-200 dark:border-slate-700'}`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Access</span>
                            {editingResource.isProtected ? <Lock size={16} className="text-orange-500"/> : <Unlock size={16} className="text-slate-400"/>}
                        </div>
                        <p className={`text-sm font-bold ${editingResource.isProtected ? 'text-orange-700 dark:text-orange-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {editingResource.isProtected ? 'Auth Only' : 'Public'}
                        </p>
                    </div>

                    <div 
                        onClick={() => setEditingResource({...editingResource, canDownload: !editingResource.canDownload})}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${editingResource.canDownload ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800' : 'border-slate-200 dark:border-slate-700'}`}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Permissions</span>
                            {editingResource.canDownload ? <Download size={16} className="text-emerald-500"/> : <CloudOff size={16} className="text-slate-400"/>}
                        </div>
                        <p className={`text-sm font-bold ${editingResource.canDownload ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {editingResource.canDownload ? 'Downloadable' : 'View Only'}
                        </p>
                    </div>
                </div>

                <button 
                  onClick={handleUpdateResource}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30 mt-4"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Resource Library</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Centralized repository for PDF notes, textbooks, and media.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
        >
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 lg:sticky lg:top-8 z-10">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
              <Upload size={22} className="mr-3 text-red-500" />
              Upload Assets
            </h3>
            <form onSubmit={initiateUpload} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Title</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-3 focus:border-red-500 outline-none transition-all"
                  required
                  placeholder="e.g. Q4 Calculus Notes"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Library Category</label>
                {isCustomCategory ? (
                   <div className="relative">
                      <input 
                        type="text" 
                        value={newCategoryInput}
                        onChange={(e) => setNewCategoryInput(e.target.value)}
                        className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-3 focus:border-red-500 outline-none transition-all"
                        placeholder="Enter new category name..."
                        autoFocus
                      />
                      <button 
                        type="button"
                        onClick={() => setIsCustomCategory(false)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                   </div>
                ) : (
                  <select 
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === 'custom_plus_option') {
                        setIsCustomCategory(true);
                      } else {
                        setCategory(e.target.value);
                      }
                    }}
                    className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-3 focus:border-red-500 outline-none transition-all appearance-none cursor-pointer"
                  >
                    {customCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="custom_plus_option" className="font-bold text-red-500">+ Create New Category</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Target Class</label>
                    <select 
                        value={targetClass}
                        onChange={(e) => { setTargetClass(e.target.value); setTargetDivision(''); }}
                        className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-3 focus:border-red-500 outline-none transition-all appearance-none cursor-pointer"
                    >
                        <option value="">All Students</option>
                        {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Division</label>
                    <select 
                        value={targetDivision}
                        onChange={(e) => setTargetDivision(e.target.value)}
                        disabled={!targetClass}
                        className="w-full rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white px-4 py-3 focus:border-red-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
                    >
                        <option value="">All Divs</option>
                        {classes.find(c => c.name === targetClass)?.divisions.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Target File</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 dark:border-slate-800 border-dashed rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative group">
                  <div className="space-y-2 text-center">
                    <div className="flex justify-center text-slate-400 group-hover:text-red-500 transition-colors">
                       <FileText size={32} />
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      <label htmlFor="file-upload" className="relative cursor-pointer font-bold text-red-600 hover:text-red-500">
                        <span>Choose file</span>
                        <input 
                          id="file-upload" 
                          name="file-upload" 
                          type="file" 
                          className="sr-only" 
                          onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} 
                          accept="image/*,application/pdf" 
                          required 
                          ref={fileInputRef}
                        />
                      </label>
                      <p className="pl-1 inline">or drag and drop</p>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">
                      {file ? <span className="text-red-500 font-bold">{file.name}</span> : "PDF or Images up to 10MB"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${isProtected ? 'bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-900/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800'}`}>
                  <div className="flex items-center">
                     {isProtected ? <Lock size={18} className="text-orange-500 mr-3" /> : <Unlock size={18} className="text-slate-400 mr-3" />}
                     <div className="flex flex-col">
                        <label htmlFor="protected" className="text-sm font-bold text-slate-800 dark:text-white cursor-pointer">Authenticated Only</label>
                        <span className="text-[10px] text-slate-500">Require student login</span>
                     </div>
                  </div>
                  <input 
                    type="checkbox"
                    id="protected"
                    checked={isProtected}
                    onChange={(e) => setIsProtected(e.target.checked)}
                    className="h-5 w-5 text-red-600 focus:ring-red-500 border-slate-300 rounded-lg cursor-pointer"
                  />
                </div>

                <div className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${canDownload ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/50 dark:border-slate-800'}`}>
                  <div className="flex items-center">
                     {canDownload ? <Download size={18} className="text-emerald-500 mr-3" /> : <CloudOff size={18} className="text-slate-400 mr-3" />}
                     <div className="flex flex-col">
                        <label htmlFor="downloadable" className="text-sm font-bold text-slate-800 dark:text-white cursor-pointer">Allow Downloads</label>
                        <span className="text-[10px] text-slate-500">Enable "Save as..."</span>
                     </div>
                  </div>
                  <input 
                    type="checkbox"
                    id="downloadable"
                    checked={canDownload}
                    onChange={(e) => setCanDownload(e.target.checked)}
                    className="h-5 w-5 text-red-600 focus:ring-red-500 border-slate-300 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={isUploading}
                className="w-full flex justify-center items-center py-4 px-6 border border-transparent rounded-2xl shadow-xl shadow-red-900/10 text-base font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {isUploading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : 'Upload to Library'}
              </button>
            </form>
          </div>
        </motion.div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
               <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest flex items-center">
                 <FileText className="mr-2" size={16} /> Available Resources
               </h3>
               <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-bold">{resources.length} items</span>
            </div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto custom-scrollbar">
              {resources.length === 0 && !loading && (
                <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
                   <CloudOff size={48} className="mb-4 opacity-50" />
                   <p className="font-bold text-sm">No resources found</p>
                   <p className="text-xs mt-1">Upload a file to get started</p>
                </div>
              )}
              
              {loading && resources.length === 0 && (
                <div className="p-12 text-center text-slate-400 font-bold text-sm animate-pulse">Loading library...</div>
              )}

              <AnimatePresence>
                {resources.map((resource) => (
                  <motion.div 
                    key={resource.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group flex flex-col sm:flex-row gap-4 items-start sm:items-center"
                  >
                     <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                        {resource.type === 'pdf' ? <FileText className="text-red-500" size={24} /> : <Image className="text-blue-500" size={24} />}
                     </div>
                     
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-1">
                           <h4 className="font-bold text-slate-800 dark:text-white truncate text-sm sm:text-base mr-2">{resource.title}</h4>
                           <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">{resource.category}</span>
                           {resource.targetClass && (
                               <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wide bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center">
                                   <Users size={10} className="mr-1"/> {resource.targetClass} {resource.targetDivision ? ` - ${resource.targetDivision}` : ''}
                               </span>
                           )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                           <button 
                             onClick={() => handleToggleProtection(resource)}
                             className={`flex items-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded px-1.5 py-0.5 transition-colors ${resource.isProtected ? 'text-orange-500' : 'text-emerald-500'}`}
                             title="Toggle Authentication Requirement"
                           >
                             {resource.isProtected ? <Lock size={12} className="mr-1" /> : <Unlock size={12} className="mr-1" />}
                             {resource.isProtected ? 'Protected' : 'Public'}
                           </button>
                           
                           <button 
                             onClick={() => handleToggleDownload(resource)}
                             className={`flex items-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded px-1.5 py-0.5 transition-colors ${resource.canDownload ? 'text-emerald-500' : 'text-red-500'}`}
                             title="Toggle Download Permission"
                           >
                             {resource.canDownload ? <Download size={12} className="mr-1" /> : <CloudOff size={12} className="mr-1" />}
                             {resource.canDownload ? 'Downloadable' : 'View Only'}
                           </button>
                        </div>
                     </div>

                     <div className="flex items-center gap-1 self-end sm:self-center">
                        <a 
                          href={resource.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Preview File"
                        >
                           <Eye size={18} />
                        </a>

                        <button 
                          onClick={() => setEditingResource(resource)}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit Details"
                        >
                           <Edit2 size={18} />
                        </button>

                        <button 
                          onClick={() => setDeleteId(resource.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                           <Trash2 size={18} />
                        </button>
                     </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceManager;
