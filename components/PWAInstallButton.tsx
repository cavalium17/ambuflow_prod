import React, { useState } from 'react';
import { usePWAInstall } from '../src/hooks/usePWAInstall';
import { Download, Share, CheckCircle2, X } from 'lucide-react';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  className = '',
  variant = 'compact'
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // If already installed in standalone mode, don't display unless requested
  if (isInstalled) {
    return (
      <div className={`flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl ${className}`}>
        <CheckCircle2 size={14} />
        <span>Application installée (Mode autonome)</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (outcome) {
        setInstallSuccess(true);
        setTimeout(() => setInstallSuccess(false), 3000);
      }
    } else if (isIOS) {
      setShowIOSModal(true);
    } else {
      // Fallback for browsers that don't trigger beforeinstallprompt directly
      setShowIOSModal(true);
    }
  };

  return (
    <>
      <button
        id="pwa-install-btn"
        onClick={handleInstallClick}
        className={`flex items-center justify-center gap-2 font-black uppercase tracking-wider transition-all active:scale-95 ${
          variant === 'full' 
            ? 'w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 text-xs' 
            : 'px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[11px]'
        } ${className}`}
        title="Installer l'application pour une utilisation hors-ligne"
      >
        <Download size={15} className="shrink-0" />
        <span>Installer l'application (Hors-ligne)</span>
      </button>

      {showIOSModal && (
        <div 
          id="pwa-install-instructions-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowIOSModal(false)}
        >
          <div 
            id="pwa-install-instructions-modal"
            className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-6 text-white shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <Download size={20} />
                <h3 className="font-black text-sm uppercase tracking-wider">Installation Hors-Ligne</h3>
              </div>
              <button 
                id="close-pwa-instructions-btn"
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Pour faire fonctionner l'application <strong>100% hors-ligne</strong> et même lorsque votre téléphone est redémarré ou éteint, ajoutez-la à votre écran d'accueil :
            </p>

            <div className="space-y-3 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-xs">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] shrink-0">1</span>
                <span>Appuyez sur le bouton <strong>Partager</strong> <Share size={13} className="inline mx-1 text-indigo-400" /> dans votre navigateur Safari ou Chrome.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] shrink-0">2</span>
                <span>Sélectionnez l'option <strong>« Sur l'écran d'accueil »</strong>.</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-[10px] shrink-0">3</span>
                <span>Confirmez en cliquant sur <strong>Ajouter</strong>. L'application est prête à fonctionner hors-ligne !</span>
              </div>
            </div>

            <button
              id="close-instructions-confirm"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};
