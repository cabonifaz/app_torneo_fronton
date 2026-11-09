// Prepara la BD de producción para la versión multi-torneo. Idempotente: se puede ejecutar varias veces.
//  1. Aplica las migraciones pendientes si faltan (no borran datos; el torneo actual queda como torneo 1).
//  2. Crea el Campeonato Relámpago (slug relampago-45) si no existe.
//  3. Fija las claves de admin y árbitro de ambos torneos.
//
// Uso (PowerShell o bash, desde la raíz del repo):
//   node --env-file=.env.admin.local scripts/publicar-prod.mjs <claveAdminRelampago> <claveArbitroRelampago> <claveAdminMary> <claveArbitroMary>
import mysql from 'mysql2/promise';
import { readFile } from 'fs/promises';
import { randomBytes, scryptSync } from 'crypto';

const BD = process.env.BD_DESTINO || 'DB_Torneo_fronton_prod';
if (BD === 'db_torneo_fronton') throw new Error('db_torneo_fronton es la BD original: no se toca');

const [adminRel, arbitroRel, adminMary, arbitroMary] = process.argv.slice(2);
if (![adminRel, arbitroRel, adminMary, arbitroMary].every(c => c && c.length >= 4)) {
  console.error('Faltan las 4 claves (mínimo 4 caracteres cada una). Ver el uso al inicio del archivo.');
  process.exit(1);
}

const hash = c => { const sal = randomBytes(16).toString('hex'); return `${sal}:${scryptSync(c, sal, 32).toString('hex')}`; };
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
  if (!(await columnas('torneo')).includes('slug')) {
    await c.query(await readFile('db/migraciones/2026-11-06_multi_torneo_sets.sql', 'utf8'));
    console.log('✓ Migración multi_torneo_sets aplicada');
  } else console.log('· multi_torneo_sets ya estaba aplicada');

  if (!(await columnas('torneo')).includes('clave_admin')) {
    await c.query(await readFile('db/migraciones/2026-11-06_claves_torneo.sql', 'utf8'));
    console.log('✓ Migración claves_torneo aplicada');
  } else console.log('· claves_torneo ya estaba aplicada');

  if (!(await columnas('partidos')).includes('reloj_estado')) {
    await c.query(await readFile('db/migraciones/2026-11-06_reloj_sets.sql', 'utf8'));
    console.log('✓ Migración reloj_sets aplicada');
  } else console.log('· reloj_sets ya estaba aplicada');

  if (!(await columnas('torneo')).includes('reglas')) {
    await c.query(await readFile('db/migraciones/2026-11-09_reglas_torneo.sql', 'utf8'));
    console.log('✓ Migración reglas_torneo aplicada');
  } else console.log('· reglas_torneo ya estaba aplicada');

  const [[existe]] = await c.query("SELECT id FROM torneo WHERE slug = 'relampago-45'");
  if (!existe) {
    await c.beginTransaction();
    const [t] = await c.query("INSERT INTO torneo (slug, nombre, subtitulo, formato, organizador) VALUES ('relampago-45', 'Campeonato Relámpago', 'Dobles Varones +45', 'relampago4', 'Front On')");
    const [g] = await c.query("INSERT INTO grupos (torneo_id, nombre, cancha, hora_inicio) VALUES (?, 'TODOS CONTRA TODOS', 'Cancha La Capullana · Surco', 'Dom 8 Nov · 9:00 a 11:00')", [t.insertId]);
    const ids = [];
    for (let i = 1; i <= 4; i++) {
      const [p] = await c.query('INSERT INTO parejas (torneo_id, grupo_id, nombre, cabeza_serie) VALUES (?, ?, ?, 0)', [t.insertId, g.insertId, `Pareja ${i}`]);
      ids.push(p.insertId);
    }
    // Mismo orden de rondas que src/lib/relampago.js (CRUCES_LIGA)
    for (const [a, b] of [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]]) {
      await c.query("INSERT INTO partidos (torneo_id, grupo_id, pareja1_id, pareja2_id, fase) VALUES (?, ?, ?, ?, 'liga')", [t.insertId, g.insertId, ids[a], ids[b]]);
    }
    await c.commit();
    console.log(`✓ Campeonato Relámpago creado (id ${t.insertId})`);
  } else console.log(`· Campeonato Relámpago ya existía (id ${existe.id})`);

  await c.query("UPDATE torneo SET clave_admin = ?, clave_arbitro = ? WHERE slug = 'relampago-45'", [hash(adminRel), hash(arbitroRel)]);
  const [mary] = await c.query('UPDATE torneo SET clave_admin = ?, clave_arbitro = ? WHERE id = 1', [hash(adminMary), hash(arbitroMary)]);
  console.log(`✓ Claves fijadas (torneo 1 actualizado: ${mary.affectedRows === 1 ? 'sí' : 'NO'})`);

  const [torneos] = await c.query('SELECT id, slug, nombre, formato, (SELECT COUNT(*) FROM partidos p WHERE p.torneo_id = t.id) AS partidos FROM torneo t ORDER BY id');
  console.table(torneos);
} catch (error) {
  await c.rollback().catch(() => {});
  console.error('✗ Error:', error.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
