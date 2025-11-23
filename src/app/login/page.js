'use client';
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Verificar rol
            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const role = userData.rol; // Asumiendo que el campo se llama 'rol' o 'role'

                if (role === 'cliente') {
                    router.push('/consulta');
                } else if (role === 'admin' || role === 'operador') {
                    router.push('/');
                } else {
                    // Si no tiene rol definido o es otro
                    router.push('/');
                }
            } else {
                // Si no hay datos de usuario, redirigir al home por defecto
                router.push('/');
            }

        } catch (err) {
            console.error('Login error:', err);
            setError('Credenciales inválidas. Por favor intenta nuevamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
            padding: '20px'
        }}>
            <div className="card" style={{
                maxWidth: '400px',
                width: '100%',
                padding: '40px',
                borderRadius: '20px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)'
            }}>
                <div className="text-center mb-8">
                    <h1 style={{
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        color: '#1f2937',
                        marginBottom: '10px'
                    }}>
                        Bienvenido
                    </h1>
                    <p style={{ color: '#6b7280' }}>Lavandería El Cobre</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="input-group mb-4">
                        <label className="label" style={{ color: '#374151', fontWeight: '600' }}>Correo Electrónico</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="input"
                            placeholder="tu@email.com"
                            required
                            style={{ padding: '12px', borderRadius: '8px' }}
                        />
                    </div>

                    <div className="input-group mb-6">
                        <label className="label" style={{ color: '#374151', fontWeight: '600' }}>Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input"
                            placeholder="••••••••"
                            required
                            style={{ padding: '12px', borderRadius: '8px' }}
                        />
                    </div>

                    {error && (
                        <div className="alert alert-error mb-4" style={{ padding: '10px', borderRadius: '8px', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary btn-full"
                        style={{
                            padding: '14px',
                            fontSize: '1.1rem',
                            borderRadius: '8px',
                            background: 'linear-gradient(to right, #4f46e5, #06b6d4)',
                            border: 'none',
                            fontWeight: '600'
                        }}
                    >
                        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}
