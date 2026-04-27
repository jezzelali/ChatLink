import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider, handleFirestoreError } from '../lib/firebase';
import { 
  signInWithPopup, 
  signOut, 
  updateProfile, 
  updatePassword,
  updateEmail,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from './FirebaseProvider';
import { LogOut, User, MessageSquare, MessageCircle, Zap, Bell, Save, AlertCircle, CheckCircle2, Camera, Upload, Settings, Key, Mail, Trash2, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Messenger from './Messenger';

type TabType = 'profile' | 'messages' | 'system' | 'settings';

export default function SettingsPage() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  
  // Profile State
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  
  // Messages State
  const [statusMessage, setStatusMessage] = useState('');
  
  // System & Notification State
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState<{ text: React.ReactNode; type: 'success' | 'error' } | null>(null);

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'google-only'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Helper to handle specific auth errors
  const formatAuthError = (error: any) => {
    if (error.code === 'auth/operation-not-allowed') {
      const projectId = "gen-lang-client-0894784536";
      return (
        <div className="space-y-2">
          <p>Email/Password authentication is not enabled in the Firebase Console.</p>
          <a 
            href={`https://console.firebase.google.com/project/${projectId}/authentication/providers`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 underline font-bold block"
          >
            Click here to enable Email/Password login
          </a>
          <p className="text-xs">Or use the <strong>Sign in with Google</strong> button below.</p>
        </div>
      );
    }
    return error.message;
  };

  // Account Management State
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMessengerActive, setIsMessengerActive] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.displayName || '');
      setPhotoURL(user.photoURL || '');
      fetchUserProfile(user.uid);
    }
  }, [user]);

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setMessage(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: signupFullName });
      
      // Initialize profile in Firestore
      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        username: signupFullName.toLowerCase().replace(/[^a-z0-9_]/g, ''),
        fullName: signupFullName,
        photoURL: '',
        statusMessage: '',
        emailNotifications: true,
        pushNotifications: false,
        updatedAt: serverTimestamp(),
      });
      
      setMessage({ text: "Account created successfully!", type: 'success' });
    } catch (error: any) {
      setMessage({ text: formatAuthError(error), type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setMessage(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setMessage({ text: "Logged in successfully!", type: 'success' });
    } catch (error: any) {
      setMessage({ text: formatAuthError(error), type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchUserProfile = async (uid: string) => {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUsername(data.username || '');
        setFullName(data.fullName || '');
        setPhotoURL(data.photoURL || '');
        setStatusMessage(data.statusMessage || '');
        setEmailNotifications(data.emailNotifications ?? true);
        setPushNotifications(data.pushNotifications ?? false);
      }
    } catch (error: any) {
      console.error("Error fetching profile", error);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const showToast = (text: React.ReactNode, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  const handleSaveAllChanges = async () => {
    if (!user) return;
    setSavingProfile(true);
    setMessage(null);
    try {
      // Update Firebase Auth profile
      await updateProfile(user, { 
        displayName: fullName
      });
      
      // Update Firestore profile
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        username: username,
        fullName: fullName,
        photoURL: photoURL,
        statusMessage: statusMessage,
        emailNotifications: emailNotifications,
        pushNotifications: pushNotifications,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      showToast("All settings saved successfully!");
    } catch (error: any) {
      setMessage({ text: error.message || "Failed to update profile", type: 'error' });
      handleFirestoreError(error, 'update', `users/${user.uid}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      setMessage({ text: "Login failed: " + error.message, type: 'error' });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessage({ text: "Logged out successfully", type: 'success' });
    } catch (error: any) {
      console.error("Logout error", error);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPassword) return;
    setAuthLoading(true);
    try {
      // Re-auth if using email provider
      if (user.providerData.some(p => p.providerId === 'password')) {
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }
      await updatePassword(user, newPassword);
      showToast("Password updated successfully!");
      setNewPassword('');
      setCurrentPassword('');
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEmail) return;
    setAuthLoading(true);
    try {
      if (user.providerData.some(p => p.providerId === 'password')) {
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }
      await updateEmail(user, newEmail);
      showToast("Email updated successfully!");
      setNewEmail('');
      setCurrentPassword('');
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !window.confirm("ARE YOU ABSOLUTELY SURE? This will permanently delete your account and all data.")) return;
    setIsDeleting(true);
    try {
      if (user.providerData.some(p => p.providerId === 'password')) {
        if (!currentPassword) {
          setMessage({ text: "Please provide your current password for security.", type: 'error' });
          setIsDeleting(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }
      
      // Delete Firestore document first
      await deleteDoc(doc(db, 'users', user.uid));
      
      // Delete Auth user
      await deleteUser(user);
      showToast("Account deleted. We're sorry to see you go.");
    } catch (error: any) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f5f5]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-brand-bg p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-200 max-w-md w-full"
        >
          <div className="text-center mb-8">
            <div className="relative w-20 h-20 bg-brand-accent rounded-[28%] shadow-2xl shadow-green-500/20 flex items-center justify-center mx-auto mb-6">
              <div className="relative w-14 h-14 bg-white rounded-full flex items-center justify-center transform hover:scale-105 transition-transform">
                <MessageCircle className="w-8 h-8 text-brand-accent fill-current" />
                <Zap className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-current stroke-[3px]" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">ChatLink</h1>
            <p className="text-slate-500 mt-2 text-sm font-medium">Connect with everyone, everywhere</p>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
            <button 
              onClick={() => { setAuthMode('login'); setMessage(null); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${authMode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => { setAuthMode('signup'); setMessage(null); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${authMode === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign Up
            </button>
          </div>

          <AnimatePresence mode="wait">
            {message && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`mb-6 p-4 rounded-2xl flex items-start gap-3 border ${message.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}
              >
                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                <span className="text-sm font-bold">{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={authMode === 'login' ? handleEmailLogin : handleEmailSignup} className="space-y-4">
            {authMode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-slate-700"
                  placeholder=""
                />
              </motion.div>
            )}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Gmail / Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-slate-700"
                placeholder="you@gmail.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-slate-700"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit"
              disabled={authLoading}
              className="w-full bg-brand-accent text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-accent/20 hover:opacity-90 active:scale-95 transition-all text-sm uppercase tracking-wider"
            >
              {authLoading ? 'Processing...' : (authMode === 'login' ? 'Log In' : 'Create Account')}
            </button>
            <div className="text-center mt-4">
              <p className="text-xs text-slate-500">
                {authMode === 'login' ? (
                  <>Don't have an account? <button type="button" onClick={() => setAuthMode('signup')} className="text-brand-accent font-bold hover:underline">Register here</button> before logging in.</>
                ) : (
                  <>Already have an account? <button type="button" onClick={() => setAuthMode('login')} className="text-brand-accent font-bold hover:underline">Log in here</button></>
                )}
              </p>
            </div>
          </form>

          <div className="relative my-8 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <span className="relative px-4 bg-white text-[10px] font-bold text-slate-400 uppercase tracking-widest">Or continue with</span>
          </div>

          <button 
            onClick={handleLogin}
            className="w-full bg-white border border-slate-200 text-slate-700 py-3.5 rounded-xl font-bold hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-3 text-sm"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Header */}
      <header className={`h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-10 shrink-0 ${activeTab === 'messages' ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center shadow-lg shadow-green-500/10 relative">
            <MessageCircle className="w-6 h-6 text-white fill-current" />
            <Zap className="w-3 h-3 text-brand-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-current stroke-[2.5px]" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">ChatLink</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">{fullName || user.displayName || 'User'}</p>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight -mt-0.5">@{username}</p>
            {statusMessage && <p className="text-[10px] text-slate-500 italic max-w-[120px] truncate">{statusMessage}</p>}
          </div>
          <div className="w-10 h-10 rounded-full bg-brand-accent flex items-center justify-center text-white font-bold shadow-sm overflow-hidden border-2 border-white">
            {photoURL ? (
              <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'U'
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col shrink-0 hidden md:flex">
          <div className="space-y-1 mb-8">
            <button 
              onClick={() => setActiveTab('messages')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'messages' ? 'bg-brand-accent/10 text-brand-accent' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <MessageSquare className="w-[18px] h-[18px]" />
              Messages
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'profile' ? 'bg-brand-accent/10 text-brand-accent' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <User className="w-[18px] h-[18px]" />
              Profile
            </button>
            <button 
              onClick={() => setActiveTab('system')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'system' ? 'bg-brand-accent/10 text-brand-accent' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Bell className="w-[18px] h-[18px] shrink-0" />
              <span className="truncate whitespace-nowrap">System and Notification</span>
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-bold ${activeTab === 'settings' ? 'bg-brand-accent/10 text-brand-accent' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Settings className="w-[18px] h-[18px] shrink-0" />
              Settings
            </button>
          </div>
          <div className="mt-auto border-t border-slate-100 pt-6 text-center">
            <div className="mb-4 relative group cursor-pointer inline-block mx-auto">
              <div className="w-20 h-20 rounded-full bg-brand-accent flex items-center justify-center text-white text-2xl font-bold overflow-hidden border-2 border-brand-accent/20">
                {photoURL ? (
                  <img src={photoURL} alt="Large Profile" className="w-full h-full object-cover" />
                ) : (
                  user.displayName?.[0] || user.email?.[0]?.toUpperCase() || 'U'
                )}
              </div>
              <label className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
              </label>
            </div>
            <p className="text-xs font-bold text-slate-800 mb-0.5">{fullName || user.displayName || 'User'}</p>
            <p className="text-[10px] text-brand-accent font-black uppercase mb-1">@{username}</p>
            {statusMessage && <p className="text-[11px] text-slate-500 italic mb-1 truncate px-2">"{statusMessage}"</p>}
            <p className="text-[10px] text-slate-400 mb-6 truncate px-2">{user.email}</p>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-50 text-sm font-bold transition-colors"
            >
              <LogOut className="w-[18px] h-[18px]" />
              Log Out
            </button>
          </div>
        </nav>

        {/* Content Area */}
        <section className={`flex-1 overflow-y-auto bg-brand-bg transition-all ${activeTab === 'messages' ? 'p-0' : 'p-6 md:p-10'} ${!isMessengerActive ? 'pb-24 md:pb-0' : ''}`}>
          <div className={`mx-auto transition-all ${activeTab === 'messages' ? 'w-full max-w-none h-full' : 'max-w-2xl space-y-8'}`}>
            <AnimatePresence mode="wait">
              {message && (
                <div className="px-6 md:px-0 mb-4">
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-2xl flex items-start gap-4 border ${
                      message.type === 'success' 
                        ? 'bg-green-50 border-green-100 text-green-700' 
                        : 'bg-red-50 border-red-100 text-red-700'
                    } shadow-sm`}
                  >
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <span className="text-sm font-bold">{message.text}</span>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.div 
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {/* Profile Settings Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-slate-800">Profile Settings</h2>
                      <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                        Public Identity
                      </span>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-8 mb-4">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden border-2 border-slate-200">
                          {photoURL ? (
                            <img src={photoURL} alt="Edit Profile" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-10 h-10" />
                          )}
                        </div>
                        <label className="absolute -bottom-2 -right-2 bg-brand-accent text-white p-2 rounded-xl shadow-lg cursor-pointer hover:scale-110 transition-transform">
                          <Camera className="w-4 h-4" />
                          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                      </div>
                      <div className="text-center md:text-left">
                        <h3 className="font-bold text-slate-800">Profile Photo</h3>
                        <p className="text-sm text-slate-500 mb-2">Upload a profile picture to personalize your system identity.</p>
                        <label className="cursor-pointer text-xs font-bold text-brand-accent hover:underline flex items-center justify-center md:justify-start gap-1">
                          <Upload className="w-3 h-3" />
                          Change Image
                          <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                        </label>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Unique Username (@)</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                          <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            className="w-full pl-8 pr-4 py-3 bg-brand-bg/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-slate-700 font-bold" 
                            placeholder="username" 
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400 ml-1">This is how people find and add you to groups.</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Display Name</label>
                        <input 
                          type="text" 
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="w-full px-4 py-3 bg-brand-bg/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-slate-700 font-medium" 
                          placeholder="Enter display name" 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Status Message</label>
                        <input 
                          type="text" 
                          value={statusMessage}
                          onChange={(e) => setStatusMessage(e.target.value)}
                          className="w-full px-4 py-3 bg-brand-bg/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-slate-700 font-medium" 
                          placeholder="What's on your mind?" 
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'messages' && (
                <motion.div 
                  key="messages"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8 h-full"
                >
                  <Messenger currentUser={user} onChatStatusChange={(active) => setIsMessengerActive(active)} />
                </motion.div>
              )}

              {activeTab === 'system' && (
                <motion.div 
                  key="system"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-slate-800">System and Notification</h2>
                      <Bell className="w-5 h-5 text-brand-accent" />
                    </div>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-brand-bg/30 rounded-2xl border border-slate-100">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-slate-800">Email Notifications</p>
                          <p className="text-xs text-slate-500">Receive system updates via email</p>
                        </div>
                        <button 
                          onClick={() => {
                            const newValue = !emailNotifications;
                            setEmailNotifications(newValue);
                            showToast(`Email notifications ${newValue ? 'enabled' : 'disabled'}`);
                          }}
                          className={`w-12 h-6 rounded-full transition-colors relative ${emailNotifications ? 'bg-brand-accent' : 'bg-slate-200'}`}
                        >
                          <motion.div 
                            animate={{ x: emailNotifications ? 24 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm" 
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-brand-bg/30 rounded-2xl border border-slate-100">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-slate-800">Push Notifications</p>
                          <p className="text-xs text-slate-500">Enable real-time push alerts</p>
                        </div>
                        <button 
                          onClick={() => {
                            const newValue = !pushNotifications;
                            setPushNotifications(newValue);
                            showToast(`Push notifications ${newValue ? 'enabled' : 'disabled'}`);
                          }}
                          className={`w-12 h-6 rounded-full transition-colors relative ${pushNotifications ? 'bg-brand-accent' : 'bg-slate-200'}`}
                        >
                          <motion.div 
                            animate={{ x: pushNotifications ? 24 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm" 
                          />
                        </button>
                      </div>
                    </div>

                    <div className="bg-brand-accent/10 border border-brand-accent/20 rounded-2xl p-6 flex gap-4">
                      <div className="bg-brand-accent text-white p-2 rounded-lg shrink-0 h-fit">
                        <Settings className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-brand-accent">Version Control</h3>
                        <p className="text-xs text-brand-accent/80 leading-relaxed font-mono">
                          Build: v1.2.4-stable<br/>
                          Network: Secured (TLS 1.3)<br/>
                          Database: Firestore Enterprise
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'settings' && (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8 pb-12"
                >
                  {/* Master Sync Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8 text-center py-12">
                     <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Save className="w-8 h-8 text-brand-accent" />
                     </div>
                     <h2 className="text-xl font-bold text-slate-800">Master Sync</h2>
                     <p className="text-sm text-slate-500 max-w-sm mx-auto">Synchronize all your profile and notification settings across your devices.</p>
                     
                     <button 
                        onClick={handleSaveAllChanges}
                        disabled={savingProfile}
                        className="w-full sm:w-auto px-10 py-4 bg-brand-accent text-white rounded-2xl font-bold shadow-xl shadow-brand-accent/30 hover:opacity-90 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-wider mx-auto"
                      >
                        {savingProfile ? 'Syncing...' : <><Save className="w-5 h-5" /> Save All Changes</>}
                      </button>
                  </div>

                  {/* Account Security Card */}
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="w-6 h-6 text-brand-accent" />
                        <h2 className="text-lg font-bold text-slate-800">Account Security</h2>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full uppercase tracking-wider border border-slate-100">
                        Admin Only
                      </span>
                    </div>

                    {/* Shared Verification Field (if needed for sensitive actions) */}
                    {user.providerData.some(p => p.providerId === 'password') && (
                      <div className="pb-8 border-b border-slate-100">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Confirm Current Password</label>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-red-50/30 border border-red-100/50 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-slate-700 font-medium text-sm"
                            placeholder="Required for security changes"
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Change Password */}
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Key className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">Change Password</h3>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New security key"
                          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-sm"
                        />
                        <button 
                          type="submit"
                          disabled={authLoading || !newPassword}
                          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all whitespace-nowrap"
                        >
                          Update Key
                        </button>
                      </div>
                    </form>

                    {/* Change Email */}
                    <form onSubmit={handleUpdateEmail} className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">Change Contact Email</h3>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="New primary email"
                          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all text-sm"
                        />
                        <button 
                          type="submit"
                          disabled={authLoading || !newEmail}
                          className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 disabled:opacity-50 transition-all whitespace-nowrap"
                        >
                          Update Email
                        </button>
                      </div>
                    </form>

                    {/* Delete Account */}
                    <div className="pt-6 border-t border-slate-100">
                      <div className="flex items-center justify-between p-6 bg-red-50 rounded-2xl border border-red-100">
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
                            <Trash2 className="w-4 h-4" /> Danger Zone
                          </h3>
                          <p className="text-[11px] text-red-500 font-medium">Permanently wipe all records from the system</p>
                        </div>
                        <button 
                          onClick={handleDeleteAccount}
                          disabled={isDeleting}
                          className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all disabled:opacity-50"
                        >
                          {isDeleting ? 'Wiping...' : 'Delete Account'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Global Save Button Removed - Now in Settings Tab */}
            {activeTab !== 'messages' && (
              <div className="md:hidden pt-8 pb-12">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 px-3 py-4 rounded-2xl bg-red-50 text-red-500 text-sm font-bold transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Log Out
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Mobile Bottom Navigation (Dashboard) */}
      {!isMessengerActive && (
        <nav className="md:hidden glass fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-lg border-t border-slate-200 flex items-center justify-around px-6 pb-6 z-50">
        <button 
          onClick={() => setActiveTab('messages')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'messages' ? 'text-green-600 scale-110' : 'text-slate-400 opacity-60'}`}
        >
          <div className={`p-2 rounded-xl ${activeTab === 'messages' ? 'bg-green-50' : ''}`}>
            <MessageSquare className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Chats</span>
        </button>

        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-green-600 scale-110' : 'text-slate-400 opacity-60'}`}
        >
          <div className={`p-2 rounded-xl ${activeTab === 'profile' ? 'bg-green-50' : ''}`}>
            <User className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Profile</span>
        </button>

        <button 
          onClick={() => setActiveTab('system')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'system' ? 'text-green-600 scale-110' : 'text-slate-400 opacity-60'}`}
        >
          <div className={`p-2 rounded-xl ${activeTab === 'system' ? 'bg-green-50' : ''}`}>
            <Bell className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">System</span>
        </button>

        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-green-600 scale-110' : 'text-slate-400 opacity-60'}`}
        >
          <div className={`p-2 rounded-xl ${activeTab === 'settings' ? 'bg-green-50' : ''}`}>
            <Settings className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-tighter">Settings</span>
        </button>
      </nav>
      )}
    </div>
  );
}
