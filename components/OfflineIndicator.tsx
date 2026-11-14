import React, { useState } from 'react';
import { useOnlineStatus } from '../src/hooks/useOnlineStatus';
import { WifiOff, ShieldCheck, Info, X } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showDetails, setShowDetails] = useState(false);

  if (isOnline) return null;

  return (
    <>
      <div 
        id="offline-banner"
        onClick={() => setShowDetails(true)}
        className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-500/95 text-slate-950 shadow-xl backdrop-blur-md border border-amber-400 cursor-pointer animate-fadeIn transition-all hover:scale-[1.02] active:scale-95"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-900"></span>
          </span>
          <WifiOff size={16} className="shrink-0 text-slate-950" />
          <div className="text-left min-w-0">
            <p className="text-xs font-black uppercase tracking-wider truncate">
              Mode Hors-Ligne Actif
            </p>
            <p className="text-[10px] font-semibold text-slate-900/80 truncate">
              Pointages & gardes enregistrés localement
            </p>
          </div>
        </div>
        <Info size={14} className="shrink-0 text-slate-950/70" />
      </div>

      {showDetails && (
        <div 
          id="offline-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowDetails(false)}
        >
          <div 
            id="offline-modal-content"
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700/80 p-6 text-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider">Protection Hors-Ligne & Veille</h3>
                  <span className="text-[11px] text-amber-400 font-semibold">100% Autonome</span>
                </div>
              </div>
              <button 
                id="close-offline-modal"
                onClick={() => setShowDetails(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
              <p>
                <strong>Fonctionnement sans connexion :</strong> AmbuFlow stocke l'intégralité de votre planning, pointages, pauses et fiches dans la mémoire locale de votre appareil (IndexedDB et LocalStorage).
              </p>
              <p>
                <strong>Téléphone éteint ou en veille :</strong> Les heures d'embauche et de pause sont horodatées de manière absolue. Si votre téléphone s'éteint ou redémarre, le chronomètre calcule fidèlement votre amplitude exacte dès son rallumage sans perte de données.
              </p>
              <p className="text-[11px] text-slate-400">
                Dès que vous retrouverez une connexion réseau (4G/5G/Wi-Fi), les données synchroniseront automatiquement vos sauvegardes en tâche de fond.
              </p>
            </div>

            <button
              id="confirm-offline-modal"
              onClick={() => setShowDetails(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition active:scale-95"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
