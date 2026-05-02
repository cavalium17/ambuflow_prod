import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mail, 
  Lock, 
  ChevronRight, 
  Loader2,
  AlertCircle,
  ShieldCheck,
  UserCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import Logo from './Logo';
import { auth, googleProvider, db } from '../src/firebaseConfig';
import { handleFirestoreError, OperationType } from '../src/services/firestoreErrorHandler';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup
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
        
        const userDocRef = doc(db, 'users', user.uid);
        try {
          await setDoc(userDocRef, {
            email: user.email,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            onboarded: false
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
        }
      }
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
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
              <p className="font-bold uppercase text-[10px]">Identifiants incorrects</p>
              <p className="text-[10px] opacity-70">L'email ou le mot de passe ne correspond à aucun compte.</p>
              {email.toLowerCase().endsWith('@gmail.com') && (
                <p className="text-indigo-600 font-bold mt-1 text-[10px]">Vous avez peut-être utilisé Google ?</p>
              )}
              <div className="flex flex-wrap gap-3 mt-2">
                <button 
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-[9px] font-bold text-indigo-600 hover:underline uppercase"
                >
                  S'inscrire
                </button>
                <button 
                  type="button"
                  onClick={handleResetPassword}
                  className="text-[9px] font-bold text-indigo-600 hover:underline uppercase"
                >
                  Mot de passe oublié ?
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
            <p className="font-bold uppercase text-[10px]">Compte existant</p>
            <p className="text-[10px] opacity-70">Cet email est déjà enregistré.</p>
            <button 
              type="button"
              onClick={() => setIsLogin(true)}
              className="mt-2 text-[9px] font-bold text-indigo-600 hover:underline uppercase"
            >
              Se connecter
            </button>
          </div>
        );
        setIsLogin(true);
        setLoading(false);
        return;
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
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        const userDocRef = doc(db, 'users', user.uid);
        
        let userDoc;
        try {
          userDoc = await getDoc(userDocRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
        
        if (userDoc && !userDoc.exists()) {
          try {
            await setDoc(userDocRef, {
              email: user.email,
              userName: user.displayName || '',
              profileImage: user.photoURL || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              onboarded: false
            }, { merge: true });
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
          }
        }
      } catch (err: any) {
      console.error("Google Auth Error:", err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError("Un compte existe déjà via une autre méthode (email/mot de passe).");
      } else if (err.code === 'auth/popup-blocked') {
        setError("Le popup de connexion a été bloqué par votre navigateur.");
      } else if (err.code && err.code.includes('unauthorized-domain')) {
        setError(
          <div className="space-y-1">
            <p>Domaine non autorisé dans Firebase.</p>
            <p className="text-[8px] opacity-70">Veuillez ajouter ce domaine aux domaines autorisés dans la console Firebase.</p>
          </div>
        );
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("La connexion Google n'est pas activée dans votre projet Firebase.");
      } else if (err.code && err.code.includes('api-key-not-valid')) {
        setError(
          <div className="space-y-1">
            <p>Clé API non valide.</p>
            <p className="text-[8px] opacity-70">L'authentification Google n'est peut-être pas activée ou la clé API restreinte bloque l'accès.</p>
          </div>
        );
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError(`Erreur Google (${err.code}): ${err.message || "Erreur inconnue"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError("Email requis pour la réinitialisation.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError("Erreur d'envoi du lien.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto selection:bg-indigo-100">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-slate-100 to-slate-50" />
        <div className="absolute top-[20%] left-[10%] w-[40%] h-[40%] bg-indigo-50/50 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[20%] right-[10%] w-[30%] h-[30%] bg-slate-200/50 blur-[100px] rounded-full" />
      </div>

      <AnimatePresence>
        {showUserNotFoundModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl space-y-6 text-center"
            >
              <div className="mx-auto mb-4">
                <Logo size={64} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900">Compte introuvable</h3>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed px-4">
                  L'adresse <span className="text-indigo-600 font-bold">{email}</span> ne possède pas encore de compte.
                </p>
              </div>
              <div className="space-y-3">
                <button 
                  onClick={() => { setIsLogin(false); setShowUserNotFoundModal(false); }}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-200"
                >
                  Créer un compte
                </button>
                <button 
                  onClick={() => setShowUserNotFoundModal(false)}
                  className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-[10px]"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Brand */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center space-y-4"
          >
            <Logo size={74} className="mb-2" />
            <div className="text-center">
              <h1 className="text-slate-900 font-black tracking-tighter text-4xl">AmbuFlow</h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">VOTRE JOURNÉE, MAÎTRISÉE</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[40px] p-8 shadow-xl shadow-slate-200/50 border border-white relative overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex bg-slate-50 p-1 rounded-2xl mb-8">
              <button 
                onClick={() => { setIsLogin(true); setError(null); }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                Connexion
              </button>
              <button 
                onClick={() => { setIsLogin(false); setError(null); }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
              >
                Inscription
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                  <div className="relative group">
                    <UserCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      required
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 text-slate-900 text-xs font-bold focus:bg-white ring-1 ring-slate-100 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mot de passe</label>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={16} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 pl-12 pr-12 text-slate-900 text-xs font-bold focus:bg-white ring-1 ring-slate-100 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-300"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 text-rose-500 border border-rose-100">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <div className="text-[10px] font-bold tracking-tight leading-relaxed">{error}</div>
                </div>
              )}

              {resetSent && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <ShieldCheck size={14} />
                  <p className="text-[10px] font-bold">Email de réinitialisation envoyé.</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : (isLogin ? 'Se connecter' : "Créer le compte")}
                <ChevronRight size={14} />
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <div className="relative flex justify-center"><span className="bg-white px-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest">ou continuer avec</span></div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>
            </form>
          </motion.div>

          {/* Guest */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <button 
              onClick={onEnterAsGuest}
              className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[9px] hover:text-indigo-600 transition-colors"
            >
              Continuer sans compte
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Login;
