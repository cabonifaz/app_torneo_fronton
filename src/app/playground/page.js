import { notFound } from 'next/navigation';
import Playground from './Playground';
import { playgroundHabilitado } from '../../lib/playground';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Playground · Ranked', robots: { index: false } };

export default function Page() {
  if (!playgroundHabilitado()) notFound();
  return <Playground />;
}
