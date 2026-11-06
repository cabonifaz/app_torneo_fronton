// Vista pública en vivo de un torneo: /t/<slug>
import { notFound } from 'next/navigation';
import EnVivo from '../../en-vivo/EnVivo';
import { resolverTorneo } from '../../../lib/torneo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const torneo = await resolverTorneo((await params).slug).catch(() => null);
  return {
    title: torneo ? `En vivo · ${torneo.nombre}` : 'En vivo · Ranked',
    description: 'Resultados y posiciones del torneo de frontón en tiempo real',
  };
}

export default async function Page({ params }) {
  const torneo = await resolverTorneo((await params).slug);
  if (!torneo) notFound();
  return <EnVivo slug={torneo.slug} />;
}
