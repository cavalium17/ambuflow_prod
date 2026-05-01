
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, AlertCircle, Info, Trash2, ExternalLink } from 'lucide-react';
import { PushNotification as PushType } from '../types';

interface NotificationHistoryProps {
  notifications: PushType[];
  onClose: () => void;
  onClear: () => void;
  onRead: (id: string | 'all') => void;
  darkMode: boolean;
}

const NotificationHistory: React.FC<NotificationHistoryProps> = ({ 
  notifications, 
  onClose, 
  onClear, 
  onRead,
  darkMode 
}) => {
  const icons = {
    info: <Info className="text-blue-500" size={20} />,
    success: <CheckCircle2 className="text-emerald-500" size={20} />,
    warning: <AlertCircle className="text-amber-500" size={20} />,
  };

  const formatTimestamp = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-end sm:justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        className={`relative w-full max-w-lg rounded-[32px] overflow-hidden flex flex-col shadow-2xl border ${
          darkMode ? 'bg-[#0F1221] border-white/10' : 'bg-white border-slate-200'
        } max-h-[80vh] sm:max-h-[70vh]`}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${darkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
              <Bell className="text-indigo-500" size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className={`text-xl font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>Notifications</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${darkMode ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  {notifications.length}
                </span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Flux d'activité</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-3 rounded-2xl transition-colors ${darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-100'}`}
          >
            <X size={24} className={darkMode ? 'text-slate-400' : 'text-slate-600'} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {notifications.length > 0 ? (
              notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((notif) => (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`group relative p-5 rounded-[24px] border transition-all ${
                    notif.read 
                      ? (darkMode ? 'bg-white/5 border-transparent opacity-60' : 'bg-slate-50 border-transparent opacity-60')
                      : (darkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100')
                  }`}
                >
                  <div className="flex gap-4">
                    <div className={`p-2 h-fit rounded-xl ${darkMode ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                      {icons[notif.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`text-sm font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                          {notif.title}
                        </h4>
                        <span className="text-[9px] font-bold text-slate-500 uppercase">
                          {formatTimestamp(notif.timestamp)}
                        </span>
                      </div>
                      <p className={`text-[12px] leading-relaxed ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {notif.message}
                      </p>
                      {notif.url && (
                        <a 
                          href={notif.url} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-400 transition-colors"
                        >
                          En savoir plus <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                  {!notif.read && (
                    <button 
                      onClick={() => onRead(notif.id)}
                      className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500 text-white rounded-lg shadow-lg"
                      title="Marquer comme lu"
                    >
                      <CheckCircle2 size={12} />
                    </button>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                <Bell size={48} className="text-slate-500 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest text-slate-500">Aucune notification</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-6 border-t border-white/5 bg-slate-900/10 flex gap-4">
            <button
              onClick={() => onRead('all')}
              className={`flex-1 py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                darkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              Tout lire
            </button>
            <button
              onClick={onClear}
              className="p-4 rounded-2xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-lg shadow-rose-500/10"
              title="Tout effacer"
            >
              <Trash2 size={24} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default NotificationHistory;
