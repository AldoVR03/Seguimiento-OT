'use client';
import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const MAIN_INTRANET_URL = "https://lavanderia-el-cobre.vercel.app/intranet/dashboard";

function RootPageContent() {
  const { user, userData, loading, loginWithToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleNavigation = async () => {
      const token = searchParams.get('auth_token') || searchParams.get('token');

      if (token) {
        if (user && user.uid === token && userData) {
          redirectUser(userData.rol);
          return;
        }

        console.log("Token detectado, validando...");
        try {
          const success = await loginWithToken(token);
          if (success) {
            const storedSession = sessionStorage.getItem('lavanderia_ot_session_temp');
            if (storedSession) {
               const data = JSON.parse(storedSession).userData;
               redirectUser(data.rol);
            } else {
               window.location.reload();s
            }
          } else {
            // Token inválido: Devolver a la Intranet
            window.location.href = MAIN_INTRANET_URL;
          }
        } catch (error) {
          console.error("Error validando token:", error);
          window.location.href = MAIN_INTRANET_URL;
        }
        return;
      }

      if (!loading) {
        if (user && userData) {
          redirectUser(userData.rol);
        } else {
          router.push('/login');
        }
      }
    };

    handleNavigation();
  }, [user, userData, loading, loginWithToken, searchParams, router]);

  const redirectUser = (rol) => {
    const role = (rol || '').toLowerCase();
    if (role === 'cliente') {
      router.push('/consulta');
    } else {
      router.push('/panel');
    }
  };

  return null;
}

export default function RootPage() {
  return (
    <Suspense fallback={null}>
      <RootPageContent />
    </Suspense>
  );
}