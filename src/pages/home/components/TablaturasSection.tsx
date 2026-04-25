import { MonitorPlay, Play, Zap, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { tablaturas } from '@/mocks/products';
import { useAuth } from '@/hooks/useAuth';

const TablaturasSection = () => {
  const navigate = useNavigate();
  const { user, toggleFavorite } = useAuth();
  const preview = tablaturas.slice(0, 10);

  return (
    <section id="tablatura-isolada" className="pt-2 pb-2 sm:py-24 bg-[#060607]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-16 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 border border-stone-700 text-stone-400 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full mb-8 float-left sm:float-none">
            Biblioteca
          </div>
          <div className="clear-both" />
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-6 uppercase tracking-tight">
            Tablaturas
          </h2>

          {/* TABVINDE callout */}
          <div className="mt-8 flex flex-col gap-1 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-4 w-full sm:px-10 sm:py-6 text-left">
            <div className="flex items-start gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0 mt-0.5" />
              <span className="text-amber-400 font-black text-sm sm:text-base tracking-wide uppercase leading-snug">Tablatura Interativa + Vídeo Aula</span>
            </div>
            <p className="text-white text-sm leading-relaxed">
              <span className="font-bold">TABVINDE</span> — Sistema interativo de tablatura desenvolvido 100% pela Vinde Adoremos e focado para violão Fingerstyle.
            </p>
            <p className="text-white text-sm leading-relaxed">
              Acompanhe nota a nota do que está sendo tocado, ajuste a velocidade, veja e reveja trecho por trecho quantas vezes for necessário para aprender de verdade!
            </p>
            <p className="text-stone-400 text-xs leading-relaxed mt-1">
              Alunos com acesso ao plano também poderão criar e salvar suas próprias tablaturas diretamente no TABVINDE.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {preview.map((tab) => (
            <div
              key={tab.id}
              onClick={() => tab.hasVideo && navigate(`/aprender/${tab.id}`)}
              className={`group bg-stone-900/40 rounded-2xl ring-1 ring-stone-800/60 transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 isolate ${
                tab.hasVideo
                  ? 'hover:ring-stone-600 cursor-pointer'
                  : 'hover:ring-stone-700'
              }`}
            >
              {/* Cover image */}
              <div className="relative h-36 sm:h-48 overflow-hidden rounded-t-2xl">
                <img
                  src={tab.image}
                  alt={tab.title}
                  className="w-full h-full object-cover scale-[1.002] group-hover:scale-[1.07] transition-transform duration-500 transform-gpu backface-hidden"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/20 to-transparent" />
                {tab.hasVideo && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3 border border-white/30">
                      <Play className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <h3 className="text-white font-semibold text-sm sm:text-base leading-snug line-clamp-2">{tab.title}</h3>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(tab.id); }}
                    className="flex-shrink-0 p-1 -mr-1 rounded-full transition-colors duration-150"
                    aria-label="Favoritar"
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors duration-150 ${
                        user?.favorites.includes(tab.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-stone-600 hover:text-red-400'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-stone-500 text-xs sm:text-sm leading-snug truncate mb-2">{tab.composer}</p>
                {tab.hasVideo && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-bold">
                    <MonitorPlay className="w-3 h-3 flex-shrink-0" />
                    <span className="hidden sm:inline">TABVINDE + Vídeo Aula</span>
                    <span className="sm:hidden">TABVINDE</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <p className="text-stone-400 text-sm">
            <span className="text-amber-400 font-bold text-lg">+{tablaturas.length}</span> músicas disponíveis
          </p>
          <button
            onClick={() => navigate('/tablaturas')}
            className="flex-shrink-0 inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-semibold px-5 py-2.5 rounded-full transition-all duration-200"
          >
            Ver biblioteca completa
          </button>
        </div>
      </div>
    </section>
  );
};

export default TablaturasSection;
