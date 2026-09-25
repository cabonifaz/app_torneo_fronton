-- Soporte para torneos con marca Ranked: cabezas de serie y nombre del torneo.

ALTER TABLE parejas ADD COLUMN cabeza_serie TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE torneo (
  id INT NOT NULL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  subtitulo VARCHAR(150) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE OR REPLACE SQL SECURITY INVOKER VIEW vista_posiciones AS
SELECT
  g.nombre AS nombre_grupo,
  pa.id AS pareja_id,
  pa.nombre AS nombre_pareja,
  pa.cabeza_serie AS cabeza_serie,
  COALESCE(SUM(CASE
    WHEN p.jugado = 1 AND p.pareja1_id = pa.id AND p.puntos_pareja1 > p.puntos_pareja2 THEN 1
    WHEN p.jugado = 1 AND p.pareja2_id = pa.id AND p.puntos_pareja2 > p.puntos_pareja1 THEN 1
    ELSE 0 END), 0) AS pg,
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
GROUP BY g.nombre, pa.id, pa.nombre, pa.cabeza_serie;

