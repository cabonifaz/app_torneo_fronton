import pool from './db.js';
import { CRUCES_LIGA } from './relampago.js';

// Crea un torneo Relámpago: 1 grupo de 4 parejas con sus 6 partidos (todos contra todos).
// La final se crea después desde el panel, con las 2 mejores de la tabla.
export async function crearTorneoRelampago({ slug, nombre, subtitulo, organizador, cancha, horario, parejas, esPrueba = false }) {
  if (!slug || !nombre) throw new Error('Faltan el slug o el nombre del torneo');
  if (!Array.isArray(parejas) || parejas.length !== 4) throw new Error('El formato Relámpago necesita exactamente 4 parejas');

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [torneo] = await conexion.query(
      "INSERT INTO torneo (slug, nombre, subtitulo, formato, organizador, es_prueba) VALUES (?, ?, ?, 'relampago4', ?, ?)",
      [slug, nombre, subtitulo || null, organizador || null, esPrueba ? 1 : 0]
    );
    const torneoId = torneo.insertId;

    const [grupo] = await conexion.query(
      'INSERT INTO grupos (torneo_id, nombre, cancha, hora_inicio) VALUES (?, ?, ?, ?)',
      [torneoId, 'TODOS CONTRA TODOS', cancha || 'Por definir', horario || 'Por definir']
    );
    const grupoId = grupo.insertId;

    const ids = [];
    for (const nombrePareja of parejas) {
      const [pareja] = await conexion.query(
        'INSERT INTO parejas (torneo_id, grupo_id, nombre, cabeza_serie) VALUES (?, ?, ?, 0)',
        [torneoId, grupoId, nombrePareja]
      );
      ids.push(pareja.insertId);
    }

    // Se insertan en orden de ronda: ese orden de id es el que la UI usa para ronda y cancha
    for (const [a, b] of CRUCES_LIGA) {
      await conexion.query(
        "INSERT INTO partidos (torneo_id, grupo_id, pareja1_id, pareja2_id, fase) VALUES (?, ?, ?, ?, 'liga')",
        [torneoId, grupoId, ids[a], ids[b]]
      );
    }

    await conexion.commit();
    return { id: torneoId, slug };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}
