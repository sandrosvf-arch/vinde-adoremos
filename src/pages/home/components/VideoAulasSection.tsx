import { Play, Clock, Lock } from 'lucide-react';
import { videoAulas } from '@/mocks/products';

const difficultyColor: Record<string, string> = {
  Iniciante: 'bg-emerald-900/60 text-emerald-300',
  Intermediário: 'bg-amber-900/60 text-amber-300',
  Avançado: 'bg-rose-900/60 text-rose-300',
};

const VideoAulasSection = () => {
  return (
    <section id="tablatura-video" className="py-24 bg-stone-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm font-medium tracking-widest uppercase mb-3">Aprenda</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Vídeo Aulas</h2>
          <p className="text-stone-400 text-lg max-w-xl mx-auto">
            Aulas passo a passo com foco em técnica e expressão musical sacra.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videoAulas.map((video) => (
            <div
              key={video.id}
              className="group relative bg-stone-900 rounded-xl overflow-hidden border border-stone-800 hover:border-amber-600/50 transition-all duration-300 hover:-translate-y-1"
            >
              {/* Thumbnail */}
              <div className="relative h-44 overflow-hidden">
                <img
                  src={video.image}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-stone-950/40 flex items-center justify-center">
                  {video.included ? (
                    <div className="w-12 h-12 rounded-full bg-amber-600/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-stone-800/90 flex items-center justify-center">
                      <Lock className="w-5 h-5 text-stone-400" />
                    </div>
                  )}
                </div>

                {/* Difficulty badge */}
                <span
                  className={`absolute top-3 left-3 text-xs font-medium px-2 py-1 rounded-full ${difficultyColor[video.difficulty]}`}
                >
                  {video.difficulty}
                </span>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-white font-semibold text-sm mb-1 leading-tight">{video.title}</h3>
                <p className="text-stone-400 text-xs mb-3 leading-tight">{video.composer}</p>

                <div className="flex items-center gap-2 mb-4 text-xs text-stone-500">
                  <Clock className="w-3 h-3" />
                  <span>{video.duration}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-semibold text-sm">{video.price}</span>
                  <button className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-full transition-colors">
                    {video.included ? 'Assistir' : 'Comprar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default VideoAulasSection;
