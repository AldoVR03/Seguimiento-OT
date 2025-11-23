'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

// URL de la Intranet para volver si falla
const MAIN_INTRANET_URL = "https://lavanderia-cobre-landingpage.vercel.app/intranet/dashboard";

export default function RootPage() {
  const { user, userData, loading, loginWithToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Estado local para la UI de carga/validación
  const [status, setStatus] = useState('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    let timeoutId;

    const verifyAccess = async () => {
      const token = searchParams.get('auth_token') || searchParams.get('token');

      timeoutId = setTimeout(() => {
        if (isMounted && status === 'verifying') {
          setErrorMessage('Tiempo agotado. Redirigiendo...');
          setStatus('error');
          setTimeout(() => window.location.href = MAIN_INTRANET_URL, 2000);
        }
      }, 8000);

      try {
        if (token) {
          if (!user || user.uid !== token) {
            console.log("Token detectado, validando...");
            const success = await loginWithToken(token);
            
            if (!isMounted) return;

            if (!success) {
              setErrorMessage('Acceso denegado o usuario no encontrado.');
              setStatus('error');
              setTimeout(() => window.location.href = MAIN_INTRANET_URL, 2000);
              return;
            }
          }
          if (isMounted) setStatus('success');
        } 
        else {
          if (!loading) {
            if (!user) {
              router.push('/login');
            } else {
              if (isMounted) setStatus('success');
            }
          }
        }

      } catch (err) {
        console.error(err);
        if (isMounted) {
          setErrorMessage('Error de conexión.');
          setStatus('error');
          setTimeout(() => window.location.href = MAIN_INTRANET_URL, 2000);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    if (!loading) {
      verifyAccess();
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [user, loading, loginWithToken, searchParams, router]);

  useEffect(() => {
    if (status === 'success' && user && userData) {
      if (userData.rol === 'cliente') {
        router.push('/consulta');
      } else {
        router.push('/dashboard');
      }
    }
  }, [status, user, userData, router]);

  if (loading || status === 'verifying' || status === 'error') {
    const token = searchParams.get('auth_token') || searchParams.get('token');
    if (!token && !user && !loading) return null;

    const ORANGE_100 = '#ffedd5';
    const ORANGE_200 = '#fed7aa'; 
    const ORANGE_500 = '#f97316'; 
    const ORANGE_600 = '#ea580c'; 
    const RED_600 = '#dc2626';

    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: `linear-gradient(to bottom right, ${ORANGE_100}, ${ORANGE_200})`,
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '1rem' 
        }}>
          {status === 'error' ? (
            <div style={{ fontSize: '3rem', color: RED_600 }}>⚠️</div>
          ) : (
            <div style={{ 
              width: '3rem', 
              height: '3rem', 
              border: `4px solid ${ORANGE_500}`, 
              borderTopColor: 'transparent', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }}></div>
          )}
          
          <div style={{ 
            fontSize: '1.25rem',
            fontWeight: '600',
            color: status === 'error' ? RED_600 : ORANGE_600 
          }}>
            {status === 'error' ? errorMessage : 'Validando credenciales...'}
          </div>
        </div>
        <style jsx global>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return null;
}