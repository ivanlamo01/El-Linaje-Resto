"use client";

import React, { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { FaHistory, FaTimes, FaCalendarAlt, FaClipboardList, FaDumbbell } from "react-icons/fa";
import { ProductoData } from "../types/productTypes";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: ProductoData | null;
  filterMode?: 'ALL' | 'TRAINING'; // New Prop
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

export default function ProductionHistoryModal({ isOpen, onClose, product, filterMode = 'ALL' }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && product?.id) {
      loadHistory();
    }
  }, [isOpen, product, filterMode]);

  const loadHistory = async () => {
    if (!product?.id) return;
    setLoading(true);
    try {
      const collectionRef = collection(db, `Productos/${product.id}/History`);
      
      let q;
      if (filterMode === 'TRAINING') {
          q = query(collectionRef, where("mode", "==", "TRAINING"), orderBy("date", "desc"));
      } else {
          q = query(collectionRef, orderBy("date", "desc"));
      }

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
              <FaHistory className="text-primary" /> 
              {filterMode === 'TRAINING' ? 'Historial de Entrenamiento' : 'Historial de Producción'}
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
          
          {/* --- MASTER RECIPE (Current) --- */}
          <div className="p-6 bg-gradient-to-b from-primary/5 to-transparent border-b border-border">
              <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-primary text-primary-foreground rounded-lg">
                      <FaClipboardList />
                  </div>
                  <div>
                      <h3 className="font-bold text-lg text-foreground">Receta Madre (Actual)</h3>
                      <p className="text-xs text-muted-foreground">Configuración vigente calibrada.</p>
                  </div>
              </div>

              {product?.recipe && product.recipe.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {product.recipe.map((ing, idx) => (
                           <div key={idx} className="flex justify-between items-center p-3 bg-card border border-border/60 rounded-xl shadow-sm">
                               <span className="font-medium text-sm">{ing.ingredientName}</span>
                               <span className="font-mono font-bold text-primary text-sm">
                                   {ing.quantity} {ing.unit}
                               </span>
                           </div>
                      ))}
                      {/* Strategy Summary */}
                      <div className="md:col-span-2 mt-2 p-3 bg-muted/20 rounded-xl flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-semibold uppercase">Estrategia:</span>
                          <span className="font-bold text-foreground">
                              {product.productionStrategy === 'VOLUME_BATCH' ? 'Por Lote (Ollas)' : 'Unitario'}
                          </span>
                      </div>
                  </div>
              ) : (
                  <div className="text-center p-4 text-muted-foreground text-sm italic border rounded-xl border-dashed">
                      Sin receta configurada.
                  </div>
              )}
          </div>

          <div className="px-6 py-4">
               <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                   <FaHistory /> Historial de Cambios
               </h4>

              {loading ? (
                 <div className="p-10 text-center text-muted-foreground animate-pulse">Cargando historial...</div>
              ) : history.length === 0 ? (
                 <div className="p-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <FaCalendarAlt size={30} className="opacity-20" />
                    <p>No hay registros de entrenamiento aún.</p>
                 </div>
              ) : (
                <div className="space-y-3">
                    {history.map((item) => (
                      <div key={item.id} className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-all shadow-sm group">
                        
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            
                            {/* Left: Date & Mode */}
                            <div className="flex flex-col gap-1 min-w-[120px]">
                                <span className="font-bold text-foreground flex items-center gap-2">
                                    {new Date(item.date).toLocaleDateString()}
                                    <span className="text-[10px] text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-full">
                                        {new Date(item.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Hs
                                    </span>
                                </span>
                                
                                <span className={`inline-flex w-fit items-center px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider mt-1 ${
                                    item.mode === 'TRAINING' 
                                        ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                        : 'bg-blue-50 text-blue-600 border border-blue-100'
                                }`}>
                                    {item.mode === 'TRAINING' ? 'Entrenamiento' : 'Rápido'}
                                </span>
                            </div>

                            {/* Center: Production Data */}
                            <div className="flex flex-col sm:items-center gap-1">
                                <div className="flex items-center gap-3 text-sm p-2 bg-muted/20 rounded-lg border border-border/50">
                                     <span className="font-bold text-muted-foreground">{item.inputQty} Lotes</span>
                                     <span className="text-muted-foreground/30">➜</span>
                                     <span className="font-bold text-primary">{item.outputQty} Unidades</span>
                                </div>
                                {item.wasteQty > 0 && (
                                    <span className="text-[10px] text-destructive font-bold">
                                        -{item.wasteQty} Desperdicio
                                    </span>
                                )}
                                <span className="text-[10px] font-mono text-muted-foreground">
                                     Rend: {(item.yieldRatio || (item.outputQty / (item.inputQty || 1))).toFixed(2)} u/lote
                                </span>
                            </div>

                            {/* Right: Details / Changes */}
                            <div className="flex-1 sm:text-right min-w-[150px]">
                                {item.mode === 'TRAINING' && item.changes && item.changes.length > 0 ? (
                                    <div className="text-xs text-left bg-amber-50/50 p-2.5 rounded-lg border border-amber-200 w-full sm:ml-auto shadow-sm">
                                        <p className="font-bold text-amber-800 mb-1.5 text-[10px] uppercase tracking-wide border-b border-amber-200 pb-1 flex items-center gap-1">
                                            <FaDumbbell size={10} /> Calibración:
                                        </p>
                                        <ul className="space-y-1">
                                            {item.changes.map((change, idx) => (
                                                <li key={idx} className="text-amber-900 leading-tight font-mono text-[10px]">
                                                    • {change.replace('Calibrado ', '')}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <span className="text-xs text-muted-foreground italic block sm:mt-2">Sin cambios estructurales</span>
                                )}
                            </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
          </div>
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
