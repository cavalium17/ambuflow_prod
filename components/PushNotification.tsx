
import React, { useEffect, useState } from 'react';
import { Bell, Sparkles, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { PushNotification as PushType } from '../types';

interface PushNotificationProps {
  notification: PushType;
  onClose: (id: string) => void;
  onAction?: (action: string) => void;
  darkMode: boolean;
}

const PushNotification: React.FC<PushNotificationProps> = ({ notification, onClose, onAction, darkMode }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(notification.id), 500);
  };

  const icons = {
    info: <Bell className="text-blue-500" size={20} />,
    success: <CheckCircle2 className="text-emerald-500" size={20} />,
    warning: <AlertCircle className="text-amber-500" size={20} />,
  };

  const handleClick = () => {
    if (notification.action && onAction) {
      onAction(notification.action);
      handleClose();
    } else if (notification.url) {
      window.open(notification.url, '_blank');
      handleClose();
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-40px)] max-w-sm pointer-events-auto transition-all duration-500 transform ${
      isExiting ? 'translate-y-[-100px] opacity-0 scale-90' : 'translate-y-0 opacity-100 scale-100'
    } ${notification.url || notification.action ? 'cursor-pointer active:scale-95' : ''}`}>
      <div className={`p-4 rounded-[24px] shadow-2xl border backdrop-blur-2xl flex items-center gap-4 ${
        darkMode 
        ? 'bg-slate-900/90 border-white/10 shadow-black' 
        : 'bg-white/90 border-slate-200/50 shadow-slate-200'
      }`}>
        <div className={`p-2 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
          {icons[notification.type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-black tracking-tight leading-none mb-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            {notification.title}
          </p>
          <p className="text-[11px] font-medium text-slate-500 truncate">
            {notification.message}
          </p>
          {notification.url && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-500/10 px-2 py-1 rounded-lg">Y ALLER</span>
            </div>
          )}
        </div>
        <button onClick={handleClose} className="p-1 opacity-40 hover:opacity-100 transition-opacity">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PushNotification;
