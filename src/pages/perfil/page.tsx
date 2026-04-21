import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, BookOpen, Guitar, UserCircle, Lock, Camera, LogOut } from 'lucide-react';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/hooks/useAuth';
import { tablaturas } from '@/mocks/products';

type Tab = 'favoritos' | 'aprendendo' | 'minhas';

const PerfilPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('favoritos');

  if (!user) {
    return (
      <div className="min-h-screen bg-[#060607]">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 pt-40 pb-24 text-center">
          <Lock className="w-12 h-12 text-stone-600 mx-auto mb-6" />
          <h1 className="text-3xl font-black text-white mb-4">Área restrita</h1>
          <p className="text-stone-400 mb-8">Faça login para acessar seu perfil.</p>
          <button
            onClick={() => navigate('/')}
            className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-8 py-3 rounded-full transition-all duration-200"
          >
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
  // user_tabs created by user will come from Supabase — empty for now
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

  return (
    <div className="min-h-screen bg-[#060607]">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-32 pb-24">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-stone-300 hover:text-white text-sm font-semibold border border-stone-700 hover:border-stone-500 px-4 py-2 rounded-full transition-all duration-200 mb-12"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* Profile header */}
        <div className="flex items-center gap-6 mb-12">
          <div className="relative group flex-shrink-0">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-20 h-20 rounded-full object-cover ring-2 ring-amber-500"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-stone-800 ring-2 ring-stone-700 flex items-center justify-center">
                <UserCircle className="w-10 h-10 text-stone-500" />
              </div>
            )}
            {/* Change photo button — Supabase storage upload hook here */}
            <button
              className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200"
              aria-label="Trocar foto"
            >
              <Camera className="w-5 h-5 text-white" />
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">{user.name}</h1>
            {user.plan && (
              <span className="inline-flex mt-1 text-xs font-bold text-amber-400 border border-amber-500/40 px-3 py-1 rounded-full uppercase tracking-wider">
                Plano {user.plan}
              </span>
            )}
          </div>
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            className="ml-auto flex items-center gap-2 text-stone-500 hover:text-red-400 text-sm transition-colors duration-200"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8">
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
              <button
                onClick={() => navigate('/tabmaker')}
                className="mt-6 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-6 py-2.5 rounded-full text-sm transition-all duration-200"
              >
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
                className={`group bg-stone-900/40 rounded-2xl ring-1 ring-stone-800/60 transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 isolate ${
                  tab.hasVideo ? 'hover:ring-stone-600 cursor-pointer' : ''
                }`}
              >
                <div className="relative h-32 overflow-hidden rounded-t-2xl">
                  <img
                    src={tab.image}
                    alt={tab.title}
                    className="w-full h-full object-cover group-hover:scale-[1.07] transition-transform duration-500"
                  />
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
