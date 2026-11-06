// Pantalla del árbitro: /t/<slug>/arbitro (clave de árbitro; también entra el admin)
import { notFound, redirect } from 'next/navigation';
import { resolverTorneo } from '../../../../lib/torneo';
import { rolEnTorneo, puedeArbitrar } from '../../../../lib/auth';
import Arbitro from '../../../../componentes/Arbitro';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const torneo = await resolverTorneo((await params).slug).catch(() => null);
  return { title: torneo ? `Árbitro · ${torneo.nombre}` : 'Árbitro · Ranked', robots: { index: false } };
}

export default async function Page({ params }) {
  const torneo = await resolverTorneo((await params).slug);
  if (!torneo) notFound();
  if (!puedeArbitrar(await rolEnTorneo(torneo.id))) redirect(`/t/${torneo.slug}/login?rol=arbitro`);
  return <Arbitro torneo={torneo} />;
}
