// Acceso por torneo: /t/<slug>/login?rol=admin|arbitro
import { notFound, redirect } from 'next/navigation';
import { resolverTorneo } from '../../../../lib/torneo';
import { rolEnTorneo, puedeAdministrar, puedeArbitrar } from '../../../../lib/auth';
import Login from '../../../../componentes/Login';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acceso · Ranked', robots: { index: false } };

export default async function Page({ params, searchParams }) {
  const torneo = await resolverTorneo((await params).slug);
  if (!torneo) notFound();
  const rol = (await searchParams).rol === 'arbitro' ? 'arbitro' : 'admin';
  const destino = `/t/${torneo.slug}/${rol}`;

  // Si ya tiene sesión con permiso, directo a su pantalla
  const actual = await rolEnTorneo(torneo.id);
  if (rol === 'admin' ? puedeAdministrar(actual) : puedeArbitrar(actual)) redirect(destino);

  return <Login rol={rol} torneo={{ slug: torneo.slug, nombre: torneo.nombre, subtitulo: torneo.subtitulo, organizador: torneo.organizador }} destino={destino} />;
}
