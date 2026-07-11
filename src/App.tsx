import React, { useState, useEffect, FormEvent } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInAnonymously,
  signOut,
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  arrayUnion,
  increment,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, PoliticalLeaning, Debate, DebateArgument } from './types';
import { POLITICAL_LEANINGS, INTEREST_TAGS, LANGUAGES } from './constants';
import { translations } from './translations';
import { analyzeCommonGround } from './services/geminiService';
import { cn } from './lib/utils';
import { MOCK_USERS, MOCK_DEBATES, MOCK_ARGUMENTS } from './mockData';
import { ActivityDashboard } from './components/ActivityDashboard';
import { 
  LogOut, 
  User as UserIcon, 
  Heart, 
  Languages, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  ShieldCheck,
  MessageSquare,
  Plus,
  Scale,
  Users,
  Compass,
  ArrowRight,
  Send,
  Sparkles,
  Globe,
  Share2,
  Twitter,
  Linkedin,
  Mail,
  Link as LinkIcon,
  MessageCircle,
  Phone,
  HelpCircle,
  Shield,
  Trash2,
  Flag,
  ShieldAlert,
  MoreVertical,
  Slash,
  AlertTriangle,
  Skull,
  ChevronDown,
  Search,
  X,
  Award,
  Flame,
  TrendingUp,
  Pencil,
  Check
} from 'lucide-react';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Main Application Component
 */
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isConnectingSocial, setIsConnectingSocial] = useState(false);
  const [activeDebateId, setActiveDebateId] = useState<string | null>(null);
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);
  const [isViewingPublicHome, setIsViewingPublicHome] = useState(true);
  const [lang, setLang] = useState('he');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [acknowledgedWarning, setAcknowledgedWarning] = useState<string | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const t = (key: string) => (translations[lang] && translations[lang][key]) || (translations['he'][key]) || key;
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lang]);

  useEffect(() => {
    console.log("App Refresh - v1.0.6 - Final FAQ Accordion & Green Theme");
  }, []);

  useEffect(() => {
    // Real-time profile listener to catch warnings and status changes
    let unsub: (() => void) | undefined;
    
    const uid = user?.uid || (isGuest ? profile?.uid : null);
    if (uid) {
      unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists()) {
          const newProfile = snap.data() as UserProfile;
          setProfile(newProfile);
          
          // Show warning modal if status is not 'none' and not just acknowledged
          if (newProfile.warningStatus && newProfile.warningStatus !== 'none' && newProfile.warningStatus !== acknowledgedWarning) {
            setShowWarningModal(true);
          }

          // Force logout for Red Card
          if (newProfile.warningStatus === 'red') {
            setTimeout(() => {
              logout();
              setIsViewingPublicHome(true);
            }, 5000); // Give user 5 seconds to read the red card
          }
        }
      });
    }

    return () => unsub && unsub();
  }, [user?.uid, isGuest, acknowledgedWarning]);

  useEffect(() => {
    // Check for local guest profile
    const guestProfile = localStorage.getItem('guest_profile');
    if (guestProfile) {
      setProfile(JSON.parse(guestProfile));
      setIsGuest(true);
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setIsGuest(false);
        await fetchProfile(u.uid);
      } else if (!guestProfile) {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // New user - trigger profile creation
        setIsEditingProfile(true);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const login = async () => {
    try {
      setAuthErrorMessage(null);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setIsGuest(false);
        setIsViewingPublicHome(false);
        await fetchProfile(result.user.uid);
      }
    } catch (error: any) {
      console.error("Error during Google login:", error);
      const errCode = error?.code || '';
      const errMsg = error?.message || '';
      
      if (errCode === 'auth/popup-closed-by-user' || errMsg.includes('popup-closed-by-user')) {
        setAuthErrorMessage(t('authErrorPopupClosed'));
      } else if (errCode === 'auth/popup-blocked' || errMsg.includes('popup-blocked')) {
        setAuthErrorMessage(t('authErrorPopupBlocked'));
      } else {
        // Fall back to popup blocked / iframe issue since this is the most common issue in Google AI Studio
        setAuthErrorMessage(t('authErrorPopupBlocked'));
      }
    }
  };

  const loginAsGuest = async () => {
    try {
      // Try Anonymous Auth, but fallback to local mode if it's disabled in console
      try {
        await signInAnonymously(auth);
      } catch (authError: any) {
        if (authError.code === 'auth/admin-restricted-operation') {
          console.warn("Anonymous Auth is not enabled in Firebase Console. Using local-only guest mode.");
        } else {
          throw authError;
        }
      }
      setIsGuest(true);
      setIsViewingPublicHome(false);
      // If no profile, trigger creation
      if (!profile) {
        setIsEditingProfile(true);
      }
    } catch (error) {
      console.error("Error during guest login:", error);
    }
  };

  const logout = () => {
    if (isGuest) {
      setIsGuest(false);
      setProfile(null);
      localStorage.removeItem('guest_profile');
    } else {
      signOut(auth);
    }
    setIsViewingPublicHome(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center font-serif">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-2xl text-primary italic"
        >
          גשרים... Bridges...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-ink font-sans selection:bg-primary selection:text-white transition-all duration-300" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b border-primary/10 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 bg-bg/80 backdrop-blur-md z-40" dir="ltr">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="p-2 rounded-full hover:bg-primary/10 text-primary transition-all"
              title={t('shareTitle')}
            >
              <Share2 size={20} />
            </button>
            <AnimatePresence>
              {showShareMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute top-12 ltr:left-0 rtl:right-0 bg-white shadow-2xl rounded-2xl border border-ink/5 p-4 min-w-[200px] z-50 overflow-hidden"
                >
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => {
                        window.open(`https://wa.me/?text=${encodeURIComponent(window.location.href)}`);
                        setShowShareMenu(false);
                      }}
                      className="flex items-center gap-3 p-2 hover:bg-bg rounded-xl transition-colors text-sm font-medium"
                    >
                      <MessageCircle size={18} className="text-primary" /> WhatsApp
                    </button>
                    <button 
                      onClick={() => {
                        window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}`);
                        setShowShareMenu(false);
                      }}
                      className="flex items-center gap-3 p-2 hover:bg-bg rounded-xl transition-colors text-sm font-medium"
                    >
                      <Send size={18} className="text-primary" /> Telegram
                    </button>
                    <button 
                      onClick={() => {
                        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`);
                        setShowShareMenu(false);
                      }}
                      className="flex items-center gap-3 p-2 hover:bg-bg rounded-xl transition-colors text-sm font-medium"
                    >
                      <Twitter size={18} className="text-sky-500" /> Twitter (X)
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setShowShareMenu(false);
                      }}
                      className="flex items-center gap-3 p-2 hover:bg-bg rounded-xl transition-colors text-sm font-medium"
                    >
                      <LinkIcon size={18} className="text-ink/60" /> {t('copyUrl')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => {
              setActiveDebateId(null);
              setViewingProfileUid(null);
              setIsEditingProfile(false);
              setIsViewingPublicHome(true);
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-full flex items-center justify-center text-white relative flex-shrink-0">
              <MessageSquare size={12} fill="currentColor" className="absolute top-1.5 md:top-2" />
              <MessageSquare size={12} fill="currentColor" className="absolute bottom-1.5 md:bottom-2 opacity-80" />
            </div>
            <h1 className="text-lg md:text-xl font-serif font-bold tracking-tight text-primary">{t('appName')}</h1>
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="p-2 rounded-full hover:bg-primary/10 text-primary transition-all"
            >
              <Globe size={20} />
            </button>
            <AnimatePresence>
              {showLangMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute top-12 ltr:right-0 rtl:left-0 bg-white shadow-2xl rounded-2xl border border-ink/5 p-4 min-w-[150px] z-50 overflow-hidden"
                >
                  <div className="flex flex-col gap-1">
                    {LANGUAGES.map(l => (
                      <button 
                        key={l.id} 
                        onClick={() => {
                          setLang(l.id);
                          setShowLangMenu(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-sm font-medium rounded-xl transition-all",
                          isRtl ? "text-right" : "text-left",
                          lang === l.id ? "bg-primary/10 text-primary" : "hover:bg-bg"
                        )}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {(user || isGuest) ? (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setIsEditingProfile(true);
                  setIsConnectingSocial(false);
                  setIsViewingPublicHome(false);
                }}
                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
              >
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-primary/20" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserIcon size={16} />
                  </div>
                )}
                <span className="hidden sm:inline">{profile?.displayName || user?.displayName || 'Guest'}</span>
              </button>
              <button 
                onClick={logout}
                className="p-2 rounded-full hover:bg-red-50 text-red-600 transition-colors"
                title={t('logout')}
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-all shadow-sm"
            >
              {t('login')}
            </button>
          )}
        </div>
      </header>

      <main key={lang} dir={isRtl ? 'rtl' : 'ltr'} className="max-w-4xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {(!(user || isGuest) || isViewingPublicHome) ? (
            <Landing 
              key="landing" 
              onLogin={login} 
              onGuestLogin={loginAsGuest}
              isLoggedIn={!!(user || isGuest)}
              onGoToDashboard={() => setIsViewingPublicHome(false)}
              onViewUser={(uid) => {
                setIsViewingPublicHome(false);
                setViewingProfileUid(uid);
              }}
              t={t}
              lang={lang}
            />
          ) : activeDebateId ? (
            <DebateRoom 
              key="debate-room"
              debateId={activeDebateId}
              userProfile={profile!}
              isGuest={isGuest}
              onProfileUpdate={(p) => setProfile(p)}
              onExit={() => setActiveDebateId(null)}
              onViewUser={(uid) => setViewingProfileUid(uid)}
              t={t}
              lang={lang}
            />
          ) : viewingProfileUid ? (
            <PublicProfileView 
              key="view-profile"
              uid={viewingProfileUid}
              currentUserId={profile?.uid || user?.uid || 'anonymous'}
              onBack={() => setViewingProfileUid(null)}
              onStartChat={async (otherUid, otherName) => {
                const docRef = await addDoc(collection(db, 'debates'), {
                  topic: `${t('directDialogueTitle')}: ${profile?.displayName || t('displayName')} & ${otherName}`,
                  creatorId: profile?.uid || user?.uid || 'anonymous',
                  status: 'active',
                  participants: [profile?.uid || user?.uid || 'anonymous', otherUid],
                  createdAt: serverTimestamp(),
                });
                setActiveDebateId(docRef.id);
                setViewingProfileUid(null);
              }}
              t={t}
              lang={lang}
            />
          ) : isConnectingSocial ? (
            <Step2Connections 
              key="step2"
              onComplete={async () => {
                if (profile) {
                  const updatedProfile = { ...profile, hasConnectedSocial: true };
                  setProfile(updatedProfile);
                  if (isGuest) {
                    localStorage.setItem('guest_profile', JSON.stringify(updatedProfile));
                  } else {
                    await updateDoc(doc(db, 'users', profile.uid), {
                      hasConnectedSocial: true,
                      updatedAt: serverTimestamp()
                    });
                  }
                }
                setIsConnectingSocial(false);
              }}
              onBack={() => {
                setIsConnectingSocial(false);
                setIsEditingProfile(true);
              }}
              t={t}
              lang={lang}
            />
          ) : isEditingProfile ? (
            <ProfileForm 
              key="profile-form"
              user={user} 
              isGuest={isGuest}
              initialProfile={profile} 
              onSave={(newProfile) => {
                setProfile(newProfile);
                setIsEditingProfile(false);
                setIsViewingPublicHome(false);
                if (!newProfile.hasConnectedSocial) {
                  setIsConnectingSocial(true);
                }
              }}
              onCancel={() => {
                setIsEditingProfile(false);
                if (!profile) setIsViewingPublicHome(true);
              }}
              t={t}
              lang={lang}
            />
          ) : (
            <Dashboard 
              key="dashboard"
              profile={profile} 
              onEdit={() => setIsEditingProfile(true)}
              onJoinDebate={(id) => setActiveDebateId(id)}
              onViewUser={(uid) => setViewingProfileUid(uid)}
              t={t}
              lang={lang}
            />
          )}
        </AnimatePresence>

        {showWarningModal && profile?.warningStatus && (
          <SystemWarningModal 
            status={profile.warningStatus as any} 
            onDismiss={() => {
              setShowWarningModal(false);
              setAcknowledgedWarning(profile.warningStatus!);
            }}
            t={t}
            lang={lang}
          />
        )}

        {authErrorMessage && (
          <AuthErrorModal 
            message={authErrorMessage}
            onDismiss={() => setAuthErrorMessage(null)}
            t={t}
            lang={lang}
          />
        )}
      </main>

      <footer className="mt-20 border-t border-ink/10 py-12 px-6 bg-white/50">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {LANGUAGES.map(langOpt => (
              <button 
                key={langOpt.id} 
                onClick={() => setLang(langOpt.id)}
                className={cn(
                  "px-3 py-2 rounded-lg text-sm font-medium transition-all min-w-[44px] min-h-[44px] flex items-center justify-center",
                  lang === langOpt.id ? "bg-primary/10 text-primary underline" : "opacity-60 hover:opacity-100 hover:bg-ink/5"
                )}
              >
                {langOpt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink/40">
            {t('footerText')}
          </p>
        </div>
      </footer>
    </div>
  );
}

// Constant for simulated moderation
const FORBIDDEN_WORDS = ['fuck', 'shit', 'asshole', 'idiot', 'קללה', 'מניאק', 'זונה', 'נאצי', 'מוות'];

/**
 * System Warning Modal
 */
function SystemWarningModal({ 
  status, 
  onDismiss, 
  t, 
  lang 
}: { 
  status: 'whistle' | 'yellow' | 'red', 
  onDismiss: () => void, 
  t: (k: string) => string, 
  lang: string 
}) {
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';
  
  const config = {
    whistle: {
      icon: <AlertCircle className="text-sky w-16 h-16" />,
      title: t('warningTitle'),
      desc: t('warningWhistle'),
      color: 'bg-sky/5 border-sky/20'
    },
    yellow: {
      icon: <AlertTriangle className="text-yellow-500 w-16 h-16" />,
      title: t('warningTitle'),
      desc: t('warningYellow'),
      color: 'bg-yellow-50 border-yellow-200'
    },
    red: {
      icon: <Skull className="text-red-500 w-16 h-16" />,
      title: t('warningTitle'),
      desc: t('warningRed'),
      color: 'bg-red-50 border-red-200'
    }
  }[status];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl border-2 flex flex-col items-center text-center gap-6",
          config.color
        )}
      >
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          {config.icon}
        </motion.div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold text-ink">{config.title}</h2>
          <p className="text-ink/60 font-serif leading-relaxed">{config.desc}</p>
        </div>

        {status !== 'red' && (
          <button 
            onClick={onDismiss}
            className="w-full py-4 bg-ink text-white rounded-2xl font-bold hover:bg-black transition-all"
          >
            {t('dismiss')}
          </button>
        )}
      </motion.div>
    </div>
  );
}

/**
 * Auth Error Modal
 */
function AuthErrorModal({ 
  message, 
  onDismiss, 
  t, 
  lang 
}: { 
  message: string, 
  onDismiss: () => void, 
  t: (k: string) => string, 
  lang: string 
}) {
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';
  
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl border flex flex-col items-center text-center gap-6 border-amber-200 bg-amber-50"
        )}
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shadow-inner"
        >
          <ShieldAlert size={32} />
        </motion.div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold text-ink">{t('authErrorTitle')}</h2>
          <p className="text-ink/70 font-sans text-sm leading-relaxed">{message}</p>
        </div>

        <button 
          onClick={onDismiss}
          className="w-full py-3.5 bg-ink text-white rounded-2xl font-bold hover:bg-black transition-all shadow-md text-sm"
        >
          {t('dismiss')}
        </button>
      </motion.div>
    </div>
  );
}

/**
 * Report Confirmation Modal
 */
function ReportConfirmationModal({
  category,
  argumentText,
  onConfirm,
  onCancel,
  t,
  lang
}: {
  category: string,
  argumentText: string,
  onConfirm: () => void,
  onCancel: () => void,
  t: (k: string) => string,
  lang: string
}) {
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';
  const categoryLabel = t(`reportCategory_${category.replace(/\s+/g, '')}`) || category;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "max-w-md w-full bg-white rounded-[32px] p-8 shadow-2xl border flex flex-col gap-6 border-red-200 bg-red-50/50 animate-in fade-in zoom-in duration-200",
          isRtl ? "text-right" : "text-left"
        )}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 shadow-inner"
          >
            <AlertTriangle size={32} />
          </motion.div>
          
          <h2 className="text-2xl font-serif font-bold text-ink">{t('confirmReportTitle')}</h2>
        </div>

        <div className="space-y-4">
          <p className="text-ink/75 font-sans text-sm leading-relaxed text-center">
            {t('confirmReportDescription')} <span className="font-bold text-red-600">"{categoryLabel}"</span>?
          </p>
          
          <div className="bg-white/80 border border-ink/10 rounded-2xl p-4 max-h-32 overflow-y-auto">
            <p className="text-xs text-ink/70 italic font-serif">
              "{argumentText}"
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 bg-white border border-ink/10 text-ink rounded-2xl font-bold hover:bg-bg transition-all text-sm shadow-sm"
          >
            {t('cancel')}
          </button>
          <button 
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all text-sm shadow-md"
          >
            {t('submitReport')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Landing Page Component
 */
function Landing({ 
  onLogin, 
  onGuestLogin,
  isLoggedIn, 
  onGoToDashboard,
  onViewUser,
  t,
  lang
}: { 
  onLogin?: () => void, 
  onGuestLogin?: () => void,
  isLoggedIn?: boolean,
  onGoToDashboard?: () => void,
  onViewUser: (uid: string) => void,
  t: (key: string) => string,
  lang: string,
  key?: string
}) {
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const handlePeek = () => {
    const el = document.getElementById('feature-gallery');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-20 text-center"
    >
      <div className="space-y-8">
        <div className="space-y-4">
          <h2 className="text-5xl sm:text-7xl font-serif font-light leading-tight">
            {t('appName')}. <br />
            <span className="italic text-primary">{t('tagline')}</span>
          </h2>
          <p className="text-lg text-ink/60 max-w-xl mx-auto font-serif">
            {t('subTagline')}
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 pt-8">
          <div className="flex flex-wrap justify-center gap-4">
            {isLoggedIn ? (
              <button 
                onClick={onGoToDashboard}
                className="px-12 py-5 bg-primary text-white rounded-full text-xl font-medium hover:bg-primary/90 transition-all shadow-xl hover:shadow-primary/20 hover:-translate-y-1"
              >
                {t('backToDashboard')}
              </button>
            ) : (
              <button 
                onClick={onLogin}
                className="px-12 py-5 bg-primary text-white rounded-full text-xl font-medium hover:bg-primary/90 transition-all shadow-xl hover:shadow-primary/20 hover:-translate-y-1"
              >
                {t('startDebate')}
              </button>
            )}
            
            {!isLoggedIn && onGuestLogin && (
              <button 
                onClick={onGuestLogin}
                className="px-10 py-5 text-sm font-medium text-ink/40 hover:text-primary transition-colors underline underline-offset-4"
              >
                {lang === 'he' ? 'המשך כצופה אורח' : 'Continue as Guest'}
              </button>
            )}

            <button 
              onClick={handlePeek}
              className="px-12 py-5 bg-white text-primary border-2 border-primary/20 rounded-full text-xl font-medium hover:bg-bg transition-all shadow-sm hover:-translate-y-1"
            >
              <span className="flex items-center gap-2">
                <Eye size={20} />
                {t('getAPeek')}
              </span>
            </button>
          </div>

          <button 
            onClick={() => {
              const el = document.getElementById('faq-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="mt-4 px-10 py-3 bg-primary/5 border-2 border-primary/20 text-primary rounded-full text-base font-bold flex items-center gap-2 hover:bg-primary/10 transition-all shadow-sm active:scale-95"
          >
            <HelpCircle size={18} />
            {t('faqTitle')}
          </button>
          
          <p className="text-sm text-ink/40 flex items-center gap-2">
            <ShieldCheck size={14} />
            {t('aiModeration')}
          </p>
        </div>
      </div>

      {/* Brave Journey Flow */}
      <div className="py-20 space-y-12">
        <div className="text-center space-y-4">
          <Scale className="mx-auto text-sky w-12 h-12" />
          <h3 className="text-4xl font-serif font-bold text-primary uppercase tracking-widest">{t('journeyTitle')}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
          {[
            { id: 1, title: t('step1Title'), desc: t('step1Desc'), icon: <UserIcon size={32} /> },
            { id: 2, title: t('step2Title'), desc: t('step2Desc'), icon: <Users size={32} /> },
            { id: 3, title: t('step3Title'), desc: t('step3Desc'), icon: <Eye size={32} /> },
          ].map((step, i) => (
            <div key={i} className="relative group">
              <div className="bg-white p-10 rounded-[48px] shadow-xl border border-ink/5 flex flex-col items-center gap-6 relative z-10 hover:-translate-y-2 transition-all duration-300">
                <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center text-primary shadow-inner group-hover:bg-primary group-hover:text-white transition-colors">
                  {step.icon}
                </div>
                <div className="space-y-2">
                  <h4 className="text-xl font-serif font-bold text-ink">{step.title}</h4>
                  <p className="text-sm text-ink/50 leading-relaxed">{step.desc}</p>
                </div>
              </div>
              {i < 2 && (
                <div className={cn(
                  "hidden md:block absolute top-1/2 -translate-y-1/2 w-full h-px border-t-2 border-dashed border-ink/10",
                  isRtl ? "-left-1/2" : "-right-1/2"
                )} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gallery Section */}
      <FeatureGallery t={t} lang={lang} />

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 ">
        {[
          { icon: <MessageSquare />, title: t('featureConstructiveTitle'), desc: t('featureConstructiveDesc') },
          { icon: <Heart />, title: t('featureRespectTitle'), desc: t('featureRespectDesc') },
          { icon: <Languages />, title: t('featureMultilangTitle'), desc: t('featureMultilangDesc') },
        ].map((feat, i) => (
          <div key={i} className="bg-white p-8 rounded-3xl shadow-sm flex flex-col items-center text-center gap-4 border border-ink/5">
            <div className="text-primary opacity-80">{feat.icon}</div>
            <h3 className="font-serif font-bold text-lg">{feat.title}</h3>
            <p className="text-sm opacity-60">{feat.desc}</p>
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <div id="faq-section" className="pt-20 space-y-12">
        <div className="text-center space-y-4">
          <HelpCircle className="mx-auto text-primary w-12 h-12" />
          <h3 className="text-4xl font-serif font-bold text-primary">{t('faqTitle')}</h3>
        </div>

        <div className="max-w-2xl mx-auto border border-ink/10 rounded-[32px] overflow-hidden bg-white shadow-sm">
          {[
            { id: 'flow', title: t('faqFlowTitle'), desc: t('faqFlowDesc'), icon: <ArrowRight /> },
            { id: 'difference', title: t('faqDifferenceTitle'), desc: t('faqDifferenceDesc'), icon: <HelpCircle /> },
            { id: 'safety', title: t('faqSafetyTitle'), desc: t('faqSafetyDesc'), icon: <Shield /> },
            { id: 'warnings', title: t('faqWarningsTitle'), desc: t('faqWarningsDesc'), icon: <Scale /> },
            { id: 'anon', title: t('faqNoAnonTitle'), desc: t('faqNoAnonDesc'), icon: <UserIcon /> },
            { id: 'delete', title: t('faqDeleteTitle'), desc: t('faqDeleteDesc'), icon: <Trash2 /> },
          ].map((item, index, array) => (
            <div key={item.id} className={cn(
              "border-ink/5",
              index !== array.length - 1 && "border-b"
            )}>
              <button 
                onClick={() => setOpenFaq(openFaq === item.id ? null : item.id)}
                className={cn(
                  "w-full p-6 flex items-center justify-between transition-colors group",
                  isRtl ? "text-right" : "text-left",
                  openFaq === item.id ? "bg-soft" : "hover:bg-soft/50"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    openFaq === item.id ? "bg-primary text-white" : "bg-bg text-primary group-hover:bg-primary/10"
                  )}>
                    {item.icon}
                  </div>
                  <span className={cn(
                    "font-serif font-bold text-lg transition-colors",
                    openFaq === item.id ? "text-primary" : "text-ink"
                  )}>
                    {item.title}
                  </span>
                </div>
                <ChevronDown className={cn(
                  "w-5 h-5 text-slate transition-transform duration-300",
                  openFaq === item.id && "rotate-180"
                )} />
              </button>
              
              <AnimatePresence>
                {openFaq === item.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className={cn(
                      "px-6 pb-6 text-slate leading-relaxed font-serif pt-2 border-t border-ink/5 mx-6",
                      isRtl ? "text-right" : "text-left"
                    )}>
                      {item.desc}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

/**
 * Profile Form Component
 */
function ProfileForm({ 
  user, 
  isGuest,
  initialProfile, 
  onSave, 
  onCancel,
  t,
  lang
}: { 
  user: User | null, 
  isGuest?: boolean,
  initialProfile: UserProfile | null,
  onSave: (p: UserProfile) => void,
  onCancel: () => void,
  t: (key: string) => string,
  lang: string,
  key?: string
}) {
  const [displayName, setDisplayName] = useState(() => {
    if (initialProfile?.displayName) return initialProfile.displayName;
    if (user?.displayName) return user.displayName;
    if (isGuest) {
      return lang === 'he' ? 'אורח סקרן' : 'Curious Guest';
    }
    return '';
  });
  const [bio, setBio] = useState(() => {
    if (initialProfile?.bio) return initialProfile.bio;
    if (isGuest) {
      return lang === 'he' 
        ? 'הגעתי לפה כדי להקשיב, להשמיע דעות מגוונות וללמוד מאנשים עם השקפות עולם שונות משלי.' 
        : 'I came here to listen, share diverse views, and learn from people with different perspectives.';
    }
    return '';
  });
  const [leaning, setLeaning] = useState<PoliticalLeaning>(() => {
    if (initialProfile?.leaning) return initialProfile.leaning;
    if (isGuest) return 'Moderate';
    return 'Moderate';
  });
  const [interests, setInterests] = useState<string[]>(() => {
    if (initialProfile?.interests) return initialProfile.interests;
    if (isGuest) {
      return ['חברה', 'חינוך', 'משפט ודמוקרטיה'];
    }
    return [];
  });
  const [happyToChat, setHappyToChat] = useState(() => {
    if (initialProfile?.happyToChat !== undefined) return initialProfile.happyToChat;
    if (isGuest) return true;
    return false;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleInterest = (tag: string) => {
    setInterests(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (displayName.length < 2) {
      setError(lang === 'en' ? 'Name must be at least 2 characters' : 'השם חייב להכיל לפחות 2 תווים');
      return;
    }
    setError('');
    setSaving(true);

    const profileData: UserProfile = {
      uid: user?.uid || 'guest_' + Math.random().toString(36).substr(2, 9),
      displayName,
      bio,
      leaning,
      interests,
      happyToChat,
      warningStatus: initialProfile?.warningStatus || 'none',
      bridgeBuilderPoints: initialProfile?.bridgeBuilderPoints !== undefined ? initialProfile.bridgeBuilderPoints : 10,
      createdAt: initialProfile?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (isGuest) {
        localStorage.setItem('guest_profile', JSON.stringify(profileData));
      } else if (user) {
        await setDoc(doc(db, 'users', user.uid), profileData);
      }
      onSave(profileData);
    } catch (err) {
      console.error(err);
      setError(lang === 'en' ? 'Error saving profile' : 'שגיאה בשמירת הפרופיל');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('deleteWarning'))) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await signOut(auth);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(lang === 'en' ? 'Error deleting account' : 'שגיאה במחיקת החשבון');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.section 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-white p-10 rounded-[32px] shadow-xl border border-ink/5"
    >
      <div className="mb-8">
        <h2 className="text-3xl font-serif font-bold mb-2">{t('createProfile')}</h2>
        <p className="text-ink/60">{t('profileHelp')}</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="space-y-4">
          <label className="block text-sm font-bold uppercase tracking-wider opacity-60 text-sky">
            {t('displayName')}
          </label>
          <input 
            type="text" 
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-bg border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg"
            placeholder={t('displayName')}
            required
            maxLength={50}
          />
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-bold uppercase tracking-wider opacity-60 text-sky">
            {t('profileBio')}
          </label>
          <textarea 
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full bg-bg border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-lg min-h-[120px]"
            placeholder={t('profileBio')}
            maxLength={500}
          />
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-bold uppercase tracking-wider opacity-60 text-sky">
            {t('politicalLeaning')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {POLITICAL_LEANINGS.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLeaning(opt.id as PoliticalLeaning)}
                className={cn(
                  "px-4 py-3 rounded-2xl text-sm font-bold transition-all border-2",
                  leaning === opt.id 
                    ? cn("border-primary bg-primary text-white shadow-lg shadow-primary/20")
                    : "border-transparent bg-bg hover:bg-bg/80 opacity-80"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-bold uppercase tracking-wider opacity-60 text-sky">
            {t('interests')}
          </label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleInterest(tag)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                  interests.includes(tag)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-ink/10 bg-transparent hover:border-ink/30"
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-bg/50 p-4 rounded-2xl border border-ink/5">
          <input 
            type="checkbox" 
            id="happyToChat"
            checked={happyToChat}
            onChange={(e) => setHappyToChat(e.target.checked)}
            className="w-5 h-5 accent-primary cursor-pointer"
          />
          <label htmlFor="happyToChat" className="text-sm font-medium text-ink/70 cursor-pointer">
            {t('happyToChatLabel')}
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-2xl animate-pulse">
            <AlertCircle size={18} />
            <span className="text-sm font-bold">{error}</span>
          </div>
        )}

        <div className="flex items-center gap-4 pt-4">
          <button 
            type="submit"
            disabled={saving}
            className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold hover:bg-primary/90 transition-all shadow-xl disabled:opacity-50"
          >
            {saving ? t('saving') : t('saveAndContinue')}
          </button>
          {initialProfile && (
            <button 
              type="button"
              onClick={onCancel}
              className="px-8 py-4 bg-bg rounded-2xl font-bold hover:bg-bg/80 transition-all"
            >
              {t('cancel')}
            </button>
          )}
        </div>

        {initialProfile && (
          <div className="pt-12 border-t border-ink/5 mt-8">
            <button 
              type="button"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              className="text-red-600/40 hover:text-red-600 text-xs font-bold uppercase tracking-widest transition-all"
            >
              {t('deleteAccountBtn')}
            </button>
            {showDeleteConfirm && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-6 bg-red-50 rounded-2xl border border-red-100 space-y-4"
              >
                <p className="text-red-800 text-sm font-medium">{t('deleteWarning')}</p>
                <button 
                  type="button"
                  onClick={handleDeleteAccount}
                  className="bg-red-600 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-red-600/20"
                >
                  {t('deleteAccountBtn')}
                </button>
              </motion.div>
            )}
          </div>
        )}
      </form>
    </motion.section>
  );
}

/**
 * Dashboard Component
 */
function Dashboard({ 
  profile, 
  onEdit, 
  onJoinDebate,
  onViewUser,
  t,
  lang
}: { 
  profile: UserProfile | null, 
  onEdit: () => void,
  onJoinDebate: (id: string) => void,
  onViewUser: (uid: string) => void,
  t: (key: string) => string,
  lang: string,
  key?: string
}) {
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';
  const [debates, setDebates] = useState<Debate[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAllParticipantsModalOpen, setIsAllParticipantsModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [isCreatingDebate, setIsCreatingDebate] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<string[]>(JSON.parse(localStorage.getItem('blocked_users') || '[]'));
  const [activeDebateTab, setActiveDebateTab] = useState<'all' | 'recommended'>('all');

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'debates')), (snap) => {
      const realDebates = snap.docs.map(d => ({ id: d.id, ...d.data() } as Debate));
      // Mix real and mock
      const combined = [...realDebates, ...MOCK_DEBATES];
      // Filter out debates from blocked users or where user is blocked
      setDebates(combined.filter(d => !blockedUsers.includes(d.creatorId)));
    });
    return unsub;
  }, [blockedUsers]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('happyToChat', '==', true), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const realAvailable = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      // Mix with mock users who are "happy to chat" (let's assume some are)
      const mockAvailable = MOCK_USERS.filter(u => u.uid === 'mock1' || u.uid === 'mock5' || u.uid === 'mock10');
      const combined = [...realAvailable, ...mockAvailable];
      setAvailableUsers(combined.filter(u => u.uid !== profile?.uid && !blockedUsers.includes(u.uid)));
    });
    return unsub;
  }, [profile?.uid, blockedUsers]);

  const filteredUsers = availableUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase().trim();
    const matchesName = u.displayName?.toLowerCase().includes(term);
    const matchesInterests = u.interests?.some(interest => interest.toLowerCase().includes(term));
    return !!(matchesName || matchesInterests);
  });

  const modalFilteredUsers = availableUsers.filter((u) => {
    if (!modalSearchQuery.trim()) return true;
    const term = modalSearchQuery.toLowerCase().trim();
    const matchesName = u.displayName?.toLowerCase().includes(term);
    const matchesInterests = u.interests?.some(interest => interest.toLowerCase().includes(term));
    return !!(matchesName || matchesInterests);
  });

  const getRecommendedScore = (debate: Debate) => {
    if (!profile || !profile.interests) return 0;
    let score = 0;
    
    // 1. Direct tag matching
    if (debate.tags && Array.isArray(debate.tags)) {
      debate.tags.forEach(tag => {
        if (profile.interests.includes(tag)) {
          score += 30;
        }
      });
    }
    
    // 2. Keyword matching on the topic
    profile.interests.forEach(interest => {
      if (debate.topic.toLowerCase().includes(interest.toLowerCase())) {
        score += 15;
      }
    });
    
    return score;
  };

  const displayedDebates = activeDebateTab === 'all'
    ? debates
    : debates
        .map(d => ({ debate: d, score: getRecommendedScore(d) }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.debate);

  const handleCreateDebate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    try {
      // Auto-tagging based on INTEREST_TAGS keywords in the topic, with fallback to creator's interests or default tags
      const detectedTags: string[] = [];
      const topicLower = newTopic.toLowerCase();
      INTEREST_TAGS.forEach(tag => {
        if (topicLower.includes(tag.toLowerCase())) {
          detectedTags.push(tag);
        }
      });
      // Fallback 1: creator's interests
      if (detectedTags.length === 0 && profile?.interests && profile.interests.length > 0) {
        detectedTags.push(...profile.interests.slice(0, 2));
      }
      // Fallback 2: default interests if none of above
      if (detectedTags.length === 0) {
        detectedTags.push(INTEREST_TAGS[0], INTEREST_TAGS[2]);
      }

      const docRef = await addDoc(collection(db, 'debates'), {
        topic: newTopic,
        creatorId: profile?.uid,
        status: 'open',
        participants: [profile?.uid],
        tags: detectedTags,
        createdAt: serverTimestamp()
      });
      setNewTopic('');
      setIsCreatingDebate(false);
      onJoinDebate(docRef.id);
    } catch (err) {
      console.error(err);
    }
  };

  if (!profile) return null;

  const leaningLabel = POLITICAL_LEANINGS.find(l => l.id === profile.leaning);

  return (
    <motion.section 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-12"
    >
      {/* Profile Summary Card */}
      <div className="bg-white p-10 rounded-[32px] shadow-xl border border-ink/5 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
        
        <div className="flex flex-col sm:flex-row justify-between items-start gap-8">
          <div className="space-y-6 flex-1">
            <div className="flex items-center gap-4">
              <h2 className="text-4xl font-serif font-bold text-ink">{profile.displayName}</h2>
              <span className={cn(
                "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm",
                leaningLabel?.color
              )}>
                {leaningLabel?.label}
              </span>
              <div className="flex items-center gap-1 text-sky text-sm font-bold bg-sky/10 px-3 py-1 rounded-full">
                <Heart size={14} fill="currentColor" />
                <span>{profile.supportCount || 0}</span>
              </div>
              <div className="flex items-center gap-1 text-amber-700 text-sm font-bold bg-amber-50 border border-amber-200/50 px-3 py-1 rounded-full" title={t('reputationDesc')}>
                <Award size={14} className="text-amber-500 fill-amber-500" />
                <span>{profile.bridgeBuilderPoints || 10} {t('bridgeBuilderScore')}</span>
              </div>
            </div>
            
            <p className="text-xl font-serif text-ink/70 leading-relaxed italic">
              "{profile.bio || '...'}"
            </p>

            <div className="flex flex-wrap gap-2 pt-2">
              {profile.interests.map(interest => (
                <span key={interest} className="px-3 py-1 bg-bg text-primary rounded-lg text-xs font-bold border border-primary/10">
                  #{interest}
                </span>
              ))}
            </div>
          </div>

          <button 
            onClick={onEdit}
            className="px-6 py-3 border-2 border-primary text-primary rounded-2xl text-sm font-bold hover:bg-primary hover:text-white transition-all transform group-hover:scale-105"
          >
            {t('editProfile')}
          </button>
        </div>
      </div>

      {/* Main Feature Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Debate Section (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-serif font-bold flex items-center gap-2">
              <Scale className="text-primary" />
              {t('activeArenas')}
            </h3>
            <button 
              onClick={() => setIsCreatingDebate(true)}
              className="flex items-center gap-2 bg-sky text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-sky/20 hover:scale-105 transition-transform"
            >
              <Plus size={18} />
              {t('newDebate')}
            </button>
          </div>

          {/* Interactive Recommended Tabs */}
          <div className="flex border-b border-ink/5 gap-6">
            <button
              onClick={() => setActiveDebateTab('all')}
              className={cn(
                "pb-3 text-sm font-bold transition-all relative",
                activeDebateTab === 'all' 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-ink/40 hover:text-ink/60"
              )}
            >
              {t('tabAllDebates')}
            </button>
            <button
              onClick={() => setActiveDebateTab('recommended')}
              className={cn(
                "pb-3 text-sm font-bold transition-all relative flex items-center gap-1.5",
                activeDebateTab === 'recommended' 
                  ? "text-primary border-b-2 border-primary" 
                  : "text-ink/40 hover:text-ink/60"
              )}
            >
              <span>{t('tabRecommendedDebates')}</span>
              {profile?.interests && profile.interests.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping inline-block" />
              )}
            </button>
          </div>

          {isCreatingDebate && (
            <motion.form 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onSubmit={handleCreateDebate}
              className="bg-cream p-6 rounded-2xl border-2 border-sky border-dashed space-y-4"
            >
              <input 
                autoFocus
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                placeholder={t('createDebatePlaceholder')}
                className="w-full bg-white border-none rounded-xl px-4 py-3 outline-none shadow-sm font-serif text-lg"
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-sky text-white py-2 rounded-xl font-bold">{t('startDebateBtn')}</button>
                <button type="button" onClick={() => setIsCreatingDebate(false)} className="bg-ink/5 px-4 rounded-xl">{t('cancel')}</button>
              </div>
            </motion.form>
          )}

          <div className="grid grid-cols-1 gap-4">
            {displayedDebates.map(debate => {
              const recScore = getRecommendedScore(debate);
              return (
                <button 
                  key={debate.id}
                  onClick={() => onJoinDebate(debate.id)}
                  className={cn(
                    "bg-white p-6 rounded-3xl border border-ink/5 shadow-sm hover:shadow-md transition-all group flex justify-between items-center",
                    isRtl ? "text-right" : "text-left"
                  )}
                >
                  <div className="space-y-2 flex-1">
                    <h4 className="text-lg font-serif font-bold group-hover:text-primary transition-colors">{debate.topic}</h4>
                    <div className={cn("flex flex-wrap items-center gap-4 text-xs font-medium text-ink/40", isRtl ? "flex-row text-right" : "flex-row text-left")}>
                      <span className="flex items-center gap-1"><Users size={12} /> {debate.participants?.length || 0} {t('participants')}</span>
                      <span className="flex items-center gap-1"><Compass size={12} /> {debate.status === 'open' ? t('open') : t('active')}</span>
                    </div>

                    {/* Display Debate Tags */}
                    {debate.tags && debate.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {debate.tags.map(tag => {
                          const isMatch = profile?.interests?.includes(tag);
                          return (
                            <span 
                              key={tag} 
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full font-bold border transition-colors",
                                isMatch 
                                  ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm" 
                                  : "bg-bg border-ink/5 text-ink/50"
                              )}
                            >
                              {tag}
                              {isMatch && " ★"}
                            </span>
                          );
                        })}
                        {recScore > 0 && activeDebateTab === 'recommended' && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full font-black uppercase tracking-wider scale-95 inline-block">
                            {t('recommendedScore')}: +{recScore}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="w-10 h-10 bg-bg rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all transform ltr:rotate-0 rtl:rotate-180 ml-4">
                    <ArrowRight size={20} className={cn(lang === 'he' || lang === 'ar' ? "rotate-180" : "rotate-0")} />
                  </div>
                </button>
              );
            })}
            {displayedDebates.length === 0 && (
              <div className="text-center py-20 bg-bg rounded-[32px] border-2 border-dashed border-ink/10 opacity-65 p-8">
                <p className="font-serif italic text-lg text-ink/70">
                  {activeDebateTab === 'recommended' ? t('noRecommendedDebates') : t('noActiveDebates')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Side Column: Tools & Info */}
        <div className="space-y-8">
          {/* Common Ground Spotlight */}
          <div className="bg-primary text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden group">
            <h3 className="text-xl font-serif font-bold mb-4 flex items-center gap-2">
              <Sparkles size={20} className="text-sky" />
              {t('commonGround')}
            </h3>
            <p className="text-white/80 text-sm font-serif italic mb-6">
              {t('commonGroundAnalysis')}
            </p>
            <div className="space-y-3">
              {(lang === 'he' ? ['חיזוק הביטחון האישי', 'שיפור מערכת הבריאות', 'הורדת יוקר המחיה'] : ['Personal Security', 'Healthcare Improvement', 'Cost of Living']).map((point, i) => (
                <div key={i} className="bg-white/10 p-3 rounded-xl border border-white/5 text-sm font-bold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-sky" />
                  {point}
                </div>
              ))}
            </div>
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-sky opacity-10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
          </div>

          {/* Available for Chat List */}
          <div className="bg-white p-8 rounded-[32px] shadow-lg border border-ink/5 space-y-6">
            <div className="space-y-1">
              <h3 className="text-xl font-serif font-bold flex items-center gap-2">
                <MessageSquare className="text-primary" size={20} />
                {t('directDialogueTitle')}
              </h3>
              <p className="text-ink/60 text-xs font-serif italic">
                {t('availableForChat')}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className={cn(
                "absolute inset-y-0 flex items-center text-ink/40 pointer-events-none",
                isRtl ? "right-3 pr-2" : "left-3 pl-2"
              )}>
                <Search size={18} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchParticipantsPlaceholder')}
                className={cn(
                  "w-full bg-bg border border-ink/5 rounded-2xl py-3 text-sm font-sans text-ink placeholder-ink/40 focus:outline-none focus:border-primary/30 transition-colors shadow-inner",
                  isRtl ? "pr-10 pl-10 text-right" : "pl-10 pr-10 text-left"
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={cn(
                    "absolute inset-y-0 flex items-center text-ink/40 hover:text-ink transition-colors",
                    isRtl ? "left-3 pl-2" : "right-3 pr-2"
                  )}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
              {filteredUsers.map((u) => (
                <button
                  key={u.uid}
                  onClick={() => onViewUser(u.uid)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-bg transition-all group border border-transparent hover:border-ink/5 text-right"
                >
                  <div className="w-10 h-10 bg-bg rounded-full flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-sm shrink-0">
                    <UserIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-sm font-bold group-hover:text-primary transition-colors truncate">{u.displayName}</div>
                    <div className="flex flex-wrap gap-1 justify-end mt-1">
                      <span className="text-[10px] text-ink/50 bg-bg px-1.5 py-0.5 rounded uppercase tracking-tight">{POLITICAL_LEANINGS.find(l => l.id === u.leaning)?.label}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded tracking-tight flex items-center gap-0.5">
                        <Award size={10} className="text-amber-500 fill-amber-500 animate-pulse" />
                        {u.bridgeBuilderPoints || 10}
                      </span>
                      {u.interests && u.interests.map(interest => (
                        <span key={interest} className={cn(
                          "text-[9px] px-1 rounded border border-ink/5",
                          searchQuery && interest.toLowerCase().includes(searchQuery.toLowerCase().trim()) 
                            ? "bg-primary/10 text-primary font-bold border-primary/20 animate-pulse" 
                            : "bg-bg text-ink/40"
                        )}>
                          #{interest}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-sky animate-pulse shrink-0" />
                </button>
              ))}
              {availableUsers.length > 0 && filteredUsers.length === 0 && (
                <div className="text-center py-8 text-ink/40 text-xs italic">
                  {t('noParticipantsFound')}
                </div>
              )}
              {availableUsers.length === 0 && (
                <div className="text-center py-4 text-ink/40 text-xs italic">
                  {lang === 'he' ? 'זמנית אין משתמשים פנויים' : 'No available users at the moment'}
                </div>
              )}
            </div>
            {availableUsers.length > 0 && (
              <div className="pt-4 border-t border-ink/5 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setModalSearchQuery(searchQuery);
                    setIsAllParticipantsModalOpen(true);
                  }}
                  className={cn(
                    "text-sm text-primary font-bold hover:text-primary/85 transition-all flex items-center gap-1.5 cursor-pointer group/all",
                    isRtl ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <span>{t('viewAllParticipants')}</span>
                  <ArrowRight size={16} className={cn("transform transition-transform", isRtl ? "rotate-180 group-hover/all:-translate-x-1" : "group-hover/all:translate-x-1")} />
                </button>
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-[32px] shadow-lg border border-ink/5">
            <h3 className="text-lg font-serif font-bold mb-4">{t('communitySupport')}</h3>
            <p className="text-ink/60 text-xs mb-6">{t('communitySupportDesc')}</p>
            <div className="space-y-4">
              <div className="flex items-center justify-center p-6 bg-cream rounded-2xl text-primary font-serif italic text-center text-sm leading-relaxed">
                {t('shareOpinionPrompt')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {profile && (
        <div className="mt-8">
          <ActivityDashboard profile={profile} t={t} lang={lang} />
        </div>
      )}

      {/* Full-Page Modal for All Participants */}
      <AnimatePresence>
        {isAllParticipantsModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-white rounded-[40px] w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-ink/5 text-right"
            >
              {/* Modal Header */}
              <div className={cn(
                "p-6 md:p-8 border-b border-ink/5 flex justify-between items-center bg-bg/50",
                isRtl ? "flex-row-reverse" : "flex-row"
              )}>
                <div className="space-y-1">
                  <h3 className="text-2xl font-serif font-bold text-ink">
                    {t('availableForChat')}
                  </h3>
                  <p className="text-ink/50 text-sm font-serif italic">
                    {availableUsers.length} {t('participants')} {lang === 'he' ? 'זמינים לשיחה כרגע' : 'currently available to connect'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAllParticipantsModalOpen(false)}
                  className="w-12 h-12 rounded-full bg-bg hover:bg-ink/5 text-ink/70 flex items-center justify-center transition-all hover:scale-105"
                  title={t('closeModal')}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Search Bar */}
              <div className="px-6 md:px-8 py-4 bg-bg/20 border-b border-ink/5">
                <div className="relative max-w-md mx-auto">
                  <span className={cn(
                    "absolute inset-y-0 flex items-center text-ink/40 pointer-events-none",
                    isRtl ? "right-4 pr-1" : "left-4 pl-1"
                  )}>
                    <Search size={20} />
                  </span>
                  <input
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    placeholder={t('searchParticipantsPlaceholder')}
                    className={cn(
                      "w-full bg-white border border-ink/10 rounded-2xl py-3 px-12 text-sm font-sans text-ink placeholder-ink/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all shadow-inner",
                      isRtl ? "text-right" : "text-left"
                    )}
                  />
                  {modalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setModalSearchQuery('')}
                      className={cn(
                        "absolute inset-y-0 flex items-center text-ink/40 hover:text-ink transition-colors",
                        isRtl ? "left-4 pl-1" : "right-4 pr-1"
                      )}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Grid of Full Profiles */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-bg/5">
                {modalFilteredUsers.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modalFilteredUsers.map((u) => {
                      const leaningLabel = POLITICAL_LEANINGS.find(l => l.id === u.leaning);
                      return (
                        <div
                          key={u.uid}
                          className="bg-white p-6 rounded-3xl border border-ink/5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between hover:border-primary/10 relative group"
                        >
                          <div className="space-y-4">
                            {/* Card Header: Avatar & Name */}
                            <div className={cn(
                              "flex items-start gap-4",
                              isRtl ? "flex-row-reverse text-right" : "flex-row text-left"
                            )}>
                              <div className="w-12 h-12 bg-primary/5 text-primary rounded-2xl flex items-center justify-center shrink-0 border border-primary/10 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                <UserIcon size={22} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base font-bold text-ink truncate group-hover:text-primary transition-colors">
                                  {u.displayName}
                                </h4>
                                <div className={cn(
                                  "flex flex-wrap gap-1.5 mt-1",
                                  isRtl ? "justify-end" : "justify-start"
                                )}>
                                  <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", leaningLabel?.color || "bg-bg text-ink/50 border-ink/5")}>
                                    {leaningLabel?.label || u.leaning}
                                  </span>
                                  <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                    <Award size={10} className="text-amber-500 fill-amber-500" />
                                    {u.bridgeBuilderPoints || 10}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Bio Description snippet */}
                            <p className={cn(
                              "text-xs text-ink/60 font-serif italic line-clamp-3 leading-relaxed border-t border-ink/5 pt-3 mt-2 min-h-[48px]",
                              isRtl ? "text-right" : "text-left"
                            )}>
                              "{u.bio || t('biographyNotSet')}"
                            </p>

                            {/* Interests tags */}
                            {u.interests && u.interests.length > 0 && (
                              <div className={cn(
                                "flex flex-wrap gap-1 pt-1",
                                isRtl ? "justify-end" : "justify-start"
                              )}>
                                {u.interests.map((interest) => {
                                  const isMatched = modalSearchQuery && interest.toLowerCase().includes(modalSearchQuery.toLowerCase().trim());
                                  return (
                                    <span
                                      key={interest}
                                      className={cn(
                                        "text-[9px] px-2 py-0.5 rounded-full border transition-all",
                                        isMatched
                                          ? "bg-primary/10 text-primary font-bold border-primary/20 scale-105 shadow-sm"
                                          : "bg-bg text-ink/50 border-ink/5"
                                      )}
                                    >
                                      #{interest}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="mt-6 pt-4 border-t border-ink/5">
                            <button
                              type="button"
                              onClick={() => {
                                setIsAllParticipantsModalOpen(false);
                                onViewUser(u.uid);
                              }}
                              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                            >
                              <MessageSquare size={14} />
                              <span>{t('startChat')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-ink/10 opacity-60 flex flex-col items-center justify-center p-8">
                    <Search className="text-ink/30 mb-3" size={32} />
                    <p className="font-serif italic text-lg text-ink/70">
                      {t('noParticipantsFound')}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={cn(
                "p-6 border-t border-ink/5 bg-bg/50 flex",
                isRtl ? "justify-start" : "justify-end"
              )}>
                <button
                  type="button"
                  onClick={() => setIsAllParticipantsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-ink/15 text-xs font-bold text-ink/70 hover:bg-bg transition-colors"
                >
                  {t('closeModal')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

/**
 * Debate Room Component
 */
function DebateRoom({ 
  debateId, 
  userProfile, 
  isGuest,
  onProfileUpdate,
  onExit,
  onViewUser,
  t,
  lang
}: { 
  debateId: string, 
  userProfile: UserProfile, 
  isGuest: boolean,
  onProfileUpdate: (p: UserProfile) => void,
  onExit: () => void,
  onViewUser: (uid: string) => void,
  t: (key: string) => string,
  lang: string,
  key?: string
}) {
  const [debate, setDebate] = useState<Debate | null>(null);
  const [argumentsList, setArgumentsList] = useState<DebateArgument[]>([]);
  const [newArgument, setNewArgument] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<string[]>(JSON.parse(localStorage.getItem('blocked_users') || '[]'));
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';
  const [pointsNotification, setPointsNotification] = useState<string | null>(null);
  const [reportingArgId, setReportingArgId] = useState<string | null>(null);
  const [editingArgId, setEditingArgId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [pendingReport, setPendingReport] = useState<{ arg: DebateArgument; category: string } | null>(null);

  const handleMarkConstructive = async (arg: DebateArgument) => {
    if (!userProfile) return;
    if (arg.authorId === userProfile.uid) return;

    const upvotedByList = arg.upvotedBy || [];
    if (upvotedByList.includes(userProfile.uid)) return;

    try {
      const isMockArg = arg.id?.startsWith('mock') || !arg.id;
      if (!isMockArg) {
        const argRef = doc(db, 'debates', debateId, 'arguments', arg.id);
        await updateDoc(argRef, {
          upvotedBy: arrayUnion(userProfile.uid)
        });
      } else {
        arg.upvotedBy = [...upvotedByList, userProfile.uid];
        setArgumentsList([...argumentsList]);
      }

      const isMockAuthor = arg.authorId.startsWith('mock');
      if (!isMockAuthor) {
        const authorRef = doc(db, 'users', arg.authorId);
        await updateDoc(authorRef, {
          bridgeBuilderPoints: increment(10),
          updatedAt: serverTimestamp()
        });
      } else {
        const mockUser = MOCK_USERS.find(u => u.uid === arg.authorId);
        if (mockUser) {
          mockUser.bridgeBuilderPoints = (mockUser.bridgeBuilderPoints || 10) + 10;
        }
      }

      alert(t('markedConstructive'));
    } catch (err) {
      console.error("Error marking constructive:", err);
    }
  };

  const handleReportContent = async (arg: DebateArgument, category: string) => {
    try {
      const reportPath = 'reports';
      await addDoc(collection(db, reportPath), {
        debateId: debateId,
        messageId: arg.id || '',
        category: category,
        reporterId: userProfile.uid,
        reportedUserId: arg.authorId,
        reportedUserName: arg.authorName || '',
        content: arg.content,
        createdAt: serverTimestamp()
      });
      alert(t('reportSubmitted'));
      setReportingArgId(null);
      setPendingReport(null);
    } catch (err) {
      console.error("Error creating report:", err);
      setPendingReport(null);
      handleFirestoreError(err, OperationType.CREATE, 'reports');
    }
  };

  const handleEditArgument = async (argId: string, newContent: string) => {
    if (!newContent.trim()) return;
    try {
      const hasBadWords = FORBIDDEN_WORDS.some(word => newContent.toLowerCase().includes(word));
      if (hasBadWords) {
        let nextStatus: 'whistle' | 'yellow' | 'red' = 'whistle';
        if (userProfile.warningStatus === 'whistle') nextStatus = 'yellow';
        else if (userProfile.warningStatus === 'yellow') nextStatus = 'red';
        else if (userProfile.warningStatus === 'red') nextStatus = 'red';

        if (!isGuest) {
          await updateDoc(doc(db, 'users', userProfile.uid), {
            warningStatus: nextStatus,
            updatedAt: serverTimestamp()
          });
        } else {
          const updated = { ...userProfile, warningStatus: nextStatus };
          localStorage.setItem('guest_profile', JSON.stringify(updated));
          onProfileUpdate(updated);
        }
        return;
      }

      const isMockArg = argId.startsWith('mock');
      if (!isMockArg) {
        const argRef = doc(db, 'debates', debateId, 'arguments', argId);
        await updateDoc(argRef, {
          content: newContent
        });
      } else {
        const updatedList = argumentsList.map(a => {
          if (a.id === argId) {
            return { ...a, content: newContent };
          }
          return a;
        });
        setArgumentsList(updatedList);
      }
      setEditingArgId(null);
    } catch (err) {
      console.error("Error editing argument:", err);
    }
  };

  const handleBlockUser = async (uid: string) => {
    if (!window.confirm(t('blockUser') + '?')) return;
    const newBlocked = [...blockedUsers, uid];
    setBlockedUsers(newBlocked);
    localStorage.setItem('blocked_users', JSON.stringify(newBlocked));
    alert(t('userBlocked'));
    onExit(); // Exit the debate if someone is blocked
  };

  const handleReportUser = async (uid: string) => {
    // Simulate reporting
    console.log(`Reported user: ${uid}`);
    alert(t('reportSubmitted'));
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'debates', debateId), (d) => {
      if (d.exists()) {
        setDebate({ id: d.id, ...d.data() } as Debate);
      } else {
        // Check mock
        const mock = MOCK_DEBATES.find(m => m.id === debateId);
        if (mock) setDebate(mock);
      }
    });

    const argsQ = query(
      collection(db, 'debates', debateId, 'arguments'), 
      orderBy('createdAt', 'asc')
    );
    const argsSub = onSnapshot(argsQ, (snap) => {
      const realArgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DebateArgument));
      const mockArgs = MOCK_ARGUMENTS[debateId] || [];
      setArgumentsList([...mockArgs, ...realArgs]);
    });

    return () => {
      unsub();
      argsSub();
    };
  }, [debateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newArgument.trim()) return;

    try {
      // Check for forbidden words (Moderation)
      const hasBadWords = FORBIDDEN_WORDS.some(word => newArgument.toLowerCase().includes(word));
      
      if (hasBadWords) {
        let nextStatus: 'whistle' | 'yellow' | 'red' = 'whistle';
        if (userProfile.warningStatus === 'whistle') nextStatus = 'yellow';
        else if (userProfile.warningStatus === 'yellow') nextStatus = 'red';
        else if (userProfile.warningStatus === 'red') nextStatus = 'red';

        if (!isGuest) {
          await updateDoc(doc(db, 'users', userProfile.uid), {
            warningStatus: nextStatus,
            updatedAt: serverTimestamp()
          });
        } else {
          // Update local for guest
          const updated = { ...userProfile, warningStatus: nextStatus };
          localStorage.setItem('guest_profile', JSON.stringify(updated));
          onProfileUpdate(updated);
        }
        
        // Don't send the message if it violates
        setNewArgument('');
        return;
      }

      await addDoc(collection(db, 'debates', debateId, 'arguments'), {
        debateId,
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        authorLeaning: userProfile.leaning,
        content: newArgument,
        type: 'argument',
        createdAt: serverTimestamp()
      });
      setNewArgument('');

      // Earn Bridge Builder points for surviving moderation check without warnings (+5)
      if (!isGuest) {
        await updateDoc(doc(db, 'users', userProfile.uid), {
          bridgeBuilderPoints: increment(5),
          updatedAt: serverTimestamp()
        });
      } else {
        const updated = { ...userProfile, bridgeBuilderPoints: (userProfile.bridgeBuilderPoints || 10) + 5 };
        localStorage.setItem('guest_profile', JSON.stringify(updated));
        onProfileUpdate(updated);
      }

      setPointsNotification(t('earnedPointsToast'));
      setTimeout(() => {
        setPointsNotification(null);
      }, 3500);

      // Add user to participants if not already there
      if (!debate?.participants.includes(userProfile.uid)) {
        await updateDoc(doc(db, 'debates', debateId), {
          participants: arrayUnion(userProfile.uid)
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyze = async () => {
    if (argumentsList.length < 2) return;
    setAnalyzing(true);
    const text = argumentsList.map(a => `(${a.authorLeaning}) ${a.authorName}: ${a.content}`).join('\n');
    const result = await analyzeCommonGround(text);
    
    await updateDoc(doc(db, 'debates', debateId), {
      commonGrounds: result.topics,
      commonGroundExplanation: result.explanation
    });
    setAnalyzing(false);
  };

  if (!debate) return null;

  const isFinalized = debate.status === 'closed' || !!(debate.commonGrounds && debate.commonGrounds.length > 0);

  return (
    <motion.section 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-2 text-primary font-bold hover:translate-x-1 transition-transform rtl:flex-row-reverse">
          <ArrowRight className={cn(lang === 'en' ? "rotate-180" : "rotate-0")} />
          {t('backToDashboardBtn')}
        </button>
        <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full text-primary text-sm font-bold">
          <Scale size={16} />
          {t('managedArena')}
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowSafetyMenu(!showSafetyMenu)}
            className="p-2 rounded-full hover:bg-red-50 text-red-400 transition-all border border-transparent hover:border-red-100"
          >
            <ShieldAlert size={20} />
          </button>
          <AnimatePresence>
            {showSafetyMenu && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                className={cn(
                  "absolute top-12 bg-white shadow-2xl rounded-2xl border border-ink/5 p-4 min-w-[220px] z-50 overflow-hidden",
                  isRtl ? "left-0" : "right-0"
                )}
              >
                <div className="flex flex-col gap-2">
                  <h4 className="text-[10px] uppercase font-black tracking-widest opacity-30 pb-2 border-b border-ink/5 mb-1 text-center">Safety Controls</h4>
                  {debate.participants.filter(p => p !== userProfile.uid).map(pUid => (
                    <div key={pUid} className="space-y-1">
                      <button 
                        onClick={() => handleReportUser(pUid)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-bg rounded-xl transition-colors text-xs font-bold text-ink/70"
                      >
                        <Flag size={14} className="text-sky" /> {t('reportUser')}
                      </button>
                      <button 
                        onClick={() => handleBlockUser(pUid)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-red-50 rounded-xl transition-colors text-xs font-bold text-red-600"
                      >
                        <Slash size={14} /> {t('blockUser')}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-ink/5 space-y-8">
        <div className="space-y-2 border-b border-ink/5 pb-8">
          <h2 className="text-3xl font-serif font-bold text-ink leading-tight">{debate.topic}</h2>
          <p className="text-ink/40 text-sm">{t('debateGoal')}</p>
        </div>

        {/* Common Ground Analysis Result */}
        {(debate.commonGrounds && debate.commonGrounds.length > 0) && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-cream p-8 rounded-[32px] border-2 border-sky border-dashed space-y-4"
          >
            <h3 className="text-xl font-serif font-bold text-sky flex items-center gap-2">
              <Sparkles />
              {t('identifiedCommonGround')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {debate.commonGrounds.map((g, i) => (
                <span key={i} className="bg-white px-4 py-2 rounded-full text-sm font-bold text-sky shadow-sm">{g}</span>
              ))}
            </div>
            <p className="text-ink/70 font-serif italic text-sm">{debate.commonGroundExplanation}</p>
          </motion.div>
        )}

        <div className="space-y-6 max-h-[500px] overflow-y-auto px-2">
          {argumentsList.map((arg) => {
            const hasUpvoted = arg.upvotedBy?.includes(userProfile.uid);
            return (
              <div 
                key={arg.id} 
                className={cn(
                  "flex flex-col gap-2 max-w-[85%]",
                  arg.authorId === userProfile.uid 
                    ? (isRtl ? "mr-auto items-end text-right" : "ml-auto items-start text-left") 
                    : (isRtl ? "ml-auto items-start text-left" : "mr-auto items-end text-right")
                )}
              >
                <button 
                  onClick={() => onViewUser(arg.authorId)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-ink/30 hover:text-primary transition-colors flex-wrap"
                >
                  <span>{arg.authorName} • {arg.authorLeaning}</span>
                  <span className="inline-flex items-center gap-0.5 text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-full scale-90">
                    <Award size={10} className="text-amber-500 fill-amber-500" />
                    <span>
                      {arg.authorId.startsWith('mock') 
                        ? (MOCK_USERS.find(m => m.uid === arg.authorId)?.bridgeBuilderPoints || 10) 
                        : (arg.authorId === userProfile.uid ? (userProfile.bridgeBuilderPoints || 10) : 10)} pts
                    </span>
                  </span>
                </button>
                <div 
                  className={cn(
                    "p-5 rounded-3xl font-serif leading-relaxed relative group/msg",
                    arg.authorId === userProfile.uid 
                      ? "bg-primary text-white rounded-br-none shadow-lg" 
                      : "bg-bg text-ink rounded-bl-none border border-ink/5"
                  )}
                >
                  {editingArgId === arg.id ? (
                    <div className="space-y-3 min-w-[200px] md:min-w-[300px]">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full bg-white/10 text-white placeholder-white/50 border border-white/20 rounded-xl p-2.5 text-sm font-sans focus:outline-none focus:ring-1 focus:ring-white/40"
                        rows={3}
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingArgId(null)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/20 hover:bg-white/30 text-white transition-all flex items-center gap-1"
                        >
                          <X size={10} />
                          <span>{t('cancel')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditArgument(arg.id, editingContent)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white text-primary hover:bg-white/90 transition-all flex items-center gap-1 shadow-sm"
                        >
                          <Check size={10} />
                          <span>{t('save')}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    arg.content
                  )}
                  
                  {arg.upvotedBy && arg.upvotedBy.length > 0 && (
                    <span className={cn(
                      "absolute -bottom-2 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm z-10",
                      arg.authorId === userProfile.uid 
                        ? (isRtl ? "right-3" : "left-3") 
                        : (isRtl ? "left-3" : "right-3")
                    )}>
                      <Award size={10} className="text-amber-500 fill-amber-500" />
                      <span>{t('constructiveFeedback')} • {arg.upvotedBy.length}</span>
                    </span>
                  )}
                  
                  {/* Action buttons (Report Content on all; Award only on others; Edit on self) */}
                  <div className={cn(
                    "absolute top-2 transition-all flex gap-1.5 z-10",
                    reportingArgId === arg.id 
                      ? "opacity-100 scale-100" 
                      : "opacity-0 group-hover/msg:opacity-100 scale-95",
                    arg.authorId === userProfile.uid 
                      ? (isRtl ? "-right-24" : "-left-24") 
                      : (isRtl ? "-left-24" : "-right-24")
                  )}>
                    {arg.authorId === userProfile.uid && !isFinalized && (
                      <button 
                        onClick={() => {
                          setEditingArgId(arg.id);
                          setEditingContent(arg.content);
                        }}
                        className="p-1.5 rounded-lg bg-white/95 shadow-sm border border-ink/5 text-sky hover:text-primary transition-colors"
                        title={t('edit')}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button 
                      onClick={() => setReportingArgId(reportingArgId === arg.id ? null : (arg.id || ''))}
                      className={cn(
                        "p-1.5 rounded-lg bg-white/95 shadow-sm border transition-colors",
                        reportingArgId === arg.id 
                          ? "text-red-600 border-red-200 bg-red-50 animate-pulse" 
                          : "text-sky hover:text-red-600 border-ink/5"
                      )}
                      title={t('flag')}
                    >
                      <Flag size={14} />
                    </button>
                    {arg.authorId !== userProfile.uid && (
                      <button 
                        onClick={() => handleMarkConstructive(arg)}
                        disabled={hasUpvoted}
                        className={cn(
                          "p-1.5 rounded-lg bg-white/95 shadow-sm border border-ink/5 transition-all",
                          hasUpvoted 
                            ? "text-amber-500 cursor-default bg-amber-50" 
                            : "text-sky hover:text-amber-500"
                        )}
                        title={hasUpvoted ? t('markedConstructive') : t('constructiveFeedback')}
                      >
                        <Award size={14} className={hasUpvoted ? "fill-amber-500" : ""} />
                      </button>
                    )}
                  </div>

                  {/* Report Category Selection Dropdown */}
                  {reportingArgId === arg.id && (
                    <div className={cn(
                      "absolute top-10 bg-white shadow-2xl rounded-2xl border border-ink/10 p-3 min-w-[200px] z-50 flex flex-col gap-1.5 text-xs font-bold text-ink/80",
                      arg.authorId === userProfile.uid 
                        ? (isRtl ? "right-0" : "left-0") 
                        : (isRtl ? "left-0" : "right-0")
                    )}>
                      <p className="text-[10px] uppercase font-black tracking-wider text-ink/30 pb-1.5 border-b border-ink/5 mb-1 text-center">
                        {t('flag')}
                      </p>
                      <button 
                        type="button"
                        onClick={() => { setPendingReport({ arg, category: 'Inappropriate Language' }); setReportingArgId(null); }}
                        className="w-full text-start p-2 hover:bg-bg rounded-xl transition-colors text-xs font-bold text-ink/70 hover:text-red-600 flex items-center gap-2"
                      >
                        <span className="text-sm">⚠️</span>
                        <span>{t('reportCategory_InappropriateLanguage')}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setPendingReport({ arg, category: 'Spam' }); setReportingArgId(null); }}
                        className="w-full text-start p-2 hover:bg-bg rounded-xl transition-colors text-xs font-bold text-ink/70 hover:text-red-600 flex items-center gap-2"
                      >
                        <span className="text-sm">✉️</span>
                        <span>{t('reportCategory_Spam')}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setPendingReport({ arg, category: 'Harassment' }); setReportingArgId(null); }}
                        className="w-full text-start p-2 hover:bg-bg rounded-xl transition-colors text-xs font-bold text-ink/70 hover:text-red-600 flex items-center gap-2"
                      >
                        <span className="text-sm">🚫</span>
                        <span>{t('reportCategory_Harassment')}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setPendingReport({ arg, category: 'Threat' }); setReportingArgId(null); }}
                        className="w-full text-start p-2 hover:bg-bg rounded-xl transition-colors text-xs font-bold text-ink/70 hover:text-red-600 flex items-center gap-2"
                      >
                        <span className="text-sm">🚨</span>
                        <span>{t('reportCategory_Threat')}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setReportingArgId(null)}
                        className="w-full text-center mt-1 pt-1.5 border-t border-ink/5 text-[10px] text-ink/40 hover:text-ink/60"
                      >
                        {t('dismiss')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {argumentsList.length === 0 && (
            <div className="text-center py-10 opacity-30 italic font-serif">
              {t('noArgumentsYet')}
            </div>
          )}
        </div>

        <div className="pt-8 border-t border-ink/5 space-y-4">
          {pointsNotification && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-amber-500 text-white font-bold text-xs px-4 py-2 rounded-full shadow-lg flex items-center justify-center gap-1.5 max-w-sm mx-auto"
            >
              <Award size={14} className="animate-bounce" />
              <span>{pointsNotification}</span>
            </motion.div>
          )}

          <div className="flex gap-2">
             <button 
              onClick={handleAnalyze}
              disabled={analyzing || argumentsList.length < 2}
              className="px-6 py-4 bg-sky text-white rounded-2xl font-bold flex items-center gap-2 disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles size={18} />
              {analyzing ? t('analyzing') : t('identifyCommonGround')}
            </button>
            <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
              <input 
                value={newArgument}
                onChange={(e) => setNewArgument(e.target.value)}
                placeholder={t('writeArgumentPlaceholder')}
                className="flex-1 bg-bg border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary/20 outline-none font-serif text-lg"
              />
              <button 
                type="submit" 
                className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center hover:bg-primary/90 transition-all shadow-lg"
              >
                <Send size={24} className={cn(lang === 'en' ? "rotate-0" : "rotate-180")} />
              </button>
            </form>
          </div>
          <p className="text-[10px] text-center text-ink/30 font-bold uppercase tracking-[2px]">
            {t('discourseValues')}
          </p>
        </div>
      </div>

      {pendingReport && (
        <ReportConfirmationModal
          category={pendingReport.category}
          argumentText={pendingReport.arg.content}
          onConfirm={() => handleReportContent(pendingReport.arg, pendingReport.category)}
          onCancel={() => setPendingReport(null)}
          t={t}
          lang={lang}
        />
      )}
    </motion.section>
  );
}

/**
 * Step 2: Connections Component
 */
function Step2Connections({ 
  onComplete, 
  onBack,
  t,
  lang,
  key 
}: { 
  onComplete: () => void, 
  onBack: () => void,
  t: (k: string) => string,
  lang: string,
  key?: string
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';

  const handleConnect = (type: string) => {
    setLoading(type);
    // Mock connection delay
    setTimeout(() => {
      setLoading(null);
      onComplete();
    }, 1500);
  };

  return (
    <motion.section 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-xl mx-auto space-y-10 py-10"
    >
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mx-auto">
          <Users size={40} />
        </div>
        <h2 className="text-4xl font-serif font-bold text-primary">{t('step2Title')}</h2>
        <p className="text-ink/60 font-serif text-lg">{t('step2Desc')}</p>
      </div>

      <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-ink/5 space-y-6">
        <div className="space-y-4">
          <button 
            disabled={!!loading}
            onClick={() => handleConnect('facebook')}
            className={cn(
              "w-full py-6 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl hover:scale-[1.02]",
              loading === 'facebook' ? "bg-bg text-ink/40 grayscale" : "bg-[#1877F2] text-white hover:bg-[#166fe5]"
            )}
          >
            {loading === 'facebook' ? t('analyzing') : (
              <>
                <Users size={24} />
                {t('galleryConnectFb')}
              </>
            )}
          </button>

          <button 
            disabled={!!loading}
            onClick={() => handleConnect('linkedin')}
            className={cn(
              "w-full py-6 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl hover:scale-[1.02]",
              loading === 'linkedin' ? "bg-bg text-ink/40 grayscale" : "bg-[#0A66C2] text-white hover:bg-[#0859a8]"
            )}
          >
            {loading === 'linkedin' ? t('analyzing') : (
              <>
                <Linkedin size={24} />
                {t('galleryConnectLi')}
              </>
            )}
          </button>
        </div>

        <div className="pt-8 flex flex-col items-center gap-4">
          <button 
            onClick={onComplete}
            className="text-primary font-bold hover:underline"
          >
            {t('stepSkip')}
          </button>
          <button onClick={onBack} className="text-xs text-ink/30 hover:text-ink transition-colors uppercase tracking-widest font-black">
            {t('back')}
          </button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 opacity-30">
        <ShieldCheck size={16} />
        <p className="text-[10px] uppercase font-black tracking-widest">
          {t('stepPrivacy')}
        </p>
      </div>
    </motion.section>
  );
}
function PublicProfileView({ 
  uid, 
  currentUserId,
  onBack,
  onStartChat,
  t,
  lang
}: { 
  uid: string, 
  currentUserId: string,
  onBack: () => void,
  onStartChat?: (otherUid: string, otherName: string) => void,
  t: (key: string) => string,
  lang: string,
  key?: string
}) {
  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [isSupporting, setIsSupporting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      if (snap.exists()) {
        setTargetProfile(snap.data() as UserProfile);
      } else {
        // Check mock
        const mock = MOCK_USERS.find(m => m.uid === uid);
        if (mock) setTargetProfile(mock);
      }
    });
    return unsub;
  }, [uid]);

  const handleSupport = async () => {
    if (!targetProfile || isSupporting) return;
    if (targetProfile.supporters?.includes(currentUserId)) return;

    setIsSupporting(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        supportCount: increment(1),
        supporters: arrayUnion(currentUserId),
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSupporting(false);
    }
  };

  if (!targetProfile) return null;

  const leaningLabel = POLITICAL_LEANINGS.find(l => l.id === targetProfile.leaning);
  const alreadySupported = targetProfile.supporters?.includes(currentUserId);

  return (
    <motion.section 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-8"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-primary font-bold hover:translate-x-1 transition-transform rtl:flex-row-reverse">
        <ArrowRight className={cn(lang === 'en' ? "rotate-180" : "rotate-0")} />
        {t('back')}
      </button>

      <div className="bg-white p-12 rounded-[48px] shadow-2xl border border-ink/5 space-y-8 text-center">
        <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <UserIcon size={48} />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-4xl font-serif font-bold">{targetProfile.displayName}</h2>
          <div className="flex justify-center gap-2">
            <span className={cn("px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest", leaningLabel?.color)}>
              {leaningLabel?.label}
            </span>
          </div>
          <p className="text-xl font-serif text-ink/70 max-w-lg mx-auto italic">"{targetProfile.bio || t('biographyNotSet')}"</p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center py-8">
          <div className="bg-bg px-8 py-4 rounded-3xl border border-ink/5 min-w-[140px]">
            <div className="text-3xl font-serif font-black text-primary">{targetProfile.supportCount || 0}</div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-40">{t('supportCount')}</div>
          </div>
          <div className="bg-bg px-8 py-4 rounded-3xl border border-ink/5 min-w-[140px] flex flex-col items-center">
            <div className="text-3xl font-serif font-black text-amber-600 flex items-center gap-1">
              <Award size={24} className="text-amber-500 fill-amber-500 inline animate-pulse" />
              {targetProfile.bridgeBuilderPoints || 10}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-700/60 mt-1">{t('reputationTitle')}</div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button 
            disabled={alreadySupported || isSupporting || currentUserId === uid}
            onClick={handleSupport}
            className={cn(
              "px-12 py-5 rounded-full text-xl font-bold transition-all shadow-xl flex items-center gap-2",
              alreadySupported 
                ? "bg-sky/20 text-primary cursor-default" 
                : "bg-sky text-white hover:scale-105 active:scale-95 disabled:opacity-50"
            )}
          >
            <Heart size={24} fill={alreadySupported ? "currentColor" : "none"} />
            {t('imWithYou')}
          </button>
          <p className="text-xs text-ink/30 italic">{t('supportDesc')}</p>

          {targetProfile.happyToChat && currentUserId !== uid && (
            <button 
              onClick={() => onStartChat?.(uid, targetProfile.displayName)}
              className="mt-4 px-10 py-4 rounded-full text-lg font-bold bg-primary text-white hover:bg-primary/90 transition-all shadow-lg flex items-center gap-2"
            >
              <MessageSquare size={20} />
              {t('startChat')}
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
}

/**
 * Feature Gallery Component
 */
function FeatureGallery({ t, lang }: { t: (k: string) => string, lang: string }) {
  const [activeTab, setActiveTab] = useState(0);
  const isRtl = lang === 'he' || lang === 'ar' || lang === 'yi';

  const tabs = [
    { id: 'profile', label: t('step1Title'), icon: <UserIcon size={20} /> },
    { id: 'network', label: t('step2Title'), icon: <Users size={20} /> },
    { id: 'chat', label: t('step3Title'), icon: <MessageSquare size={20} /> },
  ];

  return (
    <div id="feature-gallery" className="space-y-10 py-20">
      <div className="text-center space-y-4">
        <h3 className="text-3xl sm:text-4xl font-serif font-bold text-primary">{t('galleryTitle')}</h3>
      </div>

      <div className="max-w-5xl mx-auto bg-white rounded-[40px] shadow-2xl border border-ink/5 overflow-hidden flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <div className={cn("w-full md:w-80 bg-bg p-6 flex flex-col gap-2 border-b md:border-b-0", isRtl ? "md:border-l" : "md:border-r")}>
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(i)}
              className={cn(
                "flex items-center gap-3 p-4 rounded-2xl text-sm font-bold transition-all",
                activeTab === i 
                  ? "bg-white text-primary shadow-md"
                  : "text-ink/40 hover:bg-white/50"
              )}
            >
              <div className={cn("p-2 rounded-lg transition-colors", activeTab === i ? "bg-primary/10" : "bg-ink/5")}>
                {tab.icon}
              </div>
              <span className={cn("flex-1", isRtl ? "text-right" : "text-left")}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 md:p-12 relative min-h-[450px] flex items-center justify-center bg-white">
          <AnimatePresence mode="wait">
            {activeTab === 0 && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm space-y-6"
              >
                <div className="bg-bg p-8 rounded-[40px] border border-ink/5 space-y-6 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center text-primary shadow-inner">
                      <UserIcon size={32} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-serif font-bold text-ink">Yael Weiss</h4>
                      <div className="flex gap-2">
                        <span className="px-3 py-1 bg-sky/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">{t('leaningLeft')}</span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-sky bg-sky/10 px-2 py-0.5 rounded-full">
                          <Heart size={10} fill="currentColor" />
                          <span>128</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4">
                    <p className="text-sm font-serif text-ink/70 italic leading-relaxed">
                      "{t('galleryProfileBio')}"
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-4">
                    <span className="px-3 py-1 bg-white border border-ink/5 text-primary rounded-xl text-[10px] font-bold shadow-sm">#{t('tagEnvironment')}</span>
                    <span className="px-3 py-1 bg-white border border-ink/5 text-primary rounded-xl text-[10px] font-bold shadow-sm">#{t('tagSociety')}</span>
                    <span className="px-3 py-1 bg-white border border-ink/5 text-primary rounded-xl text-[10px] font-bold shadow-sm">#Art</span>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 1 && (
              <motion.div 
                key="network"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm space-y-6"
              >
                <div className="bg-bg p-8 rounded-[40px] border border-ink/5 space-y-8 shadow-sm">
                  <div className="text-center space-y-2">
                    <h4 className="text-xl font-serif font-bold text-ink">{t('galleryNetwork')}</h4>
                    <p className="text-xs text-ink/40">{t('galleryNetworkDesc')}</p>
                  </div>
                  
                  <div className="space-y-4">
                    <button className="w-full py-4 bg-[#1877F2] text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg group transition-all hover:scale-[1.02]">
                       <Users size={20} />
                       {t('galleryConnectFb')}
                    </button>
                    <button className="w-full py-4 bg-[#0A66C2] text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg group transition-all hover:scale-[1.02]">
                       <Linkedin size={20} />
                       {t('galleryConnectLi')}
                    </button>
                  </div>

                  <div className="pt-6 border-t border-ink/5">
                    <div className="flex -space-x-3 rtl:space-x-reverse justify-center">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-primary/10 flex items-center justify-center text-primary text-[10px] font-black">
                           {String.fromCharCode(64 + i)}
                        </div>
                      ))}
                    </div>
                    <p className="text-center text-[10px] font-bold text-ink/30 mt-3 uppercase tracking-widest">+12 {t('galleryFriendsHere')}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 2 && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-sm space-y-6"
              >
                <div className="space-y-6">
                  <div className="text-center mb-4">
                    <span className="px-4 py-1.5 bg-sky/10 text-sky rounded-full text-[10px] font-black uppercase tracking-widest">{t('galleryDialogue')}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 items-start">
                    <span className="text-[11px] font-black uppercase tracking-widest text-ink/40 px-1">Itay Cohen</span>
                    <div className="bg-bg p-5 rounded-3xl rounded-bl-none max-w-[90%] text-sm font-serif italic shadow-sm border border-ink/5 text-ink/80 leading-relaxed">
                      {t('galleryChatMsg1')}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end text-right">
                    <span className="text-[11px] font-black uppercase tracking-widest text-ink/40 px-1">{t('you')}</span>
                    <div className="bg-primary text-white p-5 rounded-3xl rounded-br-none max-w-[90%] text-sm shadow-xl leading-relaxed">
                      {t('galleryChatMsg2')}
                    </div>
                  </div>
                  <div className="mt-10 bg-sky/5 p-4 rounded-3xl text-[10px] text-center text-sky font-black uppercase tracking-widest flex items-center justify-center gap-3 border border-sky/10">
                     <Shield size={14} /> {t('galleryAiModeration')}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
