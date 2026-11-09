// Prepara la BD de producción antes de publicar código nuevo. Idempotente y SOLO aditivo:
// aplica las migraciones que falten (añaden columnas, nunca borran ni modifican datos) y muestra los torneos.
// No crea torneos ni toca claves: eso se hace desde /superadmin.
//
// Uso (PowerShell o bash, desde la raíz del repo):
//   node --env-file=.env.admin.local scripts/publicar-prod.mjs
import mysql from 'mysql2/promise';
import { readFile } from 'fs/promises';

const BD = process.env.BD_DESTINO || 'DB_Torneo_fronton_prod';
if (BD === 'db_torneo_fronton') throw new Error('db_torneo_fronton es la BD original: no se toca');

// [tabla, columna que añade, archivo]: si la columna ya existe, la migración ya está aplicada
const MIGRACIONES = [
  ['torneo', 'slug', 'db/migraciones/2026-11-06_multi_torneo_sets.sql'],
  ['torneo', 'clave_admin', 'db/migraciones/2026-11-06_claves_torneo.sql'],
  ['partidos', 'reloj_estado', 'db/migraciones/2026-11-06_reloj_sets.sql'],
  ['torneo', 'reglas', 'db/migraciones/2026-11-09_reglas_torneo.sql'],
];

const c = await mysql.createConnection({
  host: process.env.DB_HOST || '84.46.245.240',
  port: process.env.DB_PORT || 6432,
  user: process.env.DB_ADMIN_USER,
  password: process.env.DB_ADMIN_PASSWORD,
  database: BD,
  multipleStatements: true,
});

const columnas = async (tabla) => (await c.query(`SHOW COLUMNS FROM ${tabla}`))[0].map(x => x.Field);

try {
  console.log(`BD: ${BD}`);
  for (const [tabla, columna, archivo] of MIGRACIONES) {
    const nombre = archivo.split('/').pop();
    if ((await columnas(tabla)).includes(columna)) { console.log(`· ${nombre} ya estaba aplicada`); continue; }
    await c.query(await readFile(archivo, 'utf8'));
    console.log(`✓ ${nombre} aplicada`);
  }

  const [torneos] = await c.query(`
    SELECT id, slug, nombre, formato,
      (SELECT COUNT(*) FROM partidos p WHERE p.torneo_id = t.id) AS partidos,
      (SELECT COUNT(*) FROM partidos p WHERE p.torneo_id = t.id AND p.jugado = 1) AS jugados,
      clave_admin IS NOT NULL AS con_clave_admin, clave_arbitro IS NOT NULL AS con_clave_arbitro
    FROM torneo t ORDER BY id`);
  console.table(torneos);
} catch (error) {
  console.error('✗ Error:', error.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
