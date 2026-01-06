
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { HelpRequest } from '../types';
import { 
  MessageSquare, Trash2, CheckCircle2, Circle, Clock, Mail, 
  Search, Filter, Reply, CheckSquare, Square, MoreHorizontal, X, Star, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from './ConfirmModal';

const SupportInbox = () => {
  const [tickets, setTickets] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<HelpRequest | null>(null);
  
  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Single Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'open' | 'resolved' | 'all'>('open');

  // Internal Notes State
  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    const q = collection(db, 'help_requests');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HelpRequest));
      // Sort: Newest first
      fetched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTickets(fetched);
      setLoading(false);
    }, (error) => {
      console.warn("Error fetching tickets:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync note text when ticket selection changes
  useEffect(() => {
    if (selectedTicket) {
      setNoteText(selectedTicket.adminNotes || '');
    }
  }, [selectedTicket]);

  // --- Filtering ---
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
        // Safe access to properties to prevent "Cannot read properties of undefined (reading 'toLowerCase')"
        const subject = t.subject || '';
        const studentName = t.studentName || '';
        const email = t.email || '';
        const searchLower = searchTerm.toLowerCase();

        const matchesSearch = 
            subject.toLowerCase().includes(searchLower) || 
            studentName.toLowerCase().includes(searchLower) ||
            email.toLowerCase().includes(searchLower);
        
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;

        return matchesSearch && matchesStatus;
    });
  }, [tickets, searchTerm, statusFilter]);

  // --- Bulk Selection Handlers ---
  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTickets.length && filteredTickets.length > 0) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(filteredTickets.map(t => t.id)));
    }
  };

  // --- Actions ---
  const handleStatusToggle = async (ticket: HelpRequest) => {
    const newStatus = ticket.status === 'open' ? 'resolved' : 'open';
    try {
        await updateDoc(doc(db, 'help_requests', ticket.id), { status: newStatus });
        if(selectedTicket?.id === ticket.id) {
            setSelectedTicket({...ticket, status: newStatus});
        }
    } catch (e) {
        console.error("Error updating status", e);
    }
  };

  const handleStarToggle = async (ticket: HelpRequest, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
        await updateDoc(doc(db, 'help_requests', ticket.id), { isStarred: !ticket.isStarred });
        if(selectedTicket?.id === ticket.id) {
            setSelectedTicket({...ticket, isStarred: !ticket.isStarred});
        }
    } catch (e) {
        console.error("Error updating star", e);
    }
  };

  const saveAdminNote = async () => {
    if (!selectedTicket) return;
    setIsSavingNote(true);
    try {
        await updateDoc(doc(db, 'help_requests', selectedTicket.id), { adminNotes: noteText });
        // Update local state is handled by onSnapshot listener automatically
    } catch (e) {
        console.error("Error saving notes", e);
    } finally {
        setIsSavingNote(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
        await deleteDoc(doc(db, 'help_requests', deleteId));
        setDeleteId(null);
        if (selectedTicket?.id === deleteId) setSelectedTicket(null);
        // Remove from selection if it exists
        if (selectedIds.has(deleteId)) {
            const next = new Set(selectedIds);
            next.delete(deleteId);
            setSelectedIds(next);
        }
    } catch (e) {
        console.error("Error deleting ticket", e);
    }
  };

  const handleBulkResolve = async () => {
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
        const ref = doc(db, 'help_requests', id);
        batch.update(ref, { status: 'resolved' });
    });
    try {
        await batch.commit();
        setSelectedIds(new Set());
        // Update selected view if affected
        if (selectedTicket && selectedIds.has(selectedTicket.id)) {
            setSelectedTicket({...selectedTicket, status: 'resolved'});
        }
    } catch (e) {
        console.error("Bulk resolve failed", e);
    }
  };

  const handleBulkDelete = async () => {
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
        const ref = doc(db, 'help_requests', id);
        batch.delete(ref);
    });
    try {
        await batch.commit();
        if (selectedTicket && selectedIds.has(selectedTicket.id)) setSelectedTicket(null);
        setSelectedIds(new Set());
        setIsBulkDeleting(false);
    } catch (e) {
        console.error("Bulk delete failed", e);
    }
  };

  const handleReply = (ticket: HelpRequest) => {
    const subject = encodeURIComponent(`Re: ${ticket.subject}`);
    const body = encodeURIComponent(`\n\n\n--- Original Message ---\nFrom: ${ticket.studentName}\nSent: ${new Date(ticket.createdAt).toLocaleString()}\n\n${ticket.message}`);
    window.location.href = `mailto:${ticket.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
      <ConfirmModal 
         isOpen={!!deleteId}
         onClose={() => setDeleteId(null)}
         onConfirm={handleDelete}
         title="Delete Ticket"
         message="Are you sure? This cannot be undone."
         isDestructive={true}
      />
      
      <ConfirmModal 
         isOpen={isBulkDeleting}
         onClose={() => setIsBulkDeleting(false)}
         onConfirm={handleBulkDelete}
         title={`Delete ${selectedIds.size} Tickets`}
         message="Are you sure you want to delete these tickets? This action cannot be undone."
         isDestructive={true}
      />

      <div className="flex flex-col md:flex-row gap-6 h-full">
        {/* Ticket List Column */}
        <div className="w-full md:w-1/3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden h-full shadow-sm">
            
            {/* Header: Search & Filter OR Bulk Actions */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 min-h-[140px] flex flex-col gap-3">
                {selectedIds.size > 0 ? (
                    <div className="flex flex-col gap-3 h-full justify-center animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-md">{selectedIds.size}</span> Selected
                            </h3>
                            <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">Cancel</button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-auto">
                             <button onClick={handleBulkResolve} className="flex items-center justify-center gap-2 py-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl font-bold text-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                                <CheckCircle2 size={16} /> Resolve
                             </button>
                             <button onClick={() => setIsBulkDeleting(true)} className="flex items-center justify-center gap-2 py-2.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-xl font-bold text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                                <Trash2 size={16} /> Delete
                             </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center">
                            <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 text-lg">
                                <MessageSquare size={20} className="text-blue-500" /> Inbox
                            </h3>
                            <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Select All">
                                <CheckSquare size={18} />
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search tickets..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="flex gap-2">
                            {['open', 'resolved', 'all'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status as any)}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg capitalize transition-colors ${
                                        statusFilter === status 
                                        ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' 
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* List Items */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                {loading ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Syncing tickets...</div>
                ) : filteredTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center p-6 text-slate-400">
                        <Filter size={32} className="mb-2 opacity-20" />
                        <p className="text-sm font-medium">No tickets found.</p>
                    </div>
                ) : (
                    filteredTickets.map(ticket => (
                        <div 
                            key={ticket.id}
                            onClick={() => setSelectedTicket(ticket)}
                            className={`p-4 rounded-xl cursor-pointer border transition-all relative group ${
                                selectedTicket?.id === ticket.id 
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 shadow-sm' 
                                : 'bg-white dark:bg-slate-900 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 border-b-slate-50 dark:border-b-slate-800'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1.5 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div onClick={(e) => toggleSelect(ticket.id, e)} className="text-slate-300 hover:text-slate-500 cursor-pointer shrink-0">
                                        {selectedIds.has(ticket.id) ? (
                                            <CheckSquare size={18} className="text-blue-500" />
                                        ) : (
                                            <Square size={18} />
                                        )}
                                    </div>
                                    <span className={`text-xs font-bold truncate ${selectedTicket?.id === ticket.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500'}`}>{ticket.studentName}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                   <button onClick={(e) => handleStarToggle(ticket, e)} className={`transition-colors ${ticket.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-amber-400'}`}>
                                      <Star size={14} />
                                   </button>
                                   <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                      {new Date(ticket.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                   </span>
                                </div>
                            </div>
                            
                            <div className="pl-7">
                                <h4 className={`text-sm font-bold truncate mb-1 ${selectedTicket?.id === ticket.id ? 'text-blue-900 dark:text-blue-100' : 'text-slate-800 dark:text-slate-200'}`}>
                                    {ticket.subject}
                                </h4>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed max-w-[80%]">
                                        {ticket.message}
                                    </p>
                                    {ticket.status === 'resolved' ? (
                                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                    ) : (
                                        <Circle size={14} className="text-blue-500 fill-blue-500/20 shrink-0" />
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Detail View Column */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative shadow-sm">
            {selectedTicket ? (
                <>
                    {/* Detail Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10 flex flex-col sm:flex-row justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${
                                    selectedTicket.status === 'open' 
                                    ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900' 
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900'
                                }`}>
                                    {selectedTicket.status}
                                </span>
                                <span className="text-xs text-slate-400 flex items-center">
                                    <Clock size={12} className="mr-1" /> 
                                    {new Date(selectedTicket.createdAt).toLocaleString()}
                                </span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight break-words flex items-center gap-2">
                                {selectedTicket.subject}
                                {selectedTicket.isStarred && <Star size={20} className="text-amber-400 fill-amber-400 shrink-0" />}
                            </h2>
                        </div>

                        <div className="flex gap-2 shrink-0">
                            <button
                                onClick={() => handleStarToggle(selectedTicket)}
                                className={`p-2 rounded-xl transition-colors ${selectedTicket.isStarred ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-500'}`}
                                title={selectedTicket.isStarred ? "Remove Priority" : "Mark as Priority"}
                            >
                                <Star size={20} className={selectedTicket.isStarred ? "fill-current" : ""} />
                            </button>
                            <button 
                                onClick={() => handleStatusToggle(selectedTicket)}
                                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                                title={selectedTicket.status === 'open' ? "Mark as Resolved" : "Reopen Ticket"}
                            >
                                {selectedTicket.status === 'open' ? <CheckCircle2 size={20} /> : <Reply size={20} className="scale-x-[-1]" />}
                            </button>
                            <button 
                                onClick={() => setDeleteId(selectedTicket.id)}
                                className="p-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                                title="Delete Ticket"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Sender Info Banner */}
                    <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                            {selectedTicket.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {selectedTicket.studentName}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">{selectedTicket.email}</p>
                        </div>
                    </div>

                    {/* Message Body */}
                    <div className="p-6 md:p-8 overflow-y-auto flex-1 bg-white dark:bg-slate-900 custom-scrollbar flex flex-col">
                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-sm md:text-base font-medium mb-8">
                            {selectedTicket.message}
                        </p>
                        
                        {/* Admin Notes Section */}
                        <div className="mt-auto bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2 text-yellow-700 dark:text-yellow-500 font-bold text-xs uppercase tracking-wider">
                                <FileText size={14} /> Admin Notes (Internal Only)
                            </div>
                            <textarea 
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-300 outline-none resize-none placeholder-slate-400"
                                placeholder="Add internal comments or tracking info here..."
                                rows={3}
                                onBlur={saveAdminNote}
                            />
                            {isSavingNote && <p className="text-[10px] text-slate-400 mt-1 italic text-right">Saving...</p>}
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
                        <button 
                            onClick={() => handleReply(selectedTicket)}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                            <Mail size={18} /> Reply via Email
                        </button>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <MessageSquare size={32} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">No Ticket Selected</h3>
                    <p className="text-sm text-slate-500 max-w-xs">Select a ticket from the inbox to view details and take action.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SupportInbox;
