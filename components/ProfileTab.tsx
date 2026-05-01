
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
  TrendingUp,
  Briefcase,
  Trash2,
  Euro,
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
  overtimeMode: 'weekly' | 'biweekly' | 'modulation' | 'annualized';
  setOvertimeMode: (val: 'weekly' | 'biweekly' | 'modulation' | 'annualized') => void;
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
  setSupplementaryTaskType
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

  const bentoCardBase = `relative overflow-hidden transition-all duration-300 rounded-[32px] border ${
    darkMode ? 'bg-slate-900/60 border-white/5' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'
  } backdrop-blur-xl`;

  const workRegimeLabels: Record<string, string> = {
    weekly: 'Hebdomadaire',
    fortnightly: 'Quinzaine',
    modulation: 'Modulation',
    annualization: 'Annualisation'
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
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
      const weeks = parseInt(modulationWeeks) || 4;
      const end = new Date(start);
      end.setDate(start.getDate() + (weeks * 7) - 1);
      return end;
    } catch (e) {
      return null;
    }
  }, [modulationStartDate, modulationWeeks]);

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
            <h3 className={`text-xl font-black mb-2 text-center ${darkMode ? 'text-white' : 'text-slate-900'}`}>Début de modulation</h3>
            <p className="text-slate-400 text-center text-[10px] font-bold uppercase tracking-widest mb-8 leading-relaxed">
              Sélectionnez la date de début de votre cycle de modulation.
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Date de début</label>
                <input 
                  type="date" 
                  value={modulationStartDate}
                  onChange={(e) => setModulationStartDate?.(e.target.value)}
                  className={`w-full p-4 rounded-2xl border font-black outline-none transition-all ${
                    darkMode ? 'bg-slate-950 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
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
                      ? 'bg-indigo-500 text-white shadow-indigo-500/20' 
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
            <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              En poste chez <span className="text-indigo-500 font-black uppercase tracking-tight">{companyName || '...'}</span>
            </p>
            <p className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              depuis le <span className="text-amber-500 font-black">{formatDate(contractStartDate)}</span>
            </p>
          </div>

          <div className="h-px bg-white/5 w-full" />

          <div className="grid grid-cols-1 gap-4">
            {/* Base Hebdomadaire */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-500/5 border border-white/5">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-indigo-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Base Hebdo</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={weeklyContractHours}
                  onChange={(e) => setWeeklyContractHours(Number(e.target.value))}
                  className={`bg-transparent text-sm font-black text-right w-12 outline-none focus:text-indigo-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
                />
                <span className="text-xs font-bold text-slate-500">h</span>
              </div>
            </div>

            {/* Mode Heures Supp */}
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-500/5 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp size={16} className="text-indigo-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Calcul Heures Supp.</span>
                </div>
                <select 
                  value={overtimeMode}
                  onChange={(e) => {
                    const mode = e.target.value as any;
                    setOvertimeMode(mode);
                    if (mode === 'modulation') {
                      setWorkRegime('modulation');
                      setShowModulationDateModal(true);
                    } else {
                      setWorkRegime('weekly');
                    }
                  }}
                  className={`bg-transparent text-sm font-black text-right outline-none focus:text-indigo-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
                >
                  <option value="weekly">Hebdomadaire</option>
                  <option value="biweekly">Quinzaine</option>
                  <option value="modulation">Modulation</option>
                  <option value="annualized">Annuel</option>
                </select>
              </div>
              {overtimeMode === 'modulation' && (
                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cycle (semaines)</span>
                    <select 
                      value={modulationWeeks}
                      onChange={(e) => setModulationWeeks?.(e.target.value)}
                      className={`bg-transparent text-xs font-black text-right outline-none focus:text-indigo-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
                    >
                      {[4, 5, 6, 7, 8, 9, 10, 11, 12].map(w => (
                        <option key={w} value={w.toString()}>{w} semaines</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={() => setShowModulationDateModal(true)}
                    className="flex items-center justify-between group hover:opacity-80 transition-opacity"
                  >
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Date Début</span>
                    <span className="text-xs font-black text-indigo-500 underline underline-offset-4 decoration-indigo-500/30">
                      {modulationStartDate ? formatDate(modulationStartDate) : 'Définir'}
                    </span>
                  </button>
                  {modulationEndDate && (
                    <div className="flex flex-col gap-2 bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Cycle en cours</span>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-indigo-400">
                            {formatDate(modulationStartDate)} au
                          </span>
                          <span className="text-[10px] font-black text-indigo-400">
                            {formatDate(modulationEndDate.toISOString().split('T')[0])}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mode Rémunération */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-500/5 border border-white/5">
              <div className="flex items-center gap-3">
                <Briefcase size={16} className="text-indigo-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Rémunération</span>
              </div>
              <select 
                value={payRateMode}
                onChange={(e) => setPayRateMode(e.target.value as any)}
                className={`bg-transparent text-sm font-black text-right outline-none focus:text-indigo-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
              >
                <option value="100_percent">100%</option>
                <option value="90_percent">90%</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-500/5 border border-white/5">
              <div className="flex items-center gap-3">
                <Euro size={16} className="text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Taux horaire</span>
              </div>
              <div className="flex items-center gap-1">
                <input 
                  type="text"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate?.(e.target.value)}
                  className={`bg-transparent text-sm font-black text-right w-16 outline-none focus:text-indigo-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
                />
                <span className="text-sm font-black text-emerald-500">€/h</span>
              </div>
            </div>

            {/* Congés Payés Restants */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-500/5 border border-white/5">
              <div className="flex items-center gap-3">
                <CalendarIcon size={16} className="text-orange-500" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Congés payés restants</span>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={initialCpBalance}
                  onChange={(e) => setInitialCpBalance(Number(e.target.value))}
                  className={`bg-transparent text-sm font-black text-right w-12 outline-none focus:text-indigo-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
                />
                <span className="text-xs font-bold text-slate-500">j</span>
              </div>
            </div>

            {/* Missions Complémentaires */}
            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-slate-500/5 border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award size={16} className="text-amber-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Mission Complém.</span>
                </div>
                <select 
                  value={supplementaryTaskType}
                  onChange={(e) => setSupplementaryTaskType?.(e.target.value as any)}
                  className={`bg-transparent text-sm font-black text-right outline-none focus:text-indigo-500 transition-colors ${darkMode ? 'text-white' : 'text-slate-900'}`}
                >
                  <option value="none">Aucune</option>
                  <option value="type_1">Type 1 (+2%)</option>
                  <option value="type_2">Type 2 (+5%)</option>
                  <option value="type_3">Type 3 (+10%)</option>
                </select>
              </div>
              {supplementaryTaskType !== 'none' && (
                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bonus appliqué</span>
                  <span className="text-[10px] font-black text-emerald-500">
                    {supplementaryTaskType === 'type_1' ? '+2%' : supplementaryTaskType === 'type_2' ? '+5%' : '+10%'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Majoration Ancienneté ({seniorityBonus})</span>
                <span className="text-sm font-black text-indigo-400">{effectiveHourlyRate} €/h</span>
              </div>
            </div>
            {supplementaryTaskType !== 'none' && (
               <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                 <div className="flex justify-between items-center">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bonus Mission Complém.</span>
                     <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest italic leading-none mt-0.5">
                       {supplementaryTaskType === 'type_1' ? 'Conduite non sanitaire, corps...' : supplementaryTaskType === 'type_2' ? 'Taxi, Funéraire...' : 'Régulation, Mécanique...'}
                     </span>
                   </div>
                   <span className="text-sm font-black text-emerald-500">
                     +{supplementaryTaskType === 'type_1' ? '2' : supplementaryTaskType === 'type_2' ? '5' : '10'} %
                   </span>
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
              <div className={`flex p-1 rounded-2xl gap-1 animate-fadeIn ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <button 
                  onClick={() => setThemeChoice('light')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all ${
                    themeChoice === 'light' 
                      ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 shadow-sm') 
                      : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700')
                  }`}
                >
                  <Sun size={14} /> Clair
                </button>
                <button 
                  onClick={() => setThemeChoice('dark')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all ${
                    themeChoice === 'dark' 
                      ? (darkMode ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 shadow-sm') 
                      : (darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700')
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
          className="w-full p-6 rounded-[28px] bg-slate-900 border border-white/5 flex items-center justify-center gap-4 group active:scale-[0.98] transition-all shadow-xl"
        >
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500 group-hover:bg-rose-500 group-hover:text-white transition-all">
            <LogOut size={20} />
          </div>
          <span className="font-black uppercase tracking-[0.2em] text-[11px] text-slate-200">Se déconnecter</span>
        </button>
      </div>
    </div>
  );
}
