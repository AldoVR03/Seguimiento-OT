'use client';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function ConsultaCliente() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [comanda, setComanda] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const collectionName = searchParams.get('collection');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) return null;

  const buscarComanda = async (e) => {
    e.preventDefault();
    setError('');
    setComanda(null);

    if (!codigo.trim()) {
      setError('Por favor ingresa un código');
      return;
    }

    setBuscando(true);
    try {
      // Buscar en ambas colecciones
      const qEmpresa = query(
        collection(db, 'comandas_empresa_grupo_5'),
        where('numeroOrden', '==', codigo.toUpperCase().trim())
      );

      const qParticular = query(
        collection(db, 'comandas_particular_grupo_5'),
        where('numeroOrden', '==', codigo.toUpperCase().trim())
      );

      const [snapEmpresa, snapParticular] = await Promise.all([
        getDocs(qEmpresa),
        getDocs(qParticular)
      ]);

      let docFound = null;
      let collectionName = '';

      if (!snapEmpresa.empty) {
        docFound = snapEmpresa.docs[0];
        collectionName = 'comandas_empresa_grupo_5';
      } else if (!snapParticular.empty) {
        docFound = snapParticular.docs[0];
        collectionName = 'comandas_particular_grupo_5';
      }

      if (!docFound) {
        setError('Código no encontrado. Verifica el código e intenta nuevamente.');
      } else {
        setComanda({ id: docFound.id, ...docFound.data(), collection: collectionName });
      }
    } catch (error) {
      console.error('Error al buscar comanda:', error);
      setError('Error al buscar la comanda. Intenta nuevamente.');
    } finally {
      setBuscando(false);
    }
  };

  const getEstadoFase = (fase, faseActual, fases) => {
    const orden = ['analisis', 'lavado', 'planchado', 'embolsado', 'despacho'];
    const indexFase = orden.indexOf(fase);
    const indexActual = orden.indexOf(faseActual || 'analisis');

    if (indexFase < indexActual) {
      return 'completado';
    } else if (indexFase === indexActual) {
      return (fases && fases[fase]?.estado) || 'pendiente';
    } else {
      return 'pendiente';
    }
  };

  const getIconoEstado = (estado) => {
    if (estado === 'completado') return '✅';
    if (estado === 'en_proceso') return '⏳';
    return '⭕';
  };

  const getColorEstado = (estado) => {
    if (estado === 'completado') return '#16a34a';
    if (estado === 'en_proceso') return '#7f838bff';
    return '#9ca3af';
  };

  const formatearFase = (fase) => {
    const nombres = {
      analisis: 'Análisis',
      lavado: 'Lavado',
      planchado: 'Planchado',
      embolsado: 'Embolsado',
      despacho: 'Despacho'
    };
    return nombres[fase] || fase;
  };

  return (
    <div className="gradient-bg" style={{ minHeight: '100vh', padding: '20px' }}>
      <div className="container-small">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🧺 Consulta tu Comanda</h1>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>Ingresa tu código para ver el estado</p>
        </div>

        {/* Formulario de búsqueda */}
        <div className="card mb-6">
          <form onSubmit={buscarComanda}>
            <div className="input-group">
              <label className="label" style={{ fontSize: '1rem' }}>Código de Comanda</label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                className="input"
                style={{
                  fontSize: '1.5rem',
                  padding: '16px',
                  textTransform: 'uppercase',
                  fontWeight: '600',
                  textAlign: 'center'
                }}
                placeholder="EMP-1 o PART-1"
                disabled={buscando}
              />
              <small style={{ display: 'block', textAlign: 'center', marginTop: '8px' }}>
                Ejemplo: EMP-1 para empresas, PART-1 para particulares
              </small>
            </div>

            <button
              type="submit"
              disabled={buscando}
              className="btn btn-primary btn-full"
              style={{ fontSize: '1.1rem', padding: '16px', marginTop: '10px' }}
            >
              {buscando ? '🔍 Buscando...' : '🔍 Buscar Comanda'}
            </button>
          </form>

          {error && (
            <div className="alert alert-error" style={{ display: 'block', marginTop: '20px' }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* Resultado */}
        {comanda && (
          <div className="card">
            {/* Header de la comanda */}
            <div style={{ borderBottom: '2px solid #e5e7eb', paddingBottom: '20px', marginBottom: '25px' }}>
              <div className="flex-between" style={{ marginBottom: '15px' }}>
                <h2 style={{ fontSize: '2rem', margin: 0 }}>{comanda.numeroOrden}</h2>
                <span className={`badge ${collectionName === 'comandas_empresa_grupo_5' ? 'badge-orange' : 'badge-indigo'}`}
                  style={{ fontSize: '1rem', padding: '8px 16px' }}>
                  {collectionName === 'comandas_empresa_grupo_5' ? '🏨 Empresa' : '👤 Particular'}
                </span>
              </div>

              {/* Estado principal */}
              {comanda.estado === 'Finalizado' ? (
                <div style={{
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🎉</div>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>
                    ¡Tu comanda está lista para retirar!
                  </p>
                </div>
              ) : (
                <div style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  padding: '20px',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <p style={{ fontSize: '1.3rem', fontWeight: '600', margin: 0, marginBottom: '8px' }}>
                    Fase actual: {formatearFase(comanda.faseActual || 'analisis')}
                  </p>
                  {comanda.fases && comanda.fases[comanda.faseActual || 'analisis']?.tiempoEstimado > 0 && (
                    <p style={{ fontSize: '1rem', margin: 0, opacity: 0.9 }}>
                      ⏱️ Tiempo estimado: {comanda.fases[comanda.faseActual || 'analisis'].tiempoEstimado} minutos
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Información del cliente */}
            <div className="info-box mb-6">
              <h3 style={{ marginBottom: '15px', color: '#374151' }}>📋 Información</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                <p style={{ margin: 0 }}>
                  <strong>Cliente:</strong>{' '}
                  {comanda.cliente.nombre}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Teléfono:</strong> {comanda.cliente.telefono}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Fecha de emisión:</strong>{' '}
                  {new Date(comanda.fechaCreacion).toLocaleDateString('es-CL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                {comanda.despacho && (
                  <p style={{ margin: 0 }}>
                    <strong>🚚 Despacho:</strong> Sí
                  </p>
                )}
              </div>
            </div>

            {/* Timeline de fases */}
            <div>
              <h3 style={{ marginBottom: '20px', color: '#374151', fontSize: '1.3rem' }}>
                📊 Estado del Proceso
              </h3>

              <div className="timeline">
                {['analisis', 'lavado', 'planchado', 'embolsado', 'despacho'].map((fase, index) => {
                  // Si es despacho y la comanda no tiene despacho, no mostrar
                  if (fase === 'despacho' && !comanda.despacho) return null;

                  const estado = getEstadoFase(fase, comanda.faseActual, comanda.fases);
                  const datosFase = (comanda.fases && comanda.fases[fase]) || {};

                  return (
                    <div key={fase}>
                      <div className="timeline-item">
                        <div className="timeline-icon">
                          <span style={{ fontSize: '2rem', color: getColorEstado(estado) }}>
                            {getIconoEstado(estado)}
                          </span>
                        </div>

                        <div className="timeline-content">
                          <div style={{ opacity: estado === 'completado' ? 0.7 : 1 }}>
                            <h4 className="timeline-title" style={{ fontSize: '1.1rem' }}>
                              {formatearFase(fase)}
                            </h4>

                            {estado === 'completado' && (
                              <p className="timeline-text" style={{ color: '#16a34a', fontWeight: '600' }}>
                                ✓ Completado
                                {datosFase.tiempoReal > 0 && (
                                  <span style={{ marginLeft: '10px', color: '#6b7280' }}>
                                    ({datosFase.tiempoReal} min)
                                  </span>
                                )}
                              </p>
                            )}

                            {estado === 'en_proceso' && (
                              <div className="timeline-text" style={{ color: '#2563eb' }}>
                                <p style={{ fontWeight: '600', margin: '5px 0' }}>⏳ En proceso...</p>
                                {datosFase.encargado && (
                                  <p style={{ margin: '5px 0' }}>
                                    👨‍💼 Encargado: {datosFase.encargado}
                                  </p>
                                )}
                                {datosFase.tiempoEstimado > 0 && (
                                  <p style={{ margin: '5px 0' }}>
                                    ⏱️ Tiempo estimado: {datosFase.tiempoEstimado} min
                                  </p>
                                )}
                              </div>
                            )}

                            {estado === 'pendiente' && (
                              <p className="timeline-text" style={{ color: '#9ca3af' }}>
                                Pendiente
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mostrar línea si no es el último elemento visible */}
                      {((!comanda.despacho && index < 3) || (comanda.despacho && index < 4)) && (
                        <div
                          className={`timeline-line ${estado === 'completado' ? 'timeline-line-active' : 'timeline-line-inactive'}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Botón para nueva búsqueda */}
            <button
              onClick={() => {
                setComanda(null);
                setCodigo('');
              }}
              className="btn btn-secondary btn-full"
              style={{ marginTop: '30px' }}
            >
              🔍 Buscar otra comanda
            </button>
          </div>
        )}

        {/* Info adicional */}
        <div className="text-center mt-6">
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>💬 ¿Tienes dudas? Contáctanos</p>
          <p style={{ color: '#374151', fontWeight: '600', marginTop: '5px', fontSize: '1rem' }}>
            📞 Lavandería El Cobre
          </p>
        </div>
      </div>
    </div>
  );
}