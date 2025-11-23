'use client';
import { useState, useEffect, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';

export default function FasePage({ params }) {
  const { user, userData, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const comandaId = searchParams.get('comandaId');
  const collectionName = searchParams.get('collection');

  const resolvedParams = use(params);
  const fase = resolvedParams.fase;

  const [comanda, setComanda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);

  // Form states
  const [nombreEncargado, setNombreEncargado] = useState('');
  const [codigoEncargado, setCodigoEncargado] = useState('');
  const [tiempoEstimado, setTiempoEstimado] = useState('');
  const [enProceso, setEnProceso] = useState(false);
  const [horaInicio, setHoraInicio] = useState(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (userData && userData.rol === 'cliente') {
        router.push('/consulta');
      }
    }
  }, [user, userData, authLoading, router]);

  useEffect(() => {
    if (comandaId && collectionName && fase && user && (!userData || userData.rol !== 'cliente')) {
      cargarComanda();
    }
  }, [comandaId, collectionName, fase, user, userData]);

  const cargarComanda = async () => {
    try {
      const docRef = doc(db, collectionName, comandaId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setComanda({ id: docSnap.id, ...data });

        // Verificar si ya está en proceso
        if (data.fases && data.fases[fase]?.estado === 'en_proceso') {
          setEnProceso(true);
          setNombreEncargado(data.fases[fase].encargado || '');
          setCodigoEncargado(data.fases[fase].codigoEncargado || '');
          setTiempoEstimado(data.fases[fase].tiempoEstimado || '');
          setHoraInicio(data.fases[fase].horaInicio || null);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error al cargar comanda:', error);
      setLoading(false);
    }
  };

  const iniciarFase = async (e) => {
    e.preventDefault();
    if (!nombreEncargado || !codigoEncargado || !tiempoEstimado) {
      alert('Por favor completa todos los campos');
      return;
    }

    setProcesando(true);
    try {
      const docRef = doc(db, collectionName, comandaId);
      const ahora = new Date().toISOString();

      const updates = {
        [`fases.${fase}.estado`]: 'en_proceso',
        [`fases.${fase}.encargado`]: nombreEncargado,
        [`fases.${fase}.codigoEncargado`]: codigoEncargado,
        [`fases.${fase}.tiempoEstimado`]: parseInt(tiempoEstimado),
        [`fases.${fase}.horaInicio`]: ahora,
      };

      // Si iniciamos análisis, cambiamos estado global a "En proceso"
      if (fase === 'analisis') {
        updates.estado = 'En proceso';
      }

      await updateDoc(docRef, updates);

      setEnProceso(true);
      setHoraInicio(ahora);

      // Enviar notificación WhatsApp
      enviarNotificacionWhatsApp('iniciado');

      alert('Fase iniciada correctamente');
    } catch (error) {
      console.error('Error al iniciar fase:', error);
      alert('Error al iniciar la fase');
    } finally {
      setProcesando(false);
    }
  };

  const finalizarFase = async () => {
    if (!window.confirm('¿Estás seguro de finalizar esta fase?')) {
      return;
    }

    setProcesando(true);
    try {
      const docRef = doc(db, collectionName, comandaId);
      const ahora = new Date().toISOString();
      const tiempoReal = calcularTiempoReal(horaInicio, ahora);

      const fases = ['analisis', 'lavado', 'planchado', 'embolsado'];
      if (comanda.despacho) {
        fases.push('despacho');
      }

      const indiceFaseActual = fases.indexOf(fase);
      const siguienteFase = fases[indiceFaseActual + 1];

      const updates = {
        [`fases.${fase}.estado`]: 'completado',
        [`fases.${fase}.horaFin`]: ahora,
        [`fases.${fase}.tiempoReal`]: tiempoReal,
      };

      // Si hay siguiente fase, actualizar faseActual
      if (siguienteFase) {
        updates.faseActual = siguienteFase;
      } else {
        // Si es la última fase
        if (comanda.despacho) {
          // Si tenía despacho y terminó despacho -> Finalizado
          updates.estado = 'Finalizado';
          updates.fechaEntregaReal = ahora;
        } else {
          // Si NO tenía despacho y terminó embolsado -> Se mantiene En proceso
          // Solo marcamos la fase como completada (ya hecho arriba)
          // No cambiamos el estado global a Finalizado
        }
      }

      await updateDoc(docRef, updates);

      // Enviar notificación WhatsApp
      enviarNotificacionWhatsApp('completado', siguienteFase);

      alert(`Fase completada. ${siguienteFase ? `La comanda pasó a ${siguienteFase}` : 'Fase finalizada'}`);
      router.push('/dashboard');
    } catch (error) {
      console.error('Error al finalizar fase:', error);
      alert('Error al finalizar la fase');
    } finally {
      setProcesando(false);
    }
  };

  const calcularTiempoReal = (inicio, fin) => {
    const diff = new Date(fin) - new Date(inicio);
    return Math.round(diff / 60000); // minutos
  };

  const enviarNotificacionWhatsApp = (estado, siguienteFase = null) => {
    if (!comanda) return;

    let mensaje = '';
    if (estado === 'iniciado') {
      mensaje = `¡Hola! Tu comanda ${comanda.numeroOrden} ha iniciado la fase de *${fase.toUpperCase()}*. Tiempo estimado: ${tiempoEstimado} minutos. - Lavandería El Cobre`;
    } else if (estado === 'completado') {
      if (siguienteFase) {
        mensaje = `¡Tu comanda ${comanda.numeroOrden} completó la fase de *${fase.toUpperCase()}* y pasó a *${siguienteFase.toUpperCase()}*! - Lavandería El Cobre`;
      } else {
        mensaje = `¡Tu comanda ${comanda.numeroOrden} está *LISTA*! 🎉 - Lavandería El Cobre`;
      }
    }

    // Limpiar el número y validar formato
    let numeroLimpio = comanda.cliente.telefono.replace(/[^0-9]/g, '');

    // Si el número no empieza con 56, agregarlo
    if (!numeroLimpio.startsWith('56')) {
      // Si empieza con 9 (formato chileno), agregar 56
      if (numeroLimpio.startsWith('9')) {
        numeroLimpio = '56' + numeroLimpio;
      } else {
        // Si no, asumir que falta el código de país
        numeroLimpio = '56' + numeroLimpio;
      }
    }

    const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const getColorFase = (fase) => {
    const colores = {
      analisis: 'fase-analisis',
      lavado: 'fase-lavado',
      planchado: 'fase-planchado',
      embolsado: 'fase-embolsado',
      despacho: 'fase-despacho'
    };
    return colores[fase] || 'bg-gray-500';
  };

  if (authLoading) {
    return (
      <div className="loading">
        <div style={{ textAlign: 'center' }}>
          <h2>Verificando acceso...</h2>
        </div>
      </div>
    );
  }

  if (!user || (userData && userData.rol === 'cliente')) return null;

  // Mostrar loading mientras carga
  if (loading || !fase) {
    return (
      <div className="loading">
        <div style={{ textAlign: 'center' }}>
          <h2>⏳ Cargando comanda...</h2>
        </div>
      </div>
    );
  }

  if (!comanda) {
    return (
      <div className="loading">
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.25rem', marginBottom: '20px' }}>Comanda no encontrada</p>
          <Link href="/dashboard" className="btn btn-primary">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '20px' }}>
      <div className="container-small">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard" style={{ display: 'inline-block', marginBottom: '15px' }}>
            ← Volver al Dashboard
          </Link>
          <div className={`fase-header ${getColorFase(fase)}`}>
            <h1 style={{ fontSize: '2rem', marginBottom: '10px' }}>
              {fase ? fase.toUpperCase() : 'CARGANDO...'}
            </h1>
            <p style={{ opacity: 0.9 }}>Comanda: {comanda.numeroOrden}</p>
          </div>
        </div>

        {/* Información de la comanda */}
        <div className="card mb-6">
          <h2>Información de la Comanda</h2>
          <div className="info-box">
            <p><strong>Tipo:</strong> {comanda.tipo === 'Empresa' ? '🏨 Empresa' : '👤 Particular'}</p>
            <p><strong>Cliente:</strong> {comanda.cliente.nombre}</p>
            <p><strong>Teléfono:</strong> {comanda.cliente.telefono}</p>
            {/* Mostrar prendas si es necesario, la estructura es un array */}
            <p><strong>Prendas:</strong> {comanda.prendas.length} items</p>
          </div>
        </div>

        {/* Formulario o estado de la fase */}
        {!enProceso ? (
          <div className="card">
            <h2>Iniciar Fase</h2>
            <form onSubmit={iniciarFase} className="space-y">
              <div className="input-group">
                <label className="label">Nombre del Encargado *</label>
                <input
                  type="text"
                  value={nombreEncargado}
                  onChange={(e) => setNombreEncargado(e.target.value)}
                  className="input"
                  placeholder="Juan Pérez"
                  required
                />
              </div>

              <div className="input-group">
                <label className="label">Código del Encargado *</label>
                <input
                  type="text"
                  value={codigoEncargado}
                  onChange={(e) => setCodigoEncargado(e.target.value)}
                  className="input"
                  placeholder="ENC001"
                  required
                />
              </div>

              <div className="input-group">
                <label className="label">Tiempo Estimado (minutos) *</label>
                <input
                  type="number"
                  value={tiempoEstimado}
                  onChange={(e) => setTiempoEstimado(e.target.value)}
                  className="input"
                  placeholder="30"
                  min="1"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={procesando}
                className={`btn btn-full ${getColorFase(fase)}`}
                style={{ color: 'white' }}
              >
                {procesando ? '⏳ Iniciando...' : '▶️ Iniciar Fase'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card">
            <h2>Fase en Proceso</h2>
            <div className="info-box mb-6">
              <p><strong>👨‍💼 Encargado:</strong> {nombreEncargado}</p>
              <p><strong>🆔 Código:</strong> {codigoEncargado}</p>
              <p><strong>⏱️ Tiempo estimado:</strong> {tiempoEstimado} minutos</p>
              <p><strong>🕐 Hora de inicio:</strong> {new Date(horaInicio).toLocaleTimeString('es-CL')}</p>
            </div>

            <button
              onClick={finalizarFase}
              disabled={procesando}
              className="btn btn-success btn-full"
            >
              {procesando ? '⏳ Finalizando...' : '✅ Finalizar Fase'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}