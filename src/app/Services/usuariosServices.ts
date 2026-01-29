import { auth, db } from "../config/firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  UserCredential,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { Usuario } from "../types/authTypes";
// 🔹 Modelo de usuario (ajusta campos según tu colección)

// 🔹 Obtener usuario por ID (colección Firestore)
export async function getByUserId(userId: string): Promise<Usuario[]> {
  const usuariosRef = collection(db, "Usuarios");
  const q = query(usuariosRef, where("userId", "==", userId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<Usuario, "id">),
  }));
}

// 🔹 Login con Firebase Auth (email/password)
export async function loginUser(email: string, password: string): Promise<UserCredential> {
  return await signInWithEmailAndPassword(auth, email, password);
}

import { Capacitor } from "@capacitor/core";
import { GoogleAuth } from "@codetrix-studio/capacitor-google-auth";
import { isElectron, getElectronAPI } from "../lib/utils/environment";

// 🔹 Login con Google (Híbrido: Web vs Native vs Electron)
export async function loginWithGoogle(): Promise<UserCredential> {
  console.log("Attempting Google Login...");
  if (isElectron()) {
    console.log("Environment: Electron");
    // 🖥️ Electron: Usar proceso Main para OAuth Popup
    const electron = getElectronAPI();
    if (electron && electron.auth) {
        try {
            const idToken = await electron.auth.signInWithGoogle();
            const credential = GoogleAuthProvider.credential(idToken);
            return await import("firebase/auth").then(({ signInWithCredential }) =>
                signInWithCredential(auth, credential)
            );
        } catch (error) {
            console.error("Electron Google Login Error:", error);
            throw error;
        }
    }
    throw new Error("Electron API not found");
  } else if (Capacitor.isNativePlatform()) {
    console.log("Environment: Native (Capacitor)");
    // 📲 Native: Usar Plugin
    const googleUser = await GoogleAuth.signIn();
    const idToken = googleUser.authentication.idToken;
    const credential = GoogleAuthProvider.credential(idToken);
    return await import("firebase/auth").then(({ signInWithCredential }) =>
      signInWithCredential(auth, credential)
    );
  } else {
    console.log("Environment: Web (Standard Popup)");
    // 💻 Web: Usar Popup estándar
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        console.log("Google Popup Success:", result.user.uid);
        return result;
    } catch (error: any) {
        console.error("Google Popup Error:", error.code, error.message);
        throw error;
    }
  }
}

// 🔹 Logout con Firebase Auth
export async function logoutUser(): Promise<void> {
  return await signOut(auth);
}
