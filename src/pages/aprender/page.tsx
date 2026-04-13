import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Music } from 'lucide-react';
import { tablaturas } from '@/mocks/products';
import Navbar from '@/components/feature/Navbar';

// Placeholder tablature page — represents one page of sheet music
const TablaturaPlaceholder = ({ page, total, title }: { page: number; total: number; title: string }) => (
  <div className="w-full bg-stone-950 border border-stone-800/80 rounded-2xl overflow-hidden">
    {/* Page header */}
    <div className="flex items-center justify-between px-6 py-3 border-b border-stone-800/60">
      <span className="text-stone-500 text-xs font-medium tracking-wide uppercase">{title}</span>
      <span className="text-stone-600 text-xs">Página {page} de {total}</span>
    </div>

    {/* Mock staff lines */}
    <div className="px-8 py-10 space-y-10">
      {[0, 1, 2, 3].map((system) => (
        <div key={system} className="space-y-1.5">
          {/* 6 strings */}
          {[0, 1, 2, 3, 4, 5].map((string) => (
            <div
              key={string}
              className="h-px bg-stone-700/60 w-full relative"
            >
              {/* Random fret numbers as decoration */}
              {[0, 1, 2, 3, 4, 5, 6, 7].map((beat) => {
                const hasNote = (page * 17 + system * 7 + string * 3 + beat * 11) % 5 !== 0;
                const fret = ((page * 13 + system * 5 + string * 7 + beat * 3) % 12);
                return hasNote ? (
                  <span
                    key={beat}
                    className="absolute -top-2.5 text-stone-400 text-xs font-mono"
                    style={{ left: `${8 + beat * 11.5}%` }}
                  >
                    {fret}
                  </span>
                ) : null;
              })}
            </div>
          ))}
          {/* Measure bar indicator */}
          <div className="flex justify-between mt-2">
            {[0, 1, 2, 3].map((m) => (
              <div key={m} className="h-8 w-px bg-stone-700/40" />
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* Page footer */}
    <div className="px-6 py-3 border-t border-stone-800/60 flex items-center gap-2 text-stone-600 text-xs">
      <Music className="w-3 h-3" />
      <span>Vinde Adoremos · {title}</span>
    </div>
  </div>
);

const AprenderPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);

  const tab = tablaturas.find((t) => t.id === Number(id));

  if (!tab) {
    return (
      <div className="min-h-screen bg-[#060607] flex flex-col items-center justify-center gap-4">
        <p className="text-stone-400">Tablatura não encontrada.</p>
        <button
          onClick={() => navigate('/tablaturas')}
          className="text-white underline text-sm"
        >
          Voltar à biblioteca
        </button>
      </div>
    );
  }

  const totalPages = tab.pages;

  return (
    <div className="min-h-screen bg-[#060607]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-24">

        {/* Back nav */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-stone-500 hover:text-white text-sm transition-colors duration-200 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-1">
            {tab.title}
          </h1>
          <p className="text-stone-400 text-sm">{tab.composer}</p>
        </div>

        {/* Main layout — sticky video left, scrollable tabs right on large screens */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* LEFT — Video player (sticky on large screens) */}
          <div className="w-full lg:w-[55%] lg:sticky lg:top-24">

            {/* 16:9 video container */}
            <div className="relative w-full aspect-video bg-stone-950 rounded-2xl overflow-hidden border border-stone-800/60 shadow-2xl shadow-black/60">
              {tab.videoId ? (
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${tab.videoId}?rel=0&modestbranding=1`}
                  title={tab.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                // Placeholder when no video is linked yet
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-950">
                  <img
                    src={tab.image}
                    alt={tab.title}
                    className="absolute inset-0 w-full h-full object-cover opacity-20"
                  />
                  <div className="relative z-10 flex flex-col items-center gap-3 text-center px-8">
                    <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                      <Music className="w-7 h-7 text-stone-300" />
                    </div>
                    <p className="text-stone-300 font-semibold text-sm">Vídeo aula em breve</p>
                    <p className="text-stone-500 text-xs max-w-xs">
                      A gravação desta aula está sendo finalizada e estará disponível em breve.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Video info strip */}
            <div className="mt-4 flex items-center justify-between text-xs text-stone-500">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                {tab.pages} páginas de tablatura
              </span>
              <span>Página {currentPage} de {totalPages}</span>
            </div>
          </div>

          {/* RIGHT — Scrollable tablature pages */}
          <div className="w-full lg:w-[45%] flex flex-col gap-6">

            {/* Section label */}
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 border border-stone-700 text-stone-400 text-xs font-medium tracking-widest uppercase px-3 py-1.5 rounded-full">
                Tablatura
              </div>
              <div className="flex-1 h-px bg-stone-800" />
            </div>

            {/* Navigate pages */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-full border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-stone-400 text-sm flex-1 text-center">
                Página <span className="text-white font-semibold">{currentPage}</span> de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-full border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Current tablature page */}
            <TablaturaPlaceholder
              page={currentPage}
              total={totalPages}
              title={tab.title}
            />

            {/* Page dots */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`rounded-full transition-all duration-200 ${
                      p === currentPage
                        ? 'w-4 h-2 bg-white'
                        : 'w-2 h-2 bg-stone-700 hover:bg-stone-500'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AprenderPage;
