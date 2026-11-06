"use client";
// Gestión de torneos: crear, editar datos, fijar claves de admin/árbitro, copiar enlaces y borrar
import { useEffect, useState } from 'react';
import { C, styles, boton, titulo } from './admin-estilos';
import { FORMATOS } from '../lib/formatos';
import Guia from './Guia';

const json = { 'Content-Type': 'application/json' };
const aSlug = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

async function api(method, body) {
  const res = await fetch('/api/superadmin/torneos', { method, headers: json, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const r = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.reload(); return null; }
  if (!res.ok) { alert(r.error || 'Error'); return null; }
  return r;
}

export default function SuperAdmin() {
  const [torneos, setTorneos] = useState(null);
  const [creando, setCreando] = useState(false);

  const cargar = async () => setTorneos(await api('GET'));
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargar(); }, []);

  const salir = async () => {
    await fetch('/api/auth', { method: 'DELETE', headers: json, body: '{}' });
    window.location.reload();
  };

  return (
    <div style={styles.container}>
      <header style={{ ...styles.header, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/brand/ranked-mark.png" alt="Ranked" style={{ width: '40px', height: 'auto' }} />
          <h1 style={{ ...styles.title, fontSize: '1.5rem' }}>Super admin</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setCreando(v => !v)} style={{ ...boton, padding: '9px 14px', backgroundColor: C.lima, color: C.navy }} data-testid="sa-nuevo">
            {creando ? 'Cancelar' : '+ Nuevo torneo'}
          </button>
          <button onClick={salir} style={{ ...boton, padding: '9px 14px', background: 'transparent', color: C.suave, border: `1px solid ${C.borde}` }}>Salir</button>
        </div>
      </header>

      {creando && <FormularioNuevo onCreado={() => { setCreando(false); cargar(); }} />}

      {!torneos ? <p style={styles.faseInfo}>Cargando…</p> : torneos.map(t => <TarjetaTorneo key={t.id} t={t} onCambio={cargar} />)}
      {torneos && <Guia id="superadmin" />}
    </div>
  );
}

function Campo({ etiqueta, ...props }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: C.suave, fontWeight: 600, letterSpacing: '0.5px' }}>
      {etiqueta}
      <input {...props} style={{ ...styles.select, marginBottom: 0 }} />
    </label>
  );
}

function FormularioNuevo({ onCreado }) {
  const [f, setF] = useState({ nombre: '', slug: '', subtitulo: '', organizador: '', cancha: '', horario: '', clave_admin: '', clave_arbitro: '', parejas: ['', '', '', ''], es_prueba: false });
  const [slugManual, setSlugManual] = useState(false);
  const poner = (k, v) => setF(prev => ({ ...prev, [k]: v, ...(k === 'nombre' && !slugManual ? { slug: aSlug(v) } : {}) }));

  const crear = async (e) => {
    e.preventDefault();
    const r = await api('POST', { ...f, formato: 'relampago4' });
    if (r) onCreado();
  };

  return (
    <form onSubmit={crear} style={{ ...styles.groupCard, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '12px', borderColor: C.limaBorde }}>
      <h2 style={{ ...styles.groupTitle, gridColumn: '1 / -1', margin: 0 }}>Nuevo torneo · {FORMATOS.relampago4.nombre}</h2>
      <Campo etiqueta="Nombre *" value={f.nombre} onChange={e => poner('nombre', e.target.value)} required data-testid="sa-nombre" />
      <Campo etiqueta="Enlace (/t/…) *" value={f.slug} onChange={e => { setSlugManual(true); poner('slug', aSlug(e.target.value)); }} required data-testid="sa-slug" />
      <Campo etiqueta="Subtítulo / categoría" value={f.subtitulo} onChange={e => poner('subtitulo', e.target.value)} placeholder="Dobles Varones +45" />
      <Campo etiqueta="Organizador" value={f.organizador} onChange={e => poner('organizador', e.target.value)} placeholder="Front On" />
      <Campo etiqueta="Cancha" value={f.cancha} onChange={e => poner('cancha', e.target.value)} />
      <Campo etiqueta="Horario" value={f.horario} onChange={e => poner('horario', e.target.value)} />
      {f.parejas.map((p, i) => (
        <Campo key={i} etiqueta={`Pareja ${i + 1}`} value={p} placeholder={`Pareja ${i + 1}`}
          onChange={e => setF(prev => ({ ...prev, parejas: prev.parejas.map((x, j) => (j === i ? e.target.value : x)) }))} />
      ))}
      <Campo etiqueta="Clave de admin" value={f.clave_admin} onChange={e => poner('clave_admin', e.target.value)} minLength={4} autoComplete="new-password" data-testid="sa-clave-admin" />
      <Campo etiqueta="Clave de árbitro" value={f.clave_arbitro} onChange={e => poner('clave_arbitro', e.target.value)} minLength={4} autoComplete="new-password" data-testid="sa-clave-arbitro" />
      <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem', color: C.suave }}>
        <input type="checkbox" checked={f.es_prueba} onChange={e => poner('es_prueba', e.target.checked)} /> Torneo de prueba (no sale en la portada)
      </label>
      <button type="submit" style={{ ...styles.btnAssign, gridColumn: '1 / -1', marginTop: 0 }} data-testid="sa-crear">Crear torneo</button>
    </form>
  );
}

function TarjetaTorneo({ t, onCambio }) {
  const [editando, setEditando] = useState(false);
  const [datos, setDatos] = useState({ nombre: t.nombre, subtitulo: t.subtitulo || '', organizador: t.organizador || '' });
  const [claves, setClaves] = useState({ clave_admin: '', clave_arbitro: '' });
  const origen = typeof window === 'undefined' ? '' : window.location.origin;
  const enlaces = [
    ['Pública', `/t/${t.slug}`],
    ['Árbitro', `/t/${t.slug}/arbitro`],
    ['Admin', `/t/${t.slug}/admin`],
  ];

  const guardarDatos = async () => { if (await api('PUT', { id: t.id, ...datos })) { setEditando(false); onCambio(); } };
  const guardarClave = async (campo) => {
    if (await api('PUT', { id: t.id, [campo]: claves[campo] })) { setClaves(c => ({ ...c, [campo]: '' })); onCambio(); }
  };
  const quitarClave = async (campo) => confirm('¿Quitar esta clave? Nadie podrá entrar con ese rol hasta fijar otra.') && (await api('PUT', { id: t.id, [campo]: null })) && onCambio();
  const borrar = async () => {
    const confirmar = prompt(`Esto borra el torneo, sus parejas y resultados. No se puede deshacer.\nEscribe el enlace "${t.slug}" para confirmar:`);
    if (confirmar && (await api('DELETE', { id: t.id, confirmar }))) onCambio();
  };
  const copiar = (texto) => navigator.clipboard?.writeText(texto).then(() => {}, () => prompt('Copia el enlace:', texto));

  return (
    <section style={styles.groupCard} data-testid={`sa-torneo-${t.slug}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ ...styles.groupTitle, margin: 0 }}>{t.nombre} {t.es_prueba ? <span style={{ fontSize: '0.75rem', color: C.ambar }}>PRUEBA</span> : null}</h2>
          <p style={{ ...styles.faseInfo, margin: '2px 0 0' }}>
            {[t.subtitulo, t.organizador && `Organiza ${t.organizador}`, FORMATOS[t.formato]?.nombre || t.formato, `${t.jugados}/${t.partidos} partidos jugados`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <button onClick={() => setEditando(v => !v)} style={{ ...styles.btnUpdate, flex: 'none', padding: '7px 12px' }}>{editando ? 'Cerrar' : 'Editar'}</button>
          <button onClick={borrar} style={{ ...styles.btnReset, flex: 'none', padding: '7px 12px' }}>Borrar</button>
        </div>
      </div>

      <div style={styles.divider} />
      <p style={styles.seccionLabel}>Enlaces</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {enlaces.map(([etiqueta, ruta]) => (
          <div key={etiqueta} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ ...titulo, width: '70px', fontSize: '0.85rem', color: C.lima }}>{etiqueta}</span>
            <a href={ruta} target="_blank" rel="noopener" style={{ color: C.texto, fontSize: '0.85rem', wordBreak: 'break-all', flex: 1 }}>{origen}{ruta}</a>
            <button onClick={() => copiar(`${origen}${ruta}`)} style={{ ...boton, padding: '5px 10px', fontSize: '0.75rem', background: C.card2, color: C.suave, border: `1px solid ${C.borde}` }}>Copiar</button>
          </div>
        ))}
      </div>

      <div style={styles.divider} />
      <p style={styles.seccionLabel}>Claves de acceso</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '10px' }}>
        {[['clave_admin', 'Admin', t.tiene_clave_admin], ['clave_arbitro', 'Árbitro', t.tiene_clave_arbitro]].map(([campo, etiqueta, tiene]) => (
          <div key={campo} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Campo etiqueta={`${etiqueta} · ${tiene ? '✓ con clave' : '✕ sin clave'}`} type="text" autoComplete="off" placeholder={tiene ? 'Nueva clave (reemplaza)' : 'Fijar clave'}
                value={claves[campo]} onChange={e => setClaves(c => ({ ...c, [campo]: e.target.value }))} data-testid={`sa-${t.slug}-${campo}`} />
            </div>
            <button onClick={() => guardarClave(campo)} disabled={claves[campo].length < 4}
              style={{ ...boton, padding: '9px 12px', backgroundColor: C.lima, color: C.navy, opacity: claves[campo].length < 4 ? 0.4 : 1 }}>Guardar</button>
            {tiene ? <button onClick={() => quitarClave(campo)} title="Quitar clave" style={{ ...boton, padding: '9px 10px', background: 'transparent', color: C.rojo, border: `1px solid ${C.borde}` }}>✕</button> : null}
          </div>
        ))}
      </div>
      <p style={{ ...styles.faseInfo, marginTop: '8px' }}>Las claves se guardan cifradas: no se pueden ver, solo reemplazar. La clave de admin también abre la pantalla de árbitro.</p>

      {editando && (
        <>
          <div style={styles.divider} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '10px' }}>
            <Campo etiqueta="Nombre" value={datos.nombre} onChange={e => setDatos(d => ({ ...d, nombre: e.target.value }))} />
            <Campo etiqueta="Subtítulo" value={datos.subtitulo} onChange={e => setDatos(d => ({ ...d, subtitulo: e.target.value }))} />
            <Campo etiqueta="Organizador" value={datos.organizador} onChange={e => setDatos(d => ({ ...d, organizador: e.target.value }))} />
          </div>
          <button onClick={guardarDatos} style={styles.btnAssign}>Guardar cambios</button>
        </>
      )}
    </section>
  );
}
