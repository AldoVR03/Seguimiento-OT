'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

const SESSION_KEY = 'lavanderia_ot_session_temp';

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const saveSession = (fakeUser, data) => {
        setUser(fakeUser);
        setUserData(data);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: fakeUser, userData: data }));
        }
    };

    const clearSession = () => {
        setUser(null);
        setUserData(null);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(SESSION_KEY);
        }
    };

    // --- NUEVA FUNCIÓN: LOGIN CON TOKEN (SSO) ---
    const loginWithToken = async (uid) => {
        try {
            setLoading(true);
            await signOut(auth); 

            const userDocRef = doc(db, 'usuarios', uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const data = userDoc.data();
                
                const fakeUser = {
                    uid: uid,
                    email: data.correo || 'usuario@intranet.cl',
                    displayName: data.nombre || 'Usuario Intranet',
                    emailVerified: true
                };

                saveSession(fakeUser, data);
                setLoading(false);
                return true;
            } else {
                console.error('Token inválido: Usuario no encontrado en DB');
                setLoading(false);
                return false;
            }
        } catch (error) {
            console.error('Error crítico en loginWithToken:', error);
            setLoading(false);
            return false;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            clearSession();
            router.push('/login');
        } catch (error) {
            console.error("Error al salir", error);
        }
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = sessionStorage.getItem(SESSION_KEY);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    setUser(parsed.user);
                    setUserData(parsed.userData);
                } catch (e) {
                    console.error("Error parsing session", e);
                }
            }
        }

        const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
            if (authUser) {
                setUser(authUser);
                try {
                    const userDocRef = doc(db, 'usuarios', authUser.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        setUserData(userDoc.data());
                    }
                } catch (error) {
                    console.error('Error fetching user data:', error);
                }
                setLoading(false);
            } else {
                if (typeof window !== 'undefined' && !sessionStorage.getItem(SESSION_KEY)) {
                    setUser(null);
                    setUserData(null);
                }
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, userData, loading, loginWithToken, logout }}>
            {children}
        </AuthContext.Provider>
    );
};