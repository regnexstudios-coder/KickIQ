/** Spanish: partial for now; any missing key falls back to English. */
const es = {
  common: {
    continue: 'Continuar',
    back: 'Atrás',
    next: 'Siguiente',
    done: 'Listo',
    cancel: 'Cancelar',
    retry: 'Reintentar',
    save: 'Guardar',
    share: 'Compartir',
    close: 'Cerrar',
    loading: 'Cargando…',
  },
  kicks: {
    driven: 'Tiro raso potente',
    curler: 'Tiro con efecto / Falta',
    knuckleball: 'Knuckleball',
    chip: 'Vaselina',
  },
  home: {
    rate: 'Califica mi tiro',
    rateSub: 'Graba o importa un clip de 5–15 s',
  },
  splash: { tagline: 'Graba un tiro. Recibe tu nota.' },
} as const;

export default es;
