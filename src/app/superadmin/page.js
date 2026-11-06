// Super admin: gestión de todos los torneos (clave global en SUPERADMIN_CLAVE)
import { esSuper } from '../../lib/auth';
import Login from '../../componentes/Login';
import SuperAdmin from '../../componentes/SuperAdmin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Super admin · Ranked', robots: { index: false } };

export default async function Page() {
  if (!(await esSuper())) return <Login rol="super" destino="/superadmin" />;
  return <SuperAdmin />;
}
