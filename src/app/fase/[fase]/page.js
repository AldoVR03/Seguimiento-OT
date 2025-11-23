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

  // CORRECCIÓN: Usar React.use() para unwrap params
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
    if (comandaId && fase && user && (!userData || userData.rol !== 'cliente')) {
      cargarComanda();
    }
  }, [comandaId, fase, user, userData]);

  const cargarComanda = async () => {
    try {
      const docRef = doc(db, 'Comandas', comandaId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setComanda({ id: docSnap.id, ...data });

        // Verificar si ya está en proceso
        if (data.fases[fase]?.estado === 'en_proceso') {
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
      const docRef = doc(db, 'Comandas', comandaId);
      const ahora = new Date().toISOString();

      await updateDoc(docRef, {
        [`fases.${fase}.estado`]: 'en_proceso',
        [`fases.${fase}.encargado`]: nombreEncargado,
        [`fases.${fase}.codigoEncargado`]: codigoEncargado,
        [`fases.${fase}.tiempoEstimado`]: parseInt(tiempoEstimado),
        [`fases.${fase}.horaInicio`]: ahora,
      });

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
      const docRef = doc(db, 'Comandas', comandaId);
      const ahora = new Date().toISOString();
      const tiempoReal = calcularTiempoReal(horaInicio, ahora);

      const fases = ['analisis', 'lavado', 'planchado', 'embolsado'];
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
        // Si es la última fase (embolsado), marcar como finalizado
        updates.finalizado = true;
        updates.fechaFinalizacion = ahora;
      }

      await updateDoc(docRef, updates);

      // Enviar notificación WhatsApp
      enviarNotificacionWhatsApp('completado', siguienteFase);

      alert(`Fase completada. ${siguienteFase ? `La comanda pasó a ${siguienteFase}` : 'Comanda finalizada'}`);
      router.push('/');
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
      mensaje = `¡Hola! Tu comanda ${comanda.codigo} ha iniciado la fase de *${fase.toUpperCase()}*. Tiempo estimado: ${tiempoEstimado} minutos. - Lavandería El Cobre`;
    } else if (estado === 'completado') {
      if (siguienteFase) {
        mensaje = `¡Tu comanda ${comanda.codigo} completó la fase de *${fase.toUpperCase()}* y pasó a *${siguienteFase.toUpperCase()}*! - Lavandería El Cobre`;
      } else {
        mensaje = `¡Tu comanda ${comanda.codigo} está *LISTA PARA RETIRAR*! 🎉 - Lavandería El Cobre`;
      }
    }

    // CORRECCIÓN: Limpiar el número y validar formato
    let numeroLimpio = comanda.numeroCelular.replace(/[^0-9]/g, '');

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

    console.log('📱 Número original:', comanda.numeroCelular);
    console.log('📱 Número limpio:', numeroLimpio);
    console.log('💬 Mensaje:', mensaje);

    const url = `https://wa.me/${numeroLimpio}?text=${encodeURIComponent(mensaje)}`;
    console.log('🔗 URL WhatsApp:', url);

    window.open(url, '_blank');
  };

  const getColorFase = (fase) => {
    const colores = {
      analisis: 'fase-analisis',
      lavado: 'fase-lavado',
      planchado: 'fase-planchado',
      embolsado: 'fase-embolsado'
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
          <Link href="/" className="btn btn-primary">
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
          <Link href="/" style={{ display: 'inline-block', marginBottom: '15px' }}>
            ← Volver al Dashboard
          </Link>
          <div className={`fase-header ${getColorFase(fase)}`}>
            <h1 style={{ fontSize: '2rem', marginBottom: '10px' }}>
              {fase ? fase.toUpperCase() : 'CARGANDO...'}
            </h1>
            <p style={{ opacity: 0.9 }}>Comanda: {comanda.codigo}</p>
          </div>
        </div>

        {/* Información de la comanda */}
        <div className="card mb-6">
          <h2>Información de la Comanda</h2>
          <div className="info-box">
            <p><strong>Tipo:</strong> {comanda.tipo === 'hotel' ? '🏨 Hotel' : '👤 Particular'}</p>
            <p><strong>Cliente:</strong> {comanda.tipo === 'hotel' ? comanda.representante : comanda.nombreCliente}</p>
            <p><strong>Teléfono:</strong> {comanda.numeroCelular}</p>
            <p><strong>Tipo de ropa:</strong> {comanda.tipoRopa}</p>
            <p><strong>Peso:</strong> {comanda.peso}kg</p>
            {comanda.tipo === 'particular' && comanda.tipoServicio && (
              <p><strong>Servicio:</strong> {comanda.tipoServicio}</p>
            )}
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