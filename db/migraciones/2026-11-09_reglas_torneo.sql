-- Reglas de puntuación propias de cada torneo, por fase (si falta una fase, rigen las del formato).
-- Ejemplo: {"liga":{"mejorDe":3,"puntosSet":15,"ventaja":2,"maximo":20},"final":{"mejorDe":3,"puntosSet":21,"ventaja":1,"maximo":null}}
--   mejorDe:   1, 3 o 5 sets
--   puntosSet: puntos a los que se juega el set
--   ventaja:   1 = seco (gana el primero que llega) · 2 = hay que ganar por 2 de diferencia desde puntosSet
--   maximo:    con ventaja 2, tope de puntos (el primero que llega al tope gana); NULL = sin tope
ALTER TABLE torneo ADD COLUMN reglas JSON NULL AFTER formato;
