import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clock, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import Navbar from '@/components/feature/Navbar';
import Footer from '@/components/feature/Footer';
import { useAuth } from '@/hooks/useAuth';
import { planos } from '@/mocks/products';

function getDaysRemaining(expiresAt?: string): number | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

const AssinaturaPage = () => {
  const navigate = useNavigate();
  const { user, isActive } = useAuth();
  const daysLeft = getDaysRemaining(user?.expiresAt);
  const plan = planos.find((p) => p.name.toLowerCase().startsWith(user?.plan ?? ''));

  // Não logado
  if (!user) {
    return (
      <div className="min-h-screen bg-[#060607]">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 pt-40 pb-24 text-center">
          <Lock className="w-12 h-12 text-stone-600 mx-auto mb-6" />
          <h1 className="text-3xl font-black text-white mb-4">Área restrita</h1>
          <p className="text-stone-400 mb-8">Faça login para ver os detalhes da sua assinatura.</p>
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

  const progressPct = (() => {
    if (!user.subscribedAt || !user.expiresAt) return 0;
    const total = new Date(user.expiresAt).getTime() - new Date(user.subscribedAt).getTime();
    const elapsed = Date.now() - new Date(user.subscribedAt).getTime();
    return Math.min(100, Math.round((elapsed / total) * 100));
  })();

  return (
    <div className="min-h-screen bg-[#060607]">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-32 pb-24">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-stone-300 hover:text-white text-sm font-semibold border border-stone-700 hover:border-stone-500 px-4 py-2 rounded-full transition-all duration-200 mb-12"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 border border-stone-700 text-stone-400 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full mb-6">
            Minha Conta
          </div>
          <h1 className="text-4xl font-black text-white leading-tight">Assinatura</h1>
        </div>

        {/* Status card */}
        <div className={`rounded-2xl p-6 mb-6 border ${isActive ? 'bg-stone-900/50 border-stone-800' : 'bg-red-950/20 border-red-900/40'}`}>
          <div className="flex items-center gap-3 mb-6">
            {isActive
              ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            }
            <span className={`font-semibold text-lg ${isActive ? 'text-white' : 'text-red-400'}`}>
              {isActive ? 'Assinatura ativa' : 'Assinatura vencida'}
            </span>
            {plan && (
              <span className="ml-auto text-xs font-bold text-amber-400 border border-amber-500/40 px-3 py-1 rounded-full uppercase tracking-wider">
                {plan.name}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {user.subscribedAt && user.expiresAt && (
            <div className="mb-6">
              <div className="flex justify-between text-xs text-stone-500 mb-2">
                <span>Início: {formatDate(user.subscribedAt)}</span>
                <span>Vencimento: {formatDate(user.expiresAt)}</span>
              </div>
              <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isActive ? 'bg-amber-500' : 'bg-red-600'}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Days remaining */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-stone-950/60 rounded-xl p-4">
              <div className="flex items-center gap-2 text-stone-500 text-xs mb-1">
                <Clock className="w-3.5 h-3.5" />
                Dias restantes
              </div>
              <p className="text-3xl font-black text-white">{daysLeft ?? '—'}</p>
            </div>
            <div className="bg-stone-950/60 rounded-xl p-4">
              <div className="flex items-center gap-2 text-stone-500 text-xs mb-1">
                <CalendarDays className="w-3.5 h-3.5" />
                Vence em
              </div>
              <p className="text-sm font-semibold text-white leading-tight">{formatDate(user.expiresAt)}</p>
            </div>
          </div>
        </div>

        {/* Features included */}
        {plan && (
          <div className="rounded-2xl bg-stone-900/50 border border-stone-800 p-6 mb-6">
            <h2 className="text-white font-semibold mb-4 text-sm tracking-wide uppercase text-stone-400">Incluído no seu plano</h2>
            <ul className="flex flex-col gap-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-stone-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Renew CTA */}
        <button
          onClick={() => navigate('/')}
          className="w-full bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold py-4 rounded-2xl text-base transition-all duration-200"
        >
          {isActive ? 'Renovar / Fazer upgrade' : 'Reativar assinatura'}
        </button>
      </main>

      <Footer />
    </div>
  );
};

export default AssinaturaPage;
