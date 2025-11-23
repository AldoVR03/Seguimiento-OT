'use client';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function Dashboard() {
    const { user, userData, loading } = useAuth();
    const router = useRouter();
    const [comandas, setComandas] = useState([]);
    const [filtroFase, setFiltroFase] = useState('todas');
    const [filtroTipo, setFiltroTipo] = useState('todas');

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (userData && userData.rol === 'cliente') {
                router.push('/consulta');
            }
        }
    }, [user, userData, loading, router]);

    useEffect(() => {
        if (!user || (userData && userData.rol === 'cliente')) return;

        const unsubEmpresa = onSnapshot(
            query(collection(db, 'comandas_empresa_grupo_5'), where('estado', '!=', 'Finalizado')),
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), collection: 'comandas_empresa_grupo_5' }));
                setComandas(prev => {
                    const other = prev.filter(c => c.collection !== 'comandas_empresa_grupo_5');
                    return [...other, ...data].sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
                });
            }
        );

        const unsubParticular = onSnapshot(
            query(collection(db, 'comandas_particular_grupo_5'), where('estado', '!=', 'Finalizado')),
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), collection: 'comandas_particular_grupo_5' }));
                setComandas(prev => {
                    const other = prev.filter(c => c.collection !== 'comandas_particular_grupo_5');
                    return [...other, ...data].sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
                });
            }
        );

        return () => {
            unsubEmpresa();
            unsubParticular();
        };
    }, [user, userData]);

    // Filtrar comandas
    const comandasFiltradas = comandas.filter(comanda => {
        const faseActual = comanda.faseActual || 'analisis';
        const cumpleFase = filtroFase === 'todas' || faseActual === filtroFase;

        // Determinar tipo real basado en la colección
        let tipoReal = 'particular';
        if (comanda.collection === 'comandas_empresa_grupo_5') {
            tipoReal = 'empresa';
        }

        const cumpleTipo = filtroTipo === 'todas' || tipoReal === filtroTipo;
        return cumpleFase && cumpleTipo;
    });

    const fases = ['analisis', 'lavado', 'planchado', 'embolsado', 'despacho'];

    const getColorFase = (fase) => {
        const colores = {
            analisis: 'badge-yellow',
            lavado: 'badge-blue',
            planchado: 'badge-purple',
            embolsado: 'badge-green',
            despacho: 'badge-orange'
        };
        return colores[fase] || 'badge-secondary';
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!user || (userData && userData.rol === 'cliente')) return null;

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
                                <option value="empresa">Empresa</option>
                                <option value="particular">Particular</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Estadísticas rápidas */}
                <div className="grid grid-5 mb-6">
                    {fases.map(fase => {
                        const count = comandas.filter(c => (c.faseActual || 'analisis') === fase).length;
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
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '20px'
                    }}>
                        {comandasFiltradas.map(comanda => (
                            <Link
                                key={comanda.id}
                                href={`/fase/${comanda.faseActual || 'analisis'}?comandaId=${comanda.id}&collection=${comanda.collection}`}
                                className="comanda-card"
                            >
                                {/* Código y tipo */}
                                <div className="comanda-header">
                                    <span className="comanda-codigo">{comanda.numeroOrden}</span>
                                    <span className={`badge ${comanda.tipo === 'Empresa' ? 'badge-orange' : 'badge-indigo'}`}>
                                        {comanda.tipo === 'Empresa' ? '🏨 Empresa' : '👤 Particular'}
                                    </span>
                                </div>

                                {/* Información */}
                                <div className="comanda-info">
                                    <p>
                                        <strong>
                                            {comanda.tipo === 'Empresa' ? '🏨 Cliente: ' : '👤 Cliente: '}
                                        </strong>
                                        {comanda.cliente.nombre}
                                    </p>
                                    <p>📞 {comanda.cliente.telefono}</p>
                                    <p>📅 {new Date(comanda.fechaCreacion).toLocaleDateString('es-CL')}</p>
                                    {comanda.despacho && <p>🚚 Con Despacho</p>}
                                </div>

                                {/* Fase actual */}
                                <div className="mb-3">
                                    <span className={`badge ${getColorFase(comanda.faseActual || 'analisis')}`}>
                                        📍 {(comanda.faseActual || 'analisis').toUpperCase()}
                                    </span>
                                </div>

                                {/* Estado */}
                                <div className="mb-3">
                                    <span className={`badge ${comanda.estado === 'En proceso' ? 'badge-blue' : 'badge-secondary'}`}>
                                        {comanda.estado}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div >
    );
}
