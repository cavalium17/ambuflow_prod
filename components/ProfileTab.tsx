
import React, { useRef, useState, useMemo } from 'react';
import { 
  User, 
  ShieldCheck, 
  Settings, 
  LogOut, 
  Award, 
  Car, 
  Building2, 
  Clock, 
  Zap, 
  Briefcase,
  Trash2,
  Euro,
  Plus,
  Minus,
  Info,
  ChevronRight,
  Check,
  Star,
  FileBadge,
  Moon,
  Sun,
  Target,
  FileText,
  CalendarDays,
  Bell,
  MapPin,
  Calendar,
  Users,
  ShieldAlert,
  RefreshCw,
  Camera,
  Loader2,
  Layers,
  Calendar as CalendarIcon,
  Smartphone
} from 'lucide-react';
import { Shift, ActivityLog, UserStats, UserRole } from '../types';
import { storage, auth } from '../src/firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface ProfileTabProps {
  darkMode: boolean;
  userName: string;
  userEmail?: string | null;
  firstName?: string;
  lastName?: string;
  setUserName: (val: string) => void;
  profileImage: string | null;
  setProfileImage: (val: string | null) => void;
  jobTitle: string;
  setJobTitle: (val: string) => void;
  companyName: string;
  setCompanyName: (val: string) => void;
  companyCity?: string;
  setCompanyCity?: (val: string) => void;
  hourlyRate: string;
  effectiveHourlyRate?: string;
  seniorityInfo?: { years: number; months: number; bonus: number; text: string };
  setHourlyRate?: (val: string) => void;
  setContractStartDate?: (val: string) => void;
  shifts: Shift[];
  logs: ActivityLog[];
  followSystemTheme: boolean;
  setFollowSystemTheme: (val: boolean) => void;
  themeChoice: 'light' | 'dark';
  setThemeChoice: (val: 'light' | 'dark') => void;
  userStats: UserStats;
  onDeleteAccount: () => void;
  onLogout: () => void;
  hasDea?: boolean;
  hasAux?: boolean;
  hasTaxiCard?: boolean;
  contractStartDate?: string;
  workRegime?: string;
  setWorkRegime?: (val: string) => void;
  modulationWeeks?: string;
  setModulationWeeks?: (val: string) => void;
  modulationStartDate?: string;
  setModulationStartDate?: (val: string) => void;
  hoursBase?: string;
  setHoursBase?: (val: string) => void;
  cpCalculationMode?: '25' | '30';
  setCpCalculationMode?: (val: string) => void;
  initialCpBalance: number;
  setInitialCpBalance: (val: number) => void;
  weeklyContractHours: number;
  setWeeklyContractHours: (val: number) => void;
  overtimeMode?: 'weekly' | 'biweekly' | 'modulation' | 'annualized';
  setOvertimeMode?: (val: 'weekly' | 'biweekly' | 'modulation' | 'annualized') => void;
  payRateMode: '100_percent' | '90_percent';
  setPayRateMode: (val: '100_percent' | '90_percent') => void;
  pushEnabled: boolean;
  setPushEnabled: (val: boolean) => void;
  autoGeo: boolean;
  setAutoGeo: (val: boolean) => void;
  roles: UserRole[];
  setRoles: (val: UserRole[]) => void;
  primaryRole: UserRole | '';
  setPrimaryRole: (val: UserRole | '') => void;
  afgsuDate?: string;
  medicalExpiryDate?: string;
  taxiFpcDate?: string;
  taxiCardExpiryDate?: string;
  supplementaryTaskType?: 'none' | 'type_1' | 'type_2' | 'type_3';
  setSupplementaryTaskType?: (val: 'none' | 'type_1' | 'type_2' | 'type_3') => void;
  heureEmbauchePrevue?: string;
  setHeureEmbauchePrevue?: (val: string) => void;
}

export default function ProfileTab({
  darkMode,
  userName,
  userEmail,
  firstName = "",
  lastName = "",
  setUserName,
  profileImage,
  setProfileImage,
  jobTitle,
  setJobTitle,
  companyName,
  setCompanyName,
  companyCity = "",
  setCompanyCity,
  hourlyRate,
  effectiveHourlyRate,
  seniorityInfo,
  setHourlyRate,
  setContractStartDate,
  followSystemTheme,
  setFollowSystemTheme,
  themeChoice,
  setThemeChoice,
  userStats,
  onDeleteAccount,
  onLogout,
  hasDea = false,
  hasAux = false,
  hasTaxiCard = false,
  contractStartDate = "",
  workRegime = "weekly",
  setWorkRegime,
  modulationWeeks = "4",
  setModulationWeeks,
  modulationStartDate = "",
  setModulationStartDate,
  hoursBase = "35",
  setHoursBase,
  cpCalculationMode = "25",
  setCpCalculationMode,
  initialCpBalance,
  setInitialCpBalance,
  weeklyContractHours,
  setWeeklyContractHours,
  overtimeMode,
  setOvertimeMode,
  payRateMode,
  setPayRateMode,
  pushEnabled,
  setPushEnabled,
  autoGeo,
  setAutoGeo,
  roles = [],
  setRoles,
  primaryRole = '',
  setPrimaryRole,
  afgsuDate = "",
  medicalExpiryDate = "",
  taxiFpcDate = "",
  taxiCardExpiryDate = "",
  supplementaryTaskType = 'none',
  setSupplementaryTaskType,
  heureEmbauchePrevue = "06:30",
  setHeureEmbauchePrevue
}: ProfileTabProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showModulationDateModal, setShowModulationDateModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Create a unique filename based on user name and timestamp
      const safeUserName = (userName || 'user').replace(/\s+/g, '_');
      const filename = `profile_images/${safeUserName}_${Date.now()}`;
      const storageRef = ref(storage, filename);
      
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setProfileImage(downloadURL);
      localStorage.setItem('ambuflow_profile_image', downloadURL);
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const bentoCardBase = `relative overflow-hidden transition-all duration-300 rounded-[32px] border backdrop-blur-xl shadow-sm ${
    darkMode 
      ? 'bg-slate-900/60 border-white/5' 
      : 'bg-white/60 border-white/40'
  }`;

  const workRegimeLabels: Record<string, string> = {
    weekly: 'Hebdomadaire',
    fortnightly: 'Quinzaine',
    modulation: 'Modulation',
    annualization: 'Annualisation'
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'N/A';
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) {
      return 'N/A';
    }
  };

  const seniorityText = seniorityInfo?.text || "N/A";
  const seniorityBonus = seniorityInfo?.bonus ? `+${(seniorityInfo.bonus * 100).toFixed(0)}%` : "+0%";

  const complianceItems = React.useMemo(() => {
    const now = new Date();
    const items = [];

    const getStatus = (expiryDate: Date | null) => {
      if (!expiryDate) return 'expired';
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
      if (diffMs <= 0) return 'expired';
      if (diffMonths <= 3) return 'warning';
      return 'ok';
    };

    // AFGSU (4 ans)
    if (afgsuDate) {
      const expiry = new Date(afgsuDate);
      expiry.setFullYear(expiry.getFullYear() + 4);
      items.push({ label: 'AFGSU 2', status: getStatus(expiry), date: expiry });
    } else {
      items.push({ label: 'AFGSU 2', status: 'expired', date: null });
    }

    // Médical (5 ans à partir de la visite)
    if (medicalExpiryDate) {
      const expiry = new Date(medicalExpiryDate);
      expiry.setFullYear(expiry.getFullYear() + 5);
      items.push({ label: 'Aptitude Médicale', status: getStatus(expiry), date: expiry });
    } else {
      items.push({ label: 'Aptitude Médicale', status: 'expired', date: null });
    }

    // Taxi
    if (hasTaxiCard) {
      // FPC (5 ans)
      if (taxiFpcDate) {
        const expiry = new Date(taxiFpcDate);
        expiry.setFullYear(expiry.getFullYear() + 5);
        items.push({ label: 'FPC Taxi', status: getStatus(expiry), date: expiry });
      } else {
        items.push({ label: 'FPC Taxi', status: 'expired', date: null });
      }

      // Carte Pro (Date d'expiration directe)
      if (taxiCardExpiryDate) {
        const expiry = new Date(taxiCardExpiryDate);
        items.push({ label: 'Carte Pro Taxi', status: getStatus(expiry), date: expiry });
      } else {
        items.push({ label: 'Carte Pro Taxi', status: 'expired', date: null });
      }
    }

    // Permis / DEA (Simple check if exists)
    items.push({ label: 'Diplôme d\'État', status: (hasDea || hasAux) ? 'ok' : 'expired', date: null });

    return items;
  }, [afgsuDate, medicalExpiryDate, hasDea, hasAux, hasTaxiCard, taxiFpcDate, taxiCardExpiryDate]);

  const modulationEndDate = useMemo(() => {
    if (!modulationStartDate || !modulationWeeks) return null;
    try {
      const start = new Date(modulationStartDate);
      const weeks = workRegime === 'fortnightly' ? 2 : (parseInt(modulationWeeks) || 4);
      const end = new Date(start);
      end.setDate(start.getDate() + (weeks * 7) - 1);
      return end;
    } catch (e) {
      return null;
    }
  }, [modulationStartDate, modulationWeeks, workRegime]);

  const [isEditingRoles, setIsEditingRoles] = useState(false);

  const toggleRole = (role: UserRole) => {
    const newRoles = roles.includes(role) 
      ? roles.filter(r => r !== role) 
      : [...roles, role];
    
    if (newRoles.length > 0) {
      setRoles(newRoles);
      if (primaryRole && !newRoles.includes(primaryRole)) {
        setPrimaryRole(newRoles[0]);
      } else if (!primaryRole) {
        setPrimaryRole(newRoles[0]);
      }
    }
  };

  return (
    <div className="p-5 space-y-6 animate-fadeIn pb-32">
      
      {showModulationDateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowModulationDateModal(false)} />
          <div className={`relative w-full max-w-sm p-8 rounded-[40px] border ${darkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} shadow-2xl animate-scaleIn`}>
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-6 mx-auto">
              <CalendarIcon size={32} />
            </div>
            <h3 className={`text-xl font-black mb-2 text-center ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {workRegime === 'fortnightly' ? 'Début de quinzaine' : 'Début de modulation'}
            </h3>
            <p className="text-slate-400 text-center text-[10px] font-bold uppercase tracking-widest mb-8 leading-relaxed">
              Sélectionnez la date de début de {workRegime === 'fortnightly' ? 'votre cycle en quinzaine.' : 'votre cycle de modulation.'}
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Date de début</label>
                <input 
                  type="date" 
                  value={modulationStartDate}
                  onChange={(e) => setModulationStartDate?.(e.target.value)}
                  className={`w-full p-4 rounded-2xl border font-black outline-none transition-all ${
                    darkMode ? 'bg-slate-950/50 border-white/10 text-white' : 'bg-white/40 border-white/60 text-slate-900'
                  }`}
                />
              </div>
            </div>

            <button 
              onClick={() => setShowModulationDateModal(false)}
              className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
            >
              Valider la période
            </button>
          </div>
        </div>
      )}

      {/* IDENTITY HERO */}
      <div className={`${bentoCardBase} p-8 flex flex-col items-center text-center`}>
        <div className="relative mb-6 group cursor-pointer" onClick={handleAvatarClick}>
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
          <div className="relative w-32 h-32 rounded-[40px] p-1 bg-gradient-to-tr from-indigo-500 to-emerald-500 transition-transform group-hover:scale-105">
            <div className={`w-full h-full rounded-[38px] overflow-hidden flex items-center justify-center ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
              {isUploading ? (
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              ) : profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <User size={48} />
                </div>
              )}
            </div>
            <div className="absolute -right-2 -bottom-2 bg-indigo-600 text-white p-2.5 rounded-2xl shadow-xl border-4 border-white dark:border-slate-950 group-hover:bg-indigo-500 transition-colors">
              <Camera size={18} />
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="w-full space-y-4">
          <div className="space-y-1">
            <h2 className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {firstName || lastName ? `${firstName} ${lastName}`.trim() : "Utilisateur"}
            </h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{jobTitle}</p>
          </div>

          {/* Badges Diplômes / Rôles */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex flex-wrap justify-center gap-2">
              {roles.map(role => (
                <span 
                  key={role}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg ${
                    primaryRole === role 
                      ? 'bg-indigo-600 text-white shadow-indigo-600/20' 
                      : 'bg-slate-500/10 border border-white/5 text-slate-400'
                  }`}
                >
                  {role === 'dea' ? 'Ambulancier DE' : role === 'auxiliary' ? 'Auxiliaire Ambulancier' : 'Conducteur Taxi'}
                  {primaryRole === role && ' ★'}
                </span>
              ))}
            </div>
            <button 
              onClick={() => setIsEditingRoles(true)}
              className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1 hover:opacity-80 transition-opacity"
            >
              <RefreshCw size={12} /> Modifier mes métiers
            </button>
          </div>
        </div>
      </div>

      {/* MODAL ÉDITION RÔLES */}
      {isEditingRoles && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsEditingRoles(false)} />
          <div className={`relative w-full max-w-sm p-8 rounded-[40px] border ${darkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} shadow-2xl animate-scaleIn`}>
            <h3 className={`text-xl font-black mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Modifier vos métiers</h3>
            
            <div className="space-y-4 mb-8">
              {[
                { id: 'dea', label: 'Ambulancier DE', icon: ShieldCheck },
                { id: 'auxiliary', label: 'Auxiliaire Ambulancier', icon: Users },
                { id: 'taxi', label: 'Conducteur Taxi', icon: Car }
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => toggleRole(role.id as UserRole)}
                  className={`w-full p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${
                    roles.includes(role.id as UserRole) 
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-500' 
                      : 'bg-transparent border-slate-800 text-slate-500'
                  }`}
                >
                  <role.icon size={20} />
                  <span className="font-bold">{role.label}</span>
                  {roles.includes(role.id as UserRole) && <Check size={18} className="ml-auto" />}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setIsEditingRoles(false)}
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs"
            >
              Terminer
            </button>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMATION RÉINITIALISATION */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md animate-fadeIn" onClick={() => !isResetting && setShowResetConfirm(false)} />
          <div className={`relative w-full max-w-sm p-8 rounded-[40px] border ${darkMode ? 'bg-slate-900 border-rose-500/30' : 'bg-white border-rose-100'} shadow-[0_30px_100px_rgba(244,63,94,0.2)] animate-popIn`}>
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6 mx-auto">
              <ShieldAlert size={32} />
            </div>
            <h3 className={`text-xl font-black mb-3 text-center ${darkMode ? 'text-white' : 'text-slate-900'}`}>Suppression Définitive</h3>
            <p className="text-slate-400 text-center text-xs font-medium leading-relaxed mb-8 uppercase tracking-widest px-4">
              Cette action est <span className="text-rose-500 font-black underline underline-offset-4">IRRÉVERSIBLE</span>. Votre compte Auth et toutes vos données Firestore seront supprimés.
            </p>
            
            <div className="space-y-3">
              <button 
                onClick={async () => {
                   setIsResetting(true);
                   try {
                     await onDeleteAccount();
                     setShowResetConfirm(false);
                   } catch (e) {
                     console.error("Delete sequence failed:", e);
                   } finally {
                     setIsResetting(false);
                   }
                 }}
                disabled={isResetting}
                className="w-full py-5 bg-rose-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-rose-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isResetting ? <Loader2 className="animate-spin" size={16} /> : <><Trash2 size={16} /> Confirmer la suppression</>}
              </button>
              <button 
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="w-full py-5 text-slate-400 font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-slate-500/5 transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION CONTRAT */}
      <div className={`${bentoCardBase} p-8`}>
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><FileText size={16} /> Section Contrat</h3>
        
        <div className="space-y-6">
          <div className="flex flex-col gap-1">
            <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              En poste chez <span className="text-indigo-500 font-black uppercase tracking-tight">{companyName || '...'}</span>
            </p>
            <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              depuis le <span className="relative inline-block cursor-pointer">
                <span 
                  className={`font-black hover:opacity-80 transition-opacity border-b-2 border-dotted pb-0.5 ${!contractStartDate ? 'text-slate-400 border-slate-400/20 italic' : 'text-amber-500 border-amber-500/20'}`}
                >
                  {contractStartDate ? formatDate(contractStartDate) : 'définir la date'}
                </span>
                <input 
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate?.(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Modifier la date d'entrée"
                />
              </span>
            </p>
          </div>

          <div className="h-px bg-white/5 w-full" />

          <div className="grid grid-cols-1 gap-4">
            {/* Base Hebdomadaire */}
            <div className={`flex items-center justify-between p-4 rounded-2xl border backdrop-blur-md shadow-sm ${
              darkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/50'
            }`}>
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-indigo-400" />
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Régime Hebdo</span>
                  <div className="group relative">
                    <Info size={12} className="text-slate-400 cursor-help transition-colors hover:text-indigo-400" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 border border-white/10 rounded-xl text-[8px] font-bold text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl">
                      Définit votre base d'heures contractuelle par semaine (ex: 35h).
                    </div>
                  </div>
                </div>
              </div>
              <div className={`flex items-center justify-between w-[120px] p-1 rounded-xl border ${
                darkMode ? 'bg-slate-950/20 border-white/10' : 'bg-white/40 border-white'
              }`}>
                <button 
                  onClick={() => setWeeklyContractHours?.(Math.max(1, weeklyContractHours - 1))}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    darkMode ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-white hover:bg-slate-100 text-slate-500 shadow-sm border border-slate-200'
                  }`}
                >
                  <Minus size={14} />
                </button>
                <div className="flex items-baseline gap-0.5">
                  <span className={`text-sm font-black tabular-nums transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {weeklyContractHours}
                  </span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">h</span>
                </div>
                <button 
                  onClick={() => setWeeklyContractHours?.(weeklyContractHours + 1)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    darkMode ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-white hover:bg-slate-100 text-slate-500 shadow-sm border border-slate-200'
                  }`}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Régime de Travail */}
            <div className={`flex flex-col gap-4 p-5 rounded-[28px] border backdrop-blur-md shadow-sm ${
              darkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${darkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                    <Briefcase size={16} className="text-indigo-500" />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Régime de travail</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'weekly', label: 'Hebdomadaire' },
                  { id: 'fortnightly', label: 'Quinzaine' },
                  { id: 'modulation', label: 'Modulation' },
                  { id: 'annualization', label: 'Annualisation' }
                ].map(regime => (
                  <button
                    key={regime.id}
                    onClick={() => setWorkRegime?.(regime.id)}
                    className={`py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all border ${
                      workRegime === regime.id 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' 
                        : (darkMode ? 'bg-slate-950/40 border-white/5 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')
                    }`}
                  >
                    {regime.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Paramètres de Cycle / Modulation */}
            {(workRegime === 'fortnightly' || workRegime === 'modulation') && (
              <div className={`flex flex-col gap-4 p-5 rounded-[28px] border backdrop-blur-md shadow-sm ${
                darkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/50'
              }`}>
                <div className="flex items-center gap-3 mb-1">
                  <div className={`p-2 rounded-xl ${darkMode ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                    <CalendarIcon size={16} className="text-amber-500" />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {workRegime === 'fortnightly' ? 'Cycle en Quinzaine' : 'Cycle de Modulation'}
                  </span>
                </div>

                <div className={`grid ${workRegime === 'fortnightly' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-4`}>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Date de début de référence</label>
                    <input 
                      type="date" 
                      value={modulationStartDate}
                      onChange={(e) => setModulationStartDate?.(e.target.value)}
                      className={`w-full p-3 rounded-xl border text-xs font-black outline-none transition-all ${
                        darkMode ? 'bg-slate-950/50 border-white/10 text-white focus:border-indigo-500' : 'bg-white/80 border-slate-200 text-slate-900 focus:border-indigo-500'
                      }`}
                    />
                  </div>

                  {workRegime !== 'fortnightly' && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Durée de cycle (semaines)</label>
                      <div className={`flex items-center justify-between p-1 rounded-xl border ${
                        darkMode ? 'bg-slate-950/20 border-white/10' : 'bg-white/40 border-slate-200'
                      }`}>
                        <button 
                          type="button"
                          onClick={() => setModulationWeeks?.(String(Math.max(1, (parseInt(modulationWeeks) || 1) - 1)))}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                            darkMode ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-white hover:bg-slate-100 text-slate-500 shadow-sm border border-slate-200'
                          }`}
                        >
                          <Minus size={12} />
                        </button>
                        <div className="flex items-baseline gap-0.5">
                          <span className={`text-xs font-black tabular-nums ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            {modulationWeeks}
                          </span>
                          <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter">sem.</span>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setModulationWeeks?.(String((parseInt(modulationWeeks) || 1) + 1))}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                            darkMode ? 'bg-white/5 hover:bg-white/10 text-slate-400' : 'bg-white hover:bg-slate-100 text-slate-500 shadow-sm border border-slate-200'
                          }`}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {modulationStartDate && (
                  <div className={`p-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest flex items-center justify-between ${
                    darkMode ? 'bg-indigo-500/5 text-indigo-400 border border-indigo-500/10' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                  }`}>
                    <span>Cycle actif calculé :</span>
                    <span>{workRegime === 'fortnightly' ? 'Quinzaine (2 sem.)' : `Modulation de ${modulationWeeks} sem.`}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mode Rémunération */}
            <div className={`flex flex-col gap-4 p-5 rounded-[28px] border backdrop-blur-md shadow-sm ${
              darkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${darkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                    <Briefcase size={16} className="text-indigo-500" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Rémunération</span>
                    <div className="group relative">
                      <Info size={12} className="text-slate-400 cursor-help transition-colors hover:text-indigo-400" />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-slate-900 border border-white/10 rounded-xl text-[8px] font-bold text-slate-300 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-2xl leading-relaxed">
                        <p className="mb-1 text-indigo-400 uppercase tracking-wider">Modes conventionnels :</p>
                        <p className="mb-1 text-white">100% au réel: Amplitude totale - temps de pause saisis.</p>
                        <p className="text-white">90% coefficient: Amplitude x 0.90 (pauses incluses).</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setPayRateMode('100_percent')}
                  className={`py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all border ${
                    payRateMode === '100_percent' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' 
                      : (darkMode ? 'bg-slate-950/40 border-white/5 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')
                  }`}
                >
                  100% au réel
                </button>
                <button 
                  onClick={() => setPayRateMode('90_percent')}
                  className={`py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all border ${
                    payRateMode === '90_percent' 
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' 
                      : (darkMode ? 'bg-slate-950/40 border-white/5 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')
                  }`}
                >
                  90% coefficient
                </button>
              </div>
            </div>

            <div className={`flex items-center justify-between p-4 rounded-2xl border backdrop-blur-md shadow-sm ${
              darkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/50'
            }`}>
              <div className="flex items-center gap-3">
                <Euro size={16} className="text-emerald-500" />
                <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Taux horaire</span>
              </div>
              <div className={`flex items-center gap-1 p-2 rounded-xl border ${
                darkMode ? 'bg-slate-950/20 border-white/10' : 'bg-white/40 border-white'
              }`}>
                <input 
                  type="number"
                  step="0.01"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate?.(e.target.value)}
                  className={`bg-transparent text-sm font-black text-right w-20 outline-none focus:text-indigo-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
                />
                <span className="text-[10px] font-black text-emerald-500 uppercase">€/h</span>
              </div>
            </div>

            {/* Congés Payés restants & Mode Calcul */}
            <div className={`flex flex-col gap-4 p-5 rounded-[28px] border backdrop-blur-md shadow-sm ${
              darkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${darkMode ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                    <CalendarIcon size={16} className="text-orange-500" />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gestion des Congés</span>
                </div>
                <div className={`flex items-center gap-1 p-2 rounded-xl border ${
                  darkMode ? 'bg-slate-950/20 border-white/10' : 'bg-white/40 border-white'
                }`}>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialCpBalance}
                    onChange={(e) => setInitialCpBalance(parseFloat(e.target.value) || 0)}
                    className={`bg-transparent text-sm font-black text-right w-16 outline-none focus:text-orange-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
                  />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">jours</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCpCalculationMode?.('25')}
                  className={`py-3 rounded-[20px] font-black text-[10px] uppercase tracking-widest transition-all border ${
                    cpCalculationMode === '25' 
                      ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/20' 
                      : (darkMode ? 'bg-slate-950/40 border-white/5 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')
                  }`}
                >
                  Ouvrés (25/an)
                </button>
                <button
                  onClick={() => setCpCalculationMode?.('30')}
                  className={`py-3 rounded-[20px] font-black text-[10px] uppercase tracking-widest transition-all border ${
                    cpCalculationMode === '30' 
                      ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-600/20' 
                      : (darkMode ? 'bg-slate-950/40 border-white/5 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')
                  }`}
                >
                  Ouvrables (30/an)
                </button>
              </div>
            </div>

            {/* Missions Complémentaires */}
            <div className={`flex flex-col gap-4 p-5 rounded-[28px] border backdrop-blur-md shadow-sm ${
              darkMode ? 'bg-white/5 border-white/10' : 'bg-white/70 border-white/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${darkMode ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                    <Award size={16} className="text-amber-500" />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Mission Complém.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'none', label: 'Aucune' },
                  { id: 'type_1', label: 'Type 1 (+2%)' },
                  { id: 'type_2', label: 'Type 2 (+5%)' },
                  { id: 'type_3', label: 'Type 3 (+10%)' }
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSupplementaryTaskType?.(type.id as any)}
                    className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                      supplementaryTaskType === type.id 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20' 
                        : (darkMode ? 'bg-slate-950/40 border-white/5 text-slate-500 hover:text-slate-300' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50')
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              {/* Taux majoré Mission - Imbriqué */}
              {supplementaryTaskType !== 'none' && (
                <div className={`mt-2 p-4 rounded-2xl border backdrop-blur-md ${
                  darkMode ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-500/5 border-white shadow-sm'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Majoration Mission</span>
                      <span className="text-[8px] font-bold text-emerald-500/60 uppercase tracking-widest mt-0.5 italic leading-none">
                        {supplementaryTaskType === 'type_1' ? 'Conduite non sanitaire, corps...' : supplementaryTaskType === 'type_2' ? 'Taxi, Funéraire...' : 'Régulation, Mécanique...'}
                      </span>
                    </div>
                    <span className="text-sm font-black text-emerald-500">
                      {(parseFloat(hourlyRate || '0') * (1 + (supplementaryTaskType === 'type_1' ? 0.02 : supplementaryTaskType === 'type_2' ? 0.05 : 0.10))).toFixed(2)} €/h
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Majoration Ancienneté - Conditionnelle */}
            {seniorityInfo?.bonus && seniorityInfo.bonus > 0 ? (
              <div className={`p-4 rounded-2xl border backdrop-blur-md ${
                darkMode ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-indigo-500/5 border-white shadow-sm'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Majoration Ancienneté</span>
                    <span className="text-[8px] font-bold text-indigo-500/60 uppercase tracking-widest mt-0.5">
                      {seniorityText} • Taux appliqué: +{(seniorityInfo.bonus * 100).toFixed(0)}%
                    </span>
                  </div>
                  <span className="text-sm font-black text-indigo-400">
                    {(parseFloat(hourlyRate || '0') * (1 + seniorityInfo.bonus)).toFixed(2)} €/h
                  </span>
                </div>
              </div>
            ) : null}

            {/* Taux Horaire Final Récapitulatif - Toujours visible si majorations actives */}
            {( (seniorityInfo?.bonus && seniorityInfo.bonus > 0) || (supplementaryTaskType !== 'none') ) && (
              <div className={`p-5 rounded-3xl border-2 shadow-lg backdrop-blur-md ${
                darkMode ? 'bg-indigo-500/5 border-indigo-500/20 shadow-indigo-500/5' : 'bg-white/90 border-white'
              }`}>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Taux Horaire Final</span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight max-w-[180px]">
                      Cumul : base + {( ((seniorityInfo?.bonus || 0) + (supplementaryTaskType === 'type_1' ? 0.02 : supplementaryTaskType === 'type_2' ? 0.05 : supplementaryTaskType === 'type_3' ? 0.10 : 0)) * 100).toFixed(0)}% de majorations
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black text-indigo-500">
                      {effectiveHourlyRate}
                    </span>
                    <span className="text-[10px] font-black text-indigo-500 opacity-60">€/h</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION PARAMÈTRES */}
      <div className={`${bentoCardBase} p-8`}>
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Settings size={16} /> Section Paramètres</h3>
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
                  <Smartphone size={18} />
                </div>
                <span className="text-sm font-bold">Thème automatique</span>
              </div>
              <button 
                onClick={() => setFollowSystemTheme(!followSystemTheme)} 
                className={`w-12 h-6 rounded-full relative transition-all ${followSystemTheme ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${followSystemTheme ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

          {!followSystemTheme && (
            <div className={`flex p-1.5 rounded-2xl gap-1 animate-fadeIn border ${
              darkMode ? 'bg-slate-800 border-white/5' : 'bg-white/80 border-white/50 shadow-inner'
            }`}>
              <button 
                onClick={() => setThemeChoice('light')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  themeChoice === 'light' 
                    ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200') 
                    : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-600')
                }`}
              >
                <Sun size={14} /> Clair
              </button>
              <button 
                onClick={() => setThemeChoice('dark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  themeChoice === 'dark' 
                    ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 shadow-sm') 
                    : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-600')
                }`}
              >
                <Moon size={14} /> Sombre
              </button>
            </div>
          )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Bell size={18} />
              </div>
              <span className="text-sm font-bold">Notifications Push</span>
            </div>
            <button 
              onClick={() => setPushEnabled(!pushEnabled)} 
              className={`w-12 h-6 rounded-full relative transition-all ${pushEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${pushEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
                <MapPin size={18} />
              </div>
              <span className="text-sm font-bold">Géolocalisation Auto</span>
            </div>
            <button 
              onClick={() => setAutoGeo(!autoGeo)} 
              className={`w-12 h-6 rounded-full relative transition-all ${autoGeo ? 'bg-indigo-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${autoGeo ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Clock size={18} />
                </div>
                <div>
                  <span className="text-sm font-bold block">Prise de poste auto</span>
                  <span className="text-[10px] text-slate-500 font-medium">Démarre le service automatiquement</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (heureEmbauchePrevue) {
                    setHeureEmbauchePrevue?.("");
                  } else {
                    setHeureEmbauchePrevue?.("06:30");
                  }
                }} 
                className={`w-12 h-6 rounded-full relative transition-all ${heureEmbauchePrevue ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${heureEmbauchePrevue ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            {heureEmbauchePrevue && (
              <div className="flex items-center justify-between pl-11 pt-1">
                <span className="text-xs text-slate-400">Heure de démarrage :</span>
                <input 
                  type="time" 
                  value={heureEmbauchePrevue} 
                  onChange={(e) => setHeureEmbauchePrevue?.(e.target.value)}
                  className={`text-xs px-2 py-1 rounded-lg border focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                    darkMode 
                      ? 'bg-slate-950/40 border-white/10 text-white' 
                      : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                  }`}
                />
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-white/5">
            <div className="mb-4">
              <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">Zone de Danger</h4>
              <p className="text-[9px] font-medium text-slate-500 uppercase tracking-widest leading-relaxed">
                Réinitialisation complète du compte et des données en base.
              </p>
            </div>
            <button 
              onClick={() => setShowResetConfirm(true)} 
              className="w-full p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center gap-3 group active:scale-[0.98] transition-all hover:bg-rose-500/20 shadow-lg shadow-rose-500/5"
            >
              <Trash2 size={18} className="text-rose-500" />
              <span className="font-black uppercase tracking-widest text-[10px] text-rose-500">Supprimer mon compte</span>
            </button>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="space-y-4">
        <button 
          onClick={onLogout} 
          className={`w-full p-6 rounded-[32px] border flex items-center justify-center gap-4 group active:scale-[0.98] transition-all shadow-xl backdrop-blur-xl ${
            darkMode ? 'bg-slate-900 border-white/5' : 'bg-white/80 border-white/40'
          }`}
        >
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
            <LogOut size={20} />
          </div>
          <span className={`font-black uppercase tracking-[0.2em] text-[11px] ${darkMode ? 'text-slate-200' : 'text-slate-600'}`}>Se déconnecter</span>
        </button>
      </div>
    </div>
  );
}
