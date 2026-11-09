-- Cronómetro por set controlado por el árbitro (los tiempos los pone el servidor, en ms epoch).
-- reloj_estado: NULL (sin empezar) | 'en_juego' | 'pausado' | 'entre_sets'
-- reloj_inicio: cuándo arrancó el tramo actual (solo con 'en_juego')
-- reloj_acumulado: ms del set actual acumulados antes de la última pausa
-- duracion_sets: ms de cada set ya cerrado, en orden
ALTER TABLE partidos
  ADD COLUMN reloj_estado VARCHAR(12) NULL AFTER en_juego,
  ADD COLUMN reloj_inicio BIGINT NULL AFTER reloj_estado,
  ADD COLUMN reloj_acumulado INT NOT NULL DEFAULT 0 AFTER reloj_inicio,
  ADD COLUMN duracion_sets JSON NULL AFTER reloj_acumulado;
