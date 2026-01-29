"use client";

import { useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function TestFirebase() {
  const [status, setStatus] = useState("Checking...");
  const [user, setUser] = useState<any>(null);
  const [dbResult, setDbResult] = useState("");

  useEffect(() => {
    // 1. Check Auth
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ? u.email : "Not Logged In");
    });

    // 2. Check DB Write/Read
    const testDB = async () => {
      try {
        const testRef = doc(db, "TestCollection", "test-doc");
        await setDoc(testRef, {
          timestamp: new Date().toISOString(),
          message: "Hello form El Linaje"
        });
        const snap = await getDoc(testRef);
        if (snap.exists()) {
          setDbResult("Success: Wrote and Read from Firestore!");
        } else {
          setDbResult("Error: Doc written but not found.");
        }
      } catch (e: any) {
        setDbResult("Error: " + e.message);
        console.error(e);
      }
    };

    testDB();
    setStatus("Checks running...");

    return () => unsub();
  }, []);

  return (
    <div className="p-10 bg-background text-foreground min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Firebase Connection Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 border rounded relative">
          <h2 className="font-semibold">Auth Status</h2>
          <p>{user || "Loading..."}</p>
        </div>

        <div className="p-4 border rounded relative">
          <h2 className="font-semibold">Database Connection</h2>
          <p className={dbResult.startsWith("Error") ? "text-red-500" : "text-green-500"}>
            {dbResult || "Testing..."}
          </p>
        </div>

        <div className="p-4 border rounded bg-secondary/10">
           <h2 className="font-semibold">Environment Config</h2>
           <pre className="text-xs mt-2 overflow-auto">
             API KEY: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Loaded (Ending in " + process.env.NEXT_PUBLIC_FIREBASE_API_KEY.slice(-4) + ")" : "MISSING"}
           </pre>
        </div>
      </div>
    </div>
  );
}
