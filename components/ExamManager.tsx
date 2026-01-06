
import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Exam, Question, QuestionType, ClassGroup } from '../types';
import { 
  Plus, Trash2, Clock, BookOpen, 
  Save, ChevronLeft, Settings, 
  GripVertical, List, Eye,
  ListChecks, Binary, Type, Globe, MinusCircle, HelpCircle,
  AlignJustify, Terminal, Check, Layers, Database, UploadCloud, Copy, LayoutList, Shuffle, AlertTriangle, Users
} from 'lucide-react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import ConfirmModal from './ConfirmModal';

// --- Smart Formatting Logic ---
const formatScientificText = (text: string): string => {
  if (!text) return '';
  
  const toSub = (num: string) => num.split('').map(d => "₀₁₂₃₄₅₆₇₈₉"[parseInt(d)]).join('');
  const toSup = (num: string) => num.split('').map(d => "⁰¹²³⁴⁵⁶⁷⁸⁹"[parseInt(d)]).join('');

  let newText = text;
  newText = newText.replace(/\^(\d+)/g, (_, num) => toSup(num));
  newText = newText.replace(/_(\d+)/g, (_, num) => toSub(num));
  newText = newText.replace(/([₀-₉])(\d+)/g, (_, prev, num) => prev + toSub(num));
  newText = newText.replace(/([⁰-⁹])(\d+)/g, (_, prev, num) => prev + toSup(num));
  newText = newText.replace(/([A-Z][a-z]?)(\d+)/g, (_, el, num) => el + toSub(num));
  newText = newText.replace(/\b([a-z])(\d+)/g, (_, char, num) => char + toSup(num));

  return newText;
};

// --- Helper for Unique IDs ---
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

// --- Helper for Date Inputs ---
const toDatetimeLocal = (isoString: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset() * 60000;
  const localIso = new Date(date.getTime() - offset).toISOString().slice(0, 16);
  return localIso;
};

// --- Smart Parsing Logic ---
const smartParseJSON = (json: any): { questions: Question[], meta: Partial<Exam>, error?: string } => {
  let potentialArray: any[] = [];
  let meta: Partial<Exam> = {};
  const errors: string[] = [];

  try {
    if (Array.isArray(json)) {
      potentialArray = json;
    } else if (typeof json === 'object' && json !== null) {
      const root = json.exam || json;
      if (root.title) meta.title = String(root.title);
      if (root.description) meta.description = String(root.description);
      if (root.durationMinutes || root.duration) meta.durationMinutes = Number(root.durationMinutes || root.duration);
      if (root.difficulty) meta.difficulty = root.difficulty;
      if (root.totalMarks) meta.totalMarks = Number(root.totalMarks);
      if (root.maxAttempts !== undefined) meta.maxAttempts = Number(root.maxAttempts);
      if (root.shuffleQuestions !== undefined) meta.shuffleQuestions = Boolean(root.shuffleQuestions);
      if (root.negativeMarking !== undefined) meta.negativeMarking = Number(root.negativeMarking);
      if (root.targetClass !== undefined) meta.targetClass = String(root.targetClass);
      if (root.targetDivision !== undefined) meta.targetDivision = String(root.targetDivision);

      if (root.questions && Array.isArray(root.questions)) {
        potentialArray = root.questions;
      } else if (root.data && Array.isArray(root.data)) {
        potentialArray = root.data;
      } else {
        const keys = Object.keys(root);
        for (const key of keys) {
          if (Array.isArray(root[key]) && root[key].length > 0 && typeof root[key][0] === 'object') {
             potentialArray = root[key];
             break;
          }
        }
      }
    }

    if (!potentialArray || !Array.isArray(potentialArray)) {
      return { questions: [], meta: {}, error: "Structure Error: JSON must be an array or contain a 'questions' array." };
    }

    const questions: Question[] = potentialArray.map((item, index) => {
      if (typeof item !== 'object' || item === null) return null as any;

      const textKey = Object.keys(item).find(k => ['text', 'question', 'prompt'].some(s => k.toLowerCase().includes(s))) || '';
      const text = item[textKey] ? String(item[textKey]) : '';
      
      let type: QuestionType = 'multiple-choice';
      if (item.type && item.type.toLowerCase().includes('short')) type = 'short-answer';
      else if (item.type && (item.type.toLowerCase().includes('true') || item.type === 'tf')) type = 'true-false';

      const optionsKey = Object.keys(item).find(k => ['options', 'choices', 'answers'].some(s => k.toLowerCase().includes(s))) || '';
      let options = Array.isArray(item[optionsKey]) ? item[optionsKey].map(String) : [];
      
      if (type === 'multiple-choice' && options.length < 2) options = ['', '', '', ''];
      if (type === 'true-false') options = ['True', 'False'];

      const correctKey = Object.keys(item).find(k => ['correct', 'answer'].some(s => k.toLowerCase().includes(s))) || '';
      let correctAnswer = typeof item[correctKey] === 'number' ? item[correctKey] : 0;
      let correctAnswerText = type === 'short-answer' ? String(item[correctKey] || '') : '';

      return {
        id: generateId(),
        text: formatScientificText(text), 
        type,
        options: options.map(o => formatScientificText(o)), 
        correctAnswer,
        correctAnswerText: formatScientificText(correctAnswerText)
      };
    }).filter(Boolean);

    return { questions, meta };
  } catch (e) {
    return { questions: [], meta: {}, error: "Malformed JSON." };
  }
};

interface QuestionItemProps {
  q: Question;
  idx: number;
  isSelected: boolean;
  onClick: () => void;
  onPreview: (e: React.MouseEvent) => void;
  getIcon: (t: QuestionType) => any;
}

const QuestionItem: React.FC<QuestionItemProps> = ({ q, idx, isSelected, onClick, onPreview, getIcon }) => {
  const controls = useDragControls();
  
  if (!q) return null; // Safeguard against deleted items rendering

  return (
    <Reorder.Item 
      value={q}
      dragListener={false}
      dragControls={controls}
      onClick={onClick}
      className={`p-4 md:p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 group relative touch-manipulation ${
         isSelected 
         ? 'bg-red-50 dark:bg-red-900/10 border-red-500 dark:border-red-500 shadow-md shadow-red-100 dark:shadow-none' 
         : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
      }`}
    >
       <div onPointerDown={(e) => controls.start(e)} className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-2 -ml-2 touch-none">
          <GripVertical size={20} />
       </div>
       <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${isSelected ? 'bg-white dark:bg-slate-900 text-red-500 border-red-200 dark:border-red-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 border-slate-200 dark:border-slate-600'}`}>
          {getIcon(q.type)}
       </div>
       <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold truncate ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
             {q.text || 'Untitled Question'}
          </p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">
             Question {idx + 1} • {q.type === 'short-answer' ? 'Short Answer' : `${q.options.length} Options`}
          </p>
       </div>
       <button onClick={onPreview} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors -mr-1 touch-manipulation" title="Preview">
         <Eye size={18} />
       </button>
    </Reorder.Item>
  );
};

// --- Sub-Components for Tabs ---

const SettingsTab = ({ exam, setExam, isScheduled, setIsScheduled, classes }: any) => {
  const handleScheduleToggle = () => {
    const nextState = !isScheduled;
    setIsScheduled(nextState);
    if (nextState && !exam.scheduledDate) {
        setExam((prev: any) => ({...prev, scheduledDate: new Date().toISOString()}));
    }
  };

  const handleNumInput = (field: string, val: string) => {
    const num = parseInt(val);
    // If empty or NaN, default to 0 to prevent controlled input errors, but typically we want empty string support if allowed.
    // Here we force to 0 if NaN to maintain number type safety.
    setExam((prev: any) => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
          <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center"><Type className="mr-2 text-red-500" /> Basic Info</h3>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Exam Title</label>
            <input type="text" value={exam.title} onChange={e => setExam((prev: any) => ({ ...prev, title: formatScientificText(e.target.value) }))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:border-red-500 transition-all text-base" placeholder="e.g. Mid-Term Physics" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</label>
            <textarea value={exam.description} onChange={e => setExam((prev: any) => ({ ...prev, description: e.target.value }))} className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-red-500 transition-all min-h-[120px] text-base" placeholder="Instructions for students..." />
          </div>
      </div>
      
      <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center"><Settings className="mr-2 text-blue-500" /> Parameters</h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Duration (Min)</label>
                    <input 
                        type="number" 
                        value={exam.durationMinutes || ''} 
                        onChange={e => handleNumInput('durationMinutes', e.target.value)} 
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-3 font-bold outline-none text-base" 
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Total Marks</label>
                    <input 
                        type="number" 
                        value={exam.totalMarks || ''} 
                        onChange={e => handleNumInput('totalMarks', e.target.value)} 
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-3 font-bold outline-none text-base" 
                    />
                </div>
                <div><label className="text-xs font-bold text-slate-400 uppercase">Difficulty</label><select value={exam.difficulty} onChange={e => setExam((prev: any) => ({ ...prev, difficulty: e.target.value as any }))} className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-3 font-bold outline-none text-base"><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Attempts</label>
                    <input 
                        type="number" 
                        value={exam.maxAttempts === 0 ? '' : exam.maxAttempts} 
                        placeholder="∞" 
                        onChange={e => handleNumInput('maxAttempts', e.target.value)} 
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-3 font-bold outline-none text-base" 
                    />
                </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
               {/* Shuffle Toggle */}
               <div className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${exam.shuffleQuestions ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-100 dark:border-slate-800'}`} onClick={() => setExam((prev:any) => ({...prev, shuffleQuestions: !prev.shuffleQuestions}))}>
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Order</span>
                      <Shuffle size={14} className={exam.shuffleQuestions ? 'text-purple-600' : 'text-slate-400'} />
                   </div>
                   <p className={`text-sm font-bold ${exam.shuffleQuestions ? 'text-purple-700 dark:text-purple-300' : 'text-slate-600 dark:text-slate-400'}`}>
                      {exam.shuffleQuestions ? 'Randomized' : 'Fixed'}
                   </p>
               </div>

               {/* Negative Marking */}
               <div className="p-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Negative Mark</span>
                      <AlertTriangle size={14} className="text-orange-500" />
                   </div>
                   <input 
                      type="number" 
                      step="0.25"
                      min="0"
                      value={exam.negativeMarking || 0}
                      onChange={e => {
                          const val = parseFloat(e.target.value);
                          setExam((prev: any) => ({ ...prev, negativeMarking: isNaN(val) ? 0 : val }));
                      }}
                      className="w-full bg-transparent font-bold text-sm outline-none text-slate-800 dark:text-white"
                      placeholder="0.0"
                   />
               </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
             <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center"><Users className="mr-2 text-indigo-500" /> Audience Target</h3>
             <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Target Class</label>
                    <select 
                        value={exam.targetClass || ''} 
                        onChange={e => setExam((prev: any) => ({ ...prev, targetClass: e.target.value, targetDivision: '' }))} 
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-3 font-bold outline-none text-base"
                    >
                        <option value="">All Students</option>
                        {classes.map((c: ClassGroup) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase">Target Division</label>
                    <select 
                        value={exam.targetDivision || ''} 
                        onChange={e => setExam((prev: any) => ({ ...prev, targetDivision: e.target.value }))} 
                        disabled={!exam.targetClass}
                        className="w-full mt-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-3 font-bold outline-none text-base disabled:opacity-50"
                    >
                        <option value="">All Divisions</option>
                        {classes.find((c: ClassGroup) => c.name === exam.targetClass)?.divisions.map((d: string) => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
             </div>
          </div>
          
          <div className={`p-6 rounded-2xl border transition-all ${exam.isPublished ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center"><Globe className="mr-2" /> Publish Status</h3>
                <div onClick={() => setExam((prev: any) => ({...prev, isPublished: !prev.isPublished}))} className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors flex ${exam.isPublished ? 'bg-emerald-500 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'}`}><motion.div layout className="bg-white w-5 h-5 rounded-full shadow-md" /></div>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Schedule Release</span>
                <button onClick={handleScheduleToggle} className={`text-xs font-bold px-3 py-2 rounded-lg ${isScheduled ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>{isScheduled ? 'ON' : 'OFF'}</button>
            </div>
            {isScheduled && <input type="datetime-local" value={toDatetimeLocal(exam.scheduledDate || '')} onChange={e => setExam((prev: any) => ({ ...prev, scheduledDate: new Date(e.target.value).toISOString() }))} className="w-full mt-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-3 text-sm font-bold outline-none text-base" />}
          </div>
      </div>
    </div>
  );
};

const BuilderTab = ({ exam, setExam, selectedIndex, setSelectedIndex, getIcon, onDelete }: any) => {
  const editorRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    const newQ: Question = {
      id: generateId(), 
      type: 'multiple-choice', 
      text: '', 
      options: ['', '', '', ''], 
      correctAnswer: 0
    };
    setExam((prev: any) => {
      const qs = [...(prev.questions || []), newQ];
      setSelectedIndex(qs.length - 1);
      return { ...prev, questions: qs };
    });
    // Small timeout to allow render before scrolling
    setTimeout(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const updateQuestion = (idx: number, field: string, val: any) => {
    setExam((prev: any) => {
      const qs = [...prev.questions];
      qs[idx] = { ...qs[idx], [field]: field === 'text' || field === 'correctAnswerText' ? formatScientificText(val) : val };
      return { ...prev, questions: qs };
    });
  };

  const changeType = (idx: number, type: QuestionType) => {
    setExam((prev: any) => {
      const qs = [...prev.questions];
      const q = { ...qs[idx], type };
      if (type === 'true-false') { q.options = ['True', 'False']; q.correctAnswer = 0; }
      else if (type === 'short-answer') { q.options = []; q.correctAnswerText = ''; }
      else if (type === 'multiple-choice') { q.options = ['', '', '', '']; q.correctAnswer = 0; }
      qs[idx] = q;
      return { ...prev, questions: qs };
    });
  };

  const updateOption = (qIdx: number, oIdx: number, val: string) => {
    setExam((prev: any) => {
      const qs = [...prev.questions];
      const opts = [...qs[qIdx].options];
      opts[oIdx] = formatScientificText(val);
      qs[qIdx] = { ...qs[qIdx], options: opts };
      return { ...prev, questions: qs };
    });
  };

  const addOption = (idx: number) => {
    setExam((prev: any) => {
      const qs = [...prev.questions];
      qs[idx] = { ...qs[idx], options: [...qs[idx].options, ''] };
      return { ...prev, questions: qs };
    });
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    setExam((prev: any) => {
      const qs = [...prev.questions];
      const opts = [...qs[qIdx].options];
      opts.splice(oIdx, 1);
      qs[qIdx] = { ...qs[qIdx], options: opts, correctAnswer: qs[qIdx].correctAnswer >= opts.length ? 0 : qs[qIdx].correctAnswer };
      return { ...prev, questions: qs };
    });
  };

  const cloneQuestion = (idx: number) => {
    setExam((prev: any) => {
        const q = prev.questions[idx];
        const newQ = { ...q, id: generateId(), text: q.text + ' (Copy)' };
        const qs = [...prev.questions];
        qs.splice(idx + 1, 0, newQ);
        setSelectedIndex(idx + 1);
        return { ...prev, questions: qs };
    });
  };

  const activeQ = exam.questions?.[selectedIndex];

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 h-auto lg:h-[calc(100vh-14rem)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-4 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden h-[400px] lg:h-full shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center shrink-0">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Questions ({exam.questions?.length || 0})</span>
            <button onClick={handleAdd} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"><Plus size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            <Reorder.Group axis="y" values={exam.questions || []} onReorder={(newOrder) => {
                const selectedId = exam.questions?.[selectedIndex]?.id;
                setExam((prev: any) => ({ ...prev, questions: newOrder }));
                if (selectedId) {
                    const newIdx = newOrder.findIndex((q: Question) => q.id === selectedId);
                    if (newIdx !== -1) setSelectedIndex(newIdx);
                }
            }}>
                {(exam.questions || []).map((q: Question, idx: number) => (
                  <QuestionItem key={q.id} q={q} idx={idx} isSelected={selectedIndex === idx} onClick={() => setSelectedIndex(idx)} onPreview={(e) => { e.stopPropagation(); /* preview logic */ }} getIcon={getIcon} />
                ))}
            </Reorder.Group>
          </div>
      </div>

      <div ref={editorRef} className="lg:col-span-8 h-auto min-h-[500px] lg:h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative shadow-sm">
          {activeQ ? (
            <>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                      <span className="h-8 w-8 bg-red-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">Q{selectedIndex + 1}</span>
                      <select value={activeQ.type} onChange={(e) => changeType(selectedIndex, e.target.value as QuestionType)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-2 text-xs font-bold outline-none cursor-pointer">
                        <option value="multiple-choice">Multiple Choice</option>
                        <option value="true-false">True / False</option>
                        <option value="short-answer">Short Answer</option>
                      </select>
                  </div>
                  <div className="flex gap-1">
                      <button onClick={() => cloneQuestion(selectedIndex)} className="p-2 text-slate-400 hover:text-blue-500"><Copy size={18} /></button>
                      <button onClick={() => onDelete(selectedIndex)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  <div className="mb-6">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Statement</label>
                        <HelpCircle size={14} className="text-slate-400 cursor-help" />
                      </div>
                      <textarea 
                        key={`q-text-${selectedIndex}`}
                        value={activeQ.text} 
                        onChange={e => updateQuestion(selectedIndex, 'text', e.target.value)} 
                        className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-xl p-4 text-lg font-medium outline-none focus:border-red-500 transition-all min-h-[100px]" 
                        placeholder="Type your question..." 
                      />
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">{activeQ.type === 'short-answer' ? 'Correct Answer Key' : 'Options'}</label>
                      {activeQ.type === 'short-answer' ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <input type="text" value={activeQ.correctAnswerText || ''} onChange={e => updateQuestion(selectedIndex, 'correctAnswerText', e.target.value)} className="w-full bg-transparent font-bold text-lg outline-none text-base" placeholder="Exact answer..." />
                        </div>
                      ) : (
                        <div className="space-y-3">
                            {activeQ.options.map((opt, oIndex) => (
                              <div key={oIndex} className={`flex items-center p-3 rounded-xl border-2 transition-all group ${activeQ.correctAnswer === oIndex ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-100 dark:border-slate-800'}`}>
                                  <div onClick={() => updateQuestion(selectedIndex, 'correctAnswer', oIndex)} className={`w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center cursor-pointer shrink-0 ${activeQ.correctAnswer === oIndex ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
                                    {activeQ.correctAnswer === oIndex && <Check size={14} strokeWidth={4} />}
                                  </div>
                                  <input type="text" value={opt} onChange={e => updateOption(selectedIndex, oIndex, e.target.value)} className="flex-1 bg-transparent outline-none font-medium min-w-0 text-base" placeholder={`Option ${oIndex + 1}`} />
                                  {activeQ.options.length > 2 && <button onClick={() => removeOption(selectedIndex, oIndex)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500"><MinusCircle size={18} /></button>}
                              </div>
                            ))}
                            {activeQ.type === 'multiple-choice' && (
                              <button onClick={() => addOption(selectedIndex)} className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-blue-500 hover:border-blue-300 transition-all flex items-center justify-center uppercase">+ Add Option</button>
                            )}
                        </div>
                      )}
                  </div>
                </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                <LayoutList size={48} className="mb-4 opacity-50" />
                <p className="font-bold">Select or add a question</p>
            </div>
          )}
      </div>
    </div>
  );
};

const DataTab = ({ exam, setExam }: any) => {
  const [jsonCode, setJsonCode] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Generate JSON on mount/update
    const exportData = {
        title: exam.title,
        description: exam.description,
        difficulty: exam.difficulty,
        durationMinutes: exam.durationMinutes,
        maxAttempts: exam.maxAttempts,
        shuffleQuestions: exam.shuffleQuestions,
        negativeMarking: exam.negativeMarking,
        targetClass: exam.targetClass,
        targetDivision: exam.targetDivision,
        questions: exam.questions?.map(({ text, type, options, correctAnswer, correctAnswerText }: Question) => ({
          text, type, options, correctAnswer, correctAnswerText
        }))
    };
    setJsonCode(JSON.stringify(exportData, null, 2));
  }, [exam]);

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonCode);
      const { questions, meta, error } = smartParseJSON(parsed);
      if (error) { setJsonError(error); return; }
      setExam((prev: any) => ({ ...prev, ...meta, questions: questions.length > 0 ? questions : prev.questions }));
      setJsonError(null);
      alert("JSON applied successfully!");
    } catch (e: any) {
      setJsonError("Invalid JSON syntax: " + e.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const json = JSON.parse(raw);
        const { questions, meta, error } = smartParseJSON(json);
        if (error) { alert(error); return; }
        if (questions.length > 0) {
             setExam((prev: any) => ({ ...prev, ...meta, questions: [...(prev.questions || []), ...questions] }));
             alert(`Imported ${questions.length} questions.`);
        } else { alert("No questions found."); }
      } catch (err) { alert("Invalid JSON file"); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-700">
            <h3 className="text-white font-mono font-bold flex items-center"><Terminal className="mr-2 text-emerald-400" /> JSON Editor</h3>
            <div className="flex gap-2">
                <button onClick={() => { try { const p = JSON.parse(jsonCode); setJsonCode(JSON.stringify(p, null, 2)); } catch(e) { alert("Invalid JSON"); } }} className="p-1.5 bg-slate-800 rounded text-slate-400 hover:text-white" title="Format"><AlignJustify size={16}/></button>
                <button onClick={handleApplyJson} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700">Apply to Exam</button>
            </div>
          </div>
          <textarea value={jsonCode} onChange={e => {setJsonCode(e.target.value); setJsonError(null);}} className="flex-1 bg-transparent font-mono text-xs text-emerald-400 outline-none resize-none custom-scrollbar" placeholder="// Paste exam JSON here..." spellCheck={false} />
          {jsonError && <div className="mt-4 p-3 bg-red-900/30 border border-red-900/50 text-red-400 text-xs font-mono rounded-lg">{jsonError}</div>}
      </div>
      
      <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center h-[240px]">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <UploadCloud size={32} className="text-slate-400" />
            </div>
            <h4 className="font-bold text-lg text-slate-800 dark:text-white">Import File</h4>
            <p className="text-slate-500 text-sm mb-6 mt-1">Upload a .json file containing questions</p>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-opacity">Select File</button>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-900 h-[235px]">
            <h4 className="font-bold text-blue-700 dark:text-blue-400 mb-2 flex items-center"><HelpCircle size={18} className="mr-2"/> JSON Format Guide</h4>
            <pre className="text-[10px] text-blue-800 dark:text-blue-300 font-mono bg-white/50 dark:bg-black/20 p-3 rounded-lg overflow-auto h-[160px]">{`{ "title": "Math Exam", "shuffleQuestions": true, "questions": [ { "text": "2+2?", "type": "multiple-choice", "options": ["3", "4", "5"], "correctAnswer": 1 } ] }`}</pre>
          </div>
      </div>
    </div>
  );
}

// --- Main Component ---

const ExamManager = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]); // New: for dropdowns
  const [isEditing, setIsEditing] = useState(false);
  const [editorTab, setEditorTab] = useState<'settings' | 'builder' | 'data'>('settings');
  const [currentExam, setCurrentExam] = useState<Partial<Exam>>({
    title: '', description: '', durationMinutes: 60, difficulty: 'Medium', totalMarks: 100, questions: [], isPublished: false, scheduledDate: '', maxAttempts: 1, shuffleQuestions: false, negativeMarking: 0, targetClass: '', targetDivision: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number>(0);
  const [isScheduled, setIsScheduled] = useState(false);
  const [questionToDeleteIndex, setQuestionToDeleteIndex] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    // Fetch Exams
    const unsubExams = onSnapshot(collection(db, 'exams'), (snapshot) => {
      const fetchedExams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setExams(fetchedExams);
      setLoading(false);
    }, (error) => { console.error("Error fetching exams", error); setLoading(false); });

    // Fetch Classes for settings dropdown
    const unsubClasses = onSnapshot(collection(db, 'class_groups'), (snapshot) => {
      const fetchedClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassGroup));
      setClasses(fetchedClasses);
    }, (error) => {
      // Suppress permission errors for this dropdown as it's optional
      if (error.code !== 'permission-denied') {
        console.error("Error fetching classes:", error);
      }
    });

    return () => {
        unsubExams();
        unsubClasses();
    };
  }, []);

  const handleSaveExam = async () => {
    setShowSaveConfirm(false);
    setLoading(true);
    try {
      const examData = {
        ...currentExam,
        questionCount: currentExam.questions ? currentExam.questions.length : 0,
        scheduledDate: isScheduled && currentExam.scheduledDate ? currentExam.scheduledDate : null,
        maxAttempts: currentExam.maxAttempts !== undefined ? currentExam.maxAttempts : 1,
        shuffleQuestions: !!currentExam.shuffleQuestions,
        negativeMarking: currentExam.negativeMarking || 0,
        targetClass: currentExam.targetClass || '',
        targetDivision: currentExam.targetDivision || ''
      };
      if (currentExam.id) { await updateDoc(doc(db, 'exams', currentExam.id), examData); } 
      else { await addDoc(collection(db, 'exams'), examData); }
      setIsEditing(false);
      resetCurrentExam();
    } catch (error) { alert("Failed to save exam"); } finally { setLoading(false); }
  };

  const resetCurrentExam = () => {
    setCurrentExam({ title: '', description: '', durationMinutes: 60, difficulty: 'Medium', totalMarks: 100, questions: [], isPublished: false, scheduledDate: '', maxAttempts: 1, shuffleQuestions: false, negativeMarking: 0, targetClass: '', targetDivision: '' });
    setEditorTab('settings');
    setSelectedQuestionIndex(0);
    setIsScheduled(false);
  };

  const handleEditClick = (exam: Exam) => {
    setCurrentExam(exam);
    setIsScheduled(!!exam.scheduledDate);
    setIsEditing(true);
    setEditorTab('settings');
    if(exam.questions && exam.questions.length > 0) { setSelectedQuestionIndex(0); }
  };

  const deleteQuestion = () => {
    if (questionToDeleteIndex !== null) {
        setCurrentExam(prev => {
            const newQs = [...(prev.questions || [])];
            newQs.splice(questionToDeleteIndex, 1);
            return { ...prev, questions: newQs };
        });
        if (selectedQuestionIndex >= questionToDeleteIndex && selectedQuestionIndex > 0) {
            setSelectedQuestionIndex(prev => prev - 1);
        }
        setQuestionToDeleteIndex(null);
    }
  };

  const getQuestionTypeIcon = (type: QuestionType) => {
    switch(type) {
      case 'multiple-choice': return <ListChecks size={16} className="text-blue-500" />;
      case 'true-false': return <Binary size={16} className="text-emerald-500" />;
      case 'short-answer': return <Type size={16} className="text-orange-500" />;
      default: return <List size={16} />;
    }
  };

  if (isEditing) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-7xl mx-auto pb-24 md:pb-20">
        <ConfirmModal isOpen={showSaveConfirm} onClose={() => setShowSaveConfirm(false)} onConfirm={handleSaveExam} title="Save Changes?" message={`You are about to save "${currentExam.title}".`} confirmText="Confirm Save" isDestructive={false} />
        <ConfirmModal isOpen={questionToDeleteIndex !== null} onClose={() => setQuestionToDeleteIndex(null)} onConfirm={deleteQuestion} title="Delete Question" message="Remove this question?" isDestructive={true} />
        
        {/* Editor Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-300">
          <div className="flex items-center space-x-4">
             <button onClick={() => { setIsEditing(false); resetCurrentExam(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500"><ChevronLeft size={24} /></button>
             <div>
                <h2 className="text-lg md:text-xl font-bold text-slate-800 dark:text-white">{currentExam.id ? 'Edit Exam' : 'Create Exam'}</h2>
                <p className="text-xs text-slate-500">{editorTab === 'settings' ? 'Configure details' : editorTab === 'builder' ? 'Design questions' : 'Manage raw data'}</p>
             </div>
          </div>
          
          <div className="flex overflow-x-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 no-scrollbar">
             <button onClick={() => setEditorTab('settings')} className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${editorTab === 'settings' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                <Settings size={16} /> <span className="inline">Settings</span>
             </button>
             <button onClick={() => setEditorTab('builder')} className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${editorTab === 'builder' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                <Layers size={16} /> <span className="inline">Questions</span>
             </button>
             <button onClick={() => setEditorTab('data')} className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${editorTab === 'data' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                <Database size={16} /> <span className="inline">Data / JSON</span>
             </button>
          </div>

          <button onClick={() => setShowSaveConfirm(true)} disabled={loading || !currentExam.title} className="px-6 py-2.5 text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all font-bold flex items-center space-x-2 shrink-0 justify-center min-h-[44px]">
             <Save size={18} /> <span>Save</span>
          </button>
        </div>

        {editorTab === 'settings' && (
           <SettingsTab exam={currentExam} setExam={setCurrentExam} isScheduled={isScheduled} setIsScheduled={setIsScheduled} classes={classes} />
        )}

        {editorTab === 'builder' && (
           <BuilderTab 
              exam={currentExam} 
              setExam={setCurrentExam} 
              selectedIndex={selectedQuestionIndex} 
              setSelectedIndex={setSelectedQuestionIndex}
              getIcon={getQuestionTypeIcon}
              onDelete={setQuestionToDeleteIndex}
           />
        )}

        {editorTab === 'data' && (
           <DataTab exam={currentExam} setExam={setCurrentExam} />
        )}
      </motion.div>
    );
  }

  return (
    <div>
      <ConfirmModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={async () => { if(deleteId) { await deleteDoc(doc(db, 'exams', deleteId)); setDeleteId(null); }}} title="Delete Exam" message="Permanently remove this exam?" isDestructive={true} />
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-8">
        <div><h2 className="text-3xl font-bold text-slate-800 dark:text-white">Exam Manager</h2><p className="text-slate-500 mt-1">Create and manage assessments.</p></div>
        <button onClick={() => { resetCurrentExam(); setIsEditing(true); }} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 flex items-center justify-center shadow-xl shadow-red-500/20 w-full md:w-auto min-h-[48px]"><Plus size={20} className="mr-2"/> New Exam</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {exams.map((exam) => (
           <motion.div key={exam.id} layout initial={{opacity:0}} animate={{opacity:1}} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group relative cursor-pointer" onClick={() => handleEditClick(exam)}>
              <div className="flex justify-between mb-4">
                 <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${exam.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{exam.isPublished ? 'Published' : 'Draft'}</span>
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => {e.stopPropagation(); setDeleteId(exam.id)}} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded"><Trash2 size={16}/></button>
                 </div>
              </div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{exam.title}</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                 {exam.targetClass && (
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold border border-blue-100 dark:border-blue-900">
                        {exam.targetClass} {exam.targetDivision ? `- ${exam.targetDivision}` : ''}
                    </span>
                 )}
              </div>
              <div className="flex gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
                 <span className="flex items-center"><Clock size={14} className="mr-1"/> {exam.durationMinutes}m</span>
                 <span className="flex items-center"><BookOpen size={14} className="mr-1"/> {exam.questionCount} Qs</span>
                 {exam.shuffleQuestions && <span className="flex items-center text-purple-500"><Shuffle size={14} className="mr-1"/> Shuffled</span>}
              </div>
           </motion.div>
        ))}
        {exams.length === 0 && !loading && <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">No exams found.</div>}
      </div>
    </div>
  );
};

export default ExamManager;
