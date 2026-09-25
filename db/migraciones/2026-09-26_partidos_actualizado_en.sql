-- Marca de tiempo de la última modificación de cada partido (para "últimos resultados" en la vista pública)
ALTER TABLE partidos
  ADD COLUMN actualizado_en TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;
