-- Varios torneos en la misma BD y partidos al mejor de N sets.
-- No borra datos: todo lo existente queda asociado al torneo 1 (Campeonato Mary).
-- Los DEFAULT 1 permiten que una versión anterior de la app siga funcionando mientras se despliega la nueva.

-- ── Torneo: identificador público (slug), formato y organizador ──
ALTER TABLE torneo
  MODIFY id INT NOT NULL AUTO_INCREMENT,
  ADD COLUMN slug VARCHAR(60) NULL AFTER id,
  ADD COLUMN formato VARCHAR(30) NOT NULL DEFAULT 'ranked16' AFTER subtitulo,
  ADD COLUMN organizador VARCHAR(100) NULL AFTER formato,
  ADD COLUMN es_prueba TINYINT(1) NOT NULL DEFAULT 0 AFTER organizador,
  ADD COLUMN creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE torneo SET slug = 'campeonato-mary' WHERE id = 1;

ALTER TABLE torneo
  MODIFY slug VARCHAR(60) NOT NULL,
  ADD UNIQUE KEY uk_torneo_slug (slug);

-- ── Grupos: el nombre ya no es único global, sino por torneo ──
ALTER TABLE grupos
  ADD COLUMN torneo_id INT NOT NULL DEFAULT 1 AFTER id,
  DROP INDEX nombre,
  ADD UNIQUE KEY uk_grupos_torneo_nombre (torneo_id, nombre),
  ADD CONSTRAINT fk_grupos_torneo FOREIGN KEY (torneo_id) REFERENCES torneo (id) ON DELETE CASCADE;

ALTER TABLE parejas
  ADD COLUMN torneo_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD KEY idx_parejas_torneo (torneo_id),
  ADD CONSTRAINT fk_parejas_torneo FOREIGN KEY (torneo_id) REFERENCES torneo (id) ON DELETE CASCADE;

-- ── Partidos: torneo y sets. sets_* y detalle_sets quedan NULL en partidos a set único ──
ALTER TABLE partidos
  ADD COLUMN torneo_id INT NOT NULL DEFAULT 1 AFTER id,
  ADD COLUMN sets_pareja1 TINYINT NULL AFTER puntos_pareja2,
  ADD COLUMN sets_pareja2 TINYINT NULL AFTER sets_pareja1,
  ADD COLUMN detalle_sets JSON NULL AFTER sets_pareja2,
  -- Marcador en vivo desde la pantalla del árbitro: en_juego = 1 y detalle_sets con el set en curso al final.
  -- No cuenta para la tabla hasta que el árbitro finaliza el partido (jugado = 1).
  ADD COLUMN en_juego TINYINT(1) NOT NULL DEFAULT 0 AFTER jugado,
  ADD KEY idx_partidos_torneo_fase (torneo_id, fase),
  ADD CONSTRAINT fk_partidos_torneo FOREIGN KEY (torneo_id) REFERENCES torneo (id) ON DELETE CASCADE;

-- ── Posiciones por torneo y grupo. Gana quien gana más sets; sin sets, quien hace más puntos ──
CREATE OR REPLACE SQL SECURITY INVOKER VIEW vista_posiciones AS
SELECT
  p.torneo_id AS torneo_id,
  g.id AS grupo_id,
  g.nombre AS nombre_grupo,
  pa.id AS pareja_id,
  pa.nombre AS nombre_pareja,
  pa.cabeza_serie AS cabeza_serie,
  COALESCE(SUM(CASE
    WHEN p.jugado = 1 AND p.pareja1_id = pa.id AND IF(p.sets_pareja1 IS NULL, p.puntos_pareja1 > p.puntos_pareja2, p.sets_pareja1 > p.sets_pareja2) THEN 1
    WHEN p.jugado = 1 AND p.pareja2_id = pa.id AND IF(p.sets_pareja1 IS NULL, p.puntos_pareja2 > p.puntos_pareja1, p.sets_pareja2 > p.sets_pareja1) THEN 1
    ELSE 0 END), 0) AS pg,
  COALESCE(SUM(CASE
    WHEN p.jugado = 1 AND p.pareja1_id = pa.id THEN COALESCE(p.sets_pareja1, 0)
    WHEN p.jugado = 1 AND p.pareja2_id = pa.id THEN COALESCE(p.sets_pareja2, 0)
    ELSE 0 END), 0) AS sets_favor,
  COALESCE(SUM(CASE
    WHEN p.jugado = 1 AND p.pareja1_id = pa.id THEN COALESCE(p.sets_pareja2, 0)
    WHEN p.jugado = 1 AND p.pareja2_id = pa.id THEN COALESCE(p.sets_pareja1, 0)
    ELSE 0 END), 0) AS sets_contra,
  COALESCE(SUM(CASE
    WHEN p.jugado = 1 AND p.pareja1_id = pa.id THEN p.puntos_pareja1
    WHEN p.jugado = 1 AND p.pareja2_id = pa.id THEN p.puntos_pareja2
    ELSE 0 END), 0) AS puntos_favor,
  COALESCE(SUM(CASE
    WHEN p.jugado = 1 AND p.pareja1_id = pa.id THEN p.puntos_pareja2
    WHEN p.jugado = 1 AND p.pareja2_id = pa.id THEN p.puntos_pareja1
    ELSE 0 END), 0) AS puntos_contra,
  COALESCE(SUM(CASE
    WHEN p.jugado = 1 AND p.pareja1_id = pa.id THEN p.puntos_pareja1 - p.puntos_pareja2
    WHEN p.jugado = 1 AND p.pareja2_id = pa.id THEN p.puntos_pareja2 - p.puntos_pareja1
    ELSE 0 END), 0) AS diferencia_puntos
FROM partidos p
JOIN grupos g ON p.grupo_id = g.id
JOIN parejas pa ON pa.id = p.pareja1_id OR pa.id = p.pareja2_id
GROUP BY p.torneo_id, g.id, g.nombre, pa.id, pa.nombre, pa.cabeza_serie;
