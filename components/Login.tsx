
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  ChevronRight, 
  Loader2,
  AlertCircle,
  ShieldCheck,
  Chrome,
  UserCircle,
  Eye,
  EyeOff,
  Plus,
  HelpCircle,
  Info
} from 'lucide-react';
import { auth, googleProvider, db } from '../src/firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';

interface LoginProps {
  onLoginSuccess?: () => void;
  onEnterAsGuest?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onEnterAsGuest }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | React.ReactNode | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [showUserNotFoundModal, setShowUserNotFoundModal] = useState(false);
  
  const handleAppleLogin = () => {
    setError("La connexion avec Apple sera disponible prochainement.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Explicitly connect to Firestore to initialize the user profile
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          onboarded: false
        }, { merge: true });
      }
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      // Avoid logging common user errors as full errors to reduce console noise
      const commonUserErrors = ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential', 'auth/email-already-in-use'];
      if (!commonUserErrors.includes(err.code)) {
        console.error("Auth error:", err);
      }
      
      let message = "Une erreur est survenue.";
      
      if (err.code === 'auth/user-not-found') {
        setShowUserNotFoundModal(true);
        setLoading(false);
        return;
      }

      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        if (isLogin) {
          setError(
            <div className="space-y-1.5 flex flex-col">
              <p className="font-black uppercase text-[10px]">Identifiants incorrects</p>
              <p className="opacity-70">L'email ou le mot de passe ne correspond à aucun compte.</p>
              {email.toLowerCase().endsWith('@gmail.com') && (
                <p className="text-indigo-500 font-bold mt-1">Vous avez peut-être créé votre compte avec Google ? Essayez le bouton Google ci-dessus.</p>
              )}
              <div className="flex flex-wrap gap-4 mt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError(null);
                    setPassword('');
                  }}
                  className="text-[8px] underline decoration-indigo-300 underline-offset-4 hover:text-indigo-600 transition-colors uppercase font-black"
                >
                  Créer un compte
                </button>
                <button 
                  type="button"
                  onClick={handleResetPassword}
                  className="text-[8px] underline decoration-indigo-300 underline-offset-4 hover:text-indigo-600 transition-colors uppercase font-black"
                >
                  Réinitialiser le mot de passe
                </button>
              </div>
            </div>
          );
        } else {
          setError("Format d'identifiants non supporté.");
        }
        setLoading(false);
        return;
      } else if (err.code === 'auth/email-already-in-use') {
        setError(
          <div className="space-y-1.5 flex flex-col">
            <p className="font-black uppercase text-[10px]">Compte existant</p>
            <p className="opacity-70">Cet email est déjà enregistré sur AmbuFlow.</p>
            {email.toLowerCase().endsWith('@gmail.com') && (
              <p className="text-indigo-500 font-bold">Essayez de vous connecter avec Google.</p>
            )}
            <div className="flex gap-4 mt-2">
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(true);
                  setError(null);
                  setPassword('');
                }}
                className="text-[8px] underline decoration-indigo-300 underline-offset-4 hover:text-indigo-600 transition-colors uppercase font-black"
              >
                Passer à la connexion
              </button>
              <button 
                type="button"
                onClick={handleResetPassword}
                className="text-[8px] underline decoration-indigo-300 underline-offset-4 hover:text-indigo-600 transition-colors uppercase font-black"
              >
                Mot de passe oublié ?
              </button>
            </div>
          </div>
        );
        setIsLogin(true);
        setLoading(false);
        return;
      } else if (err.code === 'auth/operation-not-allowed') {
        setError(
          <div className="space-y-1.5 flex flex-col">
            <p className="font-black uppercase text-[10px]">Méthode désactivée</p>
            <p className="opacity-70 text-[9px] leading-relaxed">
              La connexion par email/mot de passe n'est pas activée dans la console Firebase.
              Veuillez l'activer dans Authentication &gt; Sign-in method.
            </p>
          </div>
        );
        setLoading(false);
        return;
      } else if (err.code === 'auth/weak-password') {
        message = "Le mot de passe doit contenir au moins 6 caractères.";
      } else if (err.code === 'auth/invalid-email') {
        message = "Format d'email invalide.";
      } else if (err.code === 'auth/network-request-failed') {
        setError(
          <div className="space-y-1.5 flex flex-col">
            <p className="font-black uppercase text-[10px]">Erreur réseau</p>
            <p className="opacity-70 text-[9px] leading-relaxed">
              Impossible de contacter les serveurs Firebase. 
              Vérifiez votre connexion ou désactivez vos éventuels adblockers / extensions qui pourraient bloquer les requêtes Google.
              Si vous êtes en navigation privée, assurez-vous que les cookies tiers sont autorisés.
            </p>
            <button 
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-[8px] underline decoration-indigo-300 underline-offset-4 hover:text-indigo-600 transition-colors uppercase font-black"
            >
              Recharger la page
            </button>
          </div>
        );
        setLoading(false);
        return;
      } else if (err.code === 'auth/too-many-requests') {
        message = "Trop de tentatives. Veuillez réessayer plus tard.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Starting Google Sign-In popup...");
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      console.log("Google Sign-In successful. User:", user.uid);
      
      // Force loading state while we perform Firestore check
      setLoading(true);
      
      // Check if user document exists, if not initialize it
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        console.log("User document doesn't exist, creating...");
        await setDoc(userDocRef, {
          email: user.email,
          userName: user.displayName || '',
          profileImage: user.photoURL || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          onboarded: false
        }, { merge: true });
        console.log("User document created successfully.");
      } else {
        console.log("User document already exists.");
      }
      
      // We don't call onLoginSuccess here anymore as App.tsx handles it via onAuthStateChanged
      console.log("Login sequence finished in Login component.");
    } catch (err: any) {
      console.error("Google Auth error details:", err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError("Un compte existe déjà avec cet email via une autre méthode de connexion (Email/Mot de passe).");
      } else if (err.code === 'auth/network-request-failed') {
        setError(
          <div className="space-y-1.5 flex flex-col">
            <p className="font-black uppercase text-[10px]">Erreur réseau (Google)</p>
            <p className="opacity-70 text-[9px] leading-relaxed">
              La connexion Google a échoué à cause d'un blocage réseau. 
              Vérifiez votre connexion ou désactivez les extensions qui bloquent les fenêtres surgissantes (popups) ou les scripts tiers.
            </p>
          </div>
        );
      } else if (err.code !== 'auth/popup-closed-by-user') {
        console.error("Google Auth error:", err);
        setError("Erreur lors de la connexion avec Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Veuillez saisir votre email pour réinitialiser le mot de passe.");
      return;
    }
    setLoading(true);
    setError(null);
    setResetSent(false);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError("Erreur lors de l'envoi de l'email de réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto font-sans selection:bg-indigo-100">
      {/* Background Decorative Elements - Neumorphic Style */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-indigo-50 blur-[100px] rounded-full" />
        <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] bg-slate-50 blur-[100px] rounded-full" />
      </div>

      {/* User Not Found Modal */}
      {showUserNotFoundModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#0F172A]/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowUserNotFoundModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl border border-indigo-50 animate-popIn text-center space-y-6">
            <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto text-amber-500">
              <Mail size={32} />
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-black text-[#0F172A] tracking-tight">Compte introuvable</h3>
              <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase tracking-widest px-4">
                L'adresse <span className="text-indigo-600 font-black">{email}</span> n'est pas encore enregistrée chez AmbuFlow.
              </p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => {
                  setIsLogin(false);
                  setShowUserNotFoundModal(false);
                }}
                className="w-full py-4 bg-[#0F172A] text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-lg active:scale-95 transition-all"
              >
                Créer mon compte
              </button>
              <button 
                onClick={() => {
                  setShowUserNotFoundModal(false);
                  if (onEnterAsGuest) onEnterAsGuest();
                }}
                className="w-full py-4 bg-white border border-slate-100 text-[#0F172A] font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <UserCircle size={18} className="opacity-40" />
                Accès Invité
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 md:p-12">
        <div className="w-full max-w-md space-y-10">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center space-y-1.5"
          >
            <h1 className="text-[#0F172A] font-black tracking-[0.4em] text-4xl md:text-5xl uppercase leading-none drop-shadow-sm">
              AmbuFlow
            </h1>
            <p className="text-slate-300 text-[10px] font-medium uppercase tracking-[0.3em] font-sans">
              Gestion de vos heures avec précision
            </p>
          </motion.div>

          {/* Social Auth - Sleek Rounded */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-4"
          >
            <button 
              onClick={handleGoogleLogin}
              className="flex items-center justify-center gap-3 py-4 bg-white border border-slate-100/50 rounded-[20px] neumorphic-shadow hover:neumorphic-shadow-hover transition-all font-black text-[10px] uppercase tracking-widest text-[#0F172A]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              GOOGLE
            </button>
            <button 
              onClick={handleAppleLogin}
              className="flex items-center justify-center gap-3 py-4 bg-white border border-slate-100/50 rounded-[20px] neumorphic-shadow hover:neumorphic-shadow-hover transition-all font-black text-[10px] uppercase tracking-widest text-[#0F172A]"
            >
              <svg className="w-4 h-4" viewBox="0 0 384 512" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
              </svg>
              APPLE
            </button>
          </motion.div>

          {/* Form Card */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="bg-white rounded-[20px] p-8 neumorphic-shadow relative overflow-hidden ring-1 ring-slate-100/50"
          >
            <div className="space-y-6">
              {/* Classic Login Fields */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
                    <div className="relative group">
                      <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within:text-[#0F172A] transition-colors" size={16} />
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.fr"
                        required
                        className="w-full bg-[#FCFDFF] border border-slate-100 rounded-[14px] p-4 pl-12 text-[#0F172A] text-xs font-bold focus:bg-white focus:border-indigo-100 outline-none transition-all placeholder:text-slate-200"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mot de passe</label>
                      {isLogin && (
                        <button 
                          type="button" 
                          onClick={handleResetPassword}
                          className="text-[9px] font-black text-indigo-400 hover:text-indigo-600 uppercase tracking-widest"
                        >
                          MOT DE PASSE OUBLIÉ ?
                        </button>
                      )}
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-200 group-focus-within:text-[#0F172A] transition-colors" size={16} />
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full bg-[#FCFDFF] border border-slate-100 rounded-[14px] p-4 pl-12 pr-12 text-[#0F172A] text-xs font-bold focus:bg-white focus:border-indigo-100 outline-none transition-all placeholder:text-slate-200"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[#0F172A] transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-500"
                  >
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div className="text-[9px] font-black uppercase tracking-wider leading-relaxed">
                      {error}
                    </div>
                  </motion.div>
                )}

                {resetSent && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-500"
                  >
                    <ShieldCheck size={18} className="shrink-0" />
                    <p className="text-[9px] font-black uppercase tracking-wider">Lien envoyé</p>
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {/* Primary Capsule Button */}
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="group relative flex items-center justify-center gap-2 px-6 py-4 bg-[#0F172A] text-white font-black uppercase tracking-[0.15em] rounded-full shadow-[0_12px_24px_-8px_rgba(15,23,42,0.4)] hover:shadow-[0_16px_32px_-8px_rgba(15,23,42,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all text-[10px] disabled:opacity-50 overflow-hidden"
                  >
                    <span className="text-center">
                      {loading ? <Loader2 className="animate-spin" size={16} /> : (isLogin ? 'SE CONNECTER' : "S'INSCRIRE")}
                    </span>
                    <ChevronRight size={14} className="text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Secondary Capsule Button */}
                  <button 
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError(null);
                    }}
                    className="group flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-indigo-100/50 text-[#0F172A] font-black uppercase tracking-[0.15em] rounded-full hover:border-[#0F172A] active:scale-[0.98] transition-all text-[10px]"
                  >
                    <span className="text-center">
                      {isLogin ? "S'INSCRIRE" : "CONNEXION"}
                    </span>
                    {isLogin && <ChevronRight size={14} className="text-[#0F172A]/40 group-hover:text-[#0F172A] group-hover:translate-x-0.5 transition-all" />}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center"
          >
            <button 
              onClick={onEnterAsGuest}
              className="text-slate-400 font-black uppercase tracking-[0.3em] text-[9px] hover:text-[#0F172A] transition-colors"
            >
              ACCÈS INVITÉ
            </button>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { 
          0% { opacity: 0; transform: scale(0.9) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); } 
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        .animate-popIn { animation: popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        .neumorphic-shadow {
          box-shadow: 
            6px 6px 12px rgba(15, 23, 42, 0.04),
            -6px -6px 12px rgba(255, 255, 255, 0.8),
            inset 0 1px 1px rgba(255, 255, 255, 0.5);
        }
        
        .neumorphic-shadow-hover {
          box-shadow: 
            8px 8px 16px rgba(15, 23, 42, 0.06),
            -8px -8px 16px rgba(255, 255, 255, 0.9),
            inset 0 1px 2px rgba(255, 255, 255, 0.6);
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
};

export default Login;
