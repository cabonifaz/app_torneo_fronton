-- Datos del Campeonato Mary (Ranked). Requiere la migración 2026-09-25_ranked_torneo.sql
-- Formato: 4 grupos de 4 (un cabeza de serie por grupo), pasan 2 por grupo.
-- Fase 2: sorteo de las 8 parejas en 2 series de 4, todos contra todos, pasan 2 por serie.
-- Semifinal: 1° Serie 1 vs 2° Serie 2 y 1° Serie 2 vs 2° Serie 1. Final: ganadores.
-- Todos los partidos a 1 set de 21 puntos.
--
-- ATENCIÓN: borra el torneo, los partidos, parejas y grupos existentes de la BD donde se ejecute.

DELETE FROM torneo;
DELETE FROM partidos;
DELETE FROM parejas;
DELETE FROM grupos;
ALTER TABLE partidos AUTO_INCREMENT = 1;
ALTER TABLE parejas AUTO_INCREMENT = 1;
ALTER TABLE grupos AUTO_INCREMENT = 1;

INSERT INTO torneo (id, nombre, subtitulo) VALUES (1, 'Campeonato Mary', 'Frontón · Set único a 21 puntos');

INSERT INTO grupos (id, nombre, cancha, hora_inicio) VALUES
  (1, 'GRUPO A', 'Por definir', 'Por definir'),
  (2, 'GRUPO B', 'Por definir', 'Por definir'),
  (3, 'GRUPO C', 'Por definir', 'Por definir'),
  (4, 'GRUPO D', 'Por definir', 'Por definir'),
  (5, 'SERIE 1', 'Por definir', 'Por definir'),
  (6, 'SERIE 2', 'Por definir', 'Por definir');

INSERT INTO parejas (id, grupo_id, nombre, cabeza_serie) VALUES
  (1,  1, 'Daniel - Mary', 1),
  (2,  1, 'Enrique P - Mariano', 0),
  (3,  1, 'Erick - Jorge Durán', 0),
  (4,  1, 'Henry - Roberto', 0),
  (5,  2, 'Cucho - Adriano', 1),
  (6,  2, 'Ali - Juan Siu', 0),
  (7,  2, 'Andrés - César S', 0),
  (8,  2, 'Jean Carlo - Juan José', 0),
  (9,  3, 'Rodrigo - Jorge Kahn', 1),
  (10, 3, 'Jerek - Mihael', 0),
  (11, 3, 'Hugo - Paul', 0),
  (12, 3, 'Ernesto - César Cárdenas', 0),
  (13, 4, 'Infla - Fabián', 1),
  (14, 4, 'Bruno - Emiliano', 0),
  (15, 4, 'Iván - Carlos Alban', 0),
  (16, 4, 'Rafo Vertiz - Daniel', 0);

-- Fase 1: todos contra todos por grupo. El orden (1-2, 1-3, 1-4, 2-3, 2-4, 3-4)
-- es el que la UI reordena para dar descanso entre partidos.
INSERT INTO partidos (grupo_id, pareja1_id, pareja2_id, fase)
SELECT g.grupo_id, g.base + c.a, g.base + c.b, 'grupos'
FROM (SELECT 1 AS grupo_id, 0 AS base UNION ALL SELECT 2, 4 UNION ALL SELECT 3, 8 UNION ALL SELECT 4, 12) g
CROSS JOIN (SELECT 1 AS orden, 1 AS a, 2 AS b UNION ALL SELECT 2, 1, 3 UNION ALL SELECT 3, 1, 4
            UNION ALL SELECT 4, 2, 3 UNION ALL SELECT 5, 2, 4 UNION ALL SELECT 6, 3, 4) c
ORDER BY g.grupo_id, c.orden;

-- Fase 2: 6 partidos por serie, vacíos hasta el sorteo
INSERT INTO partidos (grupo_id, fase)
SELECT s.grupo_id, 'cuartos'
FROM (SELECT 5 AS grupo_id UNION ALL SELECT 6) s
CROSS JOIN (SELECT 1 AS n UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) x
ORDER BY s.grupo_id, x.n;
