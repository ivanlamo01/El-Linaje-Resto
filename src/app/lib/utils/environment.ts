// Detecta si la app está corriendo en Electron
export function isElectron(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window as any).electron;
}

// Obtiene el objeto electron si está disponible
export function getElectronAPI() {
    if (typeof window !== 'undefined' && (window as any).electron) {
        return (window as any).electron;
    }
    return null;
}

// Detecta si hay conexión a internet (para sync)
export async function isOnline(): Promise<boolean> {
    if (typeof navigator === 'undefined') return false;

    if (!navigator.onLine) return false;

    // Intenta hacer ping a un endpoint confiable
    try {
        const response = await fetch('https://www.google.com/favicon.ico', {
            mode: 'no-cors',
            cache: 'no-store'
        });
        return true;
    } catch {
        return false;
    }
}
