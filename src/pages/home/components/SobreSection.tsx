import { Music, Heart, BookOpen } from 'lucide-react';

const SobreSection = () => {
  return (
    <section id="sobre" className="py-24 bg-stone-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-amber-400 text-sm font-medium tracking-widest uppercase mb-3">Nossa História</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-6">Sobre o Projeto</h2>
          <p className="text-stone-300 text-lg leading-relaxed max-w-2xl mx-auto">
            Vinde Adoremos nasceu da vontade de unir a beleza da música sacra com a expressividade do violão fingerstyle.
            Um projeto feito por músicos, para músicos que desejam levar a fé através das cordas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Music,
              title: 'Arranjos Exclusivos',
              description: 'Cada tablatura é cuidadosamente arranjada para preservar a sacralidade da música original com a beleza do fingerstyle.',
            },
            {
              icon: Heart,
              title: 'Feito com Devoção',
              description: 'Mais do que técnica, ensinamos a tocar com o coração. A música sacra pede entrega, tempo e reverência.',
            },
            {
              icon: BookOpen,
              title: 'Pedagogia Clara',
              description: 'Do iniciante ao avançado, nossas aulas têm linguagem acessível e progressão bem pensada.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="text-center p-6 bg-stone-900 rounded-2xl border border-stone-800">
              <div className="w-12 h-12 rounded-full bg-amber-600/20 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-white font-semibold mb-2">{title}</h3>
              <p className="text-stone-400 text-sm leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SobreSection;
