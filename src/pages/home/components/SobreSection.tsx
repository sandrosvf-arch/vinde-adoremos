import { Music, Heart, BookOpen } from 'lucide-react';

const SobreSection = () => {
  return (
    <section id="sobre" className="pt-10 pb-24 sm:py-24 bg-stone-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 border border-stone-700 text-stone-400 text-xs font-medium tracking-widest uppercase px-4 py-2 rounded-full mb-8">
            História
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-6">
            Sobre o Projeto
          </h2>
          <p className="text-stone-300 text-base leading-relaxed mb-3">
            A Vinde Adoremos nasceu do desejo de unir a beleza dos cânticos de Igreja com a profundidade do violão fingerstyle.
          </p>
          <p className="text-stone-300 text-base leading-relaxed mb-3">
            Mais do que aprender músicas, aqui você aprende a adorar e expressar o sentimento da alma a cada nota.
          </p>
          <p className="text-stone-300 text-base leading-relaxed">
            É um projeto feito para os que acreditam que o violão pode ir além da técnica e se tornar um instrumento de oração e adoração!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Music,
              emoji: '🎵',
              title: 'Arranjos Exclusivos',
              lines: [
                'Cada música é cuidadosamente trabalhada para manter a essência original, enquanto ganha uma nova vida no fingerstyle.',
                'Você não apenas toca… você interpreta e transmite.',
              ],
            },
            {
              icon: Heart,
              emoji: '❤️',
              title: 'Feito com Devoção',
              lines: [
                'Aqui, a técnica não vem sozinha.',
                'Ensinamos você a tocar com intenção, sensibilidade e reverência, porque a música não é só som, é oração em forma de melodia.',
              ],
            },
            {
              icon: BookOpen,
              emoji: '📖',
              title: 'Método de ensino único',
              lines: [
                'Você terá acesso a métodos únicos e tablaturas interativas pensadas para que você aprenda de verdade.',
                'Sem complicação, sem travas! Um caminho claro para você tocar com confiança e propósito.',
              ],
            },
          ].map(({ icon: Icon, emoji, title, lines }) => (
            <div key={title} className="p-6 bg-stone-900 rounded-2xl border border-stone-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-600/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-white font-bold text-base">{title}</h3>
              </div>
              {lines.map((line, i) => (
                <p key={i} className="text-stone-400 text-sm leading-relaxed mb-2 last:mb-0">{line}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SobreSection;
