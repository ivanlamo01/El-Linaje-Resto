"use client";

import { useAuthContext } from "../Context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NavBar from "./NavBar";
import MainLayout from "./MainLayout";
import BackgroundPattern from "./BackgroundPattern";

export default function AppShell({ children }: { children: React.ReactNode }) {
    const { login, loading } = useAuthContext();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    /* 
    // TEMPORARY: Removed mandatory login for UI development
    useEffect(() => {
        // Wait for auth to finish loading before redirecting
        if (loading) return;

        // Si no está logueado y no está en login, redirigir
        if (!login && pathname !== "/login") {
            router.push("/login");
        }
    }, [login, loading, pathname, router]);
    */

    // Evitar flash de contenido incorrecto antes de montar
    if (!mounted) return null;

    /*
    // Show loading state while auth is being checked
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground animate-pulse">Cargando aplicación...</p>
                </div>
            </div>
        );
    }
    */

    if (pathname === "/login" || pathname?.startsWith("/login")) {
        return <>{children}</>;
    }

    /*
    if (!login) {
        return null; // Will redirect in useEffect
    }
    */

    return (
        <>
            <BackgroundPattern />
            <NavBar />
            <MainLayout>
                {children}
            </MainLayout>
        </>
    );
}
