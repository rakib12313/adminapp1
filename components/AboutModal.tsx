
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Save, Edit2, Github, Globe, Linkedin, User, Twitter } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadToCloudinary } from '../services/cloudinaryService';

interface Socials {
  github?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
}

interface Profile {
  name: string;
  role: string;
  image: string;
  bio?: string;
  socials: Socials;
}

interface CreditsData {
  creator: Profile;
  developer: Profile;
}

const defaultSocials: Socials = {
  github: '',
  linkedin: '',
  twitter: '',
  website: ''
};

const defaultProfile: Profile = {
  name: 'Not Set',
  role: 'Role Name',
  image: '',
  bio: '',
  socials: { ...defaultSocials }
};

const AboutModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [data, setData] = useState<CreditsData>({
    creator: { ...defaultProfile, role: 'Founder & CEO' },
    developer: { ...defaultProfile, role: 'Lead Developer' }
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<keyof CreditsData | null>(null);
  const [expandedKey, setExpandedKey] = useState<keyof CreditsData | null>(null); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadKey = useRef<keyof CreditsData | null>(null);

  useEffect(() => {
    if (isOpen) fetchCredits();
  }, [isOpen]);

  const fetchCredits = async () => {
    try {
      // Attempt to load from local storage first for speed
      const local = localStorage.getItem('settings_credits');
      if (local) setData(JSON.parse(local));

      // Path: settings/credits
      const docRef = doc(db, 'settings', 'credits');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const raw = snap.data();
        
        // Helper to normalize data structure
        const normalizeProfile = (p: any): Profile => ({
            name: p?.name || 'Not Set',
            role: p?.role || 'Role Name',
            image: p?.image || '',
            bio: p?.bio || '',
            socials: {
                github: p?.socials?.github || p?.github || '',
                linkedin: p?.socials?.linkedin || p?.linkedin || '',
                twitter: p?.socials?.twitter || p?.twitter || '',
                website: p?.socials?.website || p?.website || ''
            }
        });

        const remoteData: CreditsData = {
            creator: normalizeProfile(raw.creator),
            developer: normalizeProfile(raw.developer)
        };

        setData(remoteData);
        // Update local cache
        localStorage.setItem('settings_credits', JSON.stringify(remoteData));
      } 
    } catch (error: any) {
      if (error?.code !== 'permission-denied' && !error?.message?.includes('Missing or insufficient permissions')) {
         console.error("Error fetching credits", error);
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    
    // 1. Always save to local storage (Optimistic / Fallback)
    localStorage.setItem('settings_credits', JSON.stringify(data));

    try {
      // 2. Try Cloud Save
      await setDoc(doc(db, 'settings', 'credits'), data);
      setIsEditing(false);
      setExpandedKey(null);
    } catch (error: any) {
      const isPermissionError = error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions');

      if (isPermissionError) {
        console.warn("Firestore write permission denied. Saved to local storage only.");
        alert("Settings saved locally! (Cloud sync unavailable due to permissions)");
        setIsEditing(false);
        setExpandedKey(null);
      } else {
        console.error("Error saving credits", error);
        alert("Failed to save to cloud: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (key: keyof CreditsData) => {
    if (!isEditing) return;
    activeUploadKey.current = key;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const key = activeUploadKey.current;
    if (!file || !key) return;

    setUploadingKey(key);
    try {
      const url = await uploadToCloudinary(file);
      setData(prev => ({
        ...prev,
        [key]: { ...prev[key], image: url }
      }));
    } catch (error) {
      console.error("Upload failed", error);
      alert("Image upload failed");
    } finally {
      setUploadingKey(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateField = (key: keyof CreditsData, field: string, value: string) => {
    setData(prev => {
        const isSocial = ['github', 'linkedin', 'website', 'twitter'].includes(field);
        if (isSocial) {
            return {
                ...prev,
                [key]: {
                    ...prev[key],
                    socials: {
                        ...prev[key].socials,
                        [field]: value
                    }
                }
            };
        }
        return {
            ...prev,
            [key]: { ...prev[key], [field]: value }
        };
    });
  };

  if (!isOpen) return null;

  const renderCard = (key: keyof CreditsData, defaultRole: string) => {
    const profile = data[key];
    const isExpanded = expandedKey === key || isEditing; 

    return (
      <div className={`bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center relative transition-all duration-300 ${isEditing ? 'ring-1 ring-slate-200 dark:ring-slate-700' : ''}`}>
        
        <div 
          onClick={() => handleImageClick(key)}
          className={`w-24 h-24 rounded-full mb-4 overflow-hidden border-4 border-white dark:border-slate-600 shadow-lg relative shrink-0 ${isEditing ? 'cursor-pointer hover:opacity-80' : ''}`}
        >
          {uploadingKey === key ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
               <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            </div>
          ) : profile.image ? (
            <img src={profile.image} alt={profile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
              <User size={32} />
            </div>
          )}
          {isEditing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white" size={24} />
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="w-full space-y-3">
            <div>
              <input 
                value={profile.role}
                onChange={(e) => updateField(key, 'role', e.target.value)}
                className="w-full text-center text-xs font-bold text-red-500 uppercase tracking-wider bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-red-500 outline-none pb-1 transition-colors"
                placeholder={defaultRole}
              />
              <input 
                value={profile.name}
                onChange={(e) => updateField(key, 'name', e.target.value)}
                className="w-full text-center text-lg font-black text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-red-500 outline-none pb-1 transition-colors"
                placeholder="Name"
              />
            </div>
            
            <AnimatePresence>
              {isExpanded && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 pt-2 text-left w-full overflow-hidden"
                >
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Bio</label>
                    <textarea 
                      value={profile.bio || ''}
                      onChange={(e) => updateField(key, 'bio', e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 rounded-lg p-2 text-xs border border-slate-200 dark:border-slate-600 focus:border-red-500 outline-none resize-none"
                      rows={2}
                      placeholder="Short bio..."
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg px-2 border border-slate-200 dark:border-slate-600">
                      <Github size={12} className="text-slate-400 shrink-0" />
                      <input 
                        value={profile.socials.github || ''}
                        onChange={(e) => updateField(key, 'github', e.target.value)}
                        className="w-full bg-transparent p-2 text-xs outline-none text-slate-700 dark:text-slate-300"
                        placeholder="GitHub URL"
                      />
                    </div>
                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg px-2 border border-slate-200 dark:border-slate-600">
                      <Linkedin size={12} className="text-slate-400 shrink-0" />
                      <input 
                        value={profile.socials.linkedin || ''}
                        onChange={(e) => updateField(key, 'linkedin', e.target.value)}
                        className="w-full bg-transparent p-2 text-xs outline-none text-slate-700 dark:text-slate-300"
                        placeholder="LinkedIn URL"
                      />
                    </div>
                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg px-2 border border-slate-200 dark:border-slate-600">
                      <Twitter size={12} className="text-slate-400 shrink-0" />
                      <input 
                        value={profile.socials.twitter || ''}
                        onChange={(e) => updateField(key, 'twitter', e.target.value)}
                        className="w-full bg-transparent p-2 text-xs outline-none text-slate-700 dark:text-slate-300"
                        placeholder="Twitter URL"
                      />
                    </div>
                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg px-2 border border-slate-200 dark:border-slate-600">
                      <Globe size={12} className="text-slate-400 shrink-0" />
                      <input 
                        value={profile.socials.website || ''}
                        onChange={(e) => updateField(key, 'website', e.target.value)}
                        className="w-full bg-transparent p-2 text-xs outline-none text-slate-700 dark:text-slate-300"
                        placeholder="Website URL"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">{profile.role}</p>
            <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">{profile.name}</h4>
            
            {profile.bio && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-3 px-2 italic leading-relaxed">
                "{profile.bio}"
              </p>
            )}
            
            <div className="flex justify-center gap-3 mt-auto pt-2 flex-wrap px-2">
               {profile.socials.github && (
                 <a href={profile.socials.github} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-all">
                   <Github size={18} />
                 </a>
               )}
               {profile.socials.linkedin && (
                 <a href={profile.socials.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all">
                   <Linkedin size={18} />
                 </a>
               )}
               {profile.socials.twitter && (
                 <a href={profile.socials.twitter} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-all">
                   <Twitter size={18} />
                 </a>
               )}
               {profile.socials.website && (
                 <a href={profile.socials.website} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all">
                   <Globe size={18} />
                 </a>
               )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-5xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-20 shrink-0">
             <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">App Credits</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">The team behind this platform.</p>
             </div>
             <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors font-bold flex items-center gap-2 text-sm"
                  >
                    <Edit2 size={16} /> Edit Info
                  </button>
                ) : (
                  <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="p-2 bg-red-600 rounded-xl text-white hover:bg-red-700 transition-colors font-bold flex items-center gap-2 text-sm shadow-lg shadow-red-500/20"
                  >
                    {loading ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                  </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                  <X size={24} />
                </button>
             </div>
          </div>

          {/* Body */}
          <div className="p-8 overflow-y-auto bg-white dark:bg-slate-900 custom-scrollbar">
             <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-4xl mx-auto">
                {renderCard('creator', 'Creator')}
                {renderCard('developer', 'Lead Developer')}
             </div>

             <div className="mt-12 text-center pb-4">
                <div className="inline-flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium italic">
                    "Empowering education through technology."
                  </p>
                </div>
                
                <p className="mt-8 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                   v2.5.0 • LMS Admin Portal • Connected to Student App
                </p>
             </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AboutModal;
