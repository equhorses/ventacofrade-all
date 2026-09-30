import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Church, X, ZoomIn } from 'lucide-react';

// Galería del anuncio: foto grande + todas las miniaturas; al pulsar la foto se abre a pantalla completa
// (flechas, teclado y deslizar el dedo en el móvil).
export default function ProductGallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = images.length;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, go]);

  if (!count) {
    return (
      <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center">
        <Church className="h-20 w-20 text-muted-foreground/30" />
      </div>
    );
  }

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40 && count > 1) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  return (
    <>
      <div
        className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden group cursor-zoom-in"
        onClick={() => setOpen(true)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img src={images[index]} alt={`${title} (foto ${index + 1})`} className="w-full h-full object-contain" />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
          <ZoomIn className="h-3.5 w-3.5" /> {count > 1 ? `${index + 1} / ${count}` : 'Ampliar'}
        </span>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-80 hover:opacity-100 cursor-pointer"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Foto siguiente"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white opacity-80 hover:opacity-100 cursor-pointer"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="grid grid-cols-5 gap-2 mt-2">
          {images.map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={`aspect-square bg-muted rounded overflow-hidden cursor-pointer border-2 transition-colors ${
                i === index ? 'border-primary' : 'border-transparent hover:border-primary/40'
              }`}
            >
              <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setOpen(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label={`Fotos de ${title}`}
        >
          <img
            src={images[index]}
            alt={`${title} (foto ${index + 1})`}
            className="max-w-[95vw] max-h-[88vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 cursor-pointer"
              >
                <ChevronLeft className="h-7 w-7" />
              </button>
              <button
                type="button"
                aria-label="Foto siguiente"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 cursor-pointer"
              >
                <ChevronRight className="h-7 w-7" />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
                {index + 1} / {count}
              </span>
            </>
          )}
        </div>
      )}
    </>
  );
}
