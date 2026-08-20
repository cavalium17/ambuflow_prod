
import React, { useState, useEffect, useMemo, useCallback, Component, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Coffee, 
  LogOut, 
  MapPin, 
  ChevronRight, 
  User, 
  Settings, 
  ArrowLeft, 
  FileBadge, 
  Euro, 
  Play, 
  History, 
  Smartphone, 
  BellRing, 
  Building2, 
  Car, 
  Percent,
  Briefcase, 
  Stethoscope, 
  Users, 
  Timer as TimerIcon,
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  Save,
  Activity,
  Clock,
  Zap,
  Trash,
  Lock,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Utensils,
  X,
  Hourglass,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  Layers,
  ChevronLeft,
  PieChart,
  Timer,
  CalendarRange,
  RefreshCw,
  ChevronDown,
  Star,
  Loader2,
  Ambulance,
  Check,
  HeartHandshake
} from 'lucide-react';
import { ServiceStatus, ActivityLog, AppTab, Shift, Break, UserStats, UserRole, UserProfile, PushNotification as PushType } from './types';
import { getLocalDateString, getFrenchPublicHolidays, isSundayOrHoliday, calculateTotalDurationMinutes, parseLocalDate } from './src/lib/dateUtils';
import Logo from './components/Logo';
import PaieTab from './components/PaieTab';
import { PlanningTab } from './components/PlanningTab';
import ProfileTab from './components/ProfileTab';
import Navigation from './components/Navigation';
import SplashScreen from './components/SplashScreen';
import NotificationHistory from './components/NotificationHistory';
import PushNotification from './components/PushNotification';
import DailyRecap from './components/DailyRecap';
import Login from './components/Login';
import { auth, db } from './src/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser, signOut, deleteUser, reauthenticateWithPopup, GoogleAuthProvider, EmailAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, writeBatch, disableNetwork, enableNetwork } from 'firebase/firestore';
import { requestNotificationPermissions, requestLocationPermissions, setupNotificationChannels } from './services/notificationManager';
import { requestForToken, onMessageListener } from './src/firebaseConfig';
import { handleFirestoreError, OperationType } from './src/services/firestoreErrorHandler';
import { getFiveNearbyRestaurants, RestaurantSuggestion } from './services/restaurantService';

const isSameWeek = (d1: Date, d2: Date): boolean => {
  const getStartOfWeek = (d: Date) => {
    const temp = new Date(d);
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1);
    temp.setDate(diff);
    temp.setHours(0, 0, 0, 0);
    return temp.getTime();
  };
  return getStartOfWeek(d1) === getStartOfWeek(d2);
};

const isWithinCustomModulationPeriod = (
  targetDate: Date,
  referenceStartDate: Date,
  cycleWeeks: number,
  currentDate: Date
): { isInPeriod: boolean; startOfCycle: Date; endOfCycle: Date } => {
  const ref = new Date(referenceStartDate);
  ref.setHours(0, 0, 0, 0);
  const curr = new Date(currentDate);
  curr.setHours(0, 0, 0, 0);

  const diffDays = Math.round((curr.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000));
  const totalDaysInCycle = cycleWeeks * 7;
  const currentCycleIndex = Math.floor(diffDays / totalDaysInCycle);

  const startOfCycle = new Date(ref);
  startOfCycle.setDate(ref.getDate() + (currentCycleIndex * totalDaysInCycle));
  startOfCycle.setHours(0, 0, 0, 0);

  const endOfCycle = new Date(startOfCycle);
  endOfCycle.setDate(startOfCycle.getDate() + totalDaysInCycle);
  endOfCycle.setHours(0, 0, 0, 0);

  const targetNormalized = new Date(targetDate);
  targetNormalized.setHours(0, 0, 0, 0);

  const isInPeriod = targetNormalized >= startOfCycle && targetNormalized < endOfCycle;
  return { isInPeriod, startOfCycle, endOfCycle };
};

const getShiftMinutes = (
  shift: any,
  activeShiftId?: string | null,
  status?: string,
  currentTime?: Date
): number => {
  if (!shift) return 0;
  // Règle d'or : Si c'est un congé ou un férié chômé, c'est 7h00 (420 min) d'office, peu importe les horaires inscrits
  if (
    shift.isCP === true ||
    shift.isCP === 'true' ||
    shift.type === 'CP' ||
    shift.absenceType === 'CP' ||
    shift.leaveType === 'CP' ||
    (shift.isLeave && shift.leaveType === 'CP') ||
    shift.isFerieChome === true ||
    shift.isFerieChome === 'true' ||
    shift.type === 'FERIE' ||
    shift.minutesForced === 420
  ) {
    return 420;
  }
  if (shift.isLeave || shift.vehicle === 'CONGÉ' || shift.isConge) return 0;
  if (!shift.start || shift.start === '--:--' || !shift.day) return 0;

  const [h1, m1] = shift.start.split(':').map((v: string) => parseInt(v, 10) || 0);
  const validH1 = isNaN(h1) ? 0 : h1;
  const validM1 = isNaN(m1) ? 0 : m1;

  let endH: number;
  let endM: number;
  
  const isCurrentlyInBreak = activeShiftId && shift.id === activeShiftId && status === 'BREAK';
  const lastBreak = isCurrentlyInBreak && shift.breaks && shift.breaks.length > 0 
    ? shift.breaks[shift.breaks.length - 1] 
    : null;

  if (shift.end !== '--:--' && shift.end !== '') {
    const [h2, m2] = shift.end.split(':').map((v: string) => parseInt(v, 10) || 0);
    endH = h2;
    endM = m2;
  } else if (activeShiftId && shift.id === activeShiftId && currentTime) {
    if (isCurrentlyInBreak && lastBreak) {
      const [hb, mb] = lastBreak.start.split(':').map((v: string) => parseInt(v, 10) || 0);
      endH = hb;
      endM = mb;
    } else {
      endH = currentTime.getHours();
      endM = currentTime.getMinutes();
    }
  } else {
    return 0;
  }

  const validEndH = isNaN(endH) ? 0 : endH;
  const validEndM = isNaN(endM) ? 0 : endM;

  // Split and recreate dates
  const [year, month, day] = shift.day.split('-').map(Number);
  const startDate = new Date(year, month - 1, day, validH1, validM1, 0, 0);
  let endDate = new Date(year, month - 1, day, validEndH, validEndM, 0, 0);

  // Overnight shift rollover detection
  if (endDate.getTime() < startDate.getTime()) {
    endDate = new Date(year, month - 1, day + 1, validEndH, validEndM, 0, 0);
  }

  // Pilier 2: Millisecond-level exact calculation translated into minutes
  let durationMs = endDate.getTime() - startDate.getTime();

  if (shift.breaks) {
    shift.breaks.forEach((b: any) => { 
      if (b.end !== '--:--' && b.id !== lastBreak?.id) {
        const rawDur = Number(b.duration) || 0;
        // Rule 4: Café (min 20m, max 90m). Rule 5: Coupure Repas (min 30m, max 90m)
        const accountedDur = b.isMeal 
          ? Math.max(30, Math.min(90, rawDur))
          : Math.max(20, Math.min(90, rawDur));
        durationMs -= accountedDur * 60000; 
      }
    });
  }

  return Math.max(0, Math.floor(durationMs / 60000));
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<any, any> {
  props: any;
  state = { hasError: false, error: null };
  constructor(props: any) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    const { children } = this.props;
    if (this.state.hasError) {
      let errorMessage = "Une erreur est survenue.";
      try {
        const parsedError = JSON.parse(this.state.error.message);
        if (parsedError.error) {
          errorMessage = `Erreur Firestore (${parsedError.operationType}) : ${parsedError.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-[32px] max-w-md">
            <AlertTriangle className="text-rose-500 mx-auto mb-4" size={48} />
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Oups ! Quelque chose a coincé.</h2>
            <p className="text-slate-400 text-sm mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-xs"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper pour calculer les jours fériés français
const BREAK_MIN_DURATION = 20 * 60; // 20 minutes en secondes
const MEAL_MIN_DURATION = 30 * 60; // 30 minutes en secondes
const MAX_BREAK_DURATION = 90 * 60; // 1h30 en secondes

const sanitizeData = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: any = {};
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (val !== undefined) {
        cleaned[key] = sanitizeData(val);
      }
    });
    return cleaned;
  }
  return data;
};

const App: React.FC = () => {
  // --- AUTH BYPASS FOR DEV (Commented for future use) ---
  const isDevBypass = false; 
  /* 
  const isDevBypassActive = window.location.hostname === 'localhost' || 
                            window.location.hostname === '127.0.0.1' || 
                            window.location.hostname.includes('ais-dev-') || 
                            window.location.hostname.includes('ais-pre-');
  */

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  // const [user, setUser] = useState<any>(isDevBypass ? { uid: 'admin', email: 'dev@test.fr', displayName: 'Admin Dev' } : null);
  // const [authLoading, setAuthLoading] = useState(!isDevBypass);
  // const [isAuthReady, setIsAuthReady] = useState(isDevBypass);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications, setNotifications] = useState<PushType[]>(() => {
    const saved = localStorage.getItem('ambuflow_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((n: any) => ({ 
          ...n, 
          timestamp: new Date(n.timestamp),
          read: n.read ?? false
        }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  const [configLoading, setConfigLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('ambuflow_is_guest') === 'true');
  const [showSplash, setShowSplash] = useState(false);
  const [showLoadingLonger, setShowLoadingLonger] = useState(false);

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [gainsCarouselIndex, setGainsCarouselIndex] = useState(0);
  const [showDailyRecap, setShowDailyRecap] = useState(false);
  const [lastFinishedShift, setLastFinishedShift] = useState<Shift | null>(null);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  
  // Use a ref to track the last reset day to avoid unnecessary processing
  const lastResetDayRef = useRef(getLocalDateString(new Date()));

  useEffect(() => {
    const todayStr = getLocalDateString(currentTime);
    if (todayStr !== lastResetDayRef.current) {
      lastResetDayRef.current = todayStr;
    }
  }, [currentTime, getLocalDateString]);

  const [userStats, setUserStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('ambuflow_user_stats');
    const stats = saved ? JSON.parse(saved) : {};
    return {
      lastActiveDay: stats.lastActiveDay,
      level: Number(stats.level) || 1,
      xp: Number(stats.xp) || 0
    };
  });

  const [pushEnabled, setPushEnabled] = useState(true);
  const [currentGeoPosition, setCurrentGeoPosition] = useState<{ latitude: number; longitude: number; } | null>(null);
  const [shifts, setShifts] = useState<Shift[]>(() => {
    if (!localStorage.getItem('ambuflow_shifts_cleared_v2')) {
      localStorage.setItem('ambuflow_shifts', '[]');
      const savedConfig = localStorage.getItem('ambuflow_config');
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          config.shifts = [];
          localStorage.setItem('ambuflow_config', JSON.stringify(config));
        } catch (e) {
          console.error("Error clearing cached shifts in config:", e);
        }
      }
      return [];
    }
    const saved = localStorage.getItem('ambuflow_shifts');
    return saved ? JSON.parse(saved) : [];
  });

  // Force one-time clear of of all shifts as requested by the user
  useEffect(() => {
    const cleared = localStorage.getItem('ambuflow_shifts_cleared_v2');
    if (!cleared) {
      setShifts([]);
      localStorage.setItem('ambuflow_shifts', '[]');
      localStorage.setItem('ambuflow_shifts_cleared_v2', 'true');
      console.log("Programmatically cleared all shifts as requested by the user.");
    }
  }, []);

  useEffect(() => {
    if (!shifts || shifts.length === 0) return;

    let modificationDetectee = false;
    const shiftsModifies = shifts.map(s => {
      // Si la ligne est marquée comme CP ou FERIE mais que ses minutes valent 0 ou ne sont pas forcées
      if ((s.isCP === true || s.type === 'CP' || s.isFerieChome === true || s.type === 'FERIE') && s.minutesForced !== 420) {
        modificationDetectee = true;
        return {
          ...s,
          minutesForced: 420,
          amplitude: 420,
          TTE: 420,
          heureEmbauche: "07:00",
          heureFin: "14:00" // On simule une plage de 7h pour forcer les calculs récalcitrants
        };
      }
      return s;
    });

    if (modificationDetectee) {
      // On écrase le state local pour forcer l'application à ingérer les 7h
      setShifts(shiftsModifies);
    }
  }, [shifts]);

  const [activeShiftId, setActiveShiftId] = useState<string | null>(() => {
    return localStorage.getItem('ambuflow_active_shift_id');
  });

  // Consolidate Config State
  const [userName, setUserName] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [jobTitle, setJobTitle] = useState("Ambulancier DE");
  const [hourlyRate, setHourlyRate] = useState("12.79");
  const [companyName, setCompanyName] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [entryDate, setEntryDate] = useState("");
  const [workRegime, setWorkRegime] = useState("weekly");
  const [monthlyHours, setMonthlyHours] = useState("151.67");
  const [leaveCalculation, setLeaveCalculation] = useState("25");
  const [autoGeo, setAutoGeo] = useState(true);
  const [hasDea, setHasDea] = useState(false);
  const [hasAux, setHasAux] = useState(false);
  const [hasTaxiCard, setHasTaxiCard] = useState(false);
  const [primaryGraduationDate, setPrimaryGraduationDate] = useState("");
  const [deaDate, setDeaDate] = useState("");
  const [auxDate, setAuxDate] = useState("");
  const [taxiDate, setTaxiDate] = useState("");
  const [taxiCardExpiryDate, setTaxiCardExpiryDate] = useState("");
  const [taxiFpcDate, setTaxiFpcDate] = useState("");
  const [afgsuDate, setAfgsuDate] = useState("");
  const [medicalExpiryDate, setMedicalExpiryDate] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractType, setContractType] = useState("CDI");
  const [hoursBase, setHoursBase] = useState("35");
  const [cpCalculationMode, setCpCalculationMode] = useState("25");
  const [modulationStartDate, setModulationStartDate] = useState("");
  const [modulationWeeks, setModulationWeeks] = useState("4");
  const [initialCpBalance, setInitialCpBalance] = useState<number>(() => {
    const saved = localStorage.getItem('ambuflow_config');
    if (saved) {
      try {
        const cfg = JSON.parse(saved);
        if (cfg.initialCpBalance !== undefined && cfg.initialCpBalance !== null && !isNaN(parseFloat(cfg.initialCpBalance)) && parseFloat(cfg.initialCpBalance) > 0) {
          return parseFloat(cfg.initialCpBalance);
        }
      } catch {}
    }
    return 23.17;
  });
  const [lastCpAccrualDate, setLastCpAccrualDate] = useState<string>("");
  const [customHours, setCustomHours] = useState("");
  const [weekendDays, setWeekendDays] = useState<string[]>([]);
  const [heureEmbauchePrevue, setHeureEmbauchePrevue] = useState<string>(() => {
    return localStorage.getItem('ambuflow_heure_embauche_prevue') || "06:30";
  });
  const [soldeTotalCP, setSoldeTotalCP] = useState<number>(() => {
    const saved = localStorage.getItem('ambuflow_solde_total_cp');
    return saved !== null ? parseFloat(saved) : 23.17;
  });
  const [joursCPPrisCycle, setJoursCPPrisCycle] = useState<number>(() => {
    const saved = localStorage.getItem('ambuflow_jours_cp_pris_cycle');
    return saved !== null ? parseInt(saved, 10) : 0;
  });
  const [followSystemTheme, setFollowSystemTheme] = useState(true);
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>('dark');
  const [onboarded, setOnboarded] = useState<boolean>(true);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<UserRole | ''>('');
  const [weeklyContractHours, setWeeklyContractHours] = useState(35);
  const [overtimeMode, setOvertimeMode] = useState<'weekly' | 'biweekly' | 'modulation' | 'annualized'>('weekly');
  const [payRateMode, setPayRateMode] = useState<'100_percent' | '90_percent'>('100_percent');
  const [supplementaryTaskType, setSupplementaryTaskType] = useState<'none' | 'type_1' | 'type_2' | 'type_3'>('none');
  const [vehicleStatMode, setVehicleStatMode] = useState<'percent' | 'hours'>('percent');

  // Missing States
  const [status, setStatus] = useState<ServiceStatus>(() => {
    const saved = localStorage.getItem('ambuflow_status');
    return (saved as ServiceStatus) || ServiceStatus.OFF;
  });
  const [dailyMinutes, setDailyMinutes] = useState(0);
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const serviceStatus = status;
  const setServiceStatus = (s: ServiceStatus | 'OFF') => {
    setStatus(s === 'OFF' ? ServiceStatus.OFF : s as ServiceStatus);
  };
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem('ambuflow_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [scheduledShiftId, setScheduledShiftId] = useState<string | null>(() => {
    return localStorage.getItem('ambuflow_scheduled_shift_id') || null;
  });
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakType, setBreakType] = useState<'meal' | 'coffee'>('meal');
  const [breakStartTime, setBreakStartTime] = useState("");
  const [breakDuration, setBreakDuration] = useState(30);
  const [breakLocation, setBreakLocation] = useState<'Entreprise' | 'Extérieur'>('Entreprise');

  
  // Nouveaux états demandés pour la pop-up de repas
  const [modeTransport, setModeTransport] = useState<'A_PIED' | 'EN_VOITURE'>('A_PIED');
  const [maxDuration, setMaxDuration] = useState<number>(5);
  const [restaurants, setRestaurants] = useState<RestaurantSuggestion[]>([]);
  const [suggestedRestaurants, setSuggestedRestaurants] = useState<RestaurantSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [breakStartDateTime, setBreakStartDateTime] = useState<Date | null>(() => {
    const saved = localStorage.getItem('ambuflow_break_start_datetime');
    return saved ? new Date(saved) : null;
  });
  const [breakEndTimeActual, setBreakEndTimeActual] = useState<Date | null>(() => {
    const saved = localStorage.getItem('ambuflow_break_end');
    return saved ? new Date(saved) : null;
  });
  const [nextAutoStart, setNextAutoStart] = useState<Date | null>(() => {
    const saved = localStorage.getItem('ambuflow_next_autostart');
    return saved ? new Date(saved) : null;
  });
  const [dismissedShiftIds, setDismissedShiftIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ambuflow_dismissed_shift_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('ambuflow_dismissed_shift_ids', JSON.stringify(dismissedShiftIds));
  }, [dismissedShiftIds]);
  const [prefersDarkMode, setPrefersDarkMode] = useState(false);
  const [showCancelDayModal, setShowCancelDayModal] = useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = useState('ASSU');
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => {
    if (typeof window !== 'undefined') {
      return !!(window as any).firestoreQuotaExceeded || localStorage.getItem('firestore_quota_exceeded') === 'true';
    }
    return false;
  });

  const addNotification = useCallback((title: string, message: string, type: 'info' | 'success' | 'warning') => {
    const newNotif: PushType = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      type,
      timestamp: new Date(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
  }, []);

  const handleAdjustCPDays = useCallback((increment: boolean) => {
    if (increment) {
      setJoursCPPrisCycle(prev => {
        const next = prev + 1;
        localStorage.setItem('ambuflow_jours_cp_pris_cycle', String(next));
        return next;
      });
      setSoldeTotalCP(prev => {
        const next = Math.max(0, prev - 1);
        localStorage.setItem('ambuflow_solde_total_cp', String(next));
        return next;
      });
      addNotification("CONGÉ PAYÉ SELECTIONNÉ", "1 jour déduit de votre solde CP et +7h00 ajoutés au cumul de modulation.", "info");
    } else {
      setJoursCPPrisCycle(prev => {
        if (prev <= 0) return prev;
        const next = prev - 1;
        localStorage.setItem('ambuflow_jours_cp_pris_cycle', String(next));
        return next;
      });
      setSoldeTotalCP(prev => {
        const next = prev + 1;
        localStorage.setItem('ambuflow_solde_total_cp', String(next));
        return next;
      });
      addNotification("CONGÉ PAYÉ RETIRÉ", "1 jour rajouté à votre solde CP et -7h00 retirés de la modulation.", "info");
    }
  }, [addNotification]);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setIsQuotaExceeded(true);
      const lastNotified = sessionStorage.getItem('quota_notification_sent');
      if (!lastNotified) {
        addNotification(
          "CONSTATS CLOUD / HORS-LIGNE",
          "Le quota d'hébergement est épuisé. L'application bascule automatiquement en mode local/hors-ligne. Vos données sont préservées !",
          "warning"
        );
        sessionStorage.setItem('quota_notification_sent', 'true');
      }
    };

    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    
    if ((window as any).firestoreQuotaExceeded) {
      handleQuotaExceeded();
    }

    return () => {
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    };
  }, [addNotification]);

  const applyConfig = useCallback((config: any) => {
    if (config.userName !== undefined) setUserName(prev => prev !== config.userName ? config.userName : prev);
    if (config.profileImage !== undefined) setProfileImage(prev => prev !== config.profileImage ? config.profileImage : prev);
    if (config.jobTitle !== undefined) setJobTitle(prev => prev !== config.jobTitle ? config.jobTitle : prev);
    if (config.hourlyRate !== undefined) setHourlyRate(prev => prev !== config.hourlyRate ? config.hourlyRate : prev);
    if (config.companyName !== undefined) setCompanyName(prev => prev !== config.companyName ? config.companyName : prev);
    if (config.companyCity !== undefined) setCompanyCity(prev => prev !== config.companyCity ? config.companyCity : prev);
    if (config.firstName !== undefined) setFirstName(prev => prev !== config.firstName ? config.firstName : prev);
    if (config.lastName !== undefined) setLastName(prev => prev !== config.lastName ? config.lastName : prev);
    if (config.qualifications !== undefined) setQualifications(prev => JSON.stringify(prev) !== JSON.stringify(config.qualifications) ? config.qualifications : prev);
    if (config.entryDate !== undefined) setEntryDate(prev => prev !== config.entryDate ? config.entryDate : prev);
    if (config.workRegime !== undefined) setWorkRegime(prev => prev !== config.workRegime ? config.workRegime : prev);
    if (config.monthlyHours !== undefined) setMonthlyHours(prev => prev !== config.monthlyHours ? config.monthlyHours : prev);
    if (config.leaveCalculation !== undefined) setLeaveCalculation(prev => prev !== config.leaveCalculation ? config.leaveCalculation : prev);
    if (config.autoGeo !== undefined) setAutoGeo(prev => prev !== config.autoGeo ? config.autoGeo : prev);
    if (config.hasDea !== undefined) setHasDea(prev => prev !== config.hasDea ? config.hasDea : prev);
    if (config.hasAux !== undefined) setHasAux(prev => prev !== config.hasAux ? config.hasAux : prev);
    if (config.hasTaxiCard !== undefined) setHasTaxiCard(prev => prev !== config.hasTaxiCard ? config.hasTaxiCard : prev);
    if (config.primaryGraduationDate !== undefined) setPrimaryGraduationDate(prev => prev !== config.primaryGraduationDate ? config.primaryGraduationDate : prev);
    if (config.deaDate !== undefined) setDeaDate(prev => prev !== config.deaDate ? config.deaDate : prev);
    if (config.auxDate !== undefined) setAuxDate(prev => prev !== config.auxDate ? config.auxDate : prev);
    if (config.taxiDate !== undefined) setTaxiDate(prev => prev !== config.taxiDate ? config.taxiDate : prev);
    if (config.taxiCardExpiryDate !== undefined) setTaxiCardExpiryDate(prev => prev !== config.taxiCardExpiryDate ? config.taxiCardExpiryDate : prev);
    if (config.taxiFpcDate !== undefined) setTaxiFpcDate(prev => prev !== config.taxiFpcDate ? config.taxiFpcDate : prev);
    if (config.afgsuDate !== undefined) setAfgsuDate(prev => prev !== config.afgsuDate ? config.afgsuDate : prev);
    if (config.medicalExpiryDate !== undefined) setMedicalExpiryDate(prev => prev !== config.medicalExpiryDate ? config.medicalExpiryDate : prev);
    if (config.contractStartDate !== undefined) setContractStartDate(prev => prev !== config.contractStartDate ? config.contractStartDate : prev);
    if (config.contractType !== undefined) setContractType(prev => prev !== config.contractType ? config.contractType : prev);
    if (config.hoursBase !== undefined) setHoursBase(prev => prev !== config.hoursBase ? config.hoursBase : prev);
    if (config.cpCalculationMode !== undefined) setCpCalculationMode(prev => prev !== config.cpCalculationMode ? config.cpCalculationMode : prev);
    if (config.modulationStartDate !== undefined) setModulationStartDate(prev => prev !== config.modulationStartDate ? config.modulationStartDate : prev);
    if (config.modulationWeeks !== undefined) setModulationWeeks(prev => {
      const val = config.modulationWeeks?.toString();
      return prev !== val ? val : prev;
    });
    if (config.initialCpBalance !== undefined) setInitialCpBalance(prev => {
      const parsed = parseFloat(config.initialCpBalance);
      const newVal = !isNaN(parsed) && parsed > 0 ? parsed : 23.17;
      return prev !== newVal ? newVal : prev;
    });
    if (config.lastCpAccrualDate !== undefined) setLastCpAccrualDate(prev => prev !== config.lastCpAccrualDate ? config.lastCpAccrualDate : prev);
    if (config.customHours !== undefined) setCustomHours(prev => prev !== config.customHours ? config.customHours : prev);
    if (config.weekendDays !== undefined) setWeekendDays(prev => JSON.stringify(prev) !== JSON.stringify(config.weekendDays) ? config.weekendDays : prev);
    if (config.pushEnabled !== undefined) setPushEnabled(prev => prev !== config.pushEnabled ? config.pushEnabled : prev);
    if (config.followSystemTheme !== undefined) setFollowSystemTheme(prev => prev !== config.followSystemTheme ? config.followSystemTheme : prev);
    if (config.themeChoice !== undefined) setThemeChoice(prev => prev !== config.themeChoice ? config.themeChoice : prev);
    if (config.onboarded !== undefined) {
      setOnboarded(config.onboarded);
    }
    if (config.heureEmbauchePrevue !== undefined) setHeureEmbauchePrevue(prev => prev !== config.heureEmbauchePrevue ? config.heureEmbauchePrevue : prev);
    if (config.soldeTotalCP !== undefined) setSoldeTotalCP(prev => {
      const parsed = parseFloat(config.soldeTotalCP);
      const val = !isNaN(parsed) ? parsed : 23.17;
      return prev !== val ? val : prev;
    });
    if (config.joursCPPrisCycle !== undefined) setJoursCPPrisCycle(prev => {
      const val = parseInt(config.joursCPPrisCycle ?? "0", 10);
      return prev !== val ? val : prev;
    });
    if (config.roles !== undefined) setRoles(prev => JSON.stringify(prev) !== JSON.stringify(config.roles) ? config.roles : prev);
    if (config.primaryRole !== undefined) setPrimaryRole(prev => prev !== config.primaryRole ? config.primaryRole : prev);
    if (config.weeklyContractHours !== undefined) setWeeklyContractHours(prev => prev !== config.weeklyContractHours ? config.weeklyContractHours : prev);
    if (config.overtimeMode !== undefined) setOvertimeMode(prev => prev !== config.overtimeMode ? config.overtimeMode : prev);
    if (config.payRateMode !== undefined) setPayRateMode(prev => prev !== config.payRateMode ? config.payRateMode : prev);
    if (config.supplementaryTaskType !== undefined) setSupplementaryTaskType(prev => prev !== config.supplementaryTaskType ? config.supplementaryTaskType : prev);
    if (config.status !== undefined) setStatus(prev => prev !== config.status ? config.status : prev);
    if (config.activeShiftId !== undefined) setActiveShiftId(prev => prev !== config.activeShiftId ? config.activeShiftId : prev);
    if (config.scheduledShiftId !== undefined) setScheduledShiftId(prev => prev !== config.scheduledShiftId ? config.scheduledShiftId : prev);
    if (config.nextAutoStart !== undefined) setNextAutoStart(prev => {
      if (!prev && !config.nextAutoStart) return prev;
      if (prev && config.nextAutoStart && prev.getTime() === new Date(config.nextAutoStart).getTime()) return prev;
      return config.nextAutoStart ? new Date(config.nextAutoStart) : null;
    });
    if (config.breakStartDateTime !== undefined) setBreakStartDateTime(prev => {
      if (!prev && !config.breakStartDateTime) return prev;
      if (prev && config.breakStartDateTime && prev.getTime() === new Date(config.breakStartDateTime).getTime()) return prev;
      return config.breakStartDateTime ? new Date(config.breakStartDateTime) : null;
    });
    if (config.breakEndTimeActual !== undefined) setBreakEndTimeActual(prev => {
      if (!prev && !config.breakEndTimeActual) return prev;
      if (prev && config.breakEndTimeActual && prev.getTime() === new Date(config.breakEndTimeActual).getTime()) return prev;
      return config.breakEndTimeActual ? new Date(config.breakEndTimeActual) : null;
    });
    if (config.shifts !== undefined) {
      const isClearedV2 = localStorage.getItem('ambuflow_shifts_cleared_v2') === 'true';
      const targetShifts = isClearedV2 ? config.shifts : [];
      setShifts(prev => JSON.stringify(prev) !== JSON.stringify(targetShifts) ? targetShifts : prev);
    }
    if (config.logs !== undefined) setLogs(prev => JSON.stringify(prev) !== JSON.stringify(config.logs) ? config.logs : prev);
    if (config.notifications !== undefined) setNotifications(prev => {
      const remoteNotifs = (config.notifications as any[])
        .map((n: any) => ({
          ...n,
          read: n.read ?? false,
          timestamp: n.timestamp && typeof n.timestamp.toDate === 'function' 
            ? n.timestamp.toDate() 
            : (n.timestamp ? new Date(n.timestamp) : new Date())
        }));
        
      // Merge logic: ensure we don't lose local-only notifications but remote is source of truth for IDs
      const merged = [...remoteNotifs];
      prev.forEach(p => {
        if (!merged.some(m => m.id === p.id)) {
          merged.push(p);
        }
      });

      const final = merged
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50);

      const prevStr = JSON.stringify(prev);
      const finalStr = JSON.stringify(final);
        
      return prevStr !== finalStr ? final : prev;
    });
  }, [setNotifications]);

  // Listen for initial mount to apply local config (important for guests and fast-loading)
  useEffect(() => {
    const saved = localStorage.getItem('ambuflow_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        applyConfig(config);
      } catch (e) { console.error("Error loading initial config:", e); }
    }
  }, [applyConfig]);

  useEffect(() => {
    if (primaryRole) {
      const titles: Record<string, string> = {
        dea: 'Ambulancier DE',
        auxiliary: 'Auxiliaire Ambulancier',
        taxi: 'Conducteur Taxi'
      };
      setJobTitle(titles[primaryRole] || jobTitle);
    }
  }, [primaryRole]);

  const effectiveDarkMode = followSystemTheme ? prefersDarkMode : (themeChoice === 'dark');

  // Auth State Listener & Real-time Config Sync
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // --- AUTH BYPASS FOR DEV (START) ---
      if (isDevBypass) {
        console.log("Auth Bypass Active (Currently Disabled). Skipping onAuthStateChanged logic.");
        setIsAuthReady(true);
        setAuthLoading(false);
        setConfigLoading(false);
        return;
      }
      // --- AUTH BYPASS FOR DEV (END) ---

      console.log("Auth state changed. User:", currentUser?.uid);
      
      // Safety timeout to unblock UI if Firebase hangs
      if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
      loadingTimeoutId = setTimeout(() => {
        setAuthLoading(false);
        setConfigLoading(false);
        setShowLoadingLonger(true);
      }, 8000);

      if (!currentUser) {
        if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
        console.log("No user session found.");
        setUser(null);
        setIsAuthReady(true);
        setAuthLoading(false);
        setConfigLoading(false);
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        return;
      }
      
      setUser(currentUser);
      setIsAuthReady(true);
      setIsGuest(false);
      localStorage.removeItem('ambuflow_is_guest');
      
      if (currentUser) {
        setAuthLoading(true);
        
        // Clean up previous subscription if it exists
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
        
        // Use onSnapshot for real-time updates
        const userDocPath = `users/${currentUser.uid}`;
        console.log("Starting subscription for:", userDocPath);
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
          if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
          setAuthLoading(false);
          setConfigLoading(false);

          if (docSnap.metadata.hasPendingWrites) return;

          if (docSnap.exists()) {
            const data = docSnap.data();
            applyConfig(data);
          } else {
            console.log("User document does not exist yet.");
          }
        }, (error) => {
          if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
          console.error("Firestore onSnapshot error:", error);
          
          const errorMsg = error.message?.toLowerCase() || '';
          const isQuota = errorMsg.includes('quota') || errorMsg.includes('resource-exhausted') || errorMsg.includes('resource_exhausted') || errorMsg.includes('exhausted');
          if (isQuota) {
            console.warn("Quota limit exceeded detected in onSnapshot sync. Unsubscribing client to prevent retry storm.");
            disableNetwork(db).catch(err => console.error("Could not disable network:", err));
            if (unsubscribeSnapshot) {
              unsubscribeSnapshot();
              unsubscribeSnapshot = null;
            }
            (window as any).firestoreQuotaExceeded = true;
            window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', { 
              detail: { error: error.message, operationType: OperationType.GET, path: userDocPath } 
            }));
          } else {
            // Check if we still have a user session when the error occurs
            if (auth.currentUser) {
               handleFirestoreError(error, OperationType.GET, userDocPath);
            } else {
               console.warn("Permission error occurred but session was lost. Ignoring.");
            }
          }
          setAuthLoading(false);
          setConfigLoading(false);
        });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
    };
  }, [applyConfig]);

  const lastSavedConfigRef = useRef<string>("");
  const isSavingRef = useRef<boolean>(false);
  const isResettingRef = useRef<boolean>(false);

  const saveConfig = useCallback(async () => {
    if (isSavingRef.current || isResettingRef.current) return;

    const config = {
      userName,
      profileImage,
      jobTitle,
      hourlyRate,
      companyName,
      companyCity,
      firstName,
      lastName,
      qualifications,
      entryDate,
      workRegime,
      monthlyHours,
      leaveCalculation,
      autoGeo,
      hasDea,
      hasAux,
      hasTaxiCard,
      primaryGraduationDate,
      deaDate,
      auxDate,
      taxiDate,
      taxiCardExpiryDate,
      taxiFpcDate,
      afgsuDate,
      medicalExpiryDate,
      contractStartDate,
      contractType,
      hoursBase,
      cpCalculationMode,
      modulationStartDate,
      modulationWeeks,
      initialCpBalance,
      lastCpAccrualDate,
      customHours,
      weekendDays,
      pushEnabled,
      followSystemTheme,
      themeChoice,
      onboarded,
      heureEmbauchePrevue,
      soldeTotalCP,
      joursCPPrisCycle,
      roles,
      primaryRole,
      weeklyContractHours,
      overtimeMode,
      payRateMode,
      supplementaryTaskType,
      status,
      activeShiftId,
      scheduledShiftId,
      nextAutoStart: nextAutoStart?.toISOString() || null,
      shifts,
      logs,
      breakStartDateTime: breakStartDateTime?.toISOString() || null,
      breakEndTimeActual: breakEndTimeActual?.toISOString() || null,
      notifications: notifications.map(n => ({
        ...n,
        timestamp: n.timestamp instanceof Date ? n.timestamp.toISOString() : n.timestamp
      })),
      updatedAt: new Date().toISOString()
    };
    
    // Extract updatedAt before stringifying for duplicate detection
    const { updatedAt: _updatedAt, ...configFieldsOnly } = config;
    const configStr = JSON.stringify(configFieldsOnly);
    if (configStr === lastSavedConfigRef.current) return;

    lastSavedConfigRef.current = configStr;
    
    // Notifications are saved separately to avoid startup overwrite issues
    const { notifications: _, ...configToSave } = config;
    localStorage.setItem('ambuflow_config', JSON.stringify(configToSave));
    
    // --- AUTH BYPASS FOR DEV Check ---
    if (!user || (user as any).uid === 'admin') {
       if (!user) return;
       // Mock user 'admin' shouldn't sync to real Firestore
       if ((user as any).uid === 'admin') return;
    }

    if ((window as any).firestoreQuotaExceeded) {
       console.log("Firestore quota is exceeded. Skipping setDoc write option to prevent error storm.");
       return;
    }

    try {
      isSavingRef.current = true;
      const sanitizedConfig = sanitizeData(config);
      await setDoc(doc(db, 'users', user.uid), sanitizedConfig, { merge: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes("aborted")) {
        console.warn("Firestore write aborted (expected during rapid updates)");
      } else {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [user, userName, profileImage, jobTitle, hourlyRate, companyName, companyCity, firstName, lastName, qualifications, entryDate, workRegime, monthlyHours, leaveCalculation, autoGeo, hasDea, hasAux, hasTaxiCard, primaryGraduationDate, deaDate, auxDate, taxiDate, taxiCardExpiryDate, taxiFpcDate, afgsuDate, medicalExpiryDate, contractStartDate, contractType, hoursBase, cpCalculationMode, modulationStartDate, modulationWeeks, initialCpBalance, lastCpAccrualDate, customHours, weekendDays, pushEnabled, followSystemTheme, themeChoice, onboarded, heureEmbauchePrevue, soldeTotalCP, joursCPPrisCycle, roles, primaryRole, weeklyContractHours, overtimeMode, payRateMode, supplementaryTaskType, status, activeShiftId, scheduledShiftId, nextAutoStart, shifts, logs, breakStartDateTime, breakEndTimeActual, notifications]);

  useEffect(() => {
    if (user || isGuest) {
      const timeout = setTimeout(() => {
        saveConfig();
      }, 500); // Reduced debounce to 500ms for more reliable sync
      return () => clearTimeout(timeout);
    }
  }, [user, isGuest, saveConfig, status, activeShiftId, scheduledShiftId, nextAutoStart, shifts, logs, breakStartDateTime, breakEndTimeActual, notifications, contractStartDate, hourlyRate, payRateMode, supplementaryTaskType, initialCpBalance, userName, companyName, jobTitle, heureEmbauchePrevue, soldeTotalCP, joursCPPrisCycle]);

  // Handle page visibility and unload for critical data saving
  useEffect(() => {
    const handleUnload = () => {
      saveConfig();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveConfig();
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveConfig]);

  // Gestion des congés payés automatiques au 1er du mois
  useEffect(() => {
    if (!onboarded || configLoading) return;

    const currentMonthStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}`;
    
    if (!lastCpAccrualDate) {
      setLastCpAccrualDate(currentMonthStr);
      return;
    }

    const [lastYear, lastMonth] = lastCpAccrualDate.split('-').map(Number);
    if (!lastYear || !lastMonth || isNaN(lastYear) || isNaN(lastMonth)) {
      setLastCpAccrualDate(currentMonthStr);
      return;
    }
    const lastDate = new Date(lastYear, lastMonth - 1, 1);
    const currentDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1);

    if (currentDate > lastDate) {
      const monthsDiff = (currentDate.getFullYear() - lastDate.getFullYear()) * 12 + (currentDate.getMonth() - lastDate.getMonth());
      
      if (monthsDiff > 0) {
        // Base calculation according to mode (30 working days vs 25 worked days)
        // Mode standard / Ouvrés : 2,085 jours ajoutés tous les 1er du mois
        let daysPerMonth = cpCalculationMode === '30' ? 2.5 : 2.085;
        
        // If part-time or specific contract hours affect acquisition
        if (weeklyContractHours && weeklyContractHours < 35) {
          // Some agreements or companies pro-rate the acquisition days
          // Though legally it's 2.5, here we follow user's instruction that it depends on the hours
          daysPerMonth = (daysPerMonth * weeklyContractHours) / 35;
        }

        let totalToCredit = parseFloat((daysPerMonth * monthsDiff).toFixed(3));
        
        // Add seniority days if we reached a threshold this month or if we are catching up
        // Seniority days are usually given once per year, but here we track if they apply
        if (seniorityInfo.extraDaysCP > 0) {
          // Just a simple credit check: if it's the anniversary month or first accrual
          const anniversaryMonth = lastDate.getMonth() === new Date(contractStartDate || "").getMonth();
          if (anniversaryMonth || !lastCpAccrualDate) {
            totalToCredit += seniorityInfo.extraDaysCP;
          }
        }

        setInitialCpBalance(prev => parseFloat((prev + totalToCredit).toFixed(3)));
        setLastCpAccrualDate(currentMonthStr);
        
        addNotification(
          "Crédit Congés & Ancienneté",
          `Votre solde a été crédité de ${totalToCredit.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} j (Base: ${daysPerMonth.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} j/mois ${seniorityInfo.extraDaysCP > 0 ? `+ ${seniorityInfo.extraDaysCP}j ancienneté` : ''}).`,
          'success'
        );
      }
    }
  }, [currentTime, onboarded, configLoading, lastCpAccrualDate, weeklyContractHours, cpCalculationMode, addNotification]);
  // Permissions et Notifications
  useEffect(() => {
    // Demande de permissions Notifications
    if (pushEnabled && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            requestForToken();
          }
        });
      } else if (Notification.permission === 'granted') {
        requestForToken();
      }
    }
    // Demande de permissions Géo
    if (autoGeo && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }
  }, [pushEnabled, autoGeo]);

  // Écouteur de messages FCM en premier plan
  useEffect(() => {
    if (!pushEnabled) return;

    const unsubscribe = onMessageListener((payload: any) => {
      if (payload?.notification) {
        addNotification(
          payload.notification.title || "Notification",
          payload.notification.body || "",
          'info'
        );
      }
      
      // Déclenchement personnalisé via Data Payload
      if (payload?.data?.type === 'MEAL_TRIGGER') {
        console.log("FCM: Déclenchement à distance de la suggestion repas");
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [pushEnabled, addNotification]);

  // Notification Restaurant Automatique
  useEffect(() => {
    if (!pushEnabled) return;

    const checkMealNotification = () => {
      const now = new Date();
      const hour = now.getHours();
      const isMealTime = (hour >= 11 && hour <= 14) || (hour >= 18 && hour <= 20);
      
      if (isMealTime) {
        const todayStr = getLocalDateString(now);
        const mealKey = `meal_notif_${todayStr}_${hour < 15 ? 'lunch' : 'dinner'}`;
        
        if (!localStorage.getItem(mealKey)) {
          localStorage.setItem(mealKey, 'true');
        }
      }
    };

    // Déclenchement sur passage en pause repas
    if (status === ServiceStatus.BREAK) {
      const activeShift = shifts.find(s => s.id === activeShiftId);
      const lastBreak = activeShift?.breaks?.[activeShift.breaks.length - 1];
      if (lastBreak?.isMeal) {
        checkMealNotification();
      }
    }
    
    // Vérification périodique si en service
    const interval = setInterval(() => {
      if (status === ServiceStatus.WORKING) {
        const now = new Date();
        const hour = now.getHours();
        const mins = now.getMinutes();
        // Suggestion à 12h00 et 19h00 pile si en mission
        if ((hour === 12 && mins === 0) || (hour === 19 && mins === 0)) {
          checkMealNotification();
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [status, activeShiftId, shifts, pushEnabled, addNotification]);

  // Notification Rapport Mensuel (1er du mois à 00:01)
  // Logic merged into the more robust useEffect for CP accrual above

  const seniorityInfo = useMemo(() => {
    if (!contractStartDate) return { years: 0, months: 0, bonus: 0, text: "N/A" };
    const start = new Date(contractStartDate);
    const now = new Date();
    
    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();
    
    if (months < 0 || (months === 0 && now.getDate() < start.getDate())) {
      years--;
      months += 12;
    }
    
    let bonus = 0;
    let extraDaysCP = 0;
    if (years >= 20) {
      bonus = 0.08;
      extraDaysCP = 5;
    } else if (years >= 15) {
      bonus = 0.08;
      extraDaysCP = 3;
    } else if (years >= 10) {
      bonus = 0.06;
      extraDaysCP = 2;
    } else if (years >= 5) {
      bonus = 0.04;
      extraDaysCP = 1;
    } else if (years >= 2) {
      bonus = 0.02;
    }

    return { 
      years, 
      months, 
      bonus,
      extraDaysCP,
      text: years > 0 ? `${years} an${years > 1 ? 's' : ''} ${months} mois` : `${months} mois`
    };
  }, [contractStartDate]);

  const effectiveHourlyRate = useMemo(() => {
    const base = parseFloat(hourlyRate) || 0;
    const taskBonusMap = {
      none: 0,
      type_1: 0.02,
      type_2: 0.05,
      type_3: 0.10
    };
    const taskBonus = taskBonusMap[supplementaryTaskType as keyof typeof taskBonusMap] || 0;
    return (base * (1 + seniorityInfo.bonus + taskBonus)).toFixed(2);
  }, [hourlyRate, seniorityInfo.bonus, supplementaryTaskType]);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const availableVehicles = useMemo(() => {
    const v: string[] = [];
    if (roles.includes('dea') || roles.includes('auxiliary')) {
      v.push('ASSU', 'AMBU', 'VSL');
    }
    if (roles.includes('taxi')) {
      v.push('TAXI');
    }
    return v.length > 0 ? v : ['ASSU', 'AMBU', 'VSL'];
  }, [roles]);

  // Automatisation du cumul des CP (chaque 1er du mois) - Déjà géré dans checkMonthlyReport

  useEffect(() => {
    // Initialisation des canaux et permissions
    setupNotificationChannels();
    if (pushEnabled) {
      requestNotificationPermissions();
    }
    if (autoGeo) {
      requestLocationPermissions();
    }
  }, [pushEnabled, autoGeo]);

  useEffect(() => {
    if (!autoGeo || !navigator.geolocation) return;

    let watchId: number | null = null;
    let usingFallback = false;

    const startWatching = (highAccuracy: boolean) => {
      console.log(`Géolocalisation: Initialisation du suivi (Haute Précision: ${highAccuracy})...`);
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setCurrentGeoPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          console.warn(`Erreur de suivi GPS (Haute Précision: ${highAccuracy}):`, err.message, "Code:", err.code);
          
          if (highAccuracy && !usingFallback) {
            console.log("Repli de suivi automatique: Passage en précision standard (Wi-Fi/Cellules) pour contourner la mauvaise réception...");
            usingFallback = true;
            if (watchId !== null) {
              navigator.geolocation.clearWatch(watchId);
              watchId = null;
            }
            startWatching(false);
          } else {
            if (err.code === 1 || err.message.includes('permission') || err.message.includes('policy')) {
              console.warn("L'accès au suivi de position GPS est restreint ou désactivé par la politique de sécurité.");
            } else {
              console.warn("Suivi de position GPS indisponible actuellement :", err.message);
            }
          }
        },
        { 
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 5000 : 15000,
          maximumAge: 5000
        }
      );
    };

    startWatching(true);

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [autoGeo]);

  const addLog = useCallback((action: string, type: ActivityLog['type']) => {
    const now = currentTime;
    let locationInfo: string | null = null;
    if (autoGeo && currentGeoPosition) {
      locationInfo = `Lat: ${currentGeoPosition.latitude.toFixed(5)}, Lng: ${currentGeoPosition.longitude.toFixed(5)}`;
    }
    const newLog: ActivityLog = { id: Math.random().toString(36).substr(2, 9), action, time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), timestamp: now, location: locationInfo || undefined, type };
    // We use locationInfo || undefined to respect the type, but sanitizeData will handle it.
    // Actually, let's keep it null for Firestore safety if we weren't sanitizing, 
    // but with sanitizeData, undefined will be dropped.
    // Let's use a cleaner approach:
    const finalLog = sanitizeData(newLog);
    setLogs(prev => [finalLog, ...prev]);
  }, [currentTime, autoGeo, currentGeoPosition]);

  const handleSearchRestaurants = async () => {
    setLoading(true);
    setSearchLoading(true);
    setError(null);
    setRestaurants([]);
    setSuggestedRestaurants([]);

    const getGPSCoordinates = (): Promise<{ latitude: number; longitude: number }> => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("La géolocalisation n'est pas supportée par ce navigateur."));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (err) => {
            console.warn("Échec Tentative GPS Matériel (Haute Précision):", err.message);
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude
                });
              },
              (fallbackErr) => {
                reject(new Error(`Impossible de récupérer votre position GPS (triangulation réseau échouée) : ${fallbackErr.message}`));
              },
              { enableHighAccuracy: false, timeout: 5000 }
            );
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      });
    };

    try {
      let coords;
      try {
        coords = await getGPSCoordinates();
      } catch (gpsError: any) {
        console.warn("Échec de la récupération GPS pour la recherche des restaurants :", gpsError.message);
        setError("Géolocalisation requise : Vrai GPS ou triangulation réseau indisponible. L'activation de la géolocalisation du smartphone/navigateur est obligatoire pour trouver de vrais restaurants réels à proximité.");
        setLoading(false);
        setSearchLoading(false);
        return; // Échec GPS bloquant l'application pour empêcher toute recherche bidon ou erronée
      }

      console.log(`Recherche de restos avec coordinates réelles: Lat ${coords.latitude}, Lng ${coords.longitude}, Véhicule: ${selectedVehicleType}`);
      const results = await getFiveNearbyRestaurants(
        selectedVehicleType,
        coords.latitude,
        coords.longitude,
        modeTransport,
        maxDuration
      );

      if (results && results.length > 0) {
        setRestaurants(results);
        setSuggestedRestaurants(results);
      } else {
        setRestaurants([]);
        setSuggestedRestaurants([]);
        if (!error) {
          setError("Aucun établissement réel de restauration trouvé dans un rayon de trajet acceptable autour de votre position.");
        }
      }
    } catch (apiError: any) {
      console.error("Erreur serveur/APIs recherche restaurant:", apiError);
      setError("Une erreur est survenue lors de la recherche des restaurants : " + (apiError.message || String(apiError)));
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  const handleSearchRestos = handleSearchRestaurants;

  const handleStartService = useCallback((idToUse?: string | null, customStartTime?: Date, vehicleType?: string) => {
    let actualId = idToUse;
    let actualStartTime = customStartTime;
    let actualVehicle = vehicleType || '';

    // Support both signatures:
    // 1. (idToUse, customStartTime, vehicleType)
    // 2. ('ASSU' or 'AMBU', customStartTime)
    if (idToUse === 'ASSU' || idToUse === 'AMBU' || idToUse === 'VSL' || idToUse === 'SOLIDARITE' || idToUse === 'TAXI') {
      actualId = null;
      actualVehicle = idToUse;
      actualStartTime = customStartTime;
    }

    const now = actualStartTime || currentTime;
    const todayStr = getLocalDateString(now);
    const actualStartTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const preciseStart = now.toISOString();

    // Clear the canceled flag since we are starting a shift
    localStorage.removeItem('ambuflow_canceled_today');
    
    // On cherche si on a déjà une mission pour aujourd'hui
    const todayShift = shifts.find(s => s.day === todayStr && !s.isLeave);
    const finalId = actualId || todayShift?.id || activeShiftId;

    if (finalId) {
      const existingShift = shifts.find(s => s.id === finalId);
      if (existingShift && existingShift.day === todayStr) {
        // On met à jour la mission existante d'aujourd'hui
        setShifts(prev => prev.map(s => s.id === finalId ? { 
          ...s, 
          start: (s.start && s.start !== '--:--') ? s.start : actualStartTimeStr,
          preciseStart: s.preciseStart || preciseStart,
          vehicle: actualVehicle || s.vehicle || 'ASSU'
        } : s));
        setActiveShiftId(finalId);
      } else {
        // Mission d'un autre jour ou non trouvée, on en crée une nouvelle pour aujourd'hui
        const newShiftId = Math.random().toString(36).substr(2, 9);
        const newShift: Shift = { 
          id: newShiftId, 
          day: todayStr, 
          start: actualStartTimeStr, 
          preciseStart: preciseStart,
          end: '--:--', 
          crew: userName || 'À définir', 
          vehicle: actualVehicle || 'ASSU', 
          breaks: [] 
        };
        setShifts(prev => [newShift, ...prev]);
        setActiveShiftId(newShiftId);
      }
    } else {
      // Aucune mission, on en crée une nouvelle
      const newShiftId = Math.random().toString(36).substr(2, 9);
      const newShift: Shift = { 
        id: newShiftId, 
        day: todayStr, 
        start: actualStartTimeStr, 
        preciseStart: preciseStart,
        end: '--:--', 
        crew: userName || 'À définir', 
        vehicle: actualVehicle || 'ASSU', 
        breaks: [] 
      };
      setShifts(prev => [newShift, ...prev]);
      setActiveShiftId(newShiftId);
    }

    setStatus(ServiceStatus.WORKING);
    setSessionStartTime(now);
    addLog("Début de service", "start");
    setNextAutoStart(null);
    setScheduledShiftId(null);
    addNotification("SERVICE ACTIVÉ", "Prudence sur la route.", "success");
  }, [currentTime, activeShiftId, addLog, addNotification, userName, shifts]);

  const handleAutoStartService = useCallback((shiftId: string, startTime: string, shiftDay: string) => {
    const [h, m] = startTime.split(':').map(Number);
    const [y, mon, d] = shiftDay.split('-').map(Number);
    const startDate = new Date(y, mon - 1, d, h, m, 0, 0);
    setScheduledShiftId(shiftId);
    setNextAutoStart(startDate);
    setActiveTab('home');
    addNotification("PLANIFICATION", `Prise de poste prévue le ${d}/${mon} à ${startTime}`, "info");
  }, [addNotification]);

  const handleEndService = useCallback(() => {
    const now = currentTime;
    const endTimeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    
    if (activeShiftId) {
      const shiftToFinish = shifts.find(s => s.id === activeShiftId);
      if (shiftToFinish) {
        const finishedShift = { ...shiftToFinish, end: endTimeStr };
        setLastFinishedShift(finishedShift);
        setShifts(prev => prev.map(s => s.id === activeShiftId ? finishedShift : s));
        setShowDailyRecap(true);
      }
    }
    
    setStatus(ServiceStatus.OFF);
    setSessionStartTime(null);
    addLog("Fin de service", "end");
    setActiveShiftId(null);
    setBreakEndTimeActual(null);
    setBreakStartDateTime(null);
    addNotification("FIN DE SERVICE", "Repos mérité !", "info");
  }, [currentTime, activeShiftId, addLog, addNotification, shifts]);

  const stopServiceSilently = useCallback(() => {
    setStatus(ServiceStatus.OFF);
    setSessionStartTime(null);
    setActiveShiftId(null);
    setBreakEndTimeActual(null);
    setBreakStartDateTime(null);
    addLog("Clôture de service (via Agenda)", "end");
    addNotification("MISSION CLÔTURÉE", "Le compteur journalier a été arrêté.", "info");
  }, [addLog, addNotification]);

  const handleEndShift = useCallback(() => {
    handleEndService();
  }, [handleEndService]);

  const clearAllShifts = useCallback(async () => {
    try {
      setDeleteError(null);
      
      // Update local state first
      setShifts([]);
      stopServiceSilently();

      // Clear from Firestore immediately
      if (user && user.uid !== 'local_user' && !(window as any).firestoreQuotaExceeded) {
        const configRef = doc(db, 'users', user.uid);
        await setDoc(configRef, sanitizeData({ shifts: [], updatedAt: new Date().toISOString() }), { merge: true });
      }
      
      addNotification("Planning vidé", "Toutes les entrées ont été supprimées avec succès.", "success");
    } catch (error: any) {
      console.error("Error clearing shifts inside Firestore:", error);
      setDeleteError("Erreur lors de la suppression définitive du planning.");
      addNotification("Erreur de suppression", "Impossible de vider le planning.", "error");
    }
  }, [user, stopServiceSilently, addNotification]);

  const deleteShift = useCallback(async (id: string) => {
    try {
      setDeleteError(null);
      const shiftToDelete = shifts.find(s => s.id === id);
      const updatedShifts = shifts.filter(s => s.id !== id);
      
      // Update local state
      setShifts(updatedShifts);

      const todayStr = getLocalDateString(currentTime);
      const isTodayShift = shiftToDelete && shiftToDelete.day === todayStr;

      if (activeShiftId === id || isTodayShift) {
        setActiveShiftId(null);
        stopServiceSilently();
        
        // SÉCURITÉ BOARD : On force la réinitialisation complète du statut de service et des states
        setServiceStatus('OFF');
        setStatus(ServiceStatus.OFF);
        setCurrentShift(null);
        setBreaks([]);
        setSessionStartTime(null);
        setBreakEndTimeActual(null);
        setBreakStartDateTime(null);

        // NETTOYAGE MÉMOIRE : On détruit définitivement les persistances pour éviter la résurrection du shift
        localStorage.removeItem('ambu_service_status');
        localStorage.removeItem('ambu_current_shift');
        localStorage.removeItem('ambuflow_status');
        localStorage.removeItem('ambuflow_active_shift_id');
        localStorage.removeItem('ambuflow_break_start_datetime');
        localStorage.removeItem('ambuflow_break_end');
        localStorage.removeItem('ambu_daily_minutes');
        localStorage.removeItem('ambu_break_minutes');
        localStorage.removeItem('ambu_is_on_break');
        localStorage.removeItem('ambu_break_start_time');
      }

      // Update Firestore directly
      if (user && user.uid !== 'local_user' && !(window as any).firestoreQuotaExceeded) {
        const configRef = doc(db, 'users', user.uid);
        await setDoc(configRef, sanitizeData({ shifts: updatedShifts, status: (activeShiftId === id || isTodayShift) ? ServiceStatus.OFF : status, activeShiftId: (activeShiftId === id || isTodayShift) ? null : activeShiftId, updatedAt: new Date().toISOString() }), { merge: true });
      }
      addNotification("Mission supprimée", "L'entrée du planning a été retirée.", "success");
    } catch (error: any) {
      console.error("Error deleting shift inside Firestore:", error);
      setDeleteError("Erreur lors de la suppression de la mission.");
      addNotification("Erreur de suppression", "Impossible de supprimer la mission.", "error");
    }
  }, [user, shifts, activeShiftId, currentTime, status, stopServiceSilently, addNotification]);

  const deleteCurrentShift = useCallback(async () => {
    const todayStr = getLocalDateString(currentTime);
    const todayShift = shifts.find(s => s.day === todayStr);
    const idDocumentFirestore = todayShift?.id || activeShiftId;
    
    try {
      setDeleteError(null);
      
      // 1. ARRÊT CHRONO ET EXTINCTION VISUELLE IMMÉDIATE (AVANT LES REQUÊTES RÉSEAU)
      setServiceStatus('OFF');
      setStatus(ServiceStatus.OFF);
      setCurrentShift(null);
      setBreaks([]);
      setActiveShiftId(null);
      setSessionStartTime(null);
      setBreakEndTimeActual(null);
      setBreakStartDateTime(null);

      // 2. NETTOYAGE FORCE DU TABLEAU LOCAL
      const updatedShifts = shifts.filter(s => s.id !== idDocumentFirestore && s.day !== todayStr);
      setShifts(updatedShifts);

      // 3. SUPPRESSION DANS FIRESTORE
      if (idDocumentFirestore && user && user.uid !== 'local_user' && !(window as any).firestoreQuotaExceeded) {
        try {
          await deleteDoc(doc(db, 'shifts', idDocumentFirestore));
        } catch (fsErr) {
          console.info("Info: Aucun document individuel correspondant dans la collection secondaire 'shifts'.");
        }
      }

      // Sync with Firestore profile users configuration if logged in
      if (user && user.uid !== 'local_user' && !(window as any).firestoreQuotaExceeded) {
        const configRef = doc(db, 'users', user.uid);
        await setDoc(configRef, sanitizeData({ 
          shifts: updatedShifts, 
          status: ServiceStatus.OFF,
          activeShiftId: null,
          updatedAt: new Date().toISOString() 
         }), { merge: true });
      }
      
      addNotification("Journée annulée", "La garde de la journée a été supprimée.", "success");
    } catch (error: any) {
      console.error("Error deleting current day shift inside Firestore:", error);
      setDeleteError("Erreur lors de la suppression de la journée.");
      addNotification("Erreur de suppression", "Impossible d'annuler la journée.", "error");
    }
  }, [user, shifts, activeShiftId, currentTime, addNotification]);

  const handleAnnulerJournee = async (forceWithoutConfirm = false) => {
    if (!forceWithoutConfirm && !window.confirm("Voulez-vous vraiment annuler cette journée ? Toutes les heures et pauses d'aujourd'hui seront effacées.")) {
      return;
    }

    try {
      // ÉTAPE A : On simule l'extinction complète et immédiate du bouton principal "FINIR"
      setServiceStatus('OFF'); 
      setBreaks([]);
      setStatus(ServiceStatus.OFF);
      
      // ÉTAPE B : On libère la mémoire de l'application
      const todayStr = getLocalDateString(currentTime);
      localStorage.setItem('ambuflow_canceled_today', todayStr);
      
      // ÉTAPE C : Destruction chirurgicale dans Firestore
      const shiftDuJour = shifts.find(s => s.day === todayStr);
      const idDocumentFirestore = shiftDuJour?.id || activeShiftId;
      if (idDocumentFirestore && user && user.uid !== 'local_user' && !(window as any).firestoreQuotaExceeded) {
        try {
          await deleteDoc(doc(db, "shifts", idDocumentFirestore));
        } catch (fsErr) {
          console.info("Info: Aucun document individuel correspondant dans la collection secondaire 'shifts'.");
        }
      }

      // ÉTAPE D : On vide le state pour forcer la disparition de la journée à l'écran
      const updatedShifts = shifts.filter(s => s.id !== idDocumentFirestore && s.day !== todayStr);
      setShifts(updatedShifts);
      setCurrentShift(null);

      // Nettoyage complet
      setActiveShiftId(null);
      setSessionStartTime(null);
      setBreakEndTimeActual(null);
      setBreakStartDateTime(null);

      // Synchroniser avec la configuration utilisateur Firestore si possible
      if (user && user.uid !== 'local_user' && !(window as any).firestoreQuotaExceeded) {
        const configRef = doc(db, 'users', user.uid);
        await setDoc(configRef, sanitizeData({ 
          shifts: updatedShifts, 
          status: ServiceStatus.OFF,
          activeShiftId: null,
          updatedAt: new Date().toISOString() 
        }), { merge: true });
      }

      alert("Journée annulée avec succès et planning libéré !");
    } catch (error) {
      console.error("Erreur lors du déverrouillage :", error);
    }
  };

  const handleResetAll = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir annuler et supprimer la journée en cours ? Toutes les heures d'aujourd'hui seront effacées.")) {
      setServiceStatus('OFF');
      setStatus(ServiceStatus.OFF);
      setCurrentShift(null);
      setDailyMinutes(0);
      setBreakMinutes(0);
      setIsOnBreak(false);

      localStorage.removeItem('ambu_service_status');
      localStorage.removeItem('ambu_current_shift');
      localStorage.removeItem('ambu_daily_minutes');
      localStorage.removeItem('ambu_break_minutes');
      localStorage.removeItem('ambu_is_on_break');
      localStorage.removeItem('ambu_break_start_time');
      localStorage.removeItem('ambuflow_status');
      localStorage.removeItem('ambuflow_active_shift_id');
      localStorage.removeItem('ambuflow_break_start_datetime');
      localStorage.removeItem('ambuflow_break_end');

      await handleAnnulerJournee(true);
    }
  };

  const handleResume = useCallback(async (customTime?: Date) => {
    const resumeTime = customTime || new Date();
    
    // First, let's prepare the updated shifts locally so we can write immediately
    let updatedShifts = [...shifts];
    if (activeShiftId && status === ServiceStatus.BREAK) {
      updatedShifts = shifts.map(s => {
        if (s.id === activeShiftId && s.breaks && s.breaks.length > 0) {
          const updatedBreaks = [...s.breaks];
          const lastIndex = updatedBreaks.length - 1;
          const lastBreak = { ...updatedBreaks[lastIndex] };
          
          // Calcul de la durée réelle consommée
          const [startH, startM] = lastBreak.start.split(':').map(Number);
          const startDate = new Date(resumeTime);
          startDate.setHours(startH, startM, 0, 0);
          
          let diffMs = resumeTime.getTime() - startDate.getTime();
          // Si le diff est négatif, c'est que la pause a traversé minuit
          if (diffMs < 0) {
            diffMs += 24 * 60 * 60 * 1000;
          }
          
          let actualDuration = Math.round(diffMs / 60000);
          actualDuration = Math.min(90, Math.max(1, actualDuration));
          
          lastBreak.duration = actualDuration;
          lastBreak.end = resumeTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          updatedBreaks[lastIndex] = lastBreak;
          
          return { ...s, breaks: updatedBreaks };
        }
        return s;
      });
    }

    // Prepare updated logs locally
    let locationInfo: string | null = null;
    if (autoGeo && currentGeoPosition) {
      locationInfo = `Lat: ${currentGeoPosition.latitude.toFixed(5)}, Lng: ${currentGeoPosition.longitude.toFixed(5)}`;
    }
    const newLog: ActivityLog = { 
      id: Math.random().toString(36).substr(2, 9), 
      action: "Reprise de mission", 
      time: resumeTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), 
      timestamp: resumeTime, 
      location: locationInfo || undefined, 
      type: "resume" 
    };
    const finalLog = sanitizeData(newLog);
    const updatedLogs = [finalLog, ...logs];

    // 1. Update state synchronously
    setShifts(updatedShifts);
    setLogs(updatedLogs);
    setStatus(ServiceStatus.WORKING);
    setBreakEndTimeActual(null);
    setBreakStartDateTime(null);

    // Save end break states to localStorage immediately
    localStorage.removeItem('ambuflow_break_start_datetime');
    localStorage.removeItem('ambuflow_break_end');

    // 2. Direct database update to Firestore
    if (user && user.uid !== 'local_user' && (user as any).uid !== 'admin') {
      const config = {
        userName,
        profileImage,
        jobTitle,
        hourlyRate,
        companyName,
        companyCity,
        firstName,
        lastName,
        qualifications,
        entryDate,
        workRegime,
        monthlyHours,
        leaveCalculation,
        autoGeo,
        hasDea,
        hasAux,
        hasTaxiCard,
        primaryGraduationDate,
        deaDate,
        auxDate,
        taxiDate,
        taxiCardExpiryDate,
        taxiFpcDate,
        afgsuDate,
        medicalExpiryDate,
        contractStartDate,
        contractType,
        hoursBase,
        cpCalculationMode,
        modulationStartDate,
        modulationWeeks,
        initialCpBalance,
        lastCpAccrualDate,
        customHours,
        weekendDays,
        pushEnabled,
        followSystemTheme,
        themeChoice,
        onboarded,
        roles,
        primaryRole,
        weeklyContractHours,
        overtimeMode,
        payRateMode,
        supplementaryTaskType,
        status: ServiceStatus.WORKING,
        activeShiftId,
        scheduledShiftId,
        nextAutoStart: nextAutoStart?.toISOString() || null,
        shifts: updatedShifts,
        logs: updatedLogs,
        breakStartDateTime: null,
        breakEndTimeActual: null,
        notifications: notifications.map(n => ({
          ...n,
          timestamp: n.timestamp instanceof Date ? n.timestamp.toISOString() : n.timestamp
        })),
        updatedAt: new Date().toISOString()
      };

      try {
        const { notifications: _, ...configToSave } = config;
        localStorage.setItem('ambuflow_config', JSON.stringify(configToSave));

        const sanitizedConfig = sanitizeData(config);
        console.log("Firestore: Direct saving break completion status to database...");
        await setDoc(doc(db, 'users', user.uid), sanitizedConfig, { merge: true });
        console.log("Firestore: Direct saving completed successfully!");
        
        // Quota recovery mechanism: if it succeeded, clear any quota flags!
        if ((window as any).firestoreQuotaExceeded || localStorage.getItem('firestore_quota_exceeded') === 'true') {
          console.log("Firestore: Quota error cleared upon successful direct transaction!");
          (window as any).firestoreQuotaExceeded = false;
          localStorage.removeItem('firestore_quota_exceeded');
          setIsQuotaExceeded(false);
          await enableNetwork(db).catch(err => console.error("Could not re-enable network:", err));
        }
      } catch (error) {
        console.error("Error direct-saving break end to Firestore:", error);
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  }, [
    activeShiftId,
    status,
    shifts,
    logs,
    autoGeo,
    currentGeoPosition,
    user,
    userName,
    profileImage,
    jobTitle,
    hourlyRate,
    companyName,
    companyCity,
    firstName,
    lastName,
    qualifications,
    entryDate,
    workRegime,
    monthlyHours,
    leaveCalculation,
    hasDea,
    hasAux,
    hasTaxiCard,
    primaryGraduationDate,
    deaDate,
    auxDate,
    taxiDate,
    taxiCardExpiryDate,
    taxiFpcDate,
    afgsuDate,
    medicalExpiryDate,
    contractStartDate,
    contractType,
    hoursBase,
    cpCalculationMode,
    modulationStartDate,
    modulationWeeks,
    initialCpBalance,
    lastCpAccrualDate,
    customHours,
    weekendDays,
    pushEnabled,
    followSystemTheme,
    themeChoice,
    onboarded,
    roles,
    primaryRole,
    weeklyContractHours,
    overtimeMode,
    payRateMode,
    supplementaryTaskType,
    scheduledShiftId,
    nextAutoStart,
    notifications
  ]);

  const handleOpenBreakModal = useCallback((type: 'meal' | 'coffee') => {
    setBreakType(type);
    setBreakStartTime(currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    setBreakDuration(type === 'meal' ? 30 : 20);
    setBreakLocation('Entreprise');
    setShowBreakModal(true);
  }, [currentTime]);

  const handleModifyBreak = useCallback(() => {
    if (activeShiftId) {
      const activeShift = shifts.find(s => s.id === activeShiftId);
      const lastBreak = activeShift?.breaks?.[activeShift.breaks.length - 1];
      if (lastBreak) {
        setBreakType(lastBreak.isMeal ? 'meal' : 'coffee');
        setBreakStartTime(lastBreak.start);
        setBreakDuration(lastBreak.duration);
        setBreakLocation(lastBreak.location);
        setShowBreakModal(true);
      }
    }
  }, [activeShiftId, shifts]);

  const handleConfirmBreak = useCallback(async () => {
    // breakStartTime handles the "Début de pause" selected by the user (e.g. "12:00")
    const hParts = breakStartTime.split(':').map(Number);
    const startDate = new Date();
    if (hParts.length === 2 && !isNaN(hParts[0]) && !isNaN(hParts[1])) {
      startDate.setHours(hParts[0], hParts[1], 0, 0);
    }

    const safeDuration = Math.min(90, Math.max(1, breakDuration));
    const durationMs = safeDuration * 60000;
    const endDate = new Date(startDate.getTime() + durationMs);
    
    setBreakStartDateTime(startDate);
    setBreakEndTimeActual(endDate);
    
    // Format the start/end times precisely based on the start moment chosen
    const actualStartTimeStr = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    const endTimeStr = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Persist immediately to localStorage
    localStorage.setItem('ambuflow_break_start_datetime', startDate.toISOString());
    localStorage.setItem('ambuflow_break_end', endDate.toISOString());

    let updatedShifts = [...shifts];
    if (activeShiftId) {
      const newBreak: Break = {
        id: Math.random().toString(36).substr(2, 9),
        start: actualStartTimeStr,
        end: endTimeStr,
        duration: safeDuration,
        location: breakType === 'meal' ? breakLocation : 'Entreprise',
        isMeal: breakType === 'meal'
      };
      
      updatedShifts = shifts.map(s => {
        if (s.id === activeShiftId) {
          const breaks = s.breaks || [];
          // Si on est déjà en pause, on modifie la dernière
          if (status === ServiceStatus.BREAK && breaks.length > 0) {
            const updatedBreaks = [...breaks];
            updatedBreaks[updatedBreaks.length - 1] = { 
              ...updatedBreaks[updatedBreaks.length - 1], 
              ...newBreak, 
              id: updatedBreaks[updatedBreaks.length - 1].id 
            };
            return { ...s, breaks: updatedBreaks };
          }
          return { ...s, breaks: [...breaks, newBreak] };
        }
        return s;
      });
      setShifts(updatedShifts);
    }
    
    let nextStatus = status;
    const logAction = breakType === 'meal' 
      ? (status === ServiceStatus.BREAK ? "Modification Déjeuner" : "Pause Déjeuner") 
      : (status === ServiceStatus.BREAK ? "Modification Café" : "Pause Café");
    
    if (status !== ServiceStatus.BREAK) {
      nextStatus = ServiceStatus.BREAK;
      setStatus(ServiceStatus.BREAK);
    }
    
    // Prepare updated logs locally
    let locationInfo: string | null = null;
    if (autoGeo && currentGeoPosition) {
      locationInfo = `Lat: ${currentGeoPosition.latitude.toFixed(5)}, Lng: ${currentGeoPosition.longitude.toFixed(5)}`;
    }
    const newLog: ActivityLog = { 
      id: Math.random().toString(36).substr(2, 9), 
      action: logAction, 
      time: startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), 
      timestamp: startDate, 
      location: locationInfo || undefined, 
      type: "break" 
    };
    const finalLog = sanitizeData(newLog);
    const updatedLogs = [finalLog, ...logs];
    setLogs(updatedLogs);

    // Save break states to localStorage immediately
    localStorage.setItem('ambuflow_status', nextStatus);
    localStorage.setItem('ambuflow_logs', JSON.stringify(updatedLogs));
    localStorage.setItem('ambuflow_shifts', JSON.stringify(updatedShifts));

    // Direct database update to Firestore for break start as requested.
    if (user && user.uid !== 'local_user' && (user as any).uid !== 'admin') {
      const config = {
        userName,
        profileImage,
        jobTitle,
        hourlyRate,
        companyName,
        companyCity,
        firstName,
        lastName,
        qualifications,
        entryDate,
        workRegime,
        monthlyHours,
        leaveCalculation,
        autoGeo,
        hasDea,
        hasAux,
        hasTaxiCard,
        primaryGraduationDate,
        deaDate,
        auxDate,
        taxiDate,
        taxiCardExpiryDate,
        taxiFpcDate,
        afgsuDate,
        medicalExpiryDate,
        contractStartDate,
        contractType,
        hoursBase,
        cpCalculationMode,
        modulationStartDate,
        modulationWeeks,
        initialCpBalance,
        lastCpAccrualDate,
        customHours,
        weekendDays,
        pushEnabled,
        followSystemTheme,
        themeChoice,
        onboarded,
        roles,
        primaryRole,
        weeklyContractHours,
        overtimeMode,
        payRateMode,
        supplementaryTaskType,
        status: nextStatus,
        activeShiftId,
        scheduledShiftId,
        nextAutoStart: nextAutoStart?.toISOString() || null,
        shifts: updatedShifts,
        logs: updatedLogs,
        breakStartDateTime: startDate.toISOString(),
        breakEndTimeActual: endDate.toISOString(),
        notifications: notifications.map(n => ({
          ...n,
          timestamp: n.timestamp instanceof Date ? n.timestamp.toISOString() : n.timestamp
        })),
        updatedAt: new Date().toISOString()
      };

      try {
        const { notifications: _, ...configToSave } = config;
        localStorage.setItem('ambuflow_config', JSON.stringify(configToSave));

        const sanitizedConfig = sanitizeData(config);
        console.log("Firestore: Direct saving break start status to database...");
        await setDoc(doc(db, 'users', user.uid), sanitizedConfig, { merge: true });
        console.log("Firestore: Direct saving start completed successfully!");
      } catch (error) {
        console.error("Error direct-saving break start to Firestore:", error);
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    }
    
    setShowBreakModal(false);
    setActiveTab('home'); // Redirection vers le Board
  }, [
    breakStartTime,
    breakDuration,
    breakLocation,
    breakType,
    activeShiftId,
    status,
    shifts,
    logs,
    autoGeo,
    currentGeoPosition,
    user,
    userName,
    profileImage,
    jobTitle,
    hourlyRate,
    companyName,
    companyCity,
    firstName,
    lastName,
    qualifications,
    entryDate,
    workRegime,
    monthlyHours,
    leaveCalculation,
    hasDea,
    hasAux,
    hasTaxiCard,
    primaryGraduationDate,
    deaDate,
    auxDate,
    taxiDate,
    taxiCardExpiryDate,
    taxiFpcDate,
    afgsuDate,
    medicalExpiryDate,
    contractStartDate,
    contractType,
    hoursBase,
    cpCalculationMode,
    modulationStartDate,
    modulationWeeks,
    initialCpBalance,
    lastCpAccrualDate,
    customHours,
    weekendDays,
    pushEnabled,
    followSystemTheme,
    themeChoice,
    onboarded,
    roles,
    primaryRole,
    weeklyContractHours,
    overtimeMode,
    payRateMode,
    supplementaryTaskType,
    scheduledShiftId,
    nextAutoStart,
    notifications
  ]);

  const renderBreakTimer = useCallback(() => {
    if (!breakStartDateTime || !breakEndTimeActual) return "00:00";
    if (currentTime < breakStartDateTime) {
      const diff = breakStartDateTime.getTime() - currentTime.getTime();
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    const nowMs = currentTime.getTime();
    if (nowMs >= breakEndTimeActual.getTime()) {
      return "PAUSE EXPIRÉE";
    }
    const diffMs = breakEndTimeActual.getTime() - nowMs;
    const totalSecsLeft = Math.max(0, Math.floor(diffMs / 1000));
    const m = Math.floor(totalSecsLeft / 60);
    const s = totalSecsLeft % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, [breakStartDateTime, breakEndTimeActual, currentTime]);

  const handleLogout = useCallback(async () => {
    try {
      await auth.signOut();
      setUser(null);
      // We don't clear localStorage.getItem('ambuflow_config') as per requirements
      localStorage.removeItem('ambuflow_auth_session');
      setActiveTab('home');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, []);

  const handleResetData = useCallback(async () => {
    isResettingRef.current = true;
    try {
      // 1. Prepare initial state but preserve critical identity if logged in
      let email = "guest@ambuflow.com";
      let createdAt = new Date().toISOString();
      
      if (user && user.uid !== 'local_user') {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};
        email = userData.email || user.email || email;
        createdAt = userData.createdAt || createdAt;
      }

      const initialData = {
        email,
        createdAt,
        userName: "",
        profileImage: null,
        jobTitle: "Ambulancier DE",
        hourlyRate: "12.79",
        companyName: "",
        companyCity: "",
        firstName: "",
        lastName: "",
        qualifications: [],
        entryDate: "",
        workRegime: "weekly",
        monthlyHours: "151.67",
        leaveCalculation: "25",
        autoGeo: true,
        hasDea: false,
        hasAux: false,
        hasTaxiCard: false,
        primaryGraduationDate: "",
        deaDate: "",
        auxDate: "",
        taxiDate: "",
        taxiCardExpiryDate: "",
        taxiFpcDate: "",
        afgsuDate: "",
        medicalExpiryDate: "",
        contractStartDate: "",
        contractType: "CDI",
        hoursBase: "35",
        cpCalculationMode: "25",
        modulationStartDate: "",
        modulationWeeks: "4",
        initialCpBalance: 0,
        customHours: "",
        followSystemTheme: true,
        pushEnabled: true,
        onboarded: true, // Onboarding has been removed
        roles: [],
        primaryRole: "",
        weeklyContractHours: 35,
        overtimeMode: "weekly",
        payRateMode: "100_percent",
        activeShiftId: null,
        scheduledShiftId: null,
        shifts: [],
        logs: [],
        updatedAt: new Date().toISOString()
      };

      // 2. Reset Firestore if user is not a guest
      if (user && user.uid !== 'local_user' && !(window as any).firestoreQuotaExceeded) {
        // Clear user document
        await setDoc(doc(db, 'users', user.uid), sanitizeData(initialData));
        
        // Clear all shifts for this user
        const shiftsQuery = query(collection(db, 'shifts'), where('userId', '==', user.uid));
        const shiftsSnapshot = await getDocs(shiftsQuery);
        const batch = writeBatch(db);
        shiftsSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      
      // 3. Clear Local Storage
      localStorage.clear();
      setIsGuest(false);

      // 4. Sign out
      await signOut(auth);

      // 5. Success Feedback & Reload
      addNotification("Compte réinitialisé", "Toutes vos données ont été supprimées et vous avez été déconnecté.", "success");
      
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      if (user && user.uid !== 'local_user') {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      } else {
        console.error("Error resetting local data:", error);
      }
    }
  }, [user, setIsGuest]);

  const [showReauthModal, setShowReauthModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isHardDeleting, setIsHardDeleting] = useState(false);

  const handleHardDelete = useCallback(async () => {
    if (!user || user.uid === 'local_user') {
      await handleResetData();
      return;
    }

    setIsHardDeleting(true);
    setDeleteError(null);
    isResettingRef.current = true;
    console.log("Starting hard delete for user:", user.uid);
    
    try {
      const uid = user.uid;

      // 1. Delete Firestore Data (Cascade)
      // We do this BEFORE deleting the auth user so we still have permissions if rules require it
      const deleteData = async () => {
        if ((window as any).firestoreQuotaExceeded) {
          console.warn("Skipping firestore database cleanup due to quota exceedance");
          return;
        }
        console.log("Deleting user document...");
        await deleteDoc(doc(db, 'users', uid));
        
        console.log("Querying shifts...");
        const shiftsQuery = query(collection(db, 'shifts'), where('userId', '==', uid));
        const shiftsSnapshot = await getDocs(shiftsQuery);
        
        if (!shiftsSnapshot.empty) {
          console.log(`Deleting ${shiftsSnapshot.size} shifts...`);
          const batch = writeBatch(db);
          shiftsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
        
        // Also check for any other possible sub-collections if they existed
        // (Currently only users and shifts are identified)
      };

      try {
        await Promise.race([
          deleteData(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Firestore (30s)")), 30000))
        ]);
      } catch (firestoreError: any) {
        console.error("Firestore cleanup failed or timed out:", firestoreError);
        // If firestore fails (e.g. permission denied), we might still want to delete the account
        // but it's better to warn the user. For now we continue.
      }

      // 2. Delete Firebase Auth User
      console.log("Deleting Auth user...");
      try {
        await deleteUser(user);
      } catch (authError: any) {
        console.error("Auth delete failed:", authError.code, authError.message);
        if (authError.code === 'auth/requires-recent-login') {
          setShowReauthModal(true);
          setIsHardDeleting(false);
          isResettingRef.current = false;
          return;
        }
        throw authError;
      }

      // 3. Cleanup Client State
      console.log("Cleanup local state...");
      localStorage.clear();
      sessionStorage.clear();
      setIsGuest(false);

      // 4. Redirect to Root
      addNotification("Compte supprimé", "Votre compte et vos données ont été définitivement supprimés.", "success");
      
      setTimeout(() => {
        window.location.href = '/';
      }, 500);

    } catch (error: any) {
      console.error("Hard delete total failure:", error);
      setDeleteError(error.message || "Une erreur inattendue est survenue.");
    } finally {
      setIsHardDeleting(false);
      isResettingRef.current = false;
    }
  }, [user, handleResetData, addNotification]);

  // Détecte automatiquement la prochaine embauche / prise de poste planifiée dans l'agenda
  useEffect(() => {
    if (status !== ServiceStatus.OFF) {
      if (scheduledShiftId || nextAutoStart) {
        setScheduledShiftId(null);
        setNextAutoStart(null);
      }
      return;
    }

    if (scheduledShiftId) {
      const scheduledShift = shifts.find(s => s.id === scheduledShiftId);
      if (scheduledShift && scheduledShift.day && scheduledShift.start && !scheduledShift.isLeave && !scheduledShift.isFerieChome) {
        const [h, m] = scheduledShift.start.split(':').map(Number);
        const [y, mon, d] = scheduledShift.day.split('-').map(Number);
        const newNextAutoStart = new Date(y, mon - 1, d, h, m, 0, 0);
        if (!nextAutoStart || nextAutoStart.getTime() !== newNextAutoStart.getTime()) {
          setNextAutoStart(newNextAutoStart);
        }
        return;
      } else {
        setScheduledShiftId(null);
        setNextAutoStart(null);
      }
    }

    const upcomingShifts = shifts.filter(s => {
      if (s.isLeave || s.isFerieChome) return false;
      if (!s.start || s.start === '--:--') return false;
      if (dismissedShiftIds.includes(s.id)) return false;

      try {
        const [h, m] = s.start.split(':').map(Number);
        const [y, mon, d] = s.day.split('-').map(Number);
        const shiftStartDateTime = new Date(y, mon - 1, d, h, m, 0, 0);
        return shiftStartDateTime > currentTime;
      } catch (e) {
        return false;
      }
    });

    if (upcomingShifts.length > 0) {
      upcomingShifts.sort((a, b) => {
        const [ah, am] = a.start.split(':').map(Number);
        const [ay, amon, ad] = a.day.split('-').map(Number);
        const dateA = new Date(ay, amon - 1, ad, ah, am, 0, 0);

        const [bh, bm] = b.start.split(':').map(Number);
        const [by, bmon, bd] = b.day.split('-').map(Number);
        const dateB = new Date(by, bmon - 1, bd, bh, bm, 0, 0);

        return dateA.getTime() - dateB.getTime();
      });

      const nextShift = upcomingShifts[0];
      const [h, m] = nextShift.start.split(':').map(Number);
      const [y, mon, d] = nextShift.day.split('-').map(Number);
      const nextShiftStartDateTime = new Date(y, mon - 1, d, h, m, 0, 0);

      setScheduledShiftId(nextShift.id);
      setNextAutoStart(nextShiftStartDateTime);
    }
  }, [shifts, status, scheduledShiftId, nextAutoStart, dismissedShiftIds, currentTime]);

  useEffect(() => {
    const todayStr = getLocalDateString(currentTime);
    const todayShift = shifts.find(s => s.day === todayStr);
    const isTodayFinished = todayShift && todayShift.end !== '--:--';

    if (status === ServiceStatus.OFF && nextAutoStart && currentTime >= nextAutoStart) {
      if (isTodayFinished && getLocalDateString(nextAutoStart) === todayStr) {
        setNextAutoStart(null);
        setScheduledShiftId(null);
      } else {
        handleStartService(scheduledShiftId, nextAutoStart);
      }
    } else if (status !== ServiceStatus.OFF && nextAutoStart && currentTime >= nextAutoStart) {
      setNextAutoStart(null);
      setScheduledShiftId(null);
    }
  }, [currentTime, nextAutoStart, status, handleStartService, scheduledShiftId, shifts]);

  // 1. ARRIVÉE AUTOMATIQUE À L'HEURE D'EMBAUCHE PRÉVUE (PLANIFICATION DE LA VEILLE)
  useEffect(() => {
    if (configLoading) return;
    if (status === ServiceStatus.OFF && heureEmbauchePrevue) {
      try {
        const todayStr = getLocalDateString(currentTime);
        // Avoid auto-start if today's shift was canceled
        const hasCanceledToday = localStorage.getItem('ambuflow_canceled_today') === todayStr;
        if (hasCanceledToday) {
          return;
        }

        const autostartKey = `ambuflow_autostart_done_${todayStr}`;
        if (localStorage.getItem(autostartKey)) {
          return;
        }

        // Check if there is already a shift today to avoid duplicate auto-starts
        const todayShift = shifts.find(s => s.day === todayStr);
        if (!todayShift || (todayShift.start === '--:--' && todayShift.end === '--:--')) {
          const [h, m] = heureEmbauchePrevue.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            const todayPlannedTime = new Date(currentTime);
            todayPlannedTime.setHours(h, m, 0, 0);
            
            if (currentTime >= todayPlannedTime) {
              localStorage.setItem(autostartKey, 'true');
              handleStartService(null, todayPlannedTime);
              addNotification("EMBAUCHE AUTOMATIQUE", `Votre service a été démarré automatiquement à ${heureEmbauchePrevue}.`, "success");
            }
          }
        }
      } catch (e) {
        console.error("Error in auto starting shift on scheduled time:", e);
      }
    }
  }, [currentTime, configLoading, status, heureEmbauchePrevue, shifts, handleStartService, addNotification]);

  // Listen to visibilitychange / window focus to catch wake-ups immediately
  useEffect(() => {
    const checkWakeUp = () => {
      const now = new Date();
      setCurrentTime(now); // Force clock sync immediately

      const savedEnd = localStorage.getItem('ambuflow_break_end');
      if (status === ServiceStatus.BREAK && savedEnd) {
        const endTime = new Date(savedEnd);
        if (now.getTime() >= endTime.getTime()) {
          console.log("Wake up: Break time exceeded, auto-validating pause.");
          handleResume(now);
        }
      }
    };

    document.addEventListener('visibilitychange', checkWakeUp);
    window.addEventListener('focus', checkWakeUp);
    return () => {
      document.removeEventListener('visibilitychange', checkWakeUp);
      window.removeEventListener('focus', checkWakeUp);
    };
  }, [status, handleResume]);

  useEffect(() => {
    if (status === ServiceStatus.BREAK && breakEndTimeActual && currentTime >= breakEndTimeActual) {
      handleResume(currentTime);
    }
  }, [currentTime, status, breakEndTimeActual, handleResume]);



  useEffect(() => {
    localStorage.setItem('ambuflow_status', status);
    localStorage.setItem('ambuflow_logs', JSON.stringify(logs));
    localStorage.setItem('ambuflow_shifts', JSON.stringify(shifts));
    localStorage.setItem('ambuflow_active_shift_id', activeShiftId || "");
    localStorage.setItem('ambuflow_scheduled_shift_id', scheduledShiftId || "");
    localStorage.setItem('ambuflow_heure_embauche_prevue', heureEmbauchePrevue || "");
    if (nextAutoStart) localStorage.setItem('ambuflow_next_autostart', nextAutoStart.toISOString());
    else localStorage.removeItem('ambuflow_next_autostart');
    
    if (breakStartDateTime) localStorage.setItem('ambuflow_break_start_datetime', breakStartDateTime.toISOString());
    else localStorage.removeItem('ambuflow_break_start_datetime');

    if (breakEndTimeActual) localStorage.setItem('ambuflow_break_end', breakEndTimeActual.toISOString());
    else localStorage.removeItem('ambuflow_break_end');

    localStorage.setItem('ambuflow_notifications', JSON.stringify(notifications));
    localStorage.setItem('ambuflow_user_stats', JSON.stringify(userStats));
  }, [status, logs, activeShiftId, scheduledShiftId, heureEmbauchePrevue, shifts, nextAutoStart, breakStartDateTime, breakEndTimeActual, userStats, notifications]);

  // Logique AFGSU
  const afgsuStatus = useMemo(() => {
    if (!afgsuDate) return null;
    const lastDate = new Date(afgsuDate);
    const expiryDate = new Date(lastDate);
    expiryDate.setFullYear(lastDate.getFullYear() + 4);
    
    const diffMs = expiryDate.getTime() - currentTime.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
    
    if (diffMs <= 0) return 'expired';
    if (diffMonths <= 3) return 'warning';
    return 'valid';
  }, [afgsuDate, currentTime]);

  // Logique Aptitude Médicale
  const medicalStatus = useMemo(() => {
    if (!medicalExpiryDate) return null;
    const lastDate = new Date(medicalExpiryDate);
    const expiryDate = new Date(lastDate);
    expiryDate.setFullYear(lastDate.getFullYear() + 5);
    
    const diffMs = expiryDate.getTime() - currentTime.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
    
    if (diffMs <= 0) return 'expired';
    if (diffMonths <= 3) return 'warning';
    return 'valid';
  }, [medicalExpiryDate, currentTime]);

  // Logique Taxi Card
  const taxiCardStatus = useMemo(() => {
    if (!hasTaxiCard || !taxiCardExpiryDate) return null;
    const expiryDate = new Date(taxiCardExpiryDate);
    const diffMs = expiryDate.getTime() - currentTime.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
    if (diffMs <= 0) return 'expired';
    if (diffMonths <= 3) return 'warning';
    return 'valid';
  }, [hasTaxiCard, taxiCardExpiryDate, currentTime]);

  // Logique Taxi FPC (5 ans)
  const taxiFpcStatus = useMemo(() => {
    if (!hasTaxiCard || !taxiFpcDate) return null;
    const lastDate = new Date(taxiFpcDate);
    const expiryDate = new Date(lastDate);
    expiryDate.setFullYear(lastDate.getFullYear() + 5);
    const diffMs = expiryDate.getTime() - currentTime.getTime();
    const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
    if (diffMs <= 0) return 'expired';
    if (diffMonths <= 3) return 'warning';
    return 'valid';
  }, [hasTaxiCard, taxiFpcDate, currentTime]);

  const leaveBalances = useMemo(() => {
    let usedCp = 0;
    
    shifts.forEach(s => {
      if (s.isLeave || s.vehicle === 'CONGÉ') {
        if (s.leaveType === 'CP') usedCp += 1;
      }
    });
    
    const baseCp = typeof initialCpBalance === 'number' && !isNaN(initialCpBalance) && initialCpBalance > 0 ? initialCpBalance : 23.17;
    return {
      cp: baseCp,
      usedCp: 0
    };
  }, [shifts, initialCpBalance]);

  const getDuration = () => {
    const activeShift = shifts.find(s => s.id === activeShiftId);
    if (!activeShift || !activeShift.start || activeShift.start === '--:--') return "00:00:00";
    
    const [y, mon, d] = (activeShift.day || "").split('-').map(v => parseInt(v) || 0);
    let startDate: Date;

    if (activeShift.preciseStart) {
      startDate = new Date(activeShift.preciseStart);
    } else {
      const [startH, startM] = (activeShift.start || "00:00").split(':').map(v => parseInt(v) || 0);
      startDate = new Date(y, mon - 1, d, startH, startM, 0, 0);
    }
    
    const isCurrentlyInBreak = status === ServiceStatus.BREAK && activeShift.breaks?.length;
    const lastBreak = isCurrentlyInBreak ? activeShift.breaks![activeShift.breaks!.length - 1] : null;
    
    let effectiveNow = isCurrentlyInBreak 
        ? new Date(y, mon - 1, d, parseInt(lastBreak!.start.split(':')[0]), parseInt(lastBreak!.start.split(':')[1]))
        : currentTime;
        
    let diffMs = effectiveNow.getTime() - startDate.getTime();
    if (diffMs < 0) diffMs = 0;
    
    if (activeShift.breaks) {
      activeShift.breaks.forEach(b => { 
        if (b.end !== '--:--' && b.id !== lastBreak?.id) {
          const bDur = Math.min(90, Math.max(0, Number(b.duration) || 0));
          diffMs -= (bDur * 60000); 
        }
      });
    }
    const totalSeconds = Math.floor(Math.max(0, diffMs) / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const calculateEffectiveMinutes = useCallback((shift: Shift): number => {
    const isAbsenceForfaite =
      shift.isCP === true ||
      (shift as any).isCP === 'true' ||
      shift.type === 'CP' ||
      (shift as any).absenceType === 'CP' ||
      (shift as any).leaveType === 'CP' ||
      shift.isFerieChome === true ||
      (shift as any).isFerieChome === 'true' ||
      shift.type === 'FERIE' ||
      (shift as any).minutesForced === 420 ||
      ((shift.isLeave || shift.vehicle === 'CONGÉ') && (shift as any).leaveType === 'CP');

    if (isAbsenceForfaite) {
      // Securing allowances: zero ground allowances or primes
      const repas = false;
      const indemniteUnique = false;
      const indemniteSpeciale = false;
      const dimancheFerie = false;

      return 420; // 7h créditées d'office
    }

    if (shift.start === '--:--') return 0;

    return getShiftMinutes(shift, activeShiftId, status, currentTime);
  }, [activeShiftId, currentTime, status]);

  const periodStats = useMemo(() => {
    let totalMin = 0;
    let cpMinutes = 0;
    let targetMin = (parseInt(hoursBase) || 35) * 60;
    let title = "Semaine";
    let icon = CalendarRange;
    let subtitle = "Période active";
    let color = "indigo";
    let extraData: any = null;

    if (workRegime === 'weekly') {
      shifts
        .filter(s => isSameWeek(parseLocalDate(s.day), currentTime))
        .forEach(s => {
          const isCP = s.isCP === true || (s as any).isCP === 'true' || s.type === 'CP' || (s as any).absenceType === 'CP' || (s as any).leaveType === 'CP' || (s.isLeave && (s as any).leaveType === 'CP') || ((s.isLeave || s.vehicle === 'CONGÉ') && (s as any).leaveType === 'CP');
          const mins = isCP
            ? 420
            : ((s.isFerieChome === true || (s as any).isFerieChome === 'true' || s.type === 'FERIE') ? 420 : getShiftMinutes(s, activeShiftId, status, currentTime));
          
          if (isCP) {
            cpMinutes += mins;
          }
          totalMin += mins;
        });
      title = "Heures Semaine";
      subtitle = "Objectif 35h/39h";
      icon = CalendarRange;
      targetMin = (parseInt(hoursBase) || 35) * 60;
    } else if (workRegime === 'fortnightly') {
      const referenceStartDate = modulationStartDate ? new Date(modulationStartDate) : new Date('2026-04-13'); 
      const cycleWeeks = 2; // Une quinzaine dure strictement 2 semaines
      const { startOfCycle, endOfCycle } = isWithinCustomModulationPeriod(currentTime, referenceStartDate, cycleWeeks, currentTime);

      let minutesTerrain = 0;

      if (Array.isArray(shifts)) {
        shifts.forEach(s => {
          if (!s || !s.day) return;
          const shiftDate = parseLocalDate(s.day);
          if (!shiftDate) return;

          const { isInPeriod } = isWithinCustomModulationPeriod(shiftDate, referenceStartDate, cycleWeeks, currentTime);
          
          if (isInPeriod) {
            const isCP = s.isCP === true || (s as any).isCP === 'true' || s.type === 'CP' || (s as any).absenceType === 'CP' || (s as any).leaveType === 'CP' || (s.isLeave && (s as any).leaveType === 'CP') || ((s.isLeave || s.vehicle === 'CONGÉ') && (s as any).leaveType === 'CP');
            const mins = isCP
              ? 420
              : ((s.isFerieChome === true || (s as any).isFerieChome === 'true' || s.type === 'FERIE') ? 420 : calculateEffectiveMinutes(s));
            
            if (isCP) {
              cpMinutes += mins;
            }
            minutesTerrain += mins;
          }
        });
      }

      // 3. Intégration de la règle des Congés Payés (7h = 420 min par jour)
      const hasCPSemissions = shifts.some(s => {
        if (!s || !s.day) return false;
        const shiftDate = parseLocalDate(s.day);
        if (!shiftDate) return false;
        const { isInPeriod } = isWithinCustomModulationPeriod(shiftDate, referenceStartDate, cycleWeeks, currentTime);
        const isCP = s.isCP === true || (s as any).isCP === 'true' || s.type === 'CP' || (s as any).absenceType === 'CP' || (s as any).leaveType === 'CP' || (s.isLeave && (s as any).leaveType === 'CP') || ((s.isLeave || s.vehicle === 'CONGÉ') && (s as any).leaveType === 'CP');
        return isCP && isInPeriod;
      });

      const joursConges = hasCPSemissions ? 0 : (joursCPPrisCycle || 0);
      const minutesConges = (joursConges || 0) * 7 * 60;
      cpMinutes += minutesConges;

      // 4. Attribution propre au compteur final sans écrasement par d'autres fonctions
      totalMin = minutesTerrain + minutesConges;

      // Configuration des textes de la jauge
      title = "Cumul Modulation";
      
      const formatLabelDate = (date: Date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
      };

      const inclusiveEnd = new Date(endOfCycle.getTime() - 24 * 60 * 60 * 1000);
      subtitle = `Cycle du ${formatLabelDate(startOfCycle)} au ${formatLabelDate(inclusiveEnd)}`;
      icon = Layers;
      color = "emerald";

      // 5. Objectif contractuel automatique basé sur une semaine de 35h (ou hoursBase)
      targetMin = (parseInt(hoursBase) || 35) * 60 * cycleWeeks;
    } else if (workRegime === 'modulation') {
      const weeks = parseInt(modulationWeeks) || 4;
      const cycleDays = weeks * 7;
      const anchor = modulationStartDate ? new Date(modulationStartDate) : (contractStartDate ? new Date(contractStartDate) : new Date(2024, 0, 1));
      anchor.setHours(0, 0, 0, 0);
      
      const diffMs = currentTime.getTime() - anchor.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const currentCycleIndex = Math.floor(diffDays / cycleDays);
      
      const startOfCycle = new Date(anchor);
      startOfCycle.setDate(anchor.getDate() + (currentCycleIndex * cycleDays));
      
      const endOfCycle = new Date(startOfCycle);
      endOfCycle.setDate(startOfCycle.getDate() + cycleDays);

      shifts.forEach(s => {
        const d = parseLocalDate(s.day);
        if (d >= startOfCycle && d < endOfCycle) {
          const isCP = s.isCP === true || (s as any).isCP === 'true' || s.type === 'CP' || (s as any).absenceType === 'CP' || (s as any).leaveType === 'CP' || (s.isLeave && (s as any).leaveType === 'CP') || ((s.isLeave || s.vehicle === 'CONGÉ') && (s as any).leaveType === 'CP');
          const mins = isCP
            ? 420
            : ((s.isFerieChome === true || (s as any).isFerieChome === 'true' || s.type === 'FERIE') ? 420 : calculateEffectiveMinutes(s));
          
          if (isCP) {
            cpMinutes += mins;
          }
          totalMin += mins;
        }
      });
      targetMin = (parseInt(hoursBase) || 35) * weeks * 60;
      const remainingMin = Math.max(0, targetMin - totalMin);
      const timeRemainingMs = endOfCycle.getTime() - currentTime.getTime();
      const daysLeft = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
      const hoursLeft = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      extraData = {
        targetHours: targetMin / 60,
        performedHours: Math.floor(totalMin / 60),
        performedMins: totalMin % 60,
        remainingHours: Math.floor(remainingMin / 60),
        remainingMins: remainingMin % 60,
        countdown: `${daysLeft}j ${hoursLeft}h`,
        progress: (totalMin / targetMin) * 100
      };
      title = "Modulation";
      subtitle = `${weeks} semaines`;
      icon = RefreshCw;
      color = "emerald";
    } else if (workRegime === 'annualization') {
      const start = new Date(currentTime.getFullYear(), 0, 1);
      shifts.forEach(s => {
        const d = parseLocalDate(s.day);
        if (d >= start) {
          const isCP = s.isCP === true || (s as any).isCP === 'true' || s.type === 'CP' || (s as any).absenceType === 'CP' || (s as any).leaveType === 'CP' || (s.isLeave && (s as any).leaveType === 'CP') || ((s.isLeave || s.vehicle === 'CONGÉ') && (s as any).leaveType === 'CP');
          const mins = isCP
            ? 420
            : ((s.isFerieChome === true || (s as any).isFerieChome === 'true' || s.type === 'FERIE') ? 420 : calculateEffectiveMinutes(s));
          
          if (isCP) {
            cpMinutes += mins;
          }
          totalMin += mins;
        }
      });
      title = "Compteur Annuel";
      subtitle = "Objectif 1607h";
      icon = Calendar;
      color = "amber";
      targetMin = 1607 * 60;
    }
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const progress = targetMin > 0 ? (totalMin / targetMin) * 100 : 0;
    const formattedVal = workRegime === 'fortnightly'
      ? `${h}h${String(m).padStart(2, '0')}`
      : `${h}h ${String(m).padStart(2, '0')}m`;

    const hourlyRateVal = parseFloat(effectiveHourlyRate) || 12.79;
    const cpGross = (cpMinutes / 60) * hourlyRateVal;

    return { title, subtitle, icon, value: formattedVal, color, extraData, progress, cpMinutes, cpGross };
  }, [shifts, workRegime, calculateEffectiveMinutes, currentTime, contractStartDate, modulationStartDate, modulationWeeks, hoursBase, status, breakStartDateTime, joursCPPrisCycle]);

  const todayStats = useMemo(() => {
    const todayStr = getLocalDateString(currentTime);
    const todayShifts = shifts.filter(s => s.day === todayStr);
    let totalAmplitudeMin = 0;
    let totalEffectiveMin = 0;
    let totalGainsBrut = 0;

    // Nouvelles indemnités
    const IND_REPAS = 15.54;
    const IND_REPAS_UNIQUE = 9.59;
    const IND_SPECIALE = 4.34;
    const IND_DIMANCHE_FERIE = 23.90;

    todayShifts.forEach(s => {
      if (
        s.isFerieChome === true || 
        s.isFerieChome === 'true' || 
        s.isCP === true || 
        s.isCP === 'true' || 
        (s.isLeave && s.leaveType === 'CP') || 
        s.type === 'CP' || 
        s.type === 'FERIE'
      ) {
        totalEffectiveMin += 420;
        return;
      }
      if (s.isLeave || s.vehicle === 'CONGÉ') return; // Pas de gains ni d'amplitude pour les congés
      
      if (s.start !== '--:--') {
        const [h1, m1] = s.start.split(':').map(v => parseInt(v, 10) || 0);
        let endH, endM;
        if (s.end !== '--:--' && s.end !== '') {
          const [h2, m2] = s.end.split(':').map(v => parseInt(v, 10) || 0);
          endH = h2;
          endM = m2;
        } else if (s.id === activeShiftId) {
          if (status === ServiceStatus.BREAK && breakStartDateTime) {
            endH = breakStartDateTime.getHours();
            endM = breakStartDateTime.getMinutes();
          } else {
            endH = currentTime.getHours();
            endM = currentTime.getMinutes();
          }
        } else {
          return;
        }

        const validH1 = isNaN(h1) ? 0 : h1;
        const validM1 = isNaN(m1) ? 0 : m1;
        const validEndH = isNaN(endH) ? 0 : endH;
        const validEndM = isNaN(endM) ? 0 : endM;

        const startMin = validH1 * 60 + validM1;
        const endMin = validEndH * 60 + validEndM;
        let amp = endMin - startMin;
        if (amp < 0) amp += 1440;
        totalAmplitudeMin += isNaN(amp) ? 0 : amp;
        
        const effective = calculateEffectiveMinutes(s);
        totalEffectiveMin += effective;

        // Calcul des indemnités
        let currentAllowances = 0;
        const hasExternalBreak = s.breaks?.some(b => b.location === 'Extérieur');

        // 1. Indemnité de repas (15.54€)
        if (startMin <= 660 && endMin >= 870 && hasExternalBreak) {
          currentAllowances += IND_REPAS;
        }

        // 2. Indemnité de repas unique (9.59€)
        const sStart = startMin;
        const sEnd = endMin < startMin ? endMin + 1440 : endMin;
        const overlapStart = Math.max(sStart, 1320);
        const overlapEnd = Math.min(sEnd, 1860);
        if (overlapEnd - overlapStart >= 240) {
          currentAllowances += IND_REPAS_UNIQUE;
        }

        // 3. Indemnité spéciale (4.34€)
        if (hasExternalBreak && (startMin < 300 || endMin > 1260)) {
          currentAllowances += IND_SPECIALE;
        }

        // 4. Indemnité Dimanche & Férié (23.90€ brut)
        if (isSundayOrHoliday(s.day)) {
          currentAllowances += IND_DIMANCHE_FERIE;
        }

        totalGainsBrut += currentAllowances;
      }
    });

    const hourly = parseFloat(effectiveHourlyRate) || 12.79;
    totalGainsBrut += (totalEffectiveMin / 60) * hourly;
    
    return {
      amplitude: `${Math.floor(totalAmplitudeMin / 60).toString().padStart(2, '0')}:${(totalAmplitudeMin % 60).toString().padStart(2, '0')}`,
      gains: totalGainsBrut.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      effective: totalEffectiveMin
    };
  }, [shifts, currentTime, activeShiftId, effectiveHourlyRate, calculateEffectiveMinutes, status, breakStartDateTime]);

  const gainsCarouselStats = useMemo(() => {
    const calculateGainsForPeriod = (start: Date, end: Date) => {
      let total = 0;
      const periodShifts = shifts.filter(s => {
        const d = parseLocalDate(s.day);
        return d >= start && d < end;
      });

      const IND_REPAS = 15.54;
      const IND_REPAS_UNIQUE = 9.59;
      const IND_SPECIALE = 4.34;
      const IND_DIMANCHE_FERIE = 23.90;

      periodShifts.forEach(s => {
        if (s.isFerieChome === true || s.isFerieChome === 'true' || s.isCP === true || s.isCP === 'true' || (s.isLeave && s.leaveType === 'CP')) {
          const hourly = parseFloat(effectiveHourlyRate) || 12.79;
          total += 7 * hourly;
          return;
        }
        if (s.isLeave || s.vehicle === 'CONGÉ') return;
        if (s.start !== '--:--') {
          const sParts = s.start.split(':');
          const h1 = parseInt(sParts[0], 10) || 0;
          const m1 = parseInt(sParts[1], 10) || 0;
          let endH, endM;
          if (s.end !== '--:--' && s.end !== '') {
            const eParts = s.end.split(':');
            endH = parseInt(eParts[0], 10) || 0;
            endM = parseInt(eParts[1], 10) || 0;
          } else if (s.id === activeShiftId) {
            if (status === ServiceStatus.BREAK && breakStartDateTime) {
              endH = breakStartDateTime.getHours();
              endM = breakStartDateTime.getMinutes();
            } else {
              endH = currentTime.getHours();
              endM = currentTime.getMinutes();
            }
          } else {
            return;
          }

          const startMin = h1 * 60 + m1;
          const endMin = endH * 60 + endM;
          
          const effective = calculateEffectiveMinutes(s);
          const hourly = parseFloat(effectiveHourlyRate) || 12.79;
          total += (effective / 60) * hourly;

          // Indemnités
          const hasExternalBreak = s.breaks?.some(b => b.location === 'Extérieur');
          if (startMin <= 660 && (endMin >= 870 || endMin < startMin) && hasExternalBreak) total += IND_REPAS;
          
          const sStart = startMin;
          const sEnd = endMin < startMin ? endMin + 1440 : endMin;
          const overlapStart = Math.max(sStart, 1320);
          const overlapEnd = Math.min(sEnd, 1860);
          if (overlapEnd - overlapStart >= 240) total += IND_REPAS_UNIQUE;

          if (hasExternalBreak && (startMin < 300 || (endMin > 1260 && endMin <= 1440))) total += IND_SPECIALE;
          if (isSundayOrHoliday(s.day)) total += IND_DIMANCHE_FERIE;
        }
      });
      return total * 0.78;
    };

    // Current Day
    const today = new Date(currentTime);
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const currentDayGains = calculateGainsForPeriod(today, tomorrow);

    // Current Week (Monday to Sunday)
    const monday = new Date(currentTime);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    const currentWeekGains = calculateGainsForPeriod(monday, nextMonday);

    // Previous Week
    const prevMonday = new Date(monday);
    prevMonday.setDate(monday.getDate() - 7);
    const prevWeekGains = calculateGainsForPeriod(prevMonday, monday);

    // Current Month
    const firstDayMonth = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1);
    const firstDayNextMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 1);
    const currentMonthGains = calculateGainsForPeriod(firstDayMonth, firstDayNextMonth);

    // Previous Month
    const firstDayPrevMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() - 1, 1);
    const prevMonthGains = calculateGainsForPeriod(firstDayPrevMonth, firstDayMonth);

    const getTrend = (curr: number, prev: number) => {
      const c = Math.round(curr);
      const p = Math.round(prev);
      if (c > p) return 'up';
      if (c < p) return 'down';
      return 'equal';
    };

    return [
      { label: 'Gains estimés (Net)', value: currentDayGains, trend: 'up' },
      { label: 'Gains Semaine (Net)', value: currentWeekGains, trend: getTrend(currentWeekGains, prevWeekGains) },
      { label: 'Gains Mois (Net)', value: currentMonthGains, trend: getTrend(currentMonthGains, prevMonthGains) }
    ];
  }, [shifts, currentTime, activeShiftId, effectiveHourlyRate, calculateEffectiveMinutes, status, breakStartDateTime]);

  const vehicleDistribution = useMemo(() => {
    let assuMin = 0;
    let ambuMin = 0;
    let vslMin = 0;
    let taxiMin = 0;
    
    // Get shifts for the current period based on workRegime
    let periodShifts = shifts;
    if (workRegime === 'weekly') {
      const monday = new Date(currentTime);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      periodShifts = shifts.filter(s => parseLocalDate(s.day) >= monday);
    } else if (workRegime === 'fortnightly') {
      const referenceStartDate = modulationStartDate ? new Date(modulationStartDate) : new Date('2026-04-13'); 
      const cycleWeeks = 2; // Une quinzaine dure strictement 2 semaines
      periodShifts = shifts.filter(s => {
        const d = parseLocalDate(s.day);
        if (!d) return false;
        const { isInPeriod } = isWithinCustomModulationPeriod(d, referenceStartDate, cycleWeeks, currentTime);
        return isInPeriod;
      });
    } else if (workRegime === 'modulation') {
      const weeks = parseInt(modulationWeeks) || 4;
      const cycleDays = weeks * 7;
      const anchor = modulationStartDate ? new Date(modulationStartDate) : (contractStartDate ? new Date(contractStartDate) : new Date(2024, 0, 1));
      anchor.setHours(0, 0, 0, 0);
      
      const diffMs = currentTime.getTime() - anchor.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const currentCycleIndex = Math.floor(diffDays / cycleDays);
      
      const startOfCycle = new Date(anchor);
      startOfCycle.setDate(anchor.getDate() + (currentCycleIndex * cycleDays));
      
      const endOfCycle = new Date(startOfCycle);
      endOfCycle.setDate(startOfCycle.getDate() + cycleDays);

      periodShifts = shifts.filter(s => {
        const d = parseLocalDate(s.day);
        return d >= startOfCycle && d < endOfCycle;
      });
    } else if (workRegime === 'annualization') {
      const start = new Date(currentTime.getFullYear(), 0, 1);
      periodShifts = shifts.filter(s => parseLocalDate(s.day) >= start);
    }

    periodShifts.forEach(s => {
      if (s.isLeave || s.vehicle === 'CONGÉ') return;
      const min = calculateEffectiveMinutes(s);
      if (s.vehicle && s.vehicle.includes('ASSU')) assuMin += min;
      else if (s.vehicle && s.vehicle.includes('VSL')) vslMin += min;
      else if (s.vehicle && s.vehicle.includes('TAXI')) taxiMin += min;
      else if (s.vehicle && s.vehicle.includes('AMBU')) ambuMin += min;
      else {
        ambuMin += min;
      }
    });
    
    const total = assuMin + ambuMin + vslMin + taxiMin;
    const pAssu = total > 0 ? (assuMin / total) * 100 : 0;
    const pAmbu = total > 0 ? (ambuMin / total) * 100 : 0;
    const pVsl = total > 0 ? (vslMin / total) * 100 : 0;
    const pTaxi = total > 0 ? (taxiMin / total) * 100 : 0;
    
    const gradient = total > 0 
      ? `conic-gradient(#FF4B5C 0% ${pAssu}%, #10b981 ${pAssu}% ${pAssu + pAmbu}%, #6366f1 ${pAssu + pAmbu}% ${pAssu + pAmbu + pVsl}%, #f59e0b ${pAssu + pAmbu + pVsl}% 100%)`
      : `conic-gradient(#e2e8f0 0% 100%)`;

    const formatMinutesToHours = (totalMinutes: number) => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${h}h${m.toString().padStart(2, '0')}`;
    };

    return { 
      assu: pAssu.toFixed(0), 
      ambu: pAmbu.toFixed(0), 
      vsl: pVsl.toFixed(0), 
      taxi: pTaxi.toFixed(0),
      assuHours: formatMinutesToHours(assuMin),
      ambuHours: formatMinutesToHours(ambuMin),
      vslHours: formatMinutesToHours(vslMin),
      taxiHours: formatMinutesToHours(taxiMin),
      gradient, 
      hasData: total > 0 
    };
  }, [shifts, calculateEffectiveMinutes, workRegime, currentTime, contractStartDate, modulationStartDate, modulationWeeks]);

  const getNextShiftCountdown = () => {
    if (!nextAutoStart) return null;
    const diff = nextAutoStart.getTime() - currentTime.getTime();
    if (diff <= 0) return "Arrivé";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    return `${days > 0 ? `J-${days} ` : ''}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderHome = () => {
    const bentoCardBase = `relative overflow-hidden transition-all duration-500 rounded-[32px] border ${effectiveDarkMode ? 'bg-slate-900/60 border-white/5 shadow-2xl shadow-black/40' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/40'} backdrop-blur-xl`;
    const nextCountdown = getNextShiftCountdown();
    const todayStr = getLocalDateString(currentTime);
    const todayShift = shifts.find(s => s.day === todayStr);
    const isTodayFerieChome = shifts.some(s => s.day === todayStr && (s.isFerieChome === true || (s as any).isFerieChome === 'true' || s.type === 'FERIE'));
    const isTodayCP = shifts.some(s => s.day === todayStr && (s.isCP === true || (s as any).isCP === 'true' || (s.isLeave && s.leaveType === 'CP') || s.type === 'CP'));
    const isTodayFinished = (todayShift && todayShift.end !== '--:--') || isTodayFerieChome || isTodayCP;

    const timeRemainingInMinutes = nextAutoStart 
      ? Math.max(0, Math.floor((nextAutoStart.getTime() - currentTime.getTime()) / 60000))
      : Infinity;

    // Calcul de l'état de repos réglementaire (ex: 11h de repos minimum entre deux services)
    const isResting = (() => {
      if (status !== ServiceStatus.OFF) return false;
      const completedShifts = shifts.filter(s => s.end && s.end !== '--:--' && !s.isLeave && !s.isFerieChome);
      if (completedShifts.length === 0) return false;

      let latestEndTime: number | null = null;
      for (const s of completedShifts) {
        try {
          const [endH, endM] = s.end.split(':').map(Number);
          const [y, mon, d] = s.day.split('-').map(Number);
          let endDateTime = new Date(y, mon - 1, d, endH, endM, 0, 0);
          if (s.start && s.start !== '--:--') {
            const [startH, startM] = s.start.split(':').map(Number);
            if (endH < startH || (endH === startH && endM < startM)) {
              endDateTime = new Date(y, mon - 1, d + 1, endH, endM, 0, 0);
            }
          }
          if (endDateTime <= currentTime) {
            if (!latestEndTime || endDateTime.getTime() > latestEndTime) {
              latestEndTime = endDateTime.getTime();
            }
          }
        } catch {
          // ignore
        }
      }

      if (latestEndTime) {
        const elapsedMinutes = (currentTime.getTime() - latestEndTime) / 60000;
        // Repos quotidien légal de 11h (660 minutes) tant que le prochain service n'est pas en phase de préparation (< 120 min)
        if (elapsedMinutes >= 0 && elapsedMinutes < 660 && timeRemainingInMinutes >= 120) {
          return true;
        }
      }
      return false;
    })();

    const getShiftStatus = (timeRemainingInMinutes: number, isResting: boolean) => {
      if (isResting) {
        return "Repos réglementaire en cours";
      }
      
      if (timeRemainingInMinutes < 60) {
        return "Prise de poste imminente";
      }
      
      if (timeRemainingInMinutes < 120) {
        return "Préparation du service";
      }
      
      return "Prochain service programmé";
    };

    const getShiftStatusIndicator = (statusText: string) => {
      switch (statusText) {
        case "Repos réglementaire en cours":
          return "bg-emerald-500";
        case "Prise de poste imminente":
          return "bg-rose-500 animate-pulse";
        case "Préparation du service":
          return "bg-amber-500";
        case "Prochain service programmé":
        default:
          return "bg-blue-500";
      }
    };

    const currentDayShift = shifts.find(s => s.day === todayStr) || currentShift;
    const dailyMinutes = todayShift ? calculateEffectiveMinutes(todayShift) : 0;
    
    // Variable de rendu finale pour la jauge du jour
    const finalDailyMinutes = (isTodayCP || isTodayFerieChome || currentDayShift?.isCP || (currentDayShift as any)?.isCP === 'true' || currentDayShift?.absenceType === 'CP' || currentDayShift?.isFerieChome || (currentDayShift as any)?.isFerieChome === 'true' || currentDayShift?.type === 'CP' || (currentDayShift as any)?.leaveType === 'CP')
      ? 420 
      : dailyMinutes; // Garde le chrono dynamique uniquement si ce n'est pas un congé/férié

    const PeriodIcon = periodStats.icon;
    
    const isBreakActive = status === ServiceStatus.BREAK && (!breakStartDateTime || currentTime >= breakStartDateTime);
    
    const activeShift = activeShiftId ? shifts.find(s => s.id === activeShiftId) : null;
    const lastBreak = activeShift?.breaks?.[activeShift.breaks.length - 1];
    
    const minBreakDuration = lastBreak ? lastBreak.duration * 60 : (lastBreak?.isMeal ? MEAL_MIN_DURATION : BREAK_MIN_DURATION);
    const elapsedBreakSeconds = status === ServiceStatus.BREAK && breakStartDateTime 
      ? Math.floor((currentTime.getTime() - breakStartDateTime.getTime()) / 1000) 
      : 0;

    const isBreakFinished = status === ServiceStatus.BREAK && elapsedBreakSeconds >= MAX_BREAK_DURATION;
    const canResume = status === ServiceStatus.BREAK;
    
    let breakBackgroundImage = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800'; 
    let breakLabel = "COUPURE";
    
    if (isBreakActive && activeShiftId) {
      if (lastBreak?.isMeal) {
        breakLabel = "COUPURE REPAS";
        if (lastBreak.location === 'Entreprise') {
          breakBackgroundImage = 'https://images.unsplash.com/photo-1560624052-449f5ddf0c31?auto=format&fit=crop&q=80&w=800';
        } else {
          breakBackgroundImage = 'https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&q=80&w=800';
        }
      } else {
        breakLabel = "PAUSE CAFÉ";
        breakBackgroundImage = 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=800';
      }
    }

    const vehicleImages: Record<string, string> = {
      'ASSU': 'https://images.unsplash.com/photo-1587748661673-d15d543b3a2a?auto=format&fit=crop&q=80&w=1200',
      'AMBU': 'https://images.unsplash.com/photo-1612277795421-9bc7706a4a34?auto=format&fit=crop&q=80&w=1200',
      'VSL': 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=1200'
    };
    
    const activeVehicle = activeShift?.vehicle || 'ASSU';
    const vehicleImage = vehicleImages[activeVehicle] || vehicleImages.ASSU;

    return (
      <div className={`w-full flex flex-col items-center p-4 pb-4 relative animate-fadeIn bg-transparent`}>
        <div className="w-full max-w-7xl flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">
              Tableau de Bord
            </p>
          </div>
        </div>
        {roles.length > 1 && (
          <div className="w-full max-w-7xl flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {roles.map(role => (
              <button
                key={role}
                onClick={() => setPrimaryRole(role)}
                className={`flex-none px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  primaryRole === role 
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' 
                    : (effectiveDarkMode ? 'bg-slate-900 border-white/5 text-slate-400' : 'bg-white border-slate-100 text-slate-500')
                }`}
              >
                {role === 'dea' ? 'Ambulancier DE' : role === 'auxiliary' ? 'Auxiliaire Ambulancier' : 'Conducteur Taxi'}
                {primaryRole === role && ' ★'}
              </button>
            ))}
          </div>
        )}
        {afgsuStatus && afgsuStatus !== 'valid' && (
          <div className={`w-full max-w-7xl p-4 rounded-[24px] border flex items-center gap-4 animate-slideUp ${
            afgsuStatus === 'expired' 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-pulse-border' 
              : 'bg-orange-500/10 border-orange-500/30 text-orange-500'
          }`}>
            <div className={`p-3 rounded-xl ${afgsuStatus === 'expired' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}`}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Alerte AFGSU 2</p>
              <p className="text-sm font-black">
                {afgsuStatus === 'expired' ? 'VOTRE AFGSU 2 EST EXPIRÉ !' : 'AFGSU 2 arrive à expiration bientôt'}
              </p>
            </div>
            <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              afgsuStatus === 'expired' ? 'border-rose-500/50 hover:bg-rose-500 hover:text-white' : 'border-orange-500/50 hover:bg-orange-500 hover:text-white'
            }`}>Gérer</button>
          </div>
        )}

        {medicalStatus && medicalStatus !== 'valid' && (
          <div className={`w-full max-w-7xl p-4 rounded-[24px] border flex items-center gap-4 animate-slideUp ${
            medicalStatus === 'expired' 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-pulse-border' 
              : 'bg-orange-500/10 border-orange-500/30 text-orange-500'
          }`}>
            <div className={`p-3 rounded-xl ${medicalStatus === 'expired' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}`}>
              <ShieldAlert size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Aptitude Préfectorale</p>
              <p className="text-sm font-black">
                {medicalStatus === 'expired' ? '🔴 CONDUITE INTERDITE : Aptitude périmée' : 'Prendre RDV Médecin Agréé (Aptitude)'}
              </p>
            </div>
            <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              medicalStatus === 'expired' ? 'border-rose-500/50 hover:bg-rose-500 hover:text-white' : 'border-orange-500/50 hover:bg-orange-500 hover:text-white'
            }`}>Gérer</button>
          </div>
        )}

        {taxiCardStatus && taxiCardStatus !== 'valid' && (
          <div className={`w-full max-w-7xl p-4 rounded-[24px] border flex items-center gap-4 animate-slideUp ${
            taxiCardStatus === 'expired' 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-pulse-border' 
              : 'bg-orange-500/10 border-orange-500/30 text-orange-500'
          }`}>
            <div className={`p-3 rounded-xl ${taxiCardStatus === 'expired' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}`}>
              <Car size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Carte Pro Taxi</p>
              <p className="text-sm font-black">
                {taxiCardStatus === 'expired' ? '🔴 CARTE TAXI PÉRIMÉE' : 'La Carte Taxi expire bientôt'}
              </p>
            </div>
            <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              taxiCardStatus === 'expired' ? 'border-rose-500/50 hover:bg-rose-500 hover:text-white' : 'border-orange-500/50 hover:bg-orange-500 hover:text-white'
            }`}>Gérer</button>
          </div>
        )}

        {taxiFpcStatus && taxiFpcStatus !== 'valid' && (
          <div className={`w-full max-w-7xl p-4 rounded-[24px] border flex items-center gap-4 animate-slideUp ${
            taxiFpcStatus === 'expired' 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-pulse-border' 
              : 'bg-orange-500/10 border-orange-500/30 text-orange-500'
          }`}>
            <div className={`p-3 rounded-xl ${taxiFpcStatus === 'expired' ? 'bg-rose-500 text-white' : 'bg-orange-500 text-white'}`}>
              <RefreshCw size={20} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Formation Taxi (FPC)</p>
              <p className="text-sm font-black">
                {taxiFpcStatus === 'expired' ? '🔴 FPC TAXI EXPIRÉE' : 'Recyclage FPC Taxi nécessaire'}
              </p>
            </div>
            <button onClick={() => setActiveTab('profile')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
              taxiFpcStatus === 'expired' ? 'border-rose-500/50 hover:bg-rose-500 hover:text-white' : 'border-orange-500/50 hover:bg-orange-500 hover:text-white'
            }`}>Gérer</button>
          </div>
        )}
        <div className="w-full max-w-xl flex flex-col gap-5 mt-4 mb-4">

          <div 
            className={`${bentoCardBase} w-full col-span-2 p-8 flex flex-col justify-between min-h-[340px] ${status === ServiceStatus.WORKING ? 'text-white border-none shadow-indigo-500/20 active-mission-card' : (isBreakActive ? 'text-white' : (status === ServiceStatus.BREAK ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white' : ((isTodayFerieChome || isTodayCP) ? 'bg-gradient-to-br from-violet-600 to-violet-950 text-white shadow-violet-500/20' : (isTodayFinished ? 'bg-gradient-to-br from-emerald-600 to-emerald-950 text-white shadow-emerald-500/20' : ''))))}`}
            style={status === ServiceStatus.WORKING ? {
              backgroundImage: `linear-gradient(rgba(49, 46, 129, 0.8), rgba(30, 27, 75, 0.9)), url("${vehicleImage}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : (isBreakActive ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url("${breakBackgroundImage}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            } : {})}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60 font-sans">
                  {status === ServiceStatus.OFF 
                    ? (nextAutoStart && scheduledShiftId ? 'PROCHAINE EMBAUCHE' : (isTodayFerieChome ? 'Jour Férié' : (isTodayCP ? 'Congé Payé' : (isTodayFinished ? 'Journée Terminée' : 'Disponibilité')))) 
                    : status === ServiceStatus.WORKING 
                      ? 'Mission Active' 
                      : breakLabel}
                </p>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    status === ServiceStatus.WORKING 
                      ? 'bg-emerald-400 animate-pulse' 
                      : status === ServiceStatus.BREAK 
                        ? 'bg-white animate-pulse' 
                        : (nextAutoStart && scheduledShiftId 
                            ? getShiftStatusIndicator(getShiftStatus(timeRemainingInMinutes, isResting)) 
                            : (isTodayFerieChome || isTodayCP) 
                              ? 'bg-violet-300 animate-pulse' 
                              : isTodayFinished 
                                ? 'bg-emerald-300' 
                                : 'bg-slate-500')
                  }`} />
                  <h2 className="text-2xl font-black tracking-tight font-sans">
                    {status === ServiceStatus.OFF 
                      ? (nextAutoStart && scheduledShiftId 
                          ? getShiftStatus(timeRemainingInMinutes, isResting) 
                          : (isTodayFerieChome ? 'Jour Férié Chômé' : (isTodayCP ? 'Congé Payé (CP)' : isTodayFinished ? 'Mission Validée' : 'En attente'))) 
                      : status === ServiceStatus.WORKING 
                        ? 'En Service' 
                        : 'Coupure en cours'}
                  </h2>
                </div>
                <div className="mt-2.5">
                  <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                    status === ServiceStatus.WORKING || status === ServiceStatus.BREAK || isTodayFinished
                      ? 'bg-white/15 text-white'
                      : effectiveDarkMode ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                  }`}>
                    Objectif minimal du jour : {Math.round((parseInt(hoursBase, 10) || 35) / 5)}h00
                  </span>
                </div>
              </div>

              {(status !== ServiceStatus.OFF || (todayShift && !isTodayFinished)) && (
                <button 
                  onClick={handleResetAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 transition-all text-rose-300 active:scale-95 text-[10px] font-black uppercase tracking-widest shrink-0 shadow-lg shadow-rose-950/20"
                  title="Annuler ou Supprimer la garde actuelle"
                >
                  <Trash size={12} className="text-rose-400" />
                  <span>Annuler</span>
                </button>
              )}
            </div>
            <div className="py-6 w-full text-center px-6">
              <div className="animate-fadeIn w-full flex flex-col items-center justify-center">
                 <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-2">
                   {status === ServiceStatus.BREAK 
                     ? (breakStartDateTime && currentTime < breakStartDateTime 
                        ? 'Début dans' 
                        : (elapsedBreakSeconds >= MAX_BREAK_DURATION 
                           ? 'ALERTE' 
                           : (elapsedBreakSeconds < minBreakDuration ? 'Avant la reprise' : 'Avant Maximum'))) 
                     : (status === ServiceStatus.OFF 
                        ? (nextAutoStart && scheduledShiftId ? 'Prise de poste dans' : (isTodayFinished ? 'Total Travaillé' : 'Heure actuelle'))
                        : 'Compteur journalier')}
                 </p>
                 <h1 
                   className={`font-black tabular-nums tracking-tighter leading-none drop-shadow-2xl ${isBreakFinished ? 'text-rose-500 animate-blink-red py-4' : ''}`}
                   style={{ 
                     fontSize: isBreakFinished ? '3.5rem' : 'clamp(3rem, 16vw, 6.5rem)',
                     whiteSpace: 'nowrap',
                     display: 'block',
                     width: '100%',
                     textAlign: 'center'
                   }}
                 >
                   {isTodayCP || isTodayFerieChome ? "07:00" : status === ServiceStatus.BREAK ? renderBreakTimer() : false ? (() => {
                     if (breakStartDateTime && currentTime < breakStartDateTime) {
                       const diff = breakStartDateTime.getTime() - currentTime.getTime();
                       const m = Math.floor(diff / 60000);
                       const s = Math.floor((diff % 60000) / 1000);
                       return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                     }
                     if (!breakStartDateTime) return "00:00";
                     
                     if (elapsedBreakSeconds >= MAX_BREAK_DURATION) {
                       return "DURÉE MAX ATTEINTE";
                     }

                     const timeLeft = elapsedBreakSeconds < minBreakDuration 
                       ? minBreakDuration - elapsedBreakSeconds 
                       : MAX_BREAK_DURATION - elapsedBreakSeconds;
                       
                     const m = Math.floor(timeLeft / 60);
                     const s = timeLeft % 60;
                     return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                   })() : status === ServiceStatus.OFF ? (nextAutoStart && scheduledShiftId ? nextCountdown : (isTodayFinished ? (() => {
                     const finalDur = finalDailyMinutes;
                     const h = Math.floor(finalDur / 60);
                     const m = finalDur % 60;
                     return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                   })() : currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))) : getDuration()}
                 </h1>
                 {status === ServiceStatus.OFF && isTodayCP && (
                   <p className="text-sm font-bold text-violet-200 mt-2 uppercase tracking-wide animate-fadeIn text-center">
                     7h00 (Congé Payé)
                   </p>
                 )}
                 {status === ServiceStatus.OFF && isTodayFerieChome && (
                   <p className="text-sm font-bold text-violet-200 mt-2 uppercase tracking-wide animate-fadeIn text-center">
                     7h00 (Jour Férié)
                   </p>
                 )}
              </div>
            </div>
            <div className="space-y-3">
              {status === ServiceStatus.WORKING && (
                <div className="grid grid-cols-2 gap-3 animate-slideUp">
                  <button onClick={() => handleOpenBreakModal('meal')} className="py-4 rounded-[24px] bg-white/10 border border-white/20 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><Utensils size={16} /> Déjeuner</button>
                  <button onClick={() => handleOpenBreakModal('coffee')} className="py-4 rounded-[24px] bg-white/10 border border-white/20 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><Coffee size={16} /> Café</button>
                </div>
              )}
              {status === ServiceStatus.BREAK && (
                <div className="flex gap-3 animate-slideUp">
                  <button onClick={handleModifyBreak} className="flex-1 py-5 rounded-[24px] bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all">MODIFIER</button>
                  <button 
                    onClick={handleResume} 
                    disabled={!canResume}
                    className={`flex-[2] py-5 rounded-[24px] font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl ${
                      canResume 
                        ? 'bg-white text-amber-600' 
                        : 'bg-white/20 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    <Zap size={18} fill="currentColor" /> Reprendre
                  </button>
                </div>
              )}

              {/* Dynamic unified button for starting/ending the day/service */}
              {(serviceStatus === 'OFF' || status === ServiceStatus.OFF) ? (
                <button 
                  onClick={() => {
                    const todayStr = getLocalDateString(currentTime);
                    const todayShift = shifts.find(s => s.day === todayStr && !s.isLeave);
                    const plannedVehicle = todayShift?.vehicle || 'ASSU';
                    handleStartService(plannedVehicle, new Date());
                  }} 
                  className="w-full py-6 rounded-[28px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl font-black text-xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-emerald-400/50"
                >
                  <Play size={24} fill="currentColor" />
                  <span>Débuter la journée</span>
                </button>
              ) : (
                <button 
                  onClick={handleEndShift} 
                  className="w-full py-6 rounded-[28px] bg-gradient-to-r from-orange-500 to-rose-600 hover:from-orange-600 hover:to-rose-700 text-white shadow-2xl font-black text-xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-orange-400/50 animate-pulse-subtle"
                >
                  <LogOut size={24} />
                  <span>Finir la journée</span>
                </button>
              )}
            </div>
          </div>

          {true && (
          <div 
             className={`${bentoCardBase} w-full col-span-2 min-h-[160px] flex flex-col group cursor-pointer selection:bg-transparent`}
             onTouchStart={(e) => {
                if (workRegime === 'modulation' && periodStats.extraData) {
                   (window as any)._touchStartX = e.touches[0].clientX;
                }
             }}
             onTouchEnd={(e) => {
                if (workRegime === 'modulation' && periodStats.extraData) {
                   const touchStartX = (window as any)._touchStartX || 0;
                   const touchEndX = e.changedTouches[0].clientX;
                   if (touchStartX - touchEndX > 50) {
                      setCarouselIndex(1);
                   } else if (touchEndX - touchStartX > 50) {
                      setCarouselIndex(0);
                   }
                }
             }}
             onClick={() => {
                if (workRegime === 'modulation' && periodStats.extraData) {
                   setCarouselIndex(prev => prev === 0 ? 1 : 0);
                } else {
                   setActiveTab('paie');
                }
             }}
          >
             <div className="flex-1 px-4 sm:px-5 pt-6 pb-6 relative flex flex-col justify-between">
                {workRegime === 'modulation' && periodStats.extraData ? (
                  carouselIndex === 0 ? (
                    <div className="flex items-center justify-between animate-fadeIn px-2 w-full relative">
                       <div className="flex items-center gap-3">
                          <div className={`w-14 h-14 rounded-2xl ${effectiveDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'} flex items-center justify-center text-indigo-500 shadow-inner shrink-0`}>
                             <Hourglass size={24} className="animate-pulse" />
                          </div>
                          <div className="text-left">
                             <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-0.5">Fin de Modulation</p>
                             <p className={`text-3xl font-black tracking-tighter tabular-nums leading-none ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>{periodStats.extraData.countdown}</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60 mt-0.5">Temps restant</p>
                          </div>
                       </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between animate-fadeIn px-2 w-full relative">
                       <div className="flex items-center justify-around w-full py-2 whitespace-nowrap">
                          {/* Bloc Effectué (Gauche) */}
                          <div className="flex flex-col items-center select-none">
                             <div className={`text-3xl font-bold ${effectiveDarkMode ? 'text-white' : 'text-slate-900'} whitespace-nowrap`}>
                                {periodStats.extraData.performedHours}h {periodStats.extraData.performedMins}m
                             </div>
                             <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider mt-1">
                                Effectué
                             </span>
                          </div>

                          {/* Séparateur au MILIEU */}
                          <div className={`h-10 w-[1px] ${effectiveDarkMode ? 'bg-slate-800' : 'bg-slate-100'} shrink-0`} />

                          {/* Bloc Reste (Droite) */}
                          <div className="flex flex-col items-center select-none">
                             <div className={`text-3xl font-bold ${effectiveDarkMode ? 'text-slate-300' : 'text-slate-400'} whitespace-nowrap`}>
                                {periodStats.extraData.remainingHours}h {periodStats.extraData.remainingMins}m
                             </div>
                             <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                                Reste
                             </span>
                          </div>
                       </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between animate-fadeIn px-2 w-full relative">
                     <div className="flex items-center gap-3">
                        <div className={`w-14 h-14 rounded-2xl ${effectiveDarkMode ? `bg-${periodStats.color}-500/10` : `bg-${periodStats.color}-50`} flex items-center justify-center text-${periodStats.color}-500 shadow-inner shrink-0`}>
                           <PeriodIcon size={24} />
                        </div>
                        <div className="text-left">
                           <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-0.5">{periodStats.title}</p>
                           <p className={`text-3xl font-black tracking-tighter leading-none ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>{periodStats.value}</p>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60 mt-0.5">{periodStats.subtitle}</p>
                        </div>
                     </div>
                  </div>
                )}
                
                <div className="mt-8 space-y-4">
                   <div className="relative h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div 
                         className={`h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(99,102,241,0.2)] ${
                           periodStats.progress > 120 ? 'bg-rose-600' :
                           periodStats.progress > 110 ? 'bg-rose-500' :
                           periodStats.progress > 100 ? 'bg-orange-500' :
                           `bg-${periodStats.color}-500`
                         }`} 
                         style={{ width: `${Math.min(100, periodStats.progress)}%` }} 
                      />
                   </div>
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Début</span>
                      <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${
                        periodStats.progress > 120 ? 'text-rose-600' :
                        periodStats.progress > 110 ? 'text-rose-500' :
                        periodStats.progress > 100 ? 'text-orange-500' :
                        effectiveDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                       }`}>
                         {periodStats.progress.toFixed(0)}% de l'objectif
                      </span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Objectif</span>
                    </div>

                    {workRegime === 'fortnightly' && (
                       <div 
                         onClick={(e) => e.stopPropagation()}
                         className={`p-4 rounded-2xl flex flex-col gap-4 border transition-all ${
                           effectiveDarkMode 
                             ? 'bg-slate-900/80 border-white/5 text-slate-300' 
                             : 'bg-slate-100/50 border-slate-200 text-slate-600'
                         }`}
                       >
                         <div className="flex items-center justify-between gap-3 text-xs">
                           <div className="flex flex-col text-left">
                             <span className="font-extrabold tracking-tight uppercase text-[10px] text-indigo-400">Congés Payés (7h/j)</span>
                             <span className="text-[10px] opacity-70">Poser des jours pour le cycle</span>
                           </div>
                           <div className="flex items-center gap-2 bg-black/10 dark:bg-white/5 p-1 rounded-xl">
                             <button 
                               type="button"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleAdjustCPDays(false);
                               }} 
                               className="w-8 h-8 flex items-center justify-center bg-rose-500 hover:bg-rose-600 active:scale-90 text-white rounded-lg font-black transition-all"
                             >
                               -
                             </button>
                             <span className="w-10 text-center font-extrabold text-base tabular-nums">
                               {joursCPPrisCycle} j.
                             </span>
                             <button 
                               type="button"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleAdjustCPDays(true);
                               }} 
                               className="w-8 h-8 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 active:scale-90 text-white rounded-lg font-black transition-all"
                             >
                               +
                             </button>
                           </div>
                         </div>
                         
                         <div className="border-t border-slate-100 dark:border-white/5 pt-3 flex items-center justify-between text-[11px] font-bold">
                           <span className="text-slate-400 uppercase tracking-widest text-[9px]">Solde restant (Stock CP) :</span>
                           <span className={`tabular-nums font-extrabold text-sm ${soldeTotalCP <= 2 ? 'text-rose-500' : 'text-emerald-500'}`}>
                             {soldeTotalCP} jours
                           </span>
                         </div>
                       </div>
                    )}
                   </div>
                </div>
             {workRegime === 'modulation' && (
                <div className="pb-6 flex justify-center gap-2.5">
                   <button 
                     onClick={(e) => {
                        e.stopPropagation();
                        setCarouselIndex(0);
                     }}
                     className={`h-2 rounded-full transition-all duration-500 ${carouselIndex === 0 ? 'bg-indigo-500 w-8' : 'bg-slate-500/20 w-2'}`} 
                   />
                   <button 
                     onClick={(e) => {
                        e.stopPropagation();
                        setCarouselIndex(1);
                     }}
                     className={`h-2 rounded-full transition-all duration-500 ${carouselIndex === 1 ? 'bg-emerald-500 w-8' : 'bg-slate-500/20 w-2'}`} 
                   />
                </div>
             )}
          </div>
          )}
          <div className="flex flex-row justify-between items-center w-full max-w-xl mx-auto gap-4">
             <div className="flex-1 w-1/2">
                <div className={`${bentoCardBase} w-full p-6 flex flex-col justify-between aspect-square overflow-hidden relative group`}>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={gainsCarouselIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full flex flex-col justify-between"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(_e, { offset }) => {
                      const swipe = offset.x;
                      if (swipe < -50) setGainsCarouselIndex((gainsCarouselIndex + 1) % 3);
                      else if (swipe > 50) setGainsCarouselIndex((gainsCarouselIndex + 2) % 3);
                    }}
                  >
                     <div className="flex justify-between items-start">
                       <div className={`p-3 rounded-2xl ${
                         gainsCarouselStats[gainsCarouselIndex].trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' :
                         gainsCarouselStats[gainsCarouselIndex].trend === 'down' ? 'bg-rose-500/10 text-rose-500' :
                         'bg-slate-500/10 text-slate-500'
                       }`}>
                         {gainsCarouselStats[gainsCarouselIndex].trend === 'up' ? <ArrowUp size={20} /> :
                          gainsCarouselStats[gainsCarouselIndex].trend === 'down' ? <ArrowDown size={20} /> :
                          <Minus size={20} />}
                       </div>
                       <div className="flex gap-1 mt-2">
                         {[0, 1, 2].map(i => (
                           <div key={i} className={`w-1 h-1 rounded-full transition-all ${i === gainsCarouselIndex ? 'bg-indigo-500 w-3' : 'bg-slate-300'}`} />
                         ))}
                       </div>
                     </div>
                     <div>
                       <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest mb-1">
                         {gainsCarouselStats[gainsCarouselIndex].label}
                       </p>
                       <div className="flex items-baseline gap-1">
                         <span className="text-3xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400">
                           {gainsCarouselStats[gainsCarouselIndex].value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </span>
                         <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">€</span>
                       </div>
                     </div>
                  </motion.div>
                </AnimatePresence>
                {isGuest && (
                   <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[6px] z-10 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
                      <Lock className="text-indigo-500 mb-1 opacity-60" size={20} />
                      <p className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.2em] opacity-80 leading-tight">Gains Floutés</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-60">Mode Invité Uniquement</p>
                   </div>
                )}
                </div>
             </div>
             
             <div className="flex-1 w-1/2">
                <div className={`${bentoCardBase} w-full p-6 flex flex-col justify-between aspect-square`}>
                   <div className="flex justify-between">
                      <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                         <TimerIcon size={20} />
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full bg-indigo-500 ${status === ServiceStatus.WORKING ? 'animate-pulse' : ''}`} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                         Amplitude
                      </p>
                      <div className="flex items-baseline gap-1">
                         <span className="text-3xl font-black tracking-tighter">
                            {todayStats.amplitude}
                         </span>
                      </div>
                   </div>
                </div>
             </div>
          </div>
          

          {primaryRole !== 'taxi' && (
            <motion.div 
              className={`${bentoCardBase} w-full col-span-2 p-6 animate-slideUp overflow-hidden cursor-grab active:cursor-grabbing select-none`}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(event, info) => {
                const swipeThreshold = 50;
                if (info.offset.x < -swipeThreshold) {
                  setVehicleStatMode('hours');
                } else if (info.offset.x > swipeThreshold) {
                  setVehicleStatMode('percent');
                }
              }}
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-slate-500/5 text-slate-400">
                    <Car size={18} />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Répartition Véhicules</h3>
                </div>
                
                {/* Visual Mode Selector Pills */}
                <div className={`p-0.5 rounded-full flex gap-0.5 ${effectiveDarkMode ? 'bg-slate-950/60' : 'bg-slate-100'}`}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setVehicleStatMode('percent');
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${vehicleStatMode === 'percent' ? (effectiveDarkMode ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    %
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setVehicleStatMode('hours');
                    }}
                    className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${vehicleStatMode === 'hours' ? (effectiveDarkMode ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Heures
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-10">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <div className="w-full h-full rounded-full transition-all duration-1000 shadow-xl" style={{ background: vehicleDistribution.gradient }} />
                  <div className={`absolute inset-3 rounded-full flex items-center justify-center ${effectiveDarkMode ? 'bg-slate-900 shadow-inner shadow-black/60' : 'bg-white shadow-inner shadow-slate-200'}`}>
                    <AnimatePresence mode="wait">
                      {vehicleStatMode === 'percent' ? (
                        <motion.div
                          key="percent"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Percent size={18} className="text-indigo-400" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="hours"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Clock size={18} className="text-emerald-400" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={vehicleStatMode}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#FF4B5C]" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ASSU</span>
                        </div>
                        <span className="text-xs font-black tabular-nums">
                          {vehicleStatMode === 'percent' ? `${vehicleDistribution.assu}%` : vehicleDistribution.assuHours}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AMBU</span>
                        </div>
                        <span className="text-xs font-black tabular-nums">
                          {vehicleStatMode === 'percent' ? `${vehicleDistribution.ambu}%` : vehicleDistribution.ambuHours}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">VSL</span>
                        </div>
                        <span className="text-xs font-black tabular-nums">
                          {vehicleStatMode === 'percent' ? `${vehicleDistribution.vsl}%` : vehicleDistribution.vslHours}
                        </span>
                      </div>

                      {(roles.includes('taxi') || parseInt(vehicleDistribution.taxi) > 0) && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TAXI</span>
                          </div>
                          <span className="text-xs font-black tabular-nums">
                            {vehicleStatMode === 'percent' ? `${vehicleDistribution.taxi}%` : vehicleDistribution.taxiHours}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Dot Indicators */}
              <div className="flex justify-center gap-1.5 mt-5">
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    setVehicleStatMode('percent');
                  }}
                  className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all ${vehicleStatMode === 'percent' ? 'bg-indigo-500 w-3' : 'bg-slate-400/30'}`} 
                />
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    setVehicleStatMode('hours');
                  }}
                  className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all ${vehicleStatMode === 'hours' ? 'bg-indigo-500 w-3' : 'bg-slate-400/30'}`} 
                />
              </div>
            </motion.div>
          )}

          {/* COMPTEURS DE SOLDES */}
          <div className={`${bentoCardBase} w-full col-span-2 p-6`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Calendar size={18} />
                </div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Solde Congés Payés</h3>
              </div>
              <button onClick={() => setActiveTab('profile')} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Ajuster</button>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Congés (CP)</span>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black text-emerald-500">
                    23,17 j / 23,17 j
                  </span>
                  {seniorityInfo.extraDaysCP > 0 && (
                    <span className="text-[8px] font-bold text-amber-500 uppercase tracking-tighter">incl. +{seniorityInfo.extraDaysCP}j ancienneté</span>
                  )}
                </div>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000" 
                  style={{ width: '100%' }} 
                />
              </div>
              {lastCpAccrualDate && (
                <div className="flex justify-start">
                  <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest mt-1 italic">Dernière mise à jour : {lastCpAccrualDate}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {showBreakModal && (
          <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fadeIn">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={() => setShowBreakModal(false)} />
            <div className={`relative w-full max-w-sm rounded-t-[32px] sm:rounded-[48px] max-h-[85vh] overflow-y-auto p-6 pb-24 shadow-2xl animate-popIn border ${effectiveDarkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-[22px] shadow-lg ${breakType === 'meal' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                    {breakType === 'meal' ? <Utensils size={28} /> : <Coffee size={28} />}
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter">
                    {breakType === 'meal' ? 'Pause Repas' : 'Pause Café'}
                  </h3>
                </div>
                <button onClick={() => setShowBreakModal(false)} className={`p-4 rounded-2xl transition-all ${effectiveDarkMode ? 'bg-slate-500/10 hover:bg-slate-500/20' : 'bg-slate-100 hover:bg-slate-200'}`}>
                  <X size={22} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] block px-1">Début de pause</label>
                  <div className="relative group">
                    <input 
                      type="time" 
                      className={`w-full p-5 rounded-[22px] border-2 font-black text-xl outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer ${
                        effectiveDarkMode 
                          ? 'bg-slate-800 border-white/5 text-white' 
                          : 'bg-slate-100 border-slate-200 text-slate-900 focus:bg-white'
                      }`}
                      value={breakStartTime} 
                      onChange={(e) => setBreakStartTime(e.target.value)} 
                    />
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end px-1">
                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] block">Durée</label>
                    <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.1em]">{breakDuration} MIN</span>
                  </div>
                  <div className="relative pt-2">
                    <input 
                      type="range" 
                      min="1" 
                      max="90" 
                      step="1" 
                      className="w-full h-2.5 bg-indigo-500/10 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500" 
                      value={Math.min(90, breakDuration)} 
                      onChange={(e) => setBreakDuration(Math.min(90, Math.max(1, parseInt(e.target.value) || 1)))} 
                    />
                    <div className="flex justify-between mt-2 text-[8px] font-black text-slate-500 uppercase tracking-widest opacity-40">
                      <span>1m</span>
                      <span>45m</span>
                      <span>90m</span>
                    </div>
                  </div>
                </div>

                {breakType === 'meal' && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] block px-1">Lieu de la pause</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setBreakLocation('Entreprise')}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                          breakLocation === 'Entreprise' 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                            : (effectiveDarkMode ? 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200')
                        }`}
                      >
                        <Building2 size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Entreprise</span>
                      </button>
                      <button 
                        onClick={() => setBreakLocation('Extérieur')}
                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2 ${
                          breakLocation === 'Extérieur' 
                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' 
                            : (effectiveDarkMode ? 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200')
                        }`}
                      >
                        <MapPin size={20} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Extérieur</span>
                      </button>
                    </div>
                  </div>
                )}

                {breakType === 'meal' && breakLocation === 'Extérieur' && (
                  <div className="space-y-4 p-5 bg-indigo-500/5 dark:bg-white/5 rounded-[28px] border border-indigo-500/10 dark:border-white/10 animate-fadeIn mt-2 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Recherche Repas GPS + AI</span>
                      <Sparkles size={14} className="text-indigo-400 animate-pulse" />
                    </div>

                    {/* Mode de transport */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Mode de transport</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setModeTransport('A_PIED')}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all ${
                            modeTransport === 'A_PIED'
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                              : (effectiveDarkMode ? 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-650 hover:bg-slate-200')
                          }`}
                        >
                          🚶‍♂️ À pied
                        </button>
                        <button
                          type="button"
                          onClick={() => setModeTransport('EN_VOITURE')}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all ${
                            modeTransport === 'EN_VOITURE'
                              ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                              : (effectiveDarkMode ? 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-650 hover:bg-slate-200')
                          }`}
                        >
                          🚑 En voiture
                        </button>
                      </div>
                    </div>

                    {/* Temps de trajet limite */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Temps de trajet max</label>
                        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{maxDuration} min</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[5, 10, 15].map((time) => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => setMaxDuration(time)}
                            className={`py-2 rounded-lg border font-black text-[9px] uppercase tracking-widest transition-all ${
                              maxDuration === time
                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                : (effectiveDarkMode ? 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100')
                            }`}
                          >
                            {time} min
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bouton d'action de recherche */}
                    <button
                      type="button"
                      onClick={handleSearchRestos}
                      disabled={searchLoading}
                      className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:opacity-55 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {searchLoading ? (
                        <Loader2 className="animate-spin font-bold" size={14} />
                      ) : (
                        "🔍 Trouver des restaurants"
                      )}
                    </button>

                    {/* Gestion du loading */}
                    {searchLoading && (
                      <div className="flex flex-col items-center justify-center py-6 px-4 gap-3 bg-indigo-500/5 dark:bg-white/5 border border-indigo-500/10 dark:border-white/10 rounded-2xl animate-pulse">
                        <Loader2 size={24} className="animate-spin text-indigo-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-500 text-center">
                          ⏳ Recherche en cours à votre position réelle...
                        </span>
                      </div>
                    )}

                    {/* Gestion des erreurs */}
                    {error && (
                      <div className="p-3 bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 rounded-xl text-[9px] font-extrabold uppercase tracking-wider text-center">
                        ⚠️ {error}
                      </div>
                    )}

                    {/* Liste des restos en format scrollable */}
                    {!searchLoading && suggestedRestaurants.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                            {suggestedRestaurants.some(r => r.isFallback) ? "Suggestions Proximité GPS" : "Suggestions Gemini + AI"} ({suggestedRestaurants.length})
                          </label>
                          {suggestedRestaurants.some(r => r.isFallback) && (
                            <span className="text-[7px] font-black bg-indigo-500/10 dark:bg-white/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                              📡 Mode Proximité
                            </span>
                          )}
                        </div>
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                          {suggestedRestaurants.map((resto: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-4 rounded-2xl border transition-all ${
                                resto.hasParking 
                                  ? 'bg-indigo-600/15 border-indigo-500/40 text-slate-900 dark:text-white font-medium shadow-sm' 
                                  : (effectiveDarkMode ? 'bg-slate-800/80 border-white/5 text-white' : 'bg-slate-50 border-slate-200/60 text-slate-900')
                              }`}
                            >
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[12px] font-black tracking-tight">{resto.name}</span>
                                    {resto.hasParking && (
                                      <span className="bg-emerald-600 text-white font-black text-[7px] uppercase tracking-widest px-1.5 py-0.5 rounded">
                                        🅿️ Parking OK
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">{resto.type}</span>
                                  {resto.address && (
                                    <span className="text-[8px] text-slate-400 dark:text-slate-500 block max-w-[180px] truncate">{resto.address}</span>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1.5 min-w-[70px]">
                                  {resto.rating && (
                                    <div className="flex items-center gap-0.5 text-amber-500">
                                      <Star size={10} fill="currentColor" />
                                      <span className="text-[9px] font-black">{resto.rating}</span>
                                    </div>
                                  )}
                                  {resto.distanceMinutes !== undefined && (
                                    <span className="text-[9px] font-extrabold text-indigo-500 dark:text-indigo-400">
                                      ⏱️ {resto.distanceMinutes} min
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex justify-end mt-2 pt-2 border-t border-dashed border-slate-300/40 dark:border-white/5">
                                <button
                                  type="button"
                                  onClick={() => window.open(resto.mapsUri, '_blank')}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[8px] font-black uppercase tracking-widest rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                                >
                                  📍 Y ALLER
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  onClick={handleConfirmBreak} 
                  className="w-full py-6 rounded-[28px] bg-indigo-600 text-white font-black uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(79,70,229,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3 border border-indigo-400/50"
                >
                  <CheckCircle size={24} strokeWidth={3} /> CONFIRMER
                </button>
              </div>
            </div>
          </div>
        )}



        {showCancelDayModal && (
          <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowCancelDayModal(false)} />
            <div className={`relative w-full max-w-md ${effectiveDarkMode ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'} rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-8 shadow-2xl animate-slideUp overflow-hidden border`}>
              {/* Contenu de la Pop-up */}
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center shadow-inner">
                  <Trash size={28} className="text-rose-500" />
                </div>
                <div>
                  <h3 className={`text-lg font-black uppercase tracking-wider ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    Supprimer la journée ?
                  </h3>
                  <p className={`text-xs font-semibold leading-relaxed mt-2 ${effectiveDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Voulez-vous vraiment supprimer cette journée en cours du planning ? Toutes les heures et pauses saisies aujourd'hui seront effacées de la base de données.
                  </p>
                </div>
                
                <div className="flex w-full gap-3 mt-4">
                  <button
                    onClick={() => setShowCancelDayModal(false)}
                    className={`flex-1 py-3 px-4 ${
                      effectiveDarkMode 
                        ? 'bg-white/5 hover:bg-white/10 text-slate-300' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    } rounded-xl text-xs font-black uppercase tracking-widest transition-all`}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={async () => {
                      setShowCancelDayModal(false);
                      await handleAnnulerJournee(true);
                    }}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-rose-900/20 active:scale-95"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem('ambuflow_splash_shown', 'true');
  }, []);

  return (
    <ErrorBoundary>
      <AnimatePresence mode="wait">
        {showSplash && (
          <SplashScreen 
            key="splash-screen"
            onComplete={handleSplashComplete} 
          />
        )}
      </AnimatePresence>

      {!showSplash && (
        <>
          {(!isAuthReady || authLoading) ? (
            <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center p-8 ${effectiveDarkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
          <div className="relative mb-12">
            <div className="w-16 h-16 border-4 border-indigo-500/20 rounded-full animate-spin border-t-indigo-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="space-y-4 text-center">
            <div>
              <h2 className="text-xl font-black uppercase tracking-[0.3em] leading-none">AmbuFlow</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 font-sans">
                {user ? "Chargement du profil..." : "Initialisation..."}
              </p>
            </div>
          </div>
          {showLoadingLonger && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 p-6 bg-slate-900/50 border border-slate-800 rounded-[24px] text-center max-w-xs shadow-xl"
            >
              <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-wider">
                Connexion instable
              </p>
              <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
                Le chargement des données Firebase prend du temps.
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 w-full py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
              >
                Actualiser
              </button>
            </motion.div>
          )}
        </div>
      ) : !user && !isGuest ? (
        <Login 
          onEnterAsGuest={() => {
            setIsGuest(true);
            localStorage.setItem('ambuflow_is_guest', 'true');
          }} 
        />
      ) : (
        <div className={`min-h-screen w-full overflow-x-hidden transition-colors duration-500 font-sans pb-28 flex flex-col relative ${effectiveDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-br from-[#FDFBFB] to-[#EBEDEE] text-slate-900'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key="main-app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="flex-1 flex flex-col w-full"
          >
            <style>{`
              @keyframes pulse-border {
                0% { border-color: rgba(244, 63, 94, 0.3); box-shadow: 0 0 0px rgba(244, 63, 94, 0); }
                50% { border-color: rgba(244, 63, 94, 1); box-shadow: 0 0 30px rgba(244, 63, 94, 0.6); }
                100% { border-color: rgba(244, 63, 94, 0.3); box-shadow: 0 0 0px rgba(244, 63, 94, 0); }
              }
              .animate-pulse-border { animation: pulse-border 2s infinite; }
              @keyframes slideUp { from { opacity: 0; transform: translateY(30px); filter: blur(10px); } to { opacity: 1; transform: translateY(0); filter: blur(0); } }
              .animate-slideUp { animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
              .animate-fadeIn { animation: fadeIn 0.8s ease-out forwards; }
              @keyframes popIn { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
              .animate-popIn { animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
              @keyframes blink-red {
                0%, 100% { color: #f43f5e; opacity: 1; }
                50% { opacity: 0.7; }
              }
              .animate-blink-red { animation: blink-red 1s infinite; }
              @keyframes pulse-subtle {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.96; transform: scale(0.995); }
              }
              .animate-pulse-subtle { animation: pulse-subtle 2.5s ease-in-out infinite; }
            `}</style>
            <div className="fixed top-0 left-0 right-0 z-[200] pointer-events-none">
              <div className="flex flex-col gap-3 w-full max-w-md mx-auto px-6 pt-6">
                {notifications.map(notify => (
                  <PushNotification 
                    key={notify.id} 
                    notification={notify} 
                    darkMode={effectiveDarkMode} 
                    onClose={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
                    onAction={(action) => {
                    }}
                  />
                ))}
              </div>
            </div>
            
            {showDailyRecap && lastFinishedShift && (
              <DailyRecap 
                shift={lastFinishedShift}
                userStats={userStats}
                hourlyRate={effectiveHourlyRate}
                onClose={() => setShowDailyRecap(false)}
                darkMode={effectiveDarkMode}
                onUpdateShift={(updatedShift) => {
                  setShifts(prev => prev.map(s => s.id === updatedShift.id ? updatedShift : s));
                  setLastFinishedShift(updatedShift);
                }}
              />
            )}

            {(() => {
              const unreadCount = notifications.filter(n => !n.read).length;
              return (
                <header className={`sticky top-0 z-40 backdrop-blur-md px-6 pt-12 pb-6 transition-all bg-transparent border-none`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {profileImage && (
                        <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-indigo-500/20 shadow-lg" onClick={() => setActiveTab('profile')}>
                          <img src={profileImage} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      <div>
                        <h1 className="text-2xl font-black tracking-tight">
                          Bonjour, {userName.split(' ')[0] || "Ami"}{" "}
                          <motion.span
                            style={{ display: 'inline-block', originX: 0.7, originY: 0.7 }}
                            animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                            transition={{
                              duration: 2.5,
                              repeat: Infinity,
                              repeatDelay: 1,
                              ease: "easeInOut"
                            }}
                          >
                            👋
                          </motion.span>
                        </h1>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Logo size={24} className="-rotate-3" />
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em]">
                            {companyName || "AmbuFlow"}
                          </p>
                          {isQuotaExceeded && (
                            <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                              <span className="w-1 h-1 bg-amber-500 rounded-full" /> Sauvegarde Locale (Quota Cloud)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div 
                      onClick={() => {
                        setShowNotificationPanel(true);
                        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                      }}
                      className={`p-3 rounded-full relative border backdrop-blur-md cursor-pointer group hover:scale-105 active:scale-95 transition-all shadow-sm ${
                        effectiveDarkMode 
                          ? 'bg-slate-800/50 border-white/10' 
                          : 'bg-white/60 border-white/40'
                      }`}
                    >
                      <motion.div
                        animate={unreadCount > 0 ? {
                          rotate: [0, -10, 10, -10, 10, 0],
                        } : {}}
                        transition={unreadCount > 0 ? {
                          duration: 0.5,
                          repeat: Infinity,
                          repeatDelay: 2
                        } : {}}
                      >
                        <Bell size={24} className={unreadCount > 0 ? 'text-indigo-500' : effectiveDarkMode ? 'text-slate-400' : 'text-slate-600'} />
                      </motion.div>
                      {unreadCount > 0 && (
                        <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 shadow-lg" />
                      )}
                    </div>
                  </div>
                </header>
              );
            })()}
            <AnimatePresence>
              {showNotificationPanel && (
                <NotificationHistory 
                  notifications={notifications}
                  onClose={() => setShowNotificationPanel(false)}
                  onClear={() => {
                    setNotifications([]);
                    setShowNotificationPanel(false);
                  }}
                  onRead={(id) => {
                    if (id === 'all') {
                      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                    } else {
                      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                    }
                  }}
                  darkMode={effectiveDarkMode}
                />
              )}
            </AnimatePresence>
            <main className={`flex-1 w-full mx-auto flex flex-col border-none shadow-none focus:outline-none ${activeTab === 'home' ? 'max-w-7xl px-4 sm:px-6' : 'max-w-2xl px-4 sm:px-6'}`}>
              {activeTab === 'home' && renderHome()}
              {activeTab === 'planning' && <PlanningTab darkMode={effectiveDarkMode} status={status} setStatus={setStatus} onAutoStartService={handleAutoStartService} onEndServiceSilently={stopServiceSilently} appCurrentTime={currentTime} shifts={shifts} setShifts={setShifts} weekendDays={weekendDays} setWeekendDays={setWeekendDays} activeShiftId={activeShiftId} setActiveShiftId={setActiveShiftId} availableVehicles={availableVehicles} hourlyRate={effectiveHourlyRate} setActiveTab={setActiveTab} workRegime={workRegime} cpCalculationMode={cpCalculationMode as '25' | '30'} modulationWeeks={modulationWeeks} modulationStartDate={modulationStartDate} contractStartDate={contractStartDate} leaveBalances={leaveBalances} initialCpBalance={initialCpBalance} setInitialCpBalance={setInitialCpBalance} primaryRole={primaryRole} onClearAllShifts={clearAllShifts} onDeleteShift={deleteShift} />}
              {activeTab === 'paie' && <PaieTab logs={logs} darkMode={effectiveDarkMode} hasTaxiCard={hasTaxiCard} hourlyRate={effectiveHourlyRate} weeklyContractHours={weeklyContractHours} payRateMode={payRateMode} workRegime={workRegime} shifts={shifts} cpCalculationMode={cpCalculationMode as '25' | '30'} periodStats={periodStats} />}
              {activeTab === 'profile' && <ProfileTab 
                darkMode={effectiveDarkMode} 
                userName={userName} 
                userEmail={user?.email}
                firstName={firstName}
                lastName={lastName}
                setUserName={setUserName}
                profileImage={profileImage} 
                setProfileImage={setProfileImage}
                jobTitle={jobTitle} 
                setJobTitle={setJobTitle}
                companyName={companyName} 
                setCompanyName={setCompanyName}
                companyCity={companyCity}
                setCompanyCity={setCompanyCity}
                hourlyRate={hourlyRate}
                effectiveHourlyRate={effectiveHourlyRate}
                seniorityInfo={seniorityInfo}
                setHourlyRate={setHourlyRate}
                setContractStartDate={setContractStartDate}
                shifts={shifts} 
                logs={logs} 
                followSystemTheme={followSystemTheme} 
                setFollowSystemTheme={setFollowSystemTheme} 
                themeChoice={themeChoice}
                setThemeChoice={setThemeChoice}
                userStats={userStats} 
                onDeleteAccount={handleHardDelete}
                onLogout={async () => {
                  try {
                    await auth.signOut();
                    setIsGuest(false);
                    localStorage.removeItem('ambuflow_is_guest');
                  } catch (error) {
                    console.error("Logout error:", error);
                  }
                }}
                hasDea={hasDea}
                hasAux={hasAux}
                hasTaxiCard={hasTaxiCard}
                contractStartDate={contractStartDate}
                hoursBase={hoursBase}
                setHoursBase={setHoursBase}
                cpCalculationMode={cpCalculationMode as '25' | '30'}
                setCpCalculationMode={(val) => setCpCalculationMode(val as any)}
                initialCpBalance={initialCpBalance}
                setInitialCpBalance={setInitialCpBalance}
                workRegime={workRegime}
                setWorkRegime={setWorkRegime}
                modulationWeeks={modulationWeeks}
                setModulationWeeks={setModulationWeeks}
                modulationStartDate={modulationStartDate}
                setModulationStartDate={setModulationStartDate}
                weeklyContractHours={weeklyContractHours}
                setWeeklyContractHours={setWeeklyContractHours}
                payRateMode={payRateMode}
                setPayRateMode={setPayRateMode}
                pushEnabled={pushEnabled}
                setPushEnabled={setPushEnabled}
                autoGeo={autoGeo}
                setAutoGeo={setAutoGeo}
                roles={roles}
                setRoles={setRoles}
                primaryRole={primaryRole}
                setPrimaryRole={setPrimaryRole}
                afgsuDate={afgsuDate}
                medicalExpiryDate={medicalExpiryDate}
                taxiFpcDate={taxiFpcDate}
                taxiCardExpiryDate={taxiCardExpiryDate}
                supplementaryTaskType={supplementaryTaskType}
                setSupplementaryTaskType={setSupplementaryTaskType}
                heureEmbauchePrevue={heureEmbauchePrevue}
                setHeureEmbauchePrevue={setHeureEmbauchePrevue}
              />}
            </main>
            <Navigation 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              darkMode={effectiveDarkMode} 
              isGuest={isGuest} 
              setIsGuest={setIsGuest}
            />
          </motion.div>
        </AnimatePresence>

        {/* MODAL RE-AUTHENTIFICATION NÉCESSAIRE */}
        <AnimatePresence>
          {showReauthModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
                onClick={() => !isHardDeleting && setShowReauthModal(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className={`relative w-full max-w-sm p-8 rounded-[40px] border ${effectiveDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} shadow-2xl`}
              >
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 mx-auto">
                  {isHardDeleting ? <Loader2 className="animate-spin" size={32} /> : <ShieldAlert size={32} />}
                </div>
                <h3 className={`text-xl font-black mb-3 text-center ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>Sécurité Renforcée</h3>
                <p className="text-slate-400 text-center text-xs font-medium leading-relaxed mb-8 uppercase tracking-widest px-4">
                  Pour supprimer votre compte, Firebase nécessite une <span className="text-amber-500 font-black">re-connexion</span> récente par mesure de sécurité.
                </p>
                
                <div className="space-y-3">
                  <button 
                    disabled={isHardDeleting}
                    onClick={async () => {
                      setIsHardDeleting(true);
                      try {
                        const provider = new GoogleAuthProvider();
                        await reauthenticateWithPopup(auth.currentUser!, provider);
                        setShowReauthModal(false);
                        // Retry deletion after success
                        await handleHardDelete();
                      } catch (error: any) {
                        console.error("Reauth error:", error);
                        setDeleteError("La re-vérification avec Google a échoué. Veuillez réessayer.");
                      } finally {
                        setIsHardDeleting(false);
                      }
                    }}
                    className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isHardDeleting ? <Loader2 className="animate-spin" size={16} /> : "Vérifier avec Google"}
                  </button>

                  <button 
                    disabled={isHardDeleting}
                    onClick={() => {
                      // For email users, we just tell them to logout and login again as it's simpler than building a full password modal
                      addNotification("Action requise", "Veuillez vous déconnecter et vous reconnecter avec votre email/mot de passe avant de supprimer votre compte.", "info");
                      setShowReauthModal(false);
                    }}
                    className="w-full py-5 border border-slate-700 text-slate-400 font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-slate-500/5 transition-all"
                  >
                    J'utilise un Email / MDP
                  </button>

                  <button 
                    disabled={isHardDeleting}
                    onClick={() => setShowReauthModal(false)}
                    className="w-full py-5 text-slate-500 font-black rounded-2xl uppercase tracking-[0.2em] text-[10px]"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL ERREUR SUPPRESSION */}
        <AnimatePresence>
          {deleteError && (
            <div className="fixed inset-0 z-[201] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
                onClick={() => setDeleteError(null)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className={`relative w-full max-w-sm p-8 rounded-[40px] border ${effectiveDarkMode ? 'bg-slate-900 border-rose-500/30' : 'bg-white border-rose-100'} shadow-2xl`}
              >
                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6 mx-auto">
                  <AlertTriangle size={32} />
                </div>
                <h3 className={`text-xl font-black mb-3 text-center ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>Erreur</h3>
                <p className="text-slate-400 text-center text-xs font-medium leading-relaxed mb-8 uppercase tracking-widest px-4">
                  {deleteError}
                </p>
                <button 
                  onClick={() => setDeleteError(null)}
                  className="w-full mt-8 py-5 bg-slate-800 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] active:scale-95 transition-all"
                >
                  OK
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    )}
  </>
)}
    </ErrorBoundary>
  );
};
export default App;
