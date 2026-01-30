"use client";

import React, { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { FaHistory, FaTimes, FaCalendarAlt, FaClipboardList } from "react-icons/fa";
import { ProductoData } from "../types/productTypes";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: ProductoData | null;
}

interface HistoryItem {
  id: string;
  date: string;
  mode?: 'FAST' | 'TRAINING';
  inputQty: number;
  outputQty: number;
  wasteQty: number;
  yieldRatio: number;
  changes?: string[];
  notes?: string;
}

export default function ProductionHistoryModal({ isOpen, onClose, product }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && product?.id) {
      loadHistory();
    }
  }, [isOpen, product]);

  const loadHistory = async () => {
    if (!product?.id) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, `Productos/${product.id}/History`),
        orderBy("date", "desc")
      );
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HistoryItem));
      setHistory(data);
    } catch (err) {
      console.error("Error loading history:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold font-serif flex items-center gap-2 text-foreground">
              <FaHistory className="text-primary" /> Historial de Entrenamiento
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {product?.title}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
             <div className="p-10 text-center text-muted-foreground animate-pulse">Cargando historial...</div>
          ) : history.length === 0 ? (
             <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                <FaCalendarAlt size={30} className="opacity-20" />
                <p>No hay registros de entrenamiento aún.</p>
             </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground font-semibold sticky top-0 backdrop-blur-sm shadow-sm z-10">
                <tr>
                  <th className="p-4">Fecha / Modo</th>
                  <th className="p-4 text-center">Producción</th>
                  <th className="p-4 text-center hidden md:table-cell">Rendimiento Base</th>
                  <th className="p-4 text-right">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/5 transition-colors group">
                    <td className="p-4 align-top">
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-foreground">{new Date(item.date).toLocaleDateString()}</span>
                            <span className="text-[10px] text-muted-foreground">
                                {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Hs
                            </span>
                            <span className={`inline-flex w-fit items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-1 ${
                                item.mode === 'TRAINING' 
                                    ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                            }`}>
                                {item.mode === 'TRAINING' ? 'Entrenamiento' : 'Rápido'}
                            </span>
                        </div>
                    </td>
                    <td className="p-4 align-top text-center">
                        <div className="flex flex-col items-center gap-1">
                           <div className="flex items-center gap-2 text-sm">
                                <span className="font-bold text-muted-foreground">{item.inputQty} Lotes</span>
                                <span className="text-muted-foreground/30">➜</span>
                                <span className="font-bold text-primary">{item.outputQty} Unidades</span>
                           </div>
                           {item.wasteQty > 0 && (
                               <div className="text-xs text-destructive font-medium bg-destructive/5 px-2 py-0.5 rounded-full">
                                   -{item.wasteQty} Desperdicio
                               </div>
                           )}
                        </div>
                    </td>
                    <td className="p-4 align-top text-center hidden md:table-cell">
                        <span className="font-mono text-xs bg-muted/30 px-2 py-1 rounded text-muted-foreground">
                            1 Lote ≈ {item.yieldRatio || (item.outputQty / (item.inputQty || 1)).toFixed(2)} u
                        </span>
                    </td>
                    <td className="p-4 align-top text-right">
                        {item.mode === 'TRAINING' && item.changes && item.changes.length > 0 ? (
                            <div className="text-xs text-left bg-amber-50/50 p-2 rounded-lg border border-amber-100/50 w-full md:w-48 ml-auto">
                                <p className="font-bold text-amber-800 mb-1 text-[10px] uppercase">Ajustes Realizados:</p>
                                <ul className="space-y-0.5">
                                    {item.changes.map((change, idx) => (
                                        <li key={idx} className="text-amber-700 leading-tight">{change}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <span className="text-xs text-muted-foreground italic">Sin cambios estructurales</span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-border bg-muted/5 rounded-b-2xl">
            <button onClick={onClose} className="w-full py-3 rounded-xl border border-border font-bold hover:bg-muted transition-colors">
                Cerrar
            </button>
        </div>
      </div>
    </div>
  );
}
