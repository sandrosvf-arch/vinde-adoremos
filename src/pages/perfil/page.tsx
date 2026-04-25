import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, BookOpen, Guitar, UserCircle, Lock, Camera, LogOut, Pencil, Check, X, CalendarDays, Clock } from 'lucide-react';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/hooks/useAuth';
import { tablaturas } from '@/mocks/products';

type Tab = 'favoritos' | 'aprendendo' | 'minhas';

const PerfilPage = () => {
  const navigate = useNavigate();
  const { user, loading, signOut, updateName, updateAvatar } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('favoritos');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ainda carregando — mostra skeleton em vez de área restrita
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060607]">
        <Navbar />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-32 pb-24">
          <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-6 sm:p-8 animate-pulse">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-full bg-stone-800 flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-6 bg-stone-800 rounded-lg w-40" />
                <div className="h-4 bg-stone-800 rounded-lg w-24" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#060607]">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 pt-40 pb-24 text-center">
          <Lock className="w-12 h-12 text-stone-600 mx-auto mb-6" />
          <h1 className="text-3xl font-black text-white mb-4">Área restrita</h1>
          <p className="text-stone-400 mb-8">Faça login para acessar seu perfil.</p>
          <button onClick={() => navigate('/')} className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-8 py-3 rounded-full transition-all duration-200">
            Voltar ao início
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  const favoriteTabs = tablaturas.filter((t) => user.favorites.includes(t.id));
  const learningTabs = tablaturas.filter((t) =>
    user.progress.some((p) => p.tabId === t.id && p.status === 'learning')
  );
  const myTabs: typeof tablaturas = [];

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'favoritos', label: 'Favoritos', icon: <Heart className="w-4 h-4" />, count: favoriteTabs.length },
    { id: 'aprendendo', label: 'Aprendendo', icon: <BookOpen className="w-4 h-4" />, count: learningTabs.length },
    { id: 'minhas', label: 'Minhas tabs', icon: <Guitar className="w-4 h-4" />, count: myTabs.length },
  ];

  const currentList =
    activeTab === 'favoritos' ? favoriteTabs :
    activeTab === 'aprendendo' ? learningTabs :
    myTabs;

  const handleStartEditName = () => {
    setNameValue(user.name);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue.trim() === user.name) { setEditingName(false); return; }
    setSavingName(true);
    await updateName(nameValue.trim());
    setSavingName(false);
    setEditingName(false);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    await updateAvatar(file);
    setUploadingAvatar(false);
  };

  // Subscription info
  const hasActivePlan = !!user.plan && !!user.expiresAt;
  const expiresAt = user.expiresAt ? new Date(user.expiresAt) : null;
  const subscribedAt = user.subscribedAt ? new Date(user.subscribedAt) : null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : 0;
  const totalDays = (expiresAt && subscribedAt)
    ? Math.ceil((expiresAt.getTime() - subscribedAt.getTime()) / 86400000)
    : (user.plan === 'anual' ? 365 : 180);
  const progressPct = hasActivePlan ? Math.min(100, Math.round(((totalDays - daysLeft) / totalDays) * 100)) : 0;

  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-[#060607]">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-32 pb-24">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-stone-300 hover:text-white text-sm font-semibold border border-stone-700 hover:border-stone-500 px-4 py-2 rounded-full transition-all duration-200 mb-10"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* ── Profile card ── */}
        <div className="bg-stone-900/50 border border-stone-800 rounded-3xl p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              {uploadingAvatar ? (
                <div className="w-24 h-24 rounded-full bg-stone-800 ring-2 ring-amber-500 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-full object-cover ring-2 ring-amber-500" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-stone-800 ring-2 ring-stone-700 flex items-center justify-center">
                  <UserCircle className="w-12 h-12 text-stone-500" />
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity duration-200"
                aria-label="Trocar foto"
              >
                <Camera className="w-5 h-5 text-white" />
                <span className="text-white text-[10px] font-medium">Trocar</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Name + plan */}
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                    className="bg-stone-800 border border-stone-600 focus:border-amber-500 outline-none text-white text-xl font-bold rounded-lg px-3 py-1.5 w-full max-w-xs"
                  />
                  <button onClick={handleSaveName} disabled={savingName} className="w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-400 flex items-center justify-center flex-shrink-0 transition-colors">
                    <Check className="w-4 h-4 text-stone-950" />
                  </button>
                  <button onClick={() => setEditingName(false)} className="w-8 h-8 rounded-full bg-stone-700 hover:bg-stone-600 flex items-center justify-center flex-shrink-0 transition-colors">
                    <X className="w-4 h-4 text-stone-300" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group/name">
                  <h1 className="text-2xl font-black text-white truncate">{user.name}</h1>
                  <button onClick={handleStartEditName} className="opacity-0 group-hover/name:opacity-100 w-7 h-7 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center transition-all flex-shrink-0" aria-label="Editar nome">
                    <Pencil className="w-3.5 h-3.5 text-stone-400" />
                  </button>
                </div>
              )}

              {user.plan ? (
                <span className="inline-flex mt-2 text-xs font-bold text-amber-400 border border-amber-500/40 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-wider">
                  Plano {user.plan}
                </span>
              ) : (
                <span className="inline-flex mt-2 text-xs font-medium text-stone-500 border border-stone-700 px-3 py-1 rounded-full">
                  Sem assinatura ativa
                </span>
              )}
            </div>

            <button
              onClick={async () => { await signOut(); navigate('/'); }}
              className="flex items-center gap-2 text-stone-500 hover:text-red-400 text-sm transition-colors duration-200 flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>

        {/* ── Subscription card ── */}
        <div className={`border rounded-3xl p-6 sm:p-8 mb-8 ${hasActivePlan ? 'bg-amber-500/5 border-amber-500/30' : 'bg-stone-900/30 border-stone-800'}`}>
          <h2 className="text-sm font-bold text-stone-400 uppercase tracking-wider mb-4">Assinatura</h2>
          {hasActivePlan ? (
            <>
              <div className="flex flex-wrap gap-6 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="w-4.5 h-4.5 text-amber-400 w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-500 uppercase tracking-wide">Expira em</p>
                    <p className="text-sm font-bold text-white">{fmt(expiresAt!)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[11px] text-stone-500 uppercase tracking-wide">Dias restantes</p>
                    <p className="text-sm font-bold text-white">{daysLeft} dias</p>
                  </div>
                </div>
                {subscribedAt && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-stone-800 flex items-center justify-center flex-shrink-0">
                      <CalendarDays className="w-4 h-4 text-stone-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500 uppercase tracking-wide">Início</p>
                      <p className="text-sm font-bold text-white">{fmt(subscribedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-stone-500">
                  <span>{progressPct}% utilizado</span>
                  <span>{daysLeft} dias restantes</span>
                </div>
                <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
              {daysLeft <= 30 && (
                <button
                  onClick={() => navigate('/assinatura')}
                  className="mt-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-6 py-2.5 rounded-full text-sm transition-all duration-200"
                >
                  Renovar assinatura
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-stone-400 text-sm">Assine para acessar todas as tablaturas e recursos.</p>
              <button
                onClick={() => navigate('/assinatura')}
                className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-6 py-2.5 rounded-full text-sm transition-all duration-200 flex-shrink-0"
              >
                Ver planos
              </button>
            </div>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === t.id
                  ? 'bg-white text-stone-950'
                  : 'border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.id ? 'bg-stone-200 text-stone-900' : 'bg-stone-800 text-stone-400'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {currentList.length === 0 ? (
          <div className="text-center py-20 text-stone-600">
            <p className="text-sm">
              {activeTab === 'favoritos' && 'Nenhuma tablatura favoritada ainda.'}
              {activeTab === 'aprendendo' && 'Você não está aprendendo nenhuma tablatura.'}
              {activeTab === 'minhas' && 'Você ainda não criou nenhuma tablatura no TABVINDE.'}
            </p>
            {activeTab === 'minhas' && (
              <button onClick={() => navigate('/tabmaker')} className="mt-6 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-6 py-2.5 rounded-full text-sm transition-all duration-200">
                Criar no TABVINDE
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            {currentList.map((tab) => (
              <div
                key={tab.id}
                onClick={() => tab.hasVideo && navigate(`/aprender/${tab.id}`)}
                className={`group bg-stone-900/40 rounded-2xl ring-1 ring-stone-800/60 transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 isolate ${tab.hasVideo ? 'hover:ring-stone-600 cursor-pointer' : ''}`}
              >
                <div className="relative h-32 overflow-hidden rounded-t-2xl">
                  <img src={tab.image} alt={tab.title} className="w-full h-full object-cover group-hover:scale-[1.07] transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/20 to-transparent" />
                </div>
                <div className="p-3">
                  <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2">{tab.title}</h3>
                  <p className="text-stone-500 text-xs truncate mt-0.5">{tab.composer}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default PerfilPage;
