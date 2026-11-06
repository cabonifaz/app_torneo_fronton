// Compatibilidad con el enlace anterior: /en-vivo[?torneo=<slug>] → /t/<slug>
import { notFound, redirect } from 'next/navigation';
import { resolverTorneo } from '../../lib/torneo';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }) {
  const torneo = await resolverTorneo((await searchParams).torneo);
  if (!torneo) notFound();
  redirect(`/t/${torneo.slug}`);
}
