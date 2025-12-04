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
            collection(db, 'comandas_empresa_grupo_5'),
            (snapshot) => {
                const data = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data(), collection: 'comandas_empresa_grupo_5' }))
                    .filter(comanda => {
                        // Mostrar si está Pendiente o En proceso
                        if (comanda.estado === 'Pendiente' || comanda.estado === 'En proceso') {
                            return true;
                        }
                        // Mostrar si está "Listo para su entrega" Y tiene despacho
                        if (comanda.estado === 'Listo para su entrega' && comanda.despacho === true) {
                            return true;
                        }
                        return false;
                    });
                setComandas(prev => {
                    const other = prev.filter(c => c.collection !== 'comandas_empresa_grupo_5');
                    return [...other, ...data].sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
                });
            }
        );

        const unsubParticular = onSnapshot(
            collection(db, 'comandas_particular_grupo_5'),
            (snapshot) => {
                const data = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data(), collection: 'comandas_particular_grupo_5' }))
                    .filter(comanda => {
                        // Mostrar si está Pendiente o En proceso
                        if (comanda.estado === 'Pendiente' || comanda.estado === 'En proceso') {
                            return true;
                        }
                        // Mostrar si está "Listo para su entrega" Y tiene despacho
                        if (comanda.estado === 'Listo para su entrega' && comanda.despacho === true) {
                            return true;
                        }
                        return false;
                    });
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

        // Normalizar estado
        const est = (estado || "").toLowerCase();

        // Estados que significan NO iniciado → GRIS
        const estadosPendientes = [
            "",               // vacío
            "pendiente",
            "sin iniciar",
            "no iniciada",
            "no-iniciada",
            "no asignada",
            "iniciar fase",
            "iniciado",
            "iniciar-fase"
        ];

        // ES PENDIENTE → gris
        const isPendiente = estadosPendientes.includes(est);

        return isPendiente
            ? clasesPendiente[fase] || "badge-gray"
            : clasesActivas[fase] || "badge-green";
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
        <div style={{ minHeight: "100vh", background: "#FFE9D6", padding: "20px" }}>
            {/* Header */}
            <div className="container">
                <div
                    style={{
                        background: "#FF8A3D", // naranja fuerte
                        padding: "20px",
                        borderRadius: "12px",
                        marginBottom: "30px",
                        color: "white",
                        boxShadow: "0px 6px 16px rgba(0,0,0,0.20)"
                    }}
                >
                <h1 style={{ color: "white", margin: 0 }}>Lavandería El Cobre</h1>
                <p style={{ color: "white", margin: 0 }}>Panel de Control - Operadores</p>
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
                        <p style={{ color: '#6b7280' }}>No hay comandas en proceso</p>
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
                                    <span className={`badge ${comanda.collection === 'comandas_empresa_grupo_5' ? 'badge-orange' : 'badge-indigo'}`}>
                                        {comanda.collection === 'comandas_empresa_grupo_5' ? '🏨 Empresa' : '👤 Particular'}
                                    </span>
                                </div>

                                {/* Información */}
                                <div className="comanda-info">
                                    <p>
                                        <strong>
                                            {comanda.collection === 'comandas_empresa_grupo_5' ? '🏨 Cliente: ' : '👤 Cliente: '}
                                        </strong>
                                        {comanda.cliente.nombre}
                                    </p>
                                    <p>📞 {comanda.cliente.telefono}</p>
                                    <p>📅 {new Date(comanda.fechaCreacion).toLocaleDateString('es-CL')}</p>
                                    {comanda.despacho && <p>🚚 Con Despacho</p>}
                                </div>

                                {/* Fase actual */}
                                <div className="mb-3">
                                    <span className={`badge ${getColorFase(comanda.faseActual || 'analisis', comanda.estado)}`}>
                                        📍 {(comanda.faseActual || 'analisis').toUpperCase()}
                                    </span>
                                </div>

                                {/* Estado */}
                                <div className="mb-3" style={{ display: "none" }}>
                                    <span className={`badge ${comanda.estado === 'En proceso' ? 'badge-blue' : 'badge-secondary'}`}>
                                        {comanda.estado}
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
