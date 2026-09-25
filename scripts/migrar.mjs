// Ejecuta un archivo .sql sobre una BD con un usuario administrador.
// Uso: DB_ADMIN_USER=... DB_ADMIN_PASSWORD=... node scripts/migrar.mjs <BD> <archivo.sql>
import mysql from 'mysql2/promise';
import { readFile } from 'fs/promises';

const [database, archivo] = process.argv.slice(2);
if (!database || !archivo) {
  console.error('Uso: node scripts/migrar.mjs <BD> <archivo.sql>');
  process.exit(1);
}

const conexion = await mysql.createConnection({
  host: process.env.DB_HOST || '84.46.245.240',
  port: process.env.DB_PORT || 6432,
  user: process.env.DB_ADMIN_USER,
  password: process.env.DB_ADMIN_PASSWORD,
  database,
  multipleStatements: true,
});
await conexion.query(await readFile(archivo, 'utf8'));
await conexion.end();
console.log(`Migración ${archivo} aplicada en ${database}`);
