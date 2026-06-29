
import React from 'react';
import { Clock, Calendar, Wallet, User, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../src/firebaseConfig';
import { signOut } from 'firebase/auth';
import { AppTab } from '../types';

interface NavigationProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  darkMode?: boolean;
  isGuest?: boolean;
  setIsGuest?: (val: boolean) => void;
}

const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, darkMode = false, isGuest = false, setIsGuest }) => {
  const tabs = [
    { id: 'home', icon: Clock, label: 'Board' },
    { id: 'planning', icon: Calendar, label: 'Agenda' },
    { id: 'paie', icon: Wallet, label: 'Revenus', disabled: isGuest },
    { id: 'profile', icon: User, label: 'Profil' },
  ];

  const handleLogout = async () => {
    try {
      if (isGuest && setIsGuest) {
        setIsGuest(false);
        localStorage.removeItem('ambuflow_is_guest');
        return;
      }
      await signOut(auth);
      localStorage.removeItem('ambuflow_is_guest');
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-50">
      <nav className={`h-18 transition-all duration-500 rounded-[28px] px-2 flex items-center justify-between border backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${
        darkMode 
          ? 'bg-slate-900/80 border-white/10' 
          : 'bg-white/90 border-slate-200'
      }`}>
        <div className="flex-1 flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDisabled = tab.disabled;
            
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id as AppTab)}
                className={`relative flex flex-col items-center justify-center py-2 px-3 transition-all duration-300 outline-none ${
                  isDisabled
                    ? 'opacity-20 cursor-not-allowed'
                    : (isActive 
                        ? (darkMode ? 'text-white' : 'text-indigo-600') 
                        : (darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'))
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute inset-0 rounded-2xl -z-10 ${
                      darkMode ? 'bg-white/10 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]' : 'bg-indigo-50 shadow-[inset_0_0_20px_rgba(79,70,229,0.05)]'
                    }`}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                <tab.icon 
                  size={22} 
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-transform duration-300 active:scale-90 ${isActive ? 'scale-110' : 'scale-100'}`}
                />
                
                <span className={`text-[8px] mt-1 font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                  isActive ? 'opacity-100' : 'opacity-0 scale-75'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className={`w-px h-8 mx-1 ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`} />

        {/* Logout Action */}
        <button
          onClick={handleLogout}
          className={`flex flex-col items-center justify-center py-2 px-4 transition-all duration-300 outline-none group ${
            isGuest 
              ? 'text-indigo-400 hover:text-indigo-300' 
              : 'text-rose-500 hover:text-rose-400'
          }`}
        >
          <div className={`p-2 rounded-2xl transition-all duration-300 ${
            isGuest 
              ? 'bg-indigo-500/10 group-hover:bg-indigo-500/20' 
              : 'bg-rose-500/10 group-hover:bg-rose-500/20'
          }`}>
            <LogOut 
              size={18} 
              strokeWidth={2.5}
              className="transition-transform duration-300 group-hover:-translate-x-0.5"
            />
          </div>
          <span className="text-[7px] mt-1 font-black uppercase tracking-[0.1em] opacity-40">
            {isGuest ? 'Login' : 'Quitter'}
          </span>
        </button>
      </nav>
    </div>
  );
};

export default Navigation;
