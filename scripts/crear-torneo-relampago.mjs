// Da de alta el Campeonato Relámpago (Dobles Varones +45) sin tocar los torneos existentes.
// Uso: node --env-file=.env.local scripts/crear-torneo-relampago.mjs ["Pareja 1" "Pareja 2" "Pareja 3" "Pareja 4"]
// Los nombres de las parejas se pueden cambiar luego desde el panel (pestaña Parejas).
import pool from '../src/lib/db.js';
import { crearTorneoRelampago } from '../src/lib/crear-torneo.js';

const nombres = process.argv.slice(2);
const parejas = nombres.length === 4 ? nombres : ['Pareja 1', 'Pareja 2', 'Pareja 3', 'Pareja 4'];

try {
  const torneo = await crearTorneoRelampago({
    slug: 'relampago-45',
    nombre: 'Campeonato Relámpago',
    subtitulo: 'Dobles Varones +45',
    organizador: 'Front On',
    cancha: 'Cancha La Capullana · Surco',
    horario: 'Dom 8 Nov · 9:00 a 11:00',
    parejas,
  });
  console.log(`Torneo creado: id ${torneo.id} → /?torneo=${torneo.slug} y /en-vivo?torneo=${torneo.slug}`);
} catch (error) {
  console.error(error.code === 'ER_DUP_ENTRY' ? 'Ya existe un torneo con el slug relampago-45.' : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
