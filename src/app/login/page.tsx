"use client";

import { useState, FormEvent, useEffect } from "react";
import { useAuthContext } from "../Context/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth, db } from "../config/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

function Login() {
  const { handleLogin, handleGoogleLogin, login } = useAuthContext(); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();


  useEffect(() => {
    if (login) {
      router.push("/");
    }
  }, [login, router]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        // --- LOGICA DE REGISTRO ---
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Actualizar perfil básico (displayName)
        await updateProfile(user, { displayName: name });

        // Crear documento en Firestore
        await setDoc(doc(db, "Usuarios", user.uid), {
          userId: user.uid,
          nombre: name,
          email: email,
          rol: "user",
          createdAt: new Date().toISOString()
        });
        
        // El login es automático tras crearse el usuario,
        // AuthContext detectará el cambio de estado con onAuthStateChanged.
      } else {
        // --- LOGICA DE LOGIN ---
        await handleLogin(email, password);
      }
    } catch (err: any) {
      console.error(err);
      setError(
        isRegistering 
          ? "Error al registrarse. Verifique los datos." 
          : "Email o contraseña inválidos"
      );
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = async () => {
    try {
      await handleGoogleLogin();
    } catch (error: any) {
      console.error("Google Login Error Full:", error);
      if (error.code === 'auth/configuration-not-found') {
          setError("Error: Habilita Google Auth en Firebase Console -> Authentication -> Sign-in method.");
      } else if (error.code === 'auth/popup-closed-by-user') {
          setError("El usuario cerró la ventana de login.");
      } else {
          setError("Error al iniciar sesión con Google: " + error.message);
      }
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground transition-colors duration-300">
      <div className="bg-card p-8 rounded-xl shadow-lg w-full max-w-sm border border-border transition-all duration-300">
        <h2 className="text-center text-2xl font-bold font-serif text-secondary mb-6">
          {isRegistering ? "Crear Cuenta" : "Iniciar sesión"}
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          {isRegistering && (
            <input
              type="text"
              placeholder="Nombre Completo"
              className="w-full px-4 py-2 rounded-md bg-muted/50 text-foreground placeholder-muted-foreground border border-input focus:outline-none focus:ring-2 focus:ring-secondary animate-fade-in"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-2 rounded-md bg-muted/50 text-foreground placeholder-muted-foreground border border-input focus:outline-none focus:ring-2 focus:ring-secondary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            className="w-full px-4 py-2 rounded-md bg-muted/50 text-foreground placeholder-muted-foreground border border-input focus:outline-none focus:ring-2 focus:ring-secondary"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && <p className="text-destructive text-sm italic">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold rounded-md transition disabled:opacity-50"
          >
            {loading ? "Procesando..." : (isRegistering ? "Registrarse" : "Iniciar sesión")}
          </button>
        </form>

        <div className="mt-4 text-center">
            <button 
                onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError(null);
                }}
                className="text-sm text-secondary hover:text-secondary/80 hover:underline transition-colors focus:outline-none"
            >
                {isRegistering 
                    ? "¿Ya tenés cuenta? Iniciar Sesión" 
                    : "¿No tenés cuenta? Registrarse"}
            </button>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-grow h-px bg-border"></div>
          <span className="px-2 text-muted-foreground text-sm">o</span>
          <div className="flex-grow h-px bg-border"></div>
        </div>

        <button
          onClick={onGoogleLogin}
          className="w-full py-3 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-md flex items-center justify-center gap-2 transition border border-border"
        >
          <Image
          width={20}
          height={20}
            src="https://www.svgrepo.com/show/355037/google.svg"
            alt="google"
            className="w-5 h-5"
          />
          Iniciar con Google
        </button>
      </div>
    </div>
  );
}

export default Login;
