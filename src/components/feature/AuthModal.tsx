import { useState } from 'react';
import { X, Mail, Lock, Eye, EyeOff, Chrome } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  onClose: () => void;
}

type Mode = 'login' | 'signup' | 'reset';

const AuthModal = ({ onClose }: AuthModalProps) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();

      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        setSuccess('Verifique seu e-mail para confirmar o cadastro.');

      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/perfil`,
        });
        if (error) throw error;
        setSuccess('Link de redefinição enviado para seu e-mail.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocorreu um erro.';
      setError(
        msg.includes('Invalid login credentials') ? 'E-mail ou senha incorretos.' :
        msg.includes('Email not confirmed') ? 'Confirme seu e-mail antes de entrar.' :
        msg.includes('User already registered') ? 'Este e-mail já está cadastrado.' :
        msg
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-stone-950 border border-stone-800 rounded-3xl p-8 shadow-2xl shadow-black/60">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-600 hover:text-white transition-colors duration-150"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-black text-white">
            {mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Redefinir senha'}
          </h2>
          <p className="text-stone-500 text-sm mt-1">
            {mode === 'login' ? 'Acesse sua conta Vinde Adoremos' :
             mode === 'signup' ? 'Comece a aprender fingerstyle hoje' :
             'Enviaremos um link para seu e-mail'}
          </p>
        </div>

        {/* Google */}
        {mode !== 'reset' && (
          <>
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 border border-stone-700 hover:border-stone-500 text-stone-300 hover:text-white py-3 rounded-2xl text-sm font-medium transition-all duration-200 mb-6"
            >
              <Chrome className="w-4 h-4" />
              Continuar com Google
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-stone-800" />
              <span className="text-stone-600 text-xs">ou</span>
              <div className="flex-1 h-px bg-stone-800" />
            </div>
          </>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <div className="relative">
              <input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-stone-900 border border-stone-800 focus:border-stone-600 rounded-2xl px-4 py-3 text-white text-sm placeholder-stone-600 outline-none transition-colors duration-200"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-stone-900 border border-stone-800 focus:border-stone-600 rounded-2xl pl-11 pr-4 py-3 text-white text-sm placeholder-stone-600 outline-none transition-colors duration-200"
            />
          </div>

          {mode !== 'reset' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-stone-900 border border-stone-800 focus:border-stone-600 rounded-2xl pl-11 pr-11 py-3 text-white text-sm placeholder-stone-600 outline-none transition-colors duration-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-xs px-1">{error}</p>}
          {success && <p className="text-emerald-400 text-xs px-1">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-bold py-3 rounded-2xl text-sm transition-all duration-200"
          >
            {loading ? 'Aguarde...' :
             mode === 'login' ? 'Entrar' :
             mode === 'signup' ? 'Criar conta' :
             'Enviar link'}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 flex flex-col items-center gap-2">
          {mode === 'login' && (
            <>
              <button onClick={() => { setMode('reset'); setError(null); }} className="text-stone-500 hover:text-stone-300 text-xs transition-colors duration-150">
                Esqueci minha senha
              </button>
              <button onClick={() => { setMode('signup'); setError(null); }} className="text-stone-400 hover:text-white text-xs transition-colors duration-150">
                Não tem conta? <span className="text-amber-400 font-semibold">Cadastre-se</span>
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button onClick={() => { setMode('login'); setError(null); }} className="text-stone-400 hover:text-white text-xs transition-colors duration-150">
              Já tem conta? <span className="text-amber-400 font-semibold">Entrar</span>
            </button>
          )}
          {mode === 'reset' && (
            <button onClick={() => { setMode('login'); setError(null); }} className="text-stone-400 hover:text-white text-xs transition-colors duration-150">
              Voltar ao login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
