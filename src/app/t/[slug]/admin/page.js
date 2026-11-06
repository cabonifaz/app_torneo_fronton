// Panel de administración del torneo: /t/<slug>/admin (requiere clave de admin o super admin)
import { notFound, redirect } from 'next/navigation';
import { listarTorneos, resolverTorneo } from '../../../../lib/torneo';
import { rolEnTorneo, puedeAdministrar } from '../../../../lib/auth';
import AdminRanked16 from '../../../../componentes/AdminRanked16';
import AdminRelampago from '../../../../componentes/AdminRelampago';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const torneo = await resolverTorneo((await params).slug).catch(() => null);
  return { title: torneo ? `Admin · ${torneo.nombre}` : 'Admin · Ranked', robots: { index: false } };
}

export default async function Page({ params }) {
  const torneo = await resolverTorneo((await params).slug);
  if (!torneo) notFound();
  const rol = await rolEnTorneo(torneo.id);
  if (!puedeAdministrar(rol)) redirect(`/t/${torneo.slug}/login?rol=admin`);

  // Solo el super admin ve el selector para saltar entre torneos
  const torneos = rol === 'super' ? await listarTorneos({ incluirPruebas: true }) : [];
  const Panel = torneo.formato === 'relampago4' ? AdminRelampago : AdminRanked16;
  return <Panel torneo={torneo} torneos={torneos} />;
}
