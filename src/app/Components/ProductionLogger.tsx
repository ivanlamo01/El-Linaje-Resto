"use client";

import React, { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { doc, updateDoc, increment, addDoc, collection, getDoc } from "firebase/firestore";
import { SmartInput } from "./ui/SmartInput";
import { ProductoProps, RecetaItem } from "../types/productTypes";
import { FaCheckCircle, FaClipboardList, FaDumbbell, FaMagic, FaHistory, FaArrowRight, FaExclamationTriangle } from "react-icons/fa";
import { NumberInput } from "./ui/NumberInput";

interface Props {
  products: ProductoProps[];
  inventory?: ProductoProps[]; // Optional for now to avoid breaking if parent not updated immediately, but logic will rely on it
  onProductionCompleted: () => void;
}

type Mode = 'FAST' | 'TRAINING';

export default function ProductionLogger({ products, inventory = [], onProductionCompleted }: Props) {
  const [selectedProduct, setSelectedProduct] = useState<ProductoProps | null>(null);
  const [mode, setMode] = useState<Mode>('FAST');
  const [quantityProduced, setQuantityProduced] = useState(1); // How many batches/units
  
  // Session State (What we are actually submitting)
  const [sessionRecipe, setSessionRecipe] = useState<RecetaItem[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initialize session when product is selected
  useEffect(() => {
    if (selectedProduct) {
        setSessionRecipe(selectedProduct.recipe || []);
        setQuantityProduced(1);
        setNotes("");
    } else {
        setSessionRecipe([]);
    }
  }, [selectedProduct]);

  // Adjust Recipe Quantities based on "QuantityProduced" (Batches)
  useEffect(() => {
      if (!selectedProduct) return;
      if (mode === 'FAST') {
          // In FAST mode, strict math: Base * Multiplier
          const adjusted = (selectedProduct.recipe || []).map(ing => ({
              ...ing,
              quantity: (ing.quantity || 0) * quantityProduced,
              waste: (ing.waste || 0) * quantityProduced
          }));
          setSessionRecipe(adjusted);
      }
      // In TRAINING mode, we don't auto-update if the user might have touched it, 
      // but for simplicity/UX, usually resetting or asking is better. 
      // Here we'll just re-calc base values if they switch quantity, but respecting manual edits is tricky.
      // For now: Simple recalc. User edits individual fields afterwards.
  }, [quantityProduced, selectedProduct, mode]);


  const handleIngredientChange = (index: number, field: keyof RecetaItem, value: number) => {
      if (mode !== 'TRAINING') return; // Gatekeeper
      const updated = [...sessionRecipe];
      updated[index] = { ...updated[index], [field]: value };
      setSessionRecipe(updated);
  };

  const getStock = (id: string, unit: string) => {
      const item = inventory.find(p => p.id === id);
      return item ? item.stock : null;
  };

  const handleProduce = async () => {
    if (!selectedProduct || !selectedProduct.id) return;
    setSubmitting(true);

    try {
        const calibrationCount = selectedProduct.calibrationCount || 0;
        const historyChanges: string[] = [];

        // 1. Process Ingredients: Deduct Stock + Calculate New Averages (if Training)
        const updates = sessionRecipe.map(async (ing) => {
            if (ing.ingredientId.startsWith('CUSTOM_')) return; 

            // A. Deduct Stock
            const itemRef = doc(db, "Productos", ing.ingredientId);
            const totalDeduction = (ing.quantity || 0) + (ing.waste || 0);
            
            await updateDoc(itemRef, {
                stock: increment(-totalDeduction)
            });

            // B. Calibrate Recipe (Only in TRAINING mode)
            if (mode === 'TRAINING') {
                // Calculate used amount PER UNIT/BATCH produced to normalize
                // usagePerUnit = TotalUsed / Batches
                const actualUsagePerUnit = (ing.quantity || 0) / quantityProduced; 
                
                // Get current master value (from product, not session) to avoid drift from session state
                const originalIng = selectedProduct.recipe?.find(r => r.ingredientId === ing.ingredientId);
                const currentMasterValue = originalIng ? (originalIng.quantity || 0) : 0; // If new ing, assume 0 start

                // Weighted Average Formula:
                // NewAvg = ((CurrentAvg * Count) + Actual) / (Count + 1)
                const newMasterValue = ((currentMasterValue * calibrationCount) + actualUsagePerUnit) / (calibrationCount + 1);
                
                // Track changes for history if significant > 0.1% diff
                if (Math.abs(newMasterValue - currentMasterValue) > 0.0001) {
                    historyChanges.push(
                        `Calibrado ${ing.ingredientName}: ${currentMasterValue.toFixed(3)} -> ${newMasterValue.toFixed(3)} ${ing.unit}`
                    );
                }

                return { 
                    ingredientId: ing.ingredientId, 
                    newQuantity: newMasterValue 
                };
            }
            return null;
        });

        const results = await Promise.all(updates);

        // 2. Update Product: Stock + History + (Calibration Updates)
        let totalYield = 0;
        if (selectedProduct.productionStrategy === 'VOLUME_BATCH') {
             const batchSize = selectedProduct.defaultContainer?.capacity || 1;
             totalYield = batchSize * quantityProduced;
        } else {
             totalYield = quantityProduced;
        }

        const productRef = doc(db, "Productos", selectedProduct.id);
        const productUpdates: any = {
            stock: increment(totalYield),
            timesProduced: increment(1)
        };

        // Apply Calibration Updates to Master Recipe
        if (mode === 'TRAINING') {
            const newRecipe = (selectedProduct.recipe || []).map(r => {
                const update = results.find(res => res?.ingredientId === r.ingredientId);
                if (update) {
                    return { ...r, quantity: update.newQuantity };
                }
                return r;
            });
            
            productUpdates.recipe = newRecipe;
            productUpdates.calibrationCount = increment(1);
        }

        await updateDoc(productRef, productUpdates);

        // 3. Log History
        const historyRef = collection(productRef, "History");
        await addDoc(historyRef, {
            date: new Date().toISOString(),
            mode: mode,
            batches: quantityProduced,
            totalYield: totalYield,
            inputs: sessionRecipe, // Logs the ACTUAL inputs used this session
            changes: historyChanges, // Logs the calibration delta
            notes: notes,
            user: "Staff" 
        });

        // UI Reset
        alert(`¡Producción Registrada! Se agregaron ${totalYield} ${selectedProduct.unit || 'un'} a Stock.`);
        setSelectedProduct(null);
        onProductionCompleted();

    } catch (error) {
        console.error("Error submitting production:", error);
        alert("Error al registrar producción. Ver consola.");
    } finally {
        setSubmitting(false);
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-2">
        {/* Left: Recipe Selector */}
        <div className="lg:col-span-4 space-y-4">
            <h2 className="text-xl font-bold font-serif mb-4 flex items-center gap-2">
                <FaClipboardList /> Recetas Disponibles
            </h2>
            <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {products.map(product => (
                    <button
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className={`text-left p-4 rounded-xl border-2 transition-all group flex flex-col gap-1 shadow-sm ${
                            selectedProduct?.id === product.id 
                            ? 'border-primary bg-primary/5 shadow-primary/10' 
                            : 'border-border bg-card hover:border-primary/50'
                        }`}
                    >   
                        <div className="flex justify-between items-center w-full">
                            <span className={`font-bold text-lg ${selectedProduct?.id === product.id ? 'text-primary' : 'text-foreground'}`}>
                                {product.title}
                            </span>
                             {selectedProduct?.id === product.id && <FaCheckCircle className="text-primary" />}
                        </div>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded w-fit">
                             {product.productionStrategy === 'VOLUME_BATCH' ? "Por Lote" : "Unitario"}
                        </span>
                    </button>
                ))}
                {products.length === 0 && (
                     <div className="text-center p-8 text-muted-foreground bg-muted/10 rounded-xl border-dashed border-2 border-border">
                        <p>No hay recetas de producción cargadas.</p>
                     </div>
                )}
            </div>
        </div>

        {/* Right: Workspace */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl shadow-xl overflow-hidden flex flex-col">
             
             {/* Toolbar */}
             <div className="bg-muted/30 p-4 border-b border-border flex flex-wrap gap-4 justify-between items-center">
                 {selectedProduct ? (
                     <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-2xl text-primary">{selectedProduct.title}</span>
                     </div>
                 ) : (
                    <span className="text-muted-foreground italic">Selecciona un producto...</span>
                 )}

                 {selectedProduct && (
                     <div className="flex items-center bg-background rounded-lg p-1 border border-border">
                         <button 
                            onClick={() => setMode('FAST')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${mode === 'FAST' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                         >
                            <FaMagic /> Rápido
                         </button>
                         <button 
                            onClick={() => setMode('TRAINING')}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${mode === 'TRAINING' ? 'bg-[#A0522D] text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                         >
                            <FaDumbbell /> Entrenamiento
                         </button>
                     </div>
                 )}
             </div>

             {/* Main Content */}
             <div className="p-6 lg:p-8 flex-1 flex flex-col gap-8">
                 {selectedProduct && (
                     <>
                        {/* Control Panel */}
                        <div className="flex flex-col md:flex-row gap-6 items-end bg-muted/10 p-6 rounded-xl border border-border">
                            <div className="flex-1 w-full">
                                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">
                                    {selectedProduct.productionStrategy === 'VOLUME_BATCH' ? 'Cantidad de Lotes' : 'Unidades a Producir'}
                                </label>
                                <div className="flex items-center gap-4">
                                     <button onClick={() => setQuantityProduced(Math.max(1, quantityProduced - 1))} className="w-10 h-10 rounded-full bg-muted hover:bg-primary/20 hover:text-primary font-bold transition-colors">-</button>
                                     <span className="text-3xl font-bold font-mono min-w-[2ch] text-center">{quantityProduced}</span>
                                     <button onClick={() => setQuantityProduced(quantityProduced + 1)} className="w-10 h-10 rounded-full bg-muted hover:bg-primary/20 hover:text-primary font-bold transition-colors">+</button>
                                </div>
                            </div>
                            
                            <div className="flex-1 w-full text-right">
                                 <p className="text-sm text-muted-foreground mb-1">Rendimiento Estimado</p>
                                 <div className="flex items-center justify-end gap-2 text-2xl font-bold text-emerald-600">
                                     <FaArrowRight size={16} className="text-muted-foreground" />
                                     {selectedProduct.productionStrategy === 'VOLUME_BATCH' 
                                        ? <span>{((selectedProduct.defaultContainer?.capacity || 0) * quantityProduced).toFixed(1)} <span className="text-sm text-emerald-600/70">{selectedProduct.defaultContainer?.unit}</span></span>
                                        : <span>{quantityProduced} <span className="text-sm text-emerald-600/70">Unidades</span></span>
                                     }
                                 </div>
                            </div>
                        </div>

                        {/* Ingredients Table */}
                         <div>
                             <h3 className="font-bold text-lg mb-4 flex items-center justify-between">
                                <span>Insumos Necesarios</span>
                                {mode === 'TRAINING' && <span className="text-xs font-normal text-[#A0522D] bg-[#A0522D]/10 px-2 py-1 rounded-full animate-pulse">Modo Edición Activo</span>}
                             </h3>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 {sessionRecipe.map((ing, idx) => {
                                     // Lookup current stock
                                     const currentStock = getStock(ing.ingredientId, ing.unit) || 0;
                                     const isLowStock = currentStock < (ing.quantity || 0); // Warning threshold
                                     
                                     return (
                                     <div key={ing.ingredientId + idx} className={`relative flex items-center justify-between p-4 rounded-xl transition-all border shadow-sm group ${ing.ingredientId.startsWith('CUSTOM_') ? 'bg-amber-50/50 border-amber-200' : 'bg-card border-border hover:border-primary/30'}`}>
                                         <div className="flex items-center gap-4">
                                             <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs ring-2 ring-offset-2 ${isLowStock ? 'bg-destructive/10 text-destructive ring-destructive/20' : 'bg-muted text-muted-foreground ring-transparent'}`}>
                                                 {ing.unit.slice(0,2).toUpperCase()}
                                             </div>
                                             <div>
                                                 <span className="text-foreground font-bold block text-sm lg:text-base">{ing.ingredientName}</span>
                                                 {/* Stock Indicator */}
                                                 {!ing.ingredientId.startsWith('CUSTOM_') && (
                                                     <div className="flex items-center gap-1.5 mt-0.5">
                                                         <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm ${isLowStock ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>
                                                             Stock: {currentStock.toFixed(2)}
                                                         </span>
                                                         {isLowStock && <span className="text-[10px] text-destructive font-bold animate-pulse">Insuficiente</span>}
                                                     </div>
                                                 )}
                                                 {ing.ingredientId.startsWith('CUSTOM_') && <span className="text-[9px] text-amber-700 font-bold uppercase tracking-wider bg-amber-100 px-1.5 py-0.5 rounded">Revisar Inventario</span>}
                                             </div>
                                         </div>
                                         {/* Inputs */}
                                         <div className="flex items-center gap-6">
                                             <div className="flex flex-col items-center gap-1">
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Usado</span>
                                                <NumberInput 
                                                    value={ing.quantity || 0}
                                                    onValueChange={(val) => handleIngredientChange(idx, 'quantity', val)}
                                                    readOnly={mode !== 'TRAINING'} // ONLY Editable in Training
                                                    style={{ width: `${Math.max(3, (ing.quantity || 0).toString().length) + 2}ch` }}
                                                    className={`min-w-[60px] text-center p-2 rounded-lg border-2 outline-none transition-all text-xl font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                                        mode === 'TRAINING' 
                                                            ? 'bg-[#A0522D]/5 border-[#A0522D]/30 text-[#5D4037] focus:ring-[#A0522D] cursor-text' 
                                                            : 'bg-transparent border-transparent text-foreground cursor-default'
                                                    } ${isLowStock ? 'text-destructive font-black' : ''}`}
                                                />
                                             </div>
                                             {/* Waste */}
                                             <div className={`flex flex-col items-center gap-1 transition-opacity ${mode === 'TRAINING' ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                                                <span className="text-[9px] font-bold text-destructive/50 uppercase tracking-wider">Merma</span>
                                                <NumberInput 
                                                    value={ing.waste || 0}
                                                    onValueChange={(val) => handleIngredientChange(idx, 'waste', val)}
                                                    readOnly={mode !== 'TRAINING'}
                                                    style={{ width: `${Math.max(2, (ing.waste || 0).toString().length) + 2}ch` }}
                                                    className="min-w-[50px] text-center p-2 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive focus:border-destructive outline-none transition-all text-lg font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                                                />
                                             </div>
                                         </div>
                                     </div>
                                 )})}
                             </div>
                         </div>
                        
                        {/* Submit Actions */}
                        <div className="mt-8 pt-8 border-t border-border flex justify-end gap-4">
                            <SmartInput 
                                placeholder="Notas opcionales (Lote #, Observaciones...)"
                                value={notes}
                                onValueChange={setNotes}
                                className="flex-1 bg-muted/20 border-border rounded-xl px-4 focus:ring-2 focus:ring-primary/20"
                            />
                            <button 
                                onClick={handleProduce}
                                disabled={submitting}
                                className="px-8 py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl shadow-lg hover:shadow-primary/30 hover:bg-primary/90 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <span className="animate-pulse">Guardando...</span>
                                ) : (
                                    <>
                                        <FaCheckCircle /> Confirmar Producción
                                    </>
                                )}
                            </button>
                        </div>
                     </>
                 )}

                 {!selectedProduct && (
                     <div className="p-12 lg:p-24 text-center text-muted-foreground">
                         <FaClipboardList className="text-6xl mx-auto mb-4 opacity-10" />
                         <p className="text-lg">Selecciona una receta arriba para comenzar.</p>
                     </div>
                 )}
            </div>
        </div>
    </div>
  );
}
