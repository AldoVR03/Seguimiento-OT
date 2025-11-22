'use client';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import Link from 'next/link';

export default function Dashboard() {
  const [comandas, setComandas] = useState([]);
  const [filtroFase, setFiltroFase] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todas');

  useEffect(() => {
    // Consulta en tiempo real de comandas no finalizadas
    const q = query(
      collection(db, 'Comandas'),
      where('finalizado', '==', false),
      orderBy('fechaEmision', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comandasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComandas(comandasData);
    });

    return () => unsubscribe();
  }, []);

  // Filtrar comandas
  const comandasFiltradas = comandas.filter(comanda => {
    const cumpleFase = filtroFase === 'todas' || comanda.faseActual === filtroFase;
    const cumpleTipo = filtroTipo === 'todas' || comanda.tipo === filtroTipo;
    return cumpleFase && cumpleTipo;
  });

  const fases = ['analisis', 'lavado', 'planchado', 'embolsado'];
  
  const getColorFase = (fase) => {
    const colores = {
      analisis: 'badge-yellow',
      lavado: 'badge-blue',
      planchado: 'badge-purple',
      embolsado: 'badge-green'
    };
    return colores[fase] || 'badge-secondary';
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '20px' }}>
      <div className="container">
        {/* Header */}
        <div className="mb-8">
          <h1>🧺 Lavandería El Cobre</h1>
          <p style={{ color: '#6b7280' }}>Panel de Control - Operadores</p>
        </div>

        {/* Filtros */}
        <div className="card mb-6">
          <div className="grid grid-2">
            <div className="input-group">
              <label className="label">Filtrar por Fase</label>
              <select
                value={filtroFase}
                onChange={(e) => setFiltroFase(e.target.value)}
                className="select"
              >
                <option value="todas">Todas las fases</option>
                {fases.map(fase => (
                  <option key={fase} value={fase}>
                    {fase.charAt(0).toUpperCase() + fase.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="label">Filtrar por Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="select"
              >
                <option value="todas">Todos los tipos</option>
                <option value="hotel">Hotel</option>
                <option value="particular">Particular</option>
              </select>
            </div>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="grid grid-4 mb-6">
          {fases.map(fase => {
            const count = comandas.filter(c => c.faseActual === fase).length;
            return (
              <div key={fase} className="stat-card">
                <div className="stat-number">{count}</div>
                <div className="stat-label">{fase}</div>
              </div>
            );
          })}
        </div>

        {/* Lista de comandas */}
        {comandasFiltradas.length === 0 ? (
          <div className="card text-center">
            <p style={{ color: '#6b7280' }}>No hay comandas pendientes</p>
          </div>
        ) : (
          <div className="grid grid-3">
            {comandasFiltradas.map(comanda => (
              <Link
                key={comanda.id}
                href={`/fase/${comanda.faseActual}?comandaId=${comanda.id}`}
                className="comanda-card"
              >
                {/* Código y tipo */}
                <div className="comanda-header">
                  <span className="comanda-codigo">{comanda.codigo}</span>
                  <span className={`badge ${comanda.tipo === 'hotel' ? 'badge-orange' : 'badge-indigo'}`}>
                    {comanda.tipo === 'hotel' ? '🏨 Hotel' : '👤 Particular'}
                  </span>
                </div>

                {/* Información */}
                <div className="comanda-info">
                  <p>
                    <strong>
                      {comanda.tipo === 'hotel' ? '👔 Representante: ' : '👤 Cliente: '}
                    </strong>
                    {comanda.tipo === 'hotel' ? comanda.representante : comanda.nombreCliente}
                  </p>
                  <p>📞 {comanda.numeroCelular}</p>
                  <p>👕 {comanda.tipoRopa} • ⚖️ {comanda.peso}kg</p>
                </div>

                {/* Fase actual */}
                <div className="mb-3">
                  <span className={`badge ${getColorFase(comanda.faseActual)}`}>
                    📍 {comanda.faseActual.toUpperCase()}
                  </span>
                </div>

                {/* Encargado actual si existe */}
                {comanda.fases[comanda.faseActual]?.encargado && (
                  <p className="text-xs" style={{ color: '#6b7280' }}>
                    👨‍💼 {comanda.fases[comanda.faseActual].encargado}
                  </p>
                )}

                {/* Fecha */}
                <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
                  📅 {new Date(comanda.fechaEmision).toLocaleDateString('es-CL')}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}