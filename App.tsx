
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
  Check
} from 'lucide-react';
import { ServiceStatus, ActivityLog, AppTab, Shift, Break, UserStats, UserRole, UserProfile, PushNotification as PushType } from './types';
import { getLocalDateString, getFrenchPublicHolidays, isSundayOrHoliday, calculateTotalDurationMinutes } from './src/lib/dateUtils';
import Logo from './components/Logo';
import PlanningTab from './components/PlanningTab';
import PaieTab from './components/PaieTab';
import ProfileTab from './components/ProfileTab';
import Navigation from './components/Navigation';
import NotificationHistory from './components/NotificationHistory';
import PushNotification from './components/PushNotification';
import DailyRecap from './components/DailyRecap';
import Onboarding from './components/Onboarding';
import Login from './components/Login';
import { auth, db } from './src/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser, signOut, deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { requestNotificationPermissions, requestLocationPermissions, setupNotificationChannels } from './services/notificationManager';
import { requestForToken, onMessageListener } from './src/firebaseConfig';
import { handleFirestoreError, OperationType } from './src/services/firestoreErrorHandler';

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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('ambuflow_is_guest') === 'true');
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
    const saved = localStorage.getItem('ambuflow_shifts');
    return saved ? JSON.parse(saved) : [];
  });
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
  const [initialCpBalance, setInitialCpBalance] = useState(0);
  const [lastCpAccrualDate, setLastCpAccrualDate] = useState<string>("");
  const [customHours, setCustomHours] = useState("");
  const [weekendDays, setWeekendDays] = useState<string[]>([]);
  const [followSystemTheme, setFollowSystemTheme] = useState(true);
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark'>('dark');
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    // Priority: check if we just requested a reset
    if (localStorage.getItem('onboarding_requested') === 'true') return false;
    
    const saved = localStorage.getItem('ambuflow_config');
    if (saved) {
      try {
        const config = JSON.parse(saved);
        return config.onboarded === true;
      } catch (e) { return false; }
    }
    return false;
  });
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<UserRole | ''>('');
  const [weeklyContractHours, setWeeklyContractHours] = useState(35);
  const [overtimeMode, setOvertimeMode] = useState<'weekly' | 'biweekly' | 'modulation' | 'annualized'>('weekly');
  const [payRateMode, setPayRateMode] = useState<'100_percent' | '90_percent'>('100_percent');
  const [supplementaryTaskType, setSupplementaryTaskType] = useState<'none' | 'type_1' | 'type_2' | 'type_3'>('none');

  // Missing States
  const [status, setStatus] = useState<ServiceStatus>(() => {
    const saved = localStorage.getItem('ambuflow_status');
    return (saved as ServiceStatus) || ServiceStatus.OFF;
  });
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
  const [prefersDarkMode, setPrefersDarkMode] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [selectedVehicleType, setSelectedVehicleType] = useState('ASSU');

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
      const newVal = parseFloat(config.initialCpBalance || "0");
      return prev !== newVal ? newVal : prev;
    });
    if (config.lastCpAccrualDate !== undefined) setLastCpAccrualDate(prev => prev !== config.lastCpAccrualDate ? config.lastCpAccrualDate : prev);
    if (config.customHours !== undefined) setCustomHours(prev => prev !== config.customHours ? config.customHours : prev);
    if (config.weekendDays !== undefined) setWeekendDays(prev => JSON.stringify(prev) !== JSON.stringify(config.weekendDays) ? config.weekendDays : prev);
    if (config.pushEnabled !== undefined) setPushEnabled(prev => prev !== config.pushEnabled ? config.pushEnabled : prev);
    if (config.followSystemTheme !== undefined) setFollowSystemTheme(prev => prev !== config.followSystemTheme ? config.followSystemTheme : prev);
    if (config.themeChoice !== undefined) setThemeChoice(prev => prev !== config.themeChoice ? config.themeChoice : prev);
    if (config.onboarded !== undefined) {
      // If we just requested a reset, ignore any 'true' value from Firestore/cache until onboarding is complete again
      if (localStorage.getItem('onboarding_requested') === 'true' && config.onboarded === true) {
        return;
      }
      setOnboarded(config.onboarded);
    }
    if (config.roles !== undefined) setRoles(prev => JSON.stringify(prev) !== JSON.stringify(config.roles) ? config.roles : prev);
    if (config.primaryRole !== undefined) setPrimaryRole(prev => prev !== config.primaryRole ? config.primaryRole : prev);
    if (config.weeklyContractHours !== undefined) setWeeklyContractHours(prev => prev !== config.weeklyContractHours ? config.weeklyContractHours : prev);
    if (config.overtimeMode !== undefined) setOvertimeMode(prev => prev !== config.overtimeMode ? config.overtimeMode : prev);
    if (config.payRateMode !== undefined) setPayRateMode(prev => prev !== config.payRateMode ? config.payRateMode : prev);
    if (config.supplementaryTaskType !== undefined) setSupplementaryTaskType(prev => prev !== config.supplementaryTaskType ? config.supplementaryTaskType : prev);
    if (config.status !== undefined) setStatus(prev => prev !== config.status ? config.status : prev);
    if (config.activeShiftId !== undefined) setActiveShiftId(prev => prev !== config.activeShiftId ? config.activeShiftId : prev);
    if (config.scheduledShiftId !== undefined) setScheduledShiftId(prev => prev !== config.scheduledShiftId ? config.scheduledShiftId : prev);
    if (config.nextAutoStart !== undefined) setNextAutoStart(config.nextAutoStart ? new Date(config.nextAutoStart) : null);
    if (config.breakStartDateTime !== undefined) setBreakStartDateTime(config.breakStartDateTime ? new Date(config.breakStartDateTime) : null);
    if (config.breakEndTimeActual !== undefined) setBreakEndTimeActual(config.breakEndTimeActual ? new Date(config.breakEndTimeActual) : null);
    if (config.shifts !== undefined) setShifts(prev => JSON.stringify(prev) !== JSON.stringify(config.shifts) ? config.shifts : prev);
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
          // Check if we still have a user session when the error occurs
          if (auth.currentUser) {
             handleFirestoreError(error, OperationType.GET, userDocPath);
          } else {
             console.warn("Permission error occurred but session was lost. Ignoring.");
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
    
    const configStr = JSON.stringify(config);
    if (configStr === lastSavedConfigRef.current) return;

    lastSavedConfigRef.current = configStr;
    
    // Notifications are saved separately to avoid startup overwrite issues
    const { notifications: _, ...configToSave } = config;
    localStorage.setItem('ambuflow_config', JSON.stringify(configToSave));
    
    if (!user) return;

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
  }, [user, userName, profileImage, jobTitle, hourlyRate, companyName, companyCity, firstName, lastName, qualifications, entryDate, workRegime, monthlyHours, leaveCalculation, autoGeo, hasDea, hasAux, hasTaxiCard, primaryGraduationDate, deaDate, auxDate, taxiDate, taxiCardExpiryDate, taxiFpcDate, afgsuDate, medicalExpiryDate, contractStartDate, contractType, hoursBase, cpCalculationMode, modulationStartDate, modulationWeeks, initialCpBalance, lastCpAccrualDate, customHours, weekendDays, pushEnabled, followSystemTheme, themeChoice, onboarded, roles, primaryRole, weeklyContractHours, overtimeMode, payRateMode, status, activeShiftId, scheduledShiftId, nextAutoStart, shifts, logs, breakStartDateTime, breakEndTimeActual, notifications]);

  useEffect(() => {
    if (user || isGuest) {
      const timeout = setTimeout(() => {
        saveConfig();
      }, 500); // Reduced debounce to 500ms for more reliable sync
      return () => clearTimeout(timeout);
    }
  }, [user, isGuest, saveConfig, status, activeShiftId, scheduledShiftId, nextAutoStart, shifts, logs, breakStartDateTime, breakEndTimeActual, notifications]);

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
    if (!onboarded) return;

    const currentMonthStr = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}`;
    
    if (!lastCpAccrualDate) {
      setLastCpAccrualDate(currentMonthStr);
      return;
    }

    const [lastYear, lastMonth] = lastCpAccrualDate.split('-').map(Number);
    const lastDate = new Date(lastYear, lastMonth - 1, 1);
    const currentDate = new Date(currentTime.getFullYear(), currentTime.getMonth(), 1);

    if (currentDate > lastDate) {
      const monthsDiff = (currentDate.getFullYear() - lastDate.getFullYear()) * 12 + (currentDate.getMonth() - lastDate.getMonth());
      
      if (monthsDiff > 0) {
        // Base calculation according to mode (30 working days vs 25 worked days)
        // Transport convention standard is 2.5 days per month (30 days/year)
        let daysPerMonth = cpCalculationMode === '30' ? 2.5 : 2.08;
        
        // If part-time or specific contract hours affect acquisition
        if (weeklyContractHours && weeklyContractHours < 35) {
          // Some agreements or companies pro-rate the acquisition days
          // Though legally it's 2.5, here we follow user's instruction that it depends on the hours
          daysPerMonth = (daysPerMonth * weeklyContractHours) / 35;
        }

        let totalToCredit = parseFloat((daysPerMonth * monthsDiff).toFixed(2));
        
        // Add seniority days if we reached a threshold this month or if we are catching up
        // Seniority days are usually given once per year, but here we track if they apply
        if (seniorityInfo.extraDaysCP > 0) {
          // Just a simple credit check: if it's the anniversary month or first accrual
          const anniversaryMonth = lastDate.getMonth() === new Date(contractStartDate || "").getMonth();
          if (anniversaryMonth || !lastCpAccrualDate) {
            totalToCredit += seniorityInfo.extraDaysCP;
          }
        }

        setInitialCpBalance(prev => prev + totalToCredit);
        setLastCpAccrualDate(currentMonthStr);
        
        addNotification(
          "Crédit Congés & Ancienneté",
          `Votre solde a été crédité de ${totalToCredit.toFixed(2)}j (Base: ${daysPerMonth.toFixed(2)}j/mois ${seniorityInfo.extraDaysCP > 0 ? `+ ${seniorityInfo.extraDaysCP}j ancienneté` : ''}).`,
          'success'
        );
      }
    }
  }, [currentTime, onboarded, lastCpAccrualDate, weeklyContractHours, cpCalculationMode, addNotification]);

  const handleOnboardingComplete = useCallback((profile: Partial<UserProfile>) => {
    if (profile.firstName) setFirstName(profile.firstName);
    if (profile.lastName) setLastName(profile.lastName);
    if (profile.companyName) setCompanyName(profile.companyName);
    if (profile.roles) setRoles(profile.roles);
    if (profile.primaryRole) setPrimaryRole(profile.primaryRole);
    if (profile.contractType) setContractType(profile.contractType);
    if (profile.hoursBase) setHoursBase(profile.hoursBase);
    if (profile.contractStartDate) setContractStartDate(profile.contractStartDate);
    if (profile.autoGeo !== undefined) setAutoGeo(profile.autoGeo);
    if (profile.pushEnabled !== undefined) setPushEnabled(profile.pushEnabled);
    if (profile.onboarded !== undefined) {
      setOnboarded(profile.onboarded);
      if (profile.onboarded === true) {
        localStorage.removeItem('onboarding_requested');
      }
    }
    if (profile.weeklyContractHours !== undefined) {
      setWeeklyContractHours(profile.weeklyContractHours);
      setHoursBase(String(profile.weeklyContractHours));
    }
    if (profile.overtimeMode !== undefined) {
      setOvertimeMode(profile.overtimeMode);
      // Map onboarding overtimeMode to internal workRegime
      const modeMapping: Record<string, string> = {
        'weekly': 'weekly',
        'biweekly': 'fortnightly',
        'modulation': 'modulation',
        'annualized': 'annualization'
      };
      setWorkRegime(modeMapping[profile.overtimeMode] || 'weekly');
    }
    if (profile.modulationWeeks !== undefined) setModulationWeeks(String(profile.modulationWeeks));
    if (profile.modulationStartDate !== undefined) setModulationStartDate(profile.modulationStartDate);
    if (profile.payRateMode !== undefined) setPayRateMode(profile.payRateMode);
    if (profile.supplementaryTaskType !== undefined) setSupplementaryTaskType(profile.supplementaryTaskType as any);
    if (profile.initialCpBalance !== undefined) setInitialCpBalance(profile.initialCpBalance);
    if (profile.hourlyRate !== undefined) setHourlyRate(String(profile.hourlyRate));
    
    // Initialize accrual date to avoid double crediting same month as onboarding
    const currentMonth = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}`;
    setLastCpAccrualDate(currentMonth);
    
    setUserName(`${profile.firstName || ''} ${profile.lastName || ''}`.trim());
    
    // Trigger save
    setTimeout(() => saveConfig(), 500);
  }, [saveConfig]);

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

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentGeoPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      },
      (err) => console.error("Erreur géo:", err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
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

  const handleStartService = useCallback((idToUse?: string | null, customStartTime?: Date, vehicleType?: string) => {
    const now = customStartTime || currentTime;
    const todayStr = getLocalDateString(now);
    const actualStartTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const preciseStart = now.toISOString();
    
    // On cherche si on a déjà une mission pour aujourd'hui
    const todayShift = shifts.find(s => s.day === todayStr && !s.isLeave);
    const finalId = idToUse || todayShift?.id || activeShiftId;

    if (finalId) {
      const existingShift = shifts.find(s => s.id === finalId);
      if (existingShift && existingShift.day === todayStr) {
        // On met à jour la mission existante d'aujourd'hui
        setShifts(prev => prev.map(s => s.id === finalId ? { 
          ...s, 
          start: (s.start && s.start !== '--:--') ? s.start : actualStartTimeStr,
          preciseStart: s.preciseStart || preciseStart,
          vehicle: vehicleType || s.vehicle || 'ASSU'
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
          vehicle: vehicleType || 'ASSU', 
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
        vehicle: vehicleType || 'ASSU', 
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

  const handleResume = useCallback(() => {
    if (activeShiftId && status === ServiceStatus.BREAK) {
      setShifts(prev => prev.map(s => {
        if (s.id === activeShiftId && s.breaks && s.breaks.length > 0) {
          const updatedBreaks = [...s.breaks];
          const lastIndex = updatedBreaks.length - 1;
          const lastBreak = { ...updatedBreaks[lastIndex] };
          
          // Calcul de la durée réelle consommée
          const [startH, startM] = lastBreak.start.split(':').map(Number);
          const startDate = new Date(currentTime);
          startDate.setHours(startH, startM, 0, 0);
          
          let diffMs = currentTime.getTime() - startDate.getTime();
          // Si le diff est négatif, c'est que la pause a traversé minuit
          if (diffMs < 0) {
            diffMs += 24 * 60 * 60 * 1000;
          }
          
          let actualDuration = Math.round(diffMs / 60000);
          
          lastBreak.duration = actualDuration;
          lastBreak.end = currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          updatedBreaks[lastIndex] = lastBreak;
          
          return { ...s, breaks: updatedBreaks };
        }
        return s;
      }));
    }

    setStatus(ServiceStatus.WORKING);
    setBreakEndTimeActual(null);
    setBreakStartDateTime(null);
    addLog("Reprise de mission", "resume");
  }, [activeShiftId, status, currentTime, addLog]);

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
    const [h, m] = breakStartTime.split(':').map(Number);
    const startDate = new Date(currentTime);
    startDate.setHours(h, m, 0, 0);
    const endDate = new Date(startDate.getTime() + breakDuration * 60000);
    setBreakStartDateTime(startDate);
    setBreakEndTimeActual(endDate);
    const endTimeStr = endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    if (activeShiftId) {
      const newBreak: Break = {
        id: Math.random().toString(36).substr(2, 9),
        start: breakStartTime,
        end: endTimeStr,
        duration: breakDuration,
        location: breakType === 'meal' ? breakLocation : 'Entreprise',
        isMeal: breakType === 'meal'
      };
      
      setShifts(prev => prev.map(s => {
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
      }));
    }
    
    if (status !== ServiceStatus.BREAK) {
      console.log("Bouton cliqué: Passage en pause");
      setStatus(ServiceStatus.BREAK);
      addLog(breakType === 'meal' ? "Pause Déjeuner" : "Pause Café", "break");
    } else {
      addLog(breakType === 'meal' ? "Modification Déjeuner" : "Modification Café", "break");
    }
    
    setShowBreakModal(false);
    setActiveTab('home'); // Redirection vers le Board
  }, [breakStartTime, breakDuration, breakLocation, breakType, currentTime, activeShiftId, addLog, status]);

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
        onboarded: false, // This triggers the onboarding flow after reload
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
      if (user && user.uid !== 'local_user') {
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

  const handleHardDelete = useCallback(async () => {
    if (!user || user.uid === 'local_user') {
      await handleResetData();
      return;
    }

    setDeleteError(null);
    isResettingRef.current = true;
    console.log("Starting hard delete for user:", user.uid);
    
    try {
      const uid = user.uid;

      // 1. Delete Firestore Data (Cascade)
      // We use a timeout to avoid hanging forever if Firestore is unreachable
      const deleteData = async () => {
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
      };

      try {
        await Promise.race([
          deleteData(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout Firestore (30s)")), 30000))
        ]);
      } catch (firestoreError: any) {
        console.error("Firestore cleanup failed or timed out:", firestoreError);
        // We continue anyway to try and delete the auth user
      }

      // 2. Delete Firebase Auth User
      console.log("Deleting Auth user...");
      try {
        await deleteUser(user);
      } catch (authError: any) {
        console.error("Auth delete failed:", authError.code, authError.message);
        if (authError.code === 'auth/requires-recent-login') {
          setShowReauthModal(true);
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
      isResettingRef.current = false;
    }
  }, [user, handleResetData, setIsGuest, addNotification]);

  useEffect(() => {
    if (scheduledShiftId) {
      const scheduledShift = shifts.find(s => s.id === scheduledShiftId);
      if (scheduledShift && scheduledShift.day && scheduledShift.start) {
        const [h, m] = scheduledShift.start.split(':').map(Number);
        const [y, mon, d] = scheduledShift.day.split('-').map(Number);
        const newNextAutoStart = new Date(y, mon - 1, d, h, m, 0, 0);
        if (nextAutoStart?.getTime() !== newNextAutoStart.getTime()) {
          setNextAutoStart(newNextAutoStart);
          addNotification("PLANIFICATION MISE À JOUR", `Prise de poste ajustée au ${d}/${mon.toString().padStart(2, '0')} à ${scheduledShift.start}`, "info");
        }
      } else {
        setNextAutoStart(null);
        setScheduledShiftId(null);
      }
    }
  }, [shifts, scheduledShiftId, nextAutoStart, addNotification]);

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

  useEffect(() => {
    if (status === ServiceStatus.BREAK && breakEndTimeActual && currentTime >= breakEndTimeActual) {
      handleResume();
    }
  }, [currentTime, status, breakEndTimeActual, handleResume]);

  useEffect(() => {
    localStorage.setItem('ambuflow_status', status);
    localStorage.setItem('ambuflow_logs', JSON.stringify(logs));
    localStorage.setItem('ambuflow_shifts', JSON.stringify(shifts));
    localStorage.setItem('ambuflow_active_shift_id', activeShiftId || "");
    localStorage.setItem('ambuflow_scheduled_shift_id', scheduledShiftId || "");
    if (nextAutoStart) localStorage.setItem('ambuflow_next_autostart', nextAutoStart.toISOString());
    else localStorage.removeItem('ambuflow_next_autostart');
    
    if (breakStartDateTime) localStorage.setItem('ambuflow_break_start_datetime', breakStartDateTime.toISOString());
    else localStorage.removeItem('ambuflow_break_start_datetime');

    if (breakEndTimeActual) localStorage.setItem('ambuflow_break_end', breakEndTimeActual.toISOString());
    else localStorage.removeItem('ambuflow_break_end');

    localStorage.setItem('ambuflow_notifications', JSON.stringify(notifications));
    localStorage.setItem('ambuflow_user_stats', JSON.stringify(userStats));
  }, [status, logs, activeShiftId, scheduledShiftId, shifts, nextAutoStart, breakStartDateTime, breakEndTimeActual, userStats, notifications]);

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
    
    return {
      cp: Math.max(0, initialCpBalance - usedCp),
      usedCp
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
          const bDur = Number(b.duration) || 0;
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

  const calculateEffectiveMinutes = useCallback((shift: Shift) => {
    if (shift.start === '--:--') return 0;
    const [h1, m1] = shift.start.split(':').map(v => parseInt(v, 10) || 0);
    let endH, endM;
    
    const isCurrentlyInBreak = shift.id === activeShiftId && status === ServiceStatus.BREAK;
    const lastBreak = isCurrentlyInBreak && shift.breaks && shift.breaks.length > 0 
      ? shift.breaks[shift.breaks.length - 1] 
      : null;

    if (shift.end !== '--:--' && shift.end !== '') {
      const [h2, m2] = shift.end.split(':').map(v => parseInt(v, 10) || 0);
      endH = h2;
      endM = m2;
    } else if (shift.id === activeShiftId) {
      if (isCurrentlyInBreak && lastBreak) {
        const [hb, mb] = lastBreak.start.split(':').map(v => parseInt(v, 10) || 0);
        endH = hb;
        endM = mb;
      } else {
        endH = currentTime.getHours();
        endM = currentTime.getMinutes();
      }
    } else {
      return 0;
    }

    const validH1 = isNaN(h1) ? 0 : h1;
    const validM1 = isNaN(m1) ? 0 : m1;
    const validEndH = isNaN(endH) ? 0 : endH;
    const validEndM = isNaN(endM) ? 0 : endM;
    
    let amp = (validEndH * 60 + validEndM) - (validH1 * 60 + validM1);
    if (amp < 0) amp += 1440;
    let eff = isNaN(amp) ? 0 : amp;
    
    if (shift.breaks) {
      shift.breaks.forEach(b => { 
        if (b.end !== '--:--' && b.id !== lastBreak?.id) {
          eff -= Number(b.duration) || 0; 
        }
      });
    }
    return Math.max(0, eff);
  }, [activeShiftId, currentTime, status]);

  const periodStats = useMemo(() => {
    let totalMin = 0;
    let targetMin = (parseInt(hoursBase) || 35) * 60;
    let title = "Semaine";
    let icon = CalendarRange;
    let subtitle = "Période active";
    let color = "indigo";
    let extraData: any = null;

    if (workRegime === 'weekly') {
      const monday = new Date(currentTime);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      shifts.forEach(s => {
        const d = new Date(s.day);
        if (d >= monday) totalMin += calculateEffectiveMinutes(s);
      });
      title = "Heures Semaine";
      subtitle = "Objectif 35h/39h";
      icon = CalendarRange;
      targetMin = (parseInt(hoursBase) || 35) * 60;
    } else if (workRegime === 'fortnightly') {
      const anchor = contractStartDate ? new Date(contractStartDate) : new Date(2024, 0, 1);
      const diffDays = Math.floor((currentTime.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const startOfCycle = new Date(anchor);
      startOfCycle.setDate(anchor.getDate() + Math.floor(diffDays / 14) * 14);
      startOfCycle.setHours(0, 0, 0, 0);
      shifts.forEach(s => {
        const d = new Date(s.day);
        if (d >= startOfCycle) totalMin += calculateEffectiveMinutes(s);
      });
      title = "Heures Quatorzaine";
      subtitle = "Cycle de 14 jours";
      icon = Layers;
      color = "violet";
      targetMin = (parseInt(hoursBase) || 35) * 2 * 60;
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
        const d = new Date(s.day);
        if (d >= startOfCycle && d < endOfCycle) totalMin += calculateEffectiveMinutes(s);
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
        const d = new Date(s.day);
        if (d >= start) totalMin += calculateEffectiveMinutes(s);
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
    return { title, subtitle, icon, value: `${h}h ${m}m`, color, extraData, progress };
  }, [shifts, workRegime, calculateEffectiveMinutes, currentTime, contractStartDate, modulationStartDate, modulationWeeks, hoursBase, status, breakStartDateTime]);

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
        const d = new Date(s.day);
        return d >= start && d < end;
      });

      const IND_REPAS = 15.54;
      const IND_REPAS_UNIQUE = 9.59;
      const IND_SPECIALE = 4.34;
      const IND_DIMANCHE_FERIE = 23.90;

      periodShifts.forEach(s => {
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
      return total;
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
      { label: 'Gains Estimés', value: currentDayGains, trend: 'up' },
      { label: 'Gains Semaine', value: currentWeekGains, trend: getTrend(currentWeekGains, prevWeekGains) },
      { label: 'Gains Mois', value: currentMonthGains, trend: getTrend(currentMonthGains, prevMonthGains) }
    ];
  }, [shifts, currentTime, activeShiftId, effectiveHourlyRate, calculateEffectiveMinutes, status, breakStartDateTime]);

  const vehicleDistribution = useMemo(() => {
    let assuMin = 0;
    let ambuMin = 0;
    let vslMin = 0;
    
    // Get shifts for the current period based on workRegime
    let periodShifts = shifts;
    if (workRegime === 'weekly') {
      const monday = new Date(currentTime);
      const day = monday.getDay();
      const diff = monday.getDate() - day + (day === 0 ? -6 : 1);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      periodShifts = shifts.filter(s => new Date(s.day) >= monday);
    } else if (workRegime === 'fortnightly') {
      const anchor = contractStartDate ? new Date(contractStartDate) : new Date(2024, 0, 1);
      const diffDays = Math.floor((currentTime.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24));
      const startOfCycle = new Date(anchor);
      startOfCycle.setDate(anchor.getDate() + Math.floor(diffDays / 14) * 14);
      startOfCycle.setHours(0, 0, 0, 0);
      periodShifts = shifts.filter(s => new Date(s.day) >= startOfCycle);
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
        const d = new Date(s.day);
        return d >= startOfCycle && d < endOfCycle;
      });
    } else if (workRegime === 'annualization') {
      const start = new Date(currentTime.getFullYear(), 0, 1);
      periodShifts = shifts.filter(s => new Date(s.day) >= start);
    }

    periodShifts.forEach(s => {
      if (s.isLeave || s.vehicle === 'CONGÉ') return;
      const min = calculateEffectiveMinutes(s);
      if (s.vehicle.includes('ASSU')) assuMin += min;
      else if (s.vehicle.includes('VSL')) vslMin += min;
      else ambuMin += min;
    });
    
    const total = assuMin + ambuMin + vslMin;
    const pAssu = total > 0 ? (assuMin / total) * 100 : 0;
    const pAmbu = total > 0 ? (ambuMin / total) * 100 : 0;
    const pVsl = total > 0 ? (vslMin / total) * 100 : 0;
    const gradient = total > 0 
      ? `conic-gradient(#FF4B5C 0% ${pAssu}%, #10b981 ${pAssu}% ${pAssu + pAmbu}%, #6366f1 ${pAssu + pAmbu}% 100%)`
      : `conic-gradient(#e2e8f0 0% 100%)`;
    return { assu: pAssu.toFixed(0), ambu: pAmbu.toFixed(0), vsl: pVsl.toFixed(0), gradient, hasData: total > 0 };
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
    const isTodayFinished = todayShift && todayShift.end !== '--:--';
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
      <div className="p-5 space-y-5 animate-fadeIn pb-32">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">
              Tableau de Bord
            </p>
          </div>
        </div>
        {roles.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
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
          <div className={`p-4 rounded-[24px] border flex items-center gap-4 animate-slideUp ${
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
          <div className={`p-4 rounded-[24px] border flex items-center gap-4 animate-slideUp ${
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
          <div className={`p-4 rounded-[24px] border flex items-center gap-4 animate-slideUp ${
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
          <div className={`p-4 rounded-[24px] border flex items-center gap-4 animate-slideUp ${
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

        {nextAutoStart && scheduledShiftId && (
          <div className="flex justify-center animate-slideUp">
            <div className={`px-4 py-2.5 rounded-full border shadow-xl flex items-center gap-3 backdrop-blur-md transition-all ${effectiveDarkMode ? 'bg-indigo-950/40 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-600'}`}>
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Prise de poste :</span>
                <span className="text-xs font-black tabular-nums">{nextCountdown}</span>
              </div>
              <button onClick={() => { setNextAutoStart(null); setScheduledShiftId(null); }} className={`p-1 rounded-full transition-colors ${effectiveDarkMode ? 'hover:bg-white/10' : 'hover:bg-indigo-100'}`}><X size={12} /></button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div 
            className={`${bentoCardBase} col-span-2 p-8 flex flex-col justify-between min-h-[340px] ${status === ServiceStatus.WORKING ? 'text-white border-none shadow-indigo-500/20 active-mission-card' : (isBreakActive ? 'text-white' : (status === ServiceStatus.BREAK ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white' : (isTodayFinished ? 'bg-gradient-to-br from-emerald-600 to-emerald-900 text-white shadow-emerald-500/20' : '')))}`}
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
                <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-60">
                  {status === ServiceStatus.OFF 
                    ? (isTodayFinished ? 'Journée Terminée' : 'Disponibilité') 
                    : status === ServiceStatus.WORKING 
                      ? 'Mission Active' 
                      : breakLabel}
                </p>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${status === ServiceStatus.WORKING ? 'bg-emerald-400 animate-pulse' : status === ServiceStatus.BREAK ? 'bg-white animate-pulse' : isTodayFinished ? 'bg-emerald-300' : 'bg-slate-500'}`} />
                  <h2 className="text-2xl font-black tracking-tight">{status === ServiceStatus.OFF ? (isTodayFinished ? 'Mission Validée' : 'En attente') : status === ServiceStatus.WORKING ? 'En Service' : 'Coupure en cours'}</h2>
                </div>
              </div>
            </div>
            <div className="py-6">
              <div className="animate-fadeIn">
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
                 <h1 className={`font-black tabular-nums tracking-tighter leading-none drop-shadow-2xl ${isBreakFinished ? 'text-rose-500 animate-blink-red text-4xl py-4' : 'text-7xl'}`}>
                   {status === ServiceStatus.BREAK ? (() => { 
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
                     const sParts = todayShift!.start.split(':');
                     const eParts = todayShift!.end.split(':');
                     if (sParts.length < 2 || eParts.length < 2) return "00:00";
                     const h1 = parseInt(sParts[0], 10);
                     const m1 = parseInt(sParts[1], 10);
                     const h2 = parseInt(eParts[0], 10);
                     const m2 = parseInt(eParts[1], 10);
                     if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return "00:00";
                     let dur = (h2 * 60 + m2) - (h1 * 60 + m1);
                     if (dur < 0) dur += 1440;
                     if (todayShift!.breaks) todayShift!.breaks.forEach(b => dur -= (Number(b.duration) || 0));
                     const finalDur = Math.max(0, dur);
                     const h = Math.floor(finalDur / 60);
                     const m = finalDur % 60;
                     return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                   })() : currentTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))) : getDuration()}
                 </h1>
              </div>
            </div>
            <div className="space-y-3">
              {status === ServiceStatus.OFF ? (
                isTodayFinished ? (
                  <div className="flex gap-3">
                    <button onClick={() => setActiveTab('planning')} className="flex-1 py-5 rounded-[24px] bg-white/10 backdrop-blur-md border border-white/20 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><History size={16} /> Voir Agenda</button>
                    <button onClick={() => setShowVehicleModal(true)} className="flex-[2] py-5 rounded-[24px] bg-white text-emerald-600 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl"><Play size={18} fill="currentColor" /> Nouvelle Mission</button>
                  </div>
                ) : (
                  <button onClick={() => setShowVehicleModal(true)} className="w-full py-6 rounded-[28px] bg-indigo-600 text-white shadow-2xl font-black text-xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-indigo-400/50"><Play size={24} fill="currentColor" /> DÉBUTER</button>
                )
              ) : status === ServiceStatus.WORKING ? (
                <>
                  <div className="grid grid-cols-2 gap-3 animate-slideUp">
                    <button onClick={() => handleOpenBreakModal('meal')} className="py-4 rounded-[24px] bg-white/10 border border-white/20 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><Utensils size={16} /> Déjeuner</button>
                    <button onClick={() => handleOpenBreakModal('coffee')} className="py-4 rounded-[24px] bg-white/10 border border-white/20 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><Coffee size={16} /> Café</button>
                  </div>
                  <button onClick={handleEndService} className="w-full py-5 rounded-[24px] bg-rose-500/20 backdrop-blur-md border border-rose-500/30 text-rose-100 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 active:scale-95 transition-all"><LogOut size={16} /> Finir</button>
                </>
              ) : (
                <div className="space-y-3">
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
                </div>
              )}
            </div>
          </div>
          <div className={`${bentoCardBase} col-span-2 min-h-[160px] flex flex-col group`}>
             <div className="flex-1 p-6 relative flex flex-col justify-between">
                {workRegime === 'modulation' && periodStats.extraData ? (
                  carouselIndex === 0 ? (
                    <div className="flex items-center justify-between animate-fadeIn px-2">
                       <div className="flex items-center gap-5">
                          <div className={`w-20 h-20 rounded-[32px] ${effectiveDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50'} flex items-center justify-center text-indigo-500 shadow-inner`}>
                             <Hourglass size={32} className="animate-pulse" />
                          </div>
                          <div className="space-y-0.5">
                             <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Fin de Modulation</p>
                             <p className={`text-4xl font-black tracking-tighter tabular-nums ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>{periodStats.extraData.countdown}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">Temps restant</p>
                          </div>
                       </div>
                       <button onClick={() => setCarouselIndex(1)} className={`p-4 rounded-3xl ${effectiveDarkMode ? 'bg-white/5' : 'bg-slate-100'} hover:scale-105 transition-all`}>
                          <ChevronRight size={24} className="text-slate-400" />
                       </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between animate-fadeIn px-2">
                       <div className="flex items-center gap-5">
                          <div className={`w-20 h-20 rounded-[32px] ${effectiveDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50'} flex items-center justify-center text-emerald-500 shadow-inner`}>
                             <PieChart size={32} />
                          </div>
                          <div className="space-y-2">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Contrat: {periodStats.extraData.targetHours}h</span>
                             </div>
                             <div className="flex gap-5">
                                <div>
                                   <p className={`text-2xl font-black tracking-tighter ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>{periodStats.extraData.performedHours}h {periodStats.extraData.performedMins}m</p>
                                   <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">EFFECTUÉ</p>
                                </div>
                                <div className="w-px h-8 bg-slate-500/10 self-center" />
                                <div>
                                   <p className="text-2xl font-black tracking-tighter text-slate-400">{periodStats.extraData.remainingHours}h {periodStats.extraData.remainingMins}m</p>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">RESTE</p>
                                </div>
                             </div>
                          </div>
                       </div>
                       <button onClick={() => setCarouselIndex(0)} className={`p-4 rounded-3xl ${effectiveDarkMode ? 'bg-white/5' : 'bg-slate-100'} hover:scale-105 transition-all`}>
                          <ChevronLeft size={24} className="text-slate-400" />
                       </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-between animate-fadeIn px-2">
                     <div className="flex items-center gap-5">
                        <div className={`w-20 h-20 rounded-[32px] ${effectiveDarkMode ? `bg-${periodStats.color}-500/10` : `bg-${periodStats.color}-50`} flex items-center justify-center text-${periodStats.color}-500 shadow-inner`}>
                           <PeriodIcon size={32} />
                        </div>
                        <div className="space-y-0.5">
                           <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">{periodStats.title}</p>
                           <p className={`text-4xl font-black tracking-tighter ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>{periodStats.value}</p>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">{periodStats.subtitle}</p>
                        </div>
                     </div>
                     <button onClick={() => setActiveTab('paie')} className={`p-4 rounded-3xl ${effectiveDarkMode ? 'bg-white/5' : 'bg-slate-100'} hover:scale-105 transition-all`}>
                        <ChevronRight size={24} className="text-slate-400" />
                     </button>
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
                </div>
             </div>
             {workRegime === 'modulation' && (
                <div className="pb-6 flex justify-center gap-2.5">
                   <button 
                     onClick={() => setCarouselIndex(0)}
                     className={`h-2 rounded-full transition-all duration-500 ${carouselIndex === 0 ? 'bg-indigo-500 w-8' : 'bg-slate-500/20 w-2'}`} 
                   />
                   <button 
                     onClick={() => setCarouselIndex(1)}
                     className={`h-2 rounded-full transition-all duration-500 ${carouselIndex === 1 ? 'bg-emerald-500 w-8' : 'bg-slate-500/20 w-2'}`} 
                   />
                </div>
             )}
          </div>
          <div className={`${bentoCardBase} p-6 flex flex-col justify-between aspect-square overflow-hidden relative group`}>
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
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                      {gainsCarouselStats[gainsCarouselIndex].label}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black tracking-tighter">
                        {gainsCarouselStats[gainsCarouselIndex].value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-sm font-bold text-slate-400">€</span>
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
          <div className={`${bentoCardBase} p-6 flex flex-col justify-between aspect-square`}><div className="flex justify-between"><div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500"><TimerIcon size={20} /></div><div className={`w-1.5 h-1.5 rounded-full bg-indigo-500 ${status === ServiceStatus.WORKING ? 'animate-pulse' : ''}`} /></div><div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Amplitude</p><div className="flex items-baseline gap-1"><span className="text-3xl font-black tracking-tighter">{todayStats.amplitude}</span></div></div></div>
          
          

          {primaryRole !== 'taxi' && (
            <div className={`${bentoCardBase} col-span-2 p-6 animate-slideUp`}>
              <div className="flex justify-between items-center mb-6"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-slate-500/5 text-slate-400"><Car size={18} /></div><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Répartition Véhicules</h3></div></div>
              <div className="flex items-center gap-10">
                <div className="relative w-28 h-28 flex-shrink-0"><div className="w-full h-full rounded-full transition-all duration-1000 shadow-xl" style={{ background: vehicleDistribution.gradient }} /><div className={`absolute inset-3 rounded-full flex items-center justify-center ${effectiveDarkMode ? 'bg-slate-900 shadow-inner shadow-black/60' : 'bg-white shadow-inner shadow-slate-200'}`}><Car size={20} className="text-slate-300 opacity-40" /></div></div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#FF4B5C]" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ASSU</span></div><span className="text-xs font-black tabular-nums">{vehicleDistribution.assu}%</span></div>
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">AMBU</span></div><span className="text-xs font-black tabular-nums">{vehicleDistribution.ambu}%</span></div>
                  <div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">VSL</span></div><span className="text-xs font-black tabular-nums">{vehicleDistribution.vsl}%</span></div>
                </div>
              </div>
            </div>
          )}

          {/* COMPTEURS DE SOLDES */}
          <div className={`${bentoCardBase} col-span-2 p-6`}>
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
                  <span className="text-sm font-black text-emerald-500">{leaveBalances.cp.toFixed(2)} / {initialCpBalance.toFixed(2)} j</span>
                  {seniorityInfo.extraDaysCP > 0 && (
                    <span className="text-[8px] font-bold text-amber-500 uppercase tracking-tighter">incl. +{seniorityInfo.extraDaysCP}j ancienneté</span>
                  )}
                </div>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-1000" 
                  style={{ width: `${Math.min(100, (leaveBalances.cp / (initialCpBalance || 25)) * 100)}%` }} 
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
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-fadeIn">
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={() => setShowBreakModal(false)} />
            <div className={`relative w-full max-w-sm rounded-[48px] p-8 shadow-2xl animate-popIn border ${effectiveDarkMode ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-100 text-slate-900'}`}>
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
                      value={breakDuration} 
                      onChange={(e) => setBreakDuration(parseInt(e.target.value))} 
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

        {showVehicleModal && (
          <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setShowVehicleModal(false)} />
            <div className={`relative w-full max-w-lg ${effectiveDarkMode ? 'bg-slate-900' : 'bg-white'} rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl animate-slideUp overflow-hidden`}>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className={`text-xl font-black uppercase tracking-widest ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>Choisir le véhicule</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sélectionnez le type pour aujourd'hui</p>
                </div>
                <button onClick={() => setShowVehicleModal(false)} className={`w-10 h-10 rounded-full flex items-center justify-center ${effectiveDarkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  <X size={22} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 mb-8">
                {[
                  { id: 'ASSU', label: 'ASSU', sub: 'Ambulance SMUR', icon: <Ambulance size={24} />, img: 'https://images.unsplash.com/photo-1587748661673-d15d543b3a2a?auto=format&fit=crop&q=80&w=300' },
                  { id: 'AMBU', label: 'AMBU', sub: 'Ambulance Privée', icon: <Activity size={24} />, img: 'https://images.unsplash.com/photo-1612277795421-9bc7706a4a34?auto=format&fit=crop&q=80&w=300' },
                  { id: 'VSL', label: 'VSL', sub: 'Véhicule Sanitaire', icon: <Car size={24} />, img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=300' }
                ].map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVehicleType(v.id);
                      setShowVehicleModal(false);
                      handleStartService(null, null, v.id);
                    }}
                    className={`group relative overflow-hidden flex items-center gap-5 p-5 rounded-[28px] border-2 transition-all ${
                      selectedVehicleType === v.id 
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' 
                        : (effectiveDarkMode ? 'border-white/5 bg-white/5 hover:border-white/10' : 'border-slate-100 bg-slate-50 hover:border-slate-200')
                    }`}
                  >
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 shadow-md">
                       <img src={v.img} alt={v.label} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                       <div className={`absolute inset-0 flex items-center justify-center ${selectedVehicleType === v.id ? 'bg-indigo-600/20' : 'bg-black/20'}`}>
                         <div className="text-white drop-shadow-lg">{v.icon}</div>
                       </div>
                    </div>
                    <div className="flex flex-col items-start flex-1 text-left">
                      <span className={`text-base font-black tracking-widest ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>{v.label}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{v.sub}</span>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      selectedVehicleType === v.id ? 'bg-indigo-600 text-white' : (effectiveDarkMode ? 'bg-white/5 text-transparent' : 'bg-white text-transparent')
                    }`}>
                      <Check size={16} strokeWidth={3} />
                    </div>
                  </button>
                ))}
              </div>
              
              <p className="text-center text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-40">
                Vous pourrez le modifier plus tard dans l'agenda
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <ErrorBoundary>
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
      ) : !onboarded ? (
        <Onboarding onComplete={handleOnboardingComplete} userEmail={user?.email} />
      ) : (
        <div className={`min-h-screen transition-colors duration-500 font-sans pb-28 flex flex-col relative ${effectiveDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F8FAFC] text-slate-900'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key="main-app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="flex-1 flex flex-col"
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
                        <div className="flex items-center gap-2">
                          <Logo size={24} className="-rotate-3" />
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.25em]">
                            {companyName || "AmbuFlow"}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div 
                      onClick={() => {
                        setShowNotificationPanel(true);
                        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                      }}
                      className={`p-3 rounded-2xl relative border ${effectiveDarkMode ? 'bg-slate-800/50 border-white/10' : 'bg-slate-100/50 border-slate-200'} backdrop-blur-md cursor-pointer group hover:scale-105 active:scale-95 transition-all`}
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
            <main className="flex-1 max-w-xl mx-auto w-full">
              {activeTab === 'home' && renderHome()}
              {activeTab === 'planning' && <PlanningTab darkMode={effectiveDarkMode} status={status} setStatus={setStatus} onAutoStartService={handleAutoStartService} onEndServiceSilently={stopServiceSilently} appCurrentTime={currentTime} shifts={shifts} setShifts={setShifts} weekendDays={weekendDays} setWeekendDays={setWeekendDays} activeShiftId={activeShiftId} setActiveShiftId={setActiveShiftId} availableVehicles={['ASSU', 'AMBU', 'VSL']} hourlyRate={effectiveHourlyRate} setActiveTab={setActiveTab} workRegime={workRegime} cpCalculationMode={cpCalculationMode as '25' | '30'} modulationWeeks={modulationWeeks} modulationStartDate={modulationStartDate} contractStartDate={contractStartDate} leaveBalances={leaveBalances} initialCpBalance={initialCpBalance} setInitialCpBalance={setInitialCpBalance} />}
              {activeTab === 'paie' && <PaieTab logs={logs} darkMode={effectiveDarkMode} hasTaxiCard={hasTaxiCard} hourlyRate={effectiveHourlyRate} weeklyContractHours={weeklyContractHours} overtimeMode={overtimeMode} payRateMode={payRateMode} workRegime={workRegime} shifts={shifts} cpCalculationMode={cpCalculationMode as '25' | '30'} />}
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
                overtimeMode={overtimeMode}
                setOvertimeMode={setOvertimeMode}
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
                onClick={() => setShowReauthModal(false)} 
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className={`relative w-full max-w-sm p-8 rounded-[40px] border ${effectiveDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'} shadow-2xl`}
              >
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-6 mx-auto">
                  <ShieldAlert size={32} />
                </div>
                <h3 className={`text-xl font-black mb-3 text-center ${effectiveDarkMode ? 'text-white' : 'text-slate-900'}`}>Sécurité Renforcée</h3>
                <p className="text-slate-400 text-center text-xs font-medium leading-relaxed mb-8 uppercase tracking-widest px-4">
                  Pour supprimer votre compte, Firebase nécessite une <span className="text-amber-500 font-black">connexion récente</span>. Veuillez vous reconnecter puis réessayer.
                </p>
                
                <div className="space-y-3">
                  <button 
                    onClick={async () => {
                      await signOut(auth);
                      localStorage.clear();
                      sessionStorage.clear();
                      window.location.href = '/';
                    }}
                    className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                  >
                    Se déconnecter pour re-tester
                  </button>
                  <button 
                    onClick={() => setShowReauthModal(false)}
                    className="w-full py-5 text-slate-400 font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-slate-500/5 transition-all"
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
    </ErrorBoundary>
  );
};
export default App;
