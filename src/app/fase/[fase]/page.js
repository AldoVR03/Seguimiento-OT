'use client';
import { useState, useEffect, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc, getDocs, collection, addDoc } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';

export const dynamic = 'force-dynamic';

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
  const [mostrarFormEncargado, setMostrarFormEncargado] = useState(false);
  const [nuevoEncargado, setNuevoEncargado] = useState("");
  const [encargadoSeleccionado, setEncargadoSeleccionado] = useState("");
  const [encargados, setEncargados] = useState([]);


  // Manejar selección de operario
  const handleSelectEncargado = (e) => {
  const nombre = e.target.value;
  setEncargadoSeleccionado(nombre);

  const encargado = encargados.find(o => o.nombre === nombre);

  setNombreEncargado(nombre);
  setCodigoEncargado(encargado ? encargado.codigo : '');
};



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

  // Cargar encargados desde Firebase
  useEffect(() => {
    const cargarEncargados = async () => {
      try {
        const snapshot = await getDocs(collection(db, "encargados"));
        const lista = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEncargados(lista);
      } catch (error) {
        console.error("Error cargando encargados:", error);
    }
  };
  cargarEncargados();
  }, []);

  // === AGREGAR ENCARGADO A FIREBASE ===
  const agregarEncargado = async () => {
    if (!nuevoEncargado.trim()) {
      alert("Ingresa un nombre válido");
      return;
    }

  try {
    // Generar código para el encargado nuevo
    const nuevoCodigo = `ENC-${String(encargados.length + 1).padStart(3, "0")}`;

    const docRef = await addDoc(collection(db, "encargados"), {
      nombre: nuevoEncargado.trim(),
      codigo: nuevoCodigo
    });

    // Actualizar lista de encargados localmente
    setEncargados([
      ...encargados,
      { id: docRef.id, nombre: nuevoEncargado.trim(), codigo: nuevoCodigo }
    ]);

    setNuevoEncargado("");
    setMostrarFormEncargado(false);

    alert("Encargado agregado correctamente");
  } catch (error) {
    console.error("Error agregando encargado:", error);
    alert("No se pudo agregar el encargado");
  }
};

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
    if (tiempoEstimado < 5 || tiempoEstimado > 180) {
      alert('El tiempo estimado debe estar entre 5 y 180 minutos');
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

      // Lógica especial para embolsado: SIEMPRE cambia a "Listo para su entrega"
      if (fase === 'embolsado') {
        updates.estado = 'Listo para su entrega';
        // Si tiene despacho, también actualizar faseActual
        if (siguienteFase) {
          updates.faseActual = siguienteFase;
        }
      } else if (siguienteFase) {
        // Para otras fases, solo actualizar faseActual si hay siguiente fase
        updates.faseActual = siguienteFase;
      } else {
        // No hay siguiente fase y no es embolsado
        if (fase === 'despacho') {
          updates.estado = 'Finalizado';
        } else {
          updates.estado = 'Finalizado';
        }
      }
    
      await updateDoc(docRef, updates);

      enviarNotificacionWhatsApp('completado', siguienteFase);

      alert('Fase finalizada correctamente');
      router.push('/panel');
    } catch (error) {
      console.error('Error al finalizar fase:', error);
      alert('Error al finalizar la fase');
    } finally {
      setProcesando(false);
    }
  };

  const retrocederFase = async () => {
  if (!window.confirm('¿Seguro que deseas retroceder a la fase anterior?')) {
    return;
  }

  const fases = ['analisis', 'lavado', 'planchado', 'embolsado', 'despacho'];

  // Fase anterior
  const indiceFaseActual = fases.indexOf(fase);
  const faseAnterior = fases[indiceFaseActual - 1];

  if (fase === 'analisis') {
    alert("⚠ No puedes retroceder más. 'Análisis' es la primera fase.");
    return;
  }

  setProcesando(true);

  try {
    const docRef = doc(db, collectionName, comandaId);

    const updates = {
      faseActual: faseAnterior,
      [`fases.${fase}.estado`]: 'pendiente',
      [`fases.${fase}.horaInicio`]: null,
      [`fases.${fase}.horaFin`]: null,
      [`fases.${fase}.tiempoReal`]: null,
      [`fases.${fase}.encargado`]: null,
      [`fases.${fase}.codigoEncargado`]: null,
      [`fases.${fase}.tiempoEstimado`]: null,
    };

    if (fase === 'analisis') {
      updates.estado = 'Pendiente';
    }

    await updateDoc(docRef, updates);

    alert(`Retrocediste desde ${fase.toUpperCase()} hacia ${faseAnterior.toUpperCase()}`);

    router.push(`/fase/${faseAnterior}?comandaId=${comandaId}&collection=${collectionName}`);

  } catch (error) {
    console.error('Error al retroceder fase:', error);
    alert('No se pudo retroceder la fase');
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

  const getColorFase = (fase, estado) => {
    const clasesActivas = {
      analisis: 'badge-green',
      lavado: 'badge-green',
      planchado: 'badge-green',
      embolsado: 'badge-green',
      despacho: 'badge-green'
    };

    const clasesPendiente = {
      analisis: 'badge-gray',
      lavado: 'badge-gray',
      planchado: 'badge-gray',
      embolsado: 'badge-gray',
      despacho: 'badge-gray'
    };

    // NORMALIZAMOS EL ESTADO (lo pasamos a minúsculas)
    const est = (estado || "").toLowerCase();

    // Cualquier estado que signifique "NO INICIADO"
    const estadosPendientes = [
      "", "pendiente", "no-iniciada", "no iniciada", "sin iniciar", "no asignada"
    ];

    const isPendiente = estadosPendientes.includes(est);

    return isPendiente
      ? clasesPendiente[fase] || 'badge-gray'
      : clasesActivas[fase] || 'badge-green';
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
          <Link href="/panel" className="btn btn-primary">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFE9D6', padding: '20px' }}>
      <div className="container-small">
        {/* Header */}
        <div className="mb-6">
          <Link href="/panel" style={{ display: 'inline-block', marginBottom: '15px' }}>
            ← Volver al Panel
          </Link>
          <div className="fase-header" style={{ background: enProceso ? '#BBF7D0' : '#7f838bff', padding: '20px', borderRadius: '12px', marginBottom: '20px'}}>
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
            <p><strong>Tipo:</strong> {collectionName === 'comandas_empresa_grupo_5' ? '🏨 Empresa' : '👤 Particular'}</p>
            <p><strong>Cliente:</strong> {comanda.cliente.nombre}</p>
            <p><strong>Teléfono:</strong> {comanda.cliente.telefono}</p>
            <p><strong>Prendas:</strong> {comanda.prendas.length} items</p>
          </div>
        </div>

        {/* Formulario o estado de la fase */}
        {!enProceso ? (
          <div className="card">
            <h2>Iniciar Fase</h2>
         <form onSubmit={iniciarFase} className="space-y">

            {/* SOLO mostrar encargado si NO es DESPACHO */}
            {fase !== 'despacho' && (
              <div className="input-group">
                <label className="label">Seleccionar Encargado *</label>
                <select
                  className="input"
                  onChange={handleSelectEncargado}
                  required
                >
                  <option value="">Selecciona…</option>
                  {encargados.map((enc) => (
                    <option key={enc.codigo} value={enc.nombre}>
                      {enc.nombre} ({enc.codigo})
                    </option>
                  ))}
                </select>
              </div>
            )}
              <button
                  type="button"
                  className="btn-agregar"
                  onClick={() => setMostrarFormEncargado(true)}
                >
                  <span className='icon'>👤</span>
                  ➕ Agregar Encargado
                </button>
                {mostrarFormEncargado && (
                  <div className='form-encargado'>
                    <label className="label">Nombre Completo</label>
                      <input type="text" className="input" placeholder="Ej: Juan Pérez" value={nuevoEncargado} onChange={(e) => setNuevoEncargado(e.target.value)}/>
                  <button type='button' className='btn-guardar' onClick={agregarEncargado} >
                    Guardar
                  </button>
                  <button type='button' className='btn-cancelar' onClick={() => setMostrarFormEncargado(false)}>
                    Cancelar
                  </button>
                  </div>
                )}
                
              {/* CAMPO DINÁMICO:
                - Si NO es despacho - Tiempo estimado
                - Si ES despacho - Patente del vehículo
              */}
            {fase === 'despacho' ? (
              <div className="input-group">
                <label className="label">Patente del vehículo *</label>
                <input
                  type="text"
                  placeholder="Ej: ABCD-12"
                  value={tiempoEstimado}
                  onChange={(e) => setTiempoEstimado(e.target.value)}
                  className="input"
                  required
                />
              </div>
            ) : (
              <div className="input-group">
                <label className="label">Tiempo Estimado (minutos) *</label>
                <input
                  type="number"
                  value={tiempoEstimado}
                  onChange={(e) => setTiempoEstimado(e.target.value)}
                  className="input"
                  min="1"
                  max="360"
                  placeholder="30"
                  required
                />
              </div>
            )}
            <button
              onClick={retrocederFase}
              disabled={procesando}
              className="btn btn-warning btn-full"
              style={{ marginBottom: '10px' }}
              >
              ⬅️ Retroceder a Fase Anterior
            </button>
            <button
              type="submit"
              disabled={procesando}
              className="btn btn-full"
              style={{background: enProceso ? '#BBF7D0' : '#E5E7EB', color: enProceso ? '#065f46' : '#4b5563'}}
            >
              {procesando ? '⏳ Iniciando...' : '▶️ Iniciar Fase'}
            </button>
          </form>
        </div>

        ) : (
          <div className="card" style={{ background: '#BBF7D0' }}>
            <h2>Fase en Proceso</h2>
            <div className="info-box mb-6">
              <p><strong>👨‍💼 Encargado:</strong> {nombreEncargado}</p>
              <p><strong>🆔 Código:</strong> {codigoEncargado}</p>
              <p><strong>⏱️ Tiempo estimado:</strong> {tiempoEstimado} minutos</p>
              <p><strong>🕐 Hora de inicio:</strong> {new Date(horaInicio).toLocaleTimeString('es-CL')}</p>
            </div>
            <button
              onClick={retrocederFase}
              disabled={procesando}
              className="btn btn-warning btn-full"
              style={{ marginBottom: '10px' }}
              >
              ⬅️ Retroceder a Fase Anterior
            </button>
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