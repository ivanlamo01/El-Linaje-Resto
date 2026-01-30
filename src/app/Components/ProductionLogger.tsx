"use client";

import React, { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { doc, updateDoc, increment, addDoc, collection } from "firebase/firestore";
import { ProductoProps, RecetaItem } from "../types/productTypes";
import { FaCheckCircle, FaClipboardList, FaDumbbell, FaMagic, FaHistory, FaArrowRight, FaExclamationTriangle } from "react-icons/fa";
import { NumberInput } from "./ui/NumberInput";

interface Props {
  products: ProductoProps[];
  onProductionCompleted: () => void;
}

type Mode = 'FAST' | 'TRAINING';

export default function ProductionLogger({ products, onProductionCompleted }: Props) {
  const [mode, setMode] = useState<Mode>('FAST');
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Input: How many "Batches" or "Standard Units" initiated. Drives ingredient suggestions.
  const [inputQty, setInputQty] = useState<number>(0); 
  
  // Output: How many actual stock units produced.
  const [outputQty, setOutputQty] = useState<number>(0);
  const [wasteQty, setWasteQty] = useState<number>(0);

  // The "Session" ingredients (what we are actually deducting)
  const [sessionRecipe, setSessionRecipe] = useState<RecetaItem[]>([]);
  
  const [loading, setLoading] = useState(false);

  /* Container Selection Logic */
  const [selectedContainerIdx, setSelectedContainerIdx] = useState(0);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Derived: Current Active Container
  const activeContainer = selectedProduct 
      ? (selectedContainerIdx === 0 
            ? selectedProduct.defaultContainer 
            : selectedProduct.additionalContainers?.[selectedContainerIdx - 1]) 
      : null;

  // Initialize
  useEffect(() => {
    if (selectedProduct) {
        setInputQty(0);
        setOutputQty(0);
        setWasteQty(0);
        setSessionRecipe(selectedProduct.recipe ? JSON.parse(JSON.stringify(selectedProduct.recipe)) : []);
    } else {
        setSessionRecipe([]);
    }
  }, [selectedProduct]);

  // Handle Input Qty Change -> Update Suggestions
  useEffect(() => {
     if (selectedProduct && inputQty > 0) {
         // 1. Suggest Output Qty
         if (selectedProduct.productionStrategy === 'VOLUME_BATCH') {
             // Default yield = Batches * Capacity
             const stdCapacity = activeContainer?.capacity || 1;
             // Only update output if it was zero or looks like a default calculation (avoid overwriting user edit if possible, but hard to know)
             // For simplicity, whenever Input changes, we reset Output suggestion unless in Training mode we want strictly separate? 
             // Le's just auto-calc standard.
             setOutputQty(parseFloat((inputQty * stdCapacity).toFixed(2)));
         } else {
             // Unit Assembly: Input = Output
             setOutputQty(inputQty);
         }

         // 2. Suggest Ingredients (Standard)
         // Corrected: Now we apply this for both FAST and TRAINING so the user sees the "expected" amounts first.
         const scaledRecipe = (selectedProduct.recipe || []).map(item => ({
             ...item,
             quantity: parseFloat((item.quantity * inputQty).toFixed(2)) // Round to 2
         }));
         setSessionRecipe(scaledRecipe);
     } else if (inputQty === 0) {
         setOutputQty(0);
     }
  }, [inputQty, mode, selectedProduct]);

  const handleIngredientChange = (index: number, newVal: number) => {
      const updated = [...sessionRecipe];
      updated[index].quantity = parseFloat(newVal.toFixed(2));
      setSessionRecipe(updated);
  };

  const handleConfirm = async () => {
    if (!selectedProduct) return;
    setLoading(true);

    try {
        const productRef = doc(db, "Productos", selectedProduct.id);

        // 1. Update Product Stock (Actual Output)
        await updateDoc(productRef, {
            stock: increment(outputQty)
        });

        // 2. Deduct Ingredients (Actual Input) - SKIPPING CUSTOM INGREDIENTS
        for (const ing of sessionRecipe) {
            // Check if it's a valid ID (not CUSTOM_...) and has quantity
            const isCustom = ing.ingredientId.startsWith('CUSTOM_');
            
            if (ing.quantity > 0 && !isCustom) {
                 const ingRef = doc(db, "Productos", ing.ingredientId);
                 // We wrap this in a try/catch specifically for missing docs, though "isCustom" check should cover most cases
                 try {
                     await updateDoc(ingRef, {
                         stock: increment(-ing.quantity)
                     });
                 } catch (e) {
                     console.warn(`Could not deduct stock for ${ing.ingredientName} (${ing.ingredientId}). Maybe it was deleted?`, e);
                 }
            }
        }

        // 3. Training Mode Logic & History Logging (Unified)
        let changeLog: string[] = [];
        let updates: any = {};
        
        let yieldRatioForHistory = 0;
        if (inputQty > 0) {
            yieldRatioForHistory = outputQty / inputQty;
        }

        if (mode === 'TRAINING' && inputQty > 0) {
             console.log("Training Mode: Updating Master Data...");
             
             const currentTimes = selectedProduct.timesProduced || 0;
             const newTimes = currentTimes + 1;

             // A. Update Recipe (Inputs per Batch/Unit)
             const newMasterRecipe = (selectedProduct.recipe || []).map(masterItem => {
                 const usedItem = sessionRecipe.find(si => si.ingredientId === masterItem.ingredientId);
                 const totalUsedThisRun = usedItem ? usedItem.quantity : 0;
                 
                 // Avg calculation based on INPUT QTY (Batches)
                 const usagePerBatchThisRun = totalUsedThisRun / inputQty;

                 const oldAvg = masterItem.quantity;
                 const newAvg = ((oldAvg * currentTimes) + usagePerBatchThisRun) / newTimes;

                 // Trigger log if THIS SESSION deviated from the ESTABLISHED AVERAGE
                 if (Math.abs(usagePerBatchThisRun - oldAvg) > 0.01) {
                     changeLog.push(`${masterItem.ingredientName}: Usado ${usagePerBatchThisRun.toFixed(2)} (Base: ${oldAvg.toFixed(2)} -> ${newAvg.toFixed(2)})`);
                 }

                 return {
                     ...masterItem,
                     quantity: parseFloat(newAvg.toFixed(2))
                 };
             });

             updates = {
                 recipe: newMasterRecipe,
                 timesProduced: newTimes
             };

             // B. Update Capacity/Yield (Only for Batch)
             if (selectedProduct.productionStrategy === 'VOLUME_BATCH') {
                 const currentCapacity = selectedProduct.defaultContainer?.capacity || 0;
                 
                 // Weighted Average for Capacity
                 const newCapacity = ((currentCapacity * currentTimes) + yieldRatioForHistory) / newTimes;
                 
                 // Same trigger logic for Yield
                 if (Math.abs(yieldRatioForHistory - currentCapacity) > 0.1) {
                     changeLog.push(`Rendimiento: Dio ${yieldRatioForHistory.toFixed(1)} (Base: ${currentCapacity.toFixed(1)} -> ${newCapacity.toFixed(1)})`);
                 }
                 
                 updates.defaultContainer = {
                     ...selectedProduct.defaultContainer,
                     capacity: parseFloat(newCapacity.toFixed(2))
                 };
             }

             await updateDoc(productRef, updates);
        }

        // 4. Save History Log (For BOTH Modes)
        try {
             await addDoc(collection(db, `Productos/${productRef.id}/History`), {
                 date: new Date().toISOString(),
                 mode: mode, // 'FAST' or 'TRAINING'
                 inputQty, // Lotes
                 outputQty, // Unidades
                 wasteQty,
                 yieldRatio: parseFloat(yieldRatioForHistory.toFixed(2)),
                 changes: changeLog, // Array of strings describing what changed
                 notes: mode === 'TRAINING' ? "Ajuste de Receta" : "Producción Rápida"
             });
        } catch (err) {
             console.error("Error saving history log", err);
        }

         // Success Feedback without Alert (use toast ideally, but simple alert for now is robust enough)
         onProductionCompleted();
         // Reset
         setInputQty(0);
         setOutputQty(0);
         setWasteQty(0);
         setSelectedProductId("");
    } catch (error) {
        console.error("Error confirming production:", error);
        alert("Error al registrar producción");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 lg:space-y-8 animate-in fade-in slide-in-from-bottom-2 pb-24 lg:pb-0">
        {/* Helper Header */}
        <div className="text-center space-y-2 mb-6">
            <h2 className="text-2xl lg:text-3xl font-serif font-bold text-primary">Registrar Producción</h2>
            <p className="text-sm lg:text-base text-muted-foreground">Selecciona el modo de trabajo y carga tus resultados.</p>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-3 lg:gap-4 p-1.5 bg-muted/20 rounded-2xl max-w-lg mx-auto border border-border">
            <button 
                onClick={() => setMode('FAST')}
                className={`flex flex-col items-center justify-center py-4 lg:py-5 rounded-xl transition-all ${
                    mode === 'FAST' 
                        ? 'bg-card shadow-sm text-primary ring-1 ring-primary/20' 
                        : 'text-muted-foreground hover:bg-muted/50'
                }`}
            >
                <FaMagic className="text-xl lg:text-2xl mb-1 lg:mb-2" />
                <span className="font-bold text-xs lg:text-sm">Modo Rápido</span>
                <span className="text-[10px] lg:text-xs opacity-70 mt-0.5">Automático</span>
            </button>
            <button 
                onClick={() => setMode('TRAINING')}
                className={`flex flex-col items-center justify-center py-4 lg:py-5 rounded-xl transition-all ${
                    mode === 'TRAINING' 
                        ? 'bg-card shadow-sm text-[#A0522D] ring-1 ring-[#A0522D]/20' 
                        : 'text-muted-foreground hover:bg-muted/50'
                }`}
            >
                <FaDumbbell className="text-xl lg:text-2xl mb-1 lg:mb-2" />
                <span className="font-bold text-xs lg:text-sm">Entrenamiento</span>
                <span className="text-[10px] lg:text-xs opacity-70 mt-0.5">Ajustable</span>
            </button>
        </div>

        {/* Form Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
             {/* Product Selector */}
             <div className="p-4 lg:p-8 border-b border-border bg-muted/5 z-20 relative">
                 <label className="block text-xs font-bold text-muted-foreground mb-3 text-center uppercase tracking-widest">¿Qué vas a producir hoy?</label>
                 
                 {/* Custom Dropdown */}
                 <div className="relative max-w-xl mx-auto">
                     <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="w-full appearance-none p-4 pl-6 pr-12 text-lg lg:text-xl font-bold bg-background border border-input rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none shadow-sm transition-all text-center hover:border-primary/50 flex items-center justify-between group"
                     >
                        <span className={`block w-full text-center truncate ${!selectedProductId ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {selectedProductId 
                                ? products.find(p => p.id === selectedProductId)?.title 
                                : "-- Seleccionar Receta --"}
                        </span>
                        
                        {/* Custom Chevron */}
                        <div className={`absolute right-4 text-muted-foreground transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}>
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </div>
                     </button>

                     {/* Dropdown Menu */}
                     {dropdownOpen && (
                         <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 max-h-[300px] overflow-y-auto">
                             {products.length === 0 ? (
                                 <div className="p-4 text-center text-muted-foreground text-sm">No hay recetas disponibles.</div>
                             ) : (
                                 products.map(p => (
                                     <button
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedProductId(p.id);
                                            setDropdownOpen(false);
                                        }}
                                        className={`w-full text-left p-4 hover:bg-primary/5 border-b border-border/50 last:border-0 flex justify-between items-center transition-colors ${
                                            selectedProductId === p.id ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                                        }`}
                                     >
                                        <span className="font-bold truncate">{p.title}</span>
                                        {selectedProductId === p.id && <FaCheckCircle className="text-primary flex-shrink-0" />}
                                     </button>
                                 ))
                             )}
                         </div>
                     )}
                     
                     {/* Backdrop to close */}
                     {dropdownOpen && (
                         <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                     )}
                 </div>
             </div>

             {selectedProduct && (
                 <div className="p-4 lg:p-8 space-y-8 lg:space-y-10">
                     {/* Container Selector (Fixed Segmented Control) */}
                     {(selectedProduct.additionalContainers && selectedProduct.additionalContainers.length > 0) && selectedProduct.productionStrategy === 'VOLUME_BATCH' && (
                         <div className="flex justify-center -mb-6 relative z-10 overflow-x-auto pb-2 hide-scrollbar">
                              <div className="bg-[#E7DCCA] p-1.5 rounded-2xl flex gap-1 shadow-inner border border-[#D7CCC8] min-w-max">
                                  {[selectedProduct.defaultContainer, ...(selectedProduct.additionalContainers || [])].map((cont, idx) => (
                                      <button
                                          key={idx}
                                          onClick={() => setSelectedContainerIdx(idx)}
                                          className={`relative px-4 lg:px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 overflow-hidden group ${
                                              selectedContainerIdx === idx
                                                  ? 'bg-[#D7CCC8] text-[#5D4037] shadow-sm ring-1 ring-[#5D4037]/10'
                                                  : 'text-[#8D6E63] hover:bg-[#D7CCC8]/50'
                                          }`}
                                      >
                                          <span className={`block text-[10px] uppercase mb-0.5 tracking-widest font-serif ${selectedContainerIdx === idx ? 'opacity-80' : 'opacity-60'}`}>
                                              {idx === 0 ? "Principal" : `Opción #${idx}`}
                                          </span>
                                          <span className="text-sm lg:text-base whitespace-nowrap">
                                            {cont?.name || `Contenedor ${idx + 1}`}
                                          </span>
                                          
                                          {/* Active Indicator Line */}
                                           {selectedContainerIdx === idx && (
                                               <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-0.5 bg-[#5D4037]/30 rounded-full" />
                                           )}
                                      </button>
                                  ))}
                              </div>
                         </div>
                     )}

                     {/* Quantity Inputs */}
                     <div className="flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-12 p-4 lg:p-8">
                         {/* Input A: Strategy Based (e.g. Batches) */}
                         <div className="flex flex-col items-center space-y-3 w-full md:w-auto">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/20 px-3 py-1 rounded-full">
                                {selectedProduct.productionStrategy === 'VOLUME_BATCH' 
                                    ? `Lotes Ingresados` 
                                    : "Unidades a Producir"
                                }
                            </span>
                            <div className="flex items-center gap-3 bg-muted/5 p-4 rounded-2xl border border-transparent focus-within:border-primary/20 focus-within:bg-muted/10 transition-all w-full md:w-auto justify-center">
                                <NumberInput 
                                    value={inputQty || 0}
                                    onValueChange={setInputQty}
                                    placeholder="0"
                                    style={{ width: `${Math.max(1, (inputQty || 0).toString().length) + 3}ch` }}
                                    className="min-w-[80px] text-center text-5xl lg:text-6xl font-black bg-transparent border-none outline-none py-1 text-foreground transition-all placeholder:text-muted-foreground/10 hover:cursor-text"
                                    autoFocus
                                />
                                <span className="text-sm font-bold text-muted-foreground whitespace-nowrap opacity-60">
                                    {selectedProduct.productionStrategy === 'VOLUME_BATCH' 
                                         ? (activeContainer?.unit || 'Lotes') 
                                                // Show container name if available 
                                                + (activeContainer?.name ? ` (${activeContainer.name})` : '')
                                         : 'Unidades'
                                    }
                                </span>
                            </div>
                         </div>

                         {/* Arrow */}
                         {selectedProduct.productionStrategy === 'VOLUME_BATCH' && (
                             <div className="text-muted-foreground/10 hidden md:block rotate-90 md:rotate-0">
                                 <FaArrowRight size={24} />
                             </div>
                         )}

                         {/* Input B: Final Yield */}
                         {selectedProduct.productionStrategy === 'VOLUME_BATCH' && (
                             <div className="flex flex-col items-center space-y-4 animate-in fade-in slide-in-from-left-4 w-full md:w-auto">
                                <div className="flex gap-4 lg:gap-12 w-full justify-center">
                                    {/* Real Yield (Good Units) */}
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 bg-muted/20 px-3 py-1 rounded-full">
                                            Rendimiento
                                            {mode === 'TRAINING' && <FaDumbbell className="text-[#A0522D] w-3 h-3" />}
                                        </span>
                                        <div className={`flex items-center gap-3 p-2 rounded-xl border border-transparent transition-all ${mode === 'TRAINING' ? 'focus-within:bg-[#A0522D]/5 focus-within:border-[#A0522D]/20' : 'opacity-80'}`}>
                                            <NumberInput 
                                                value={outputQty || 0}
                                                onValueChange={(val) => mode === 'TRAINING' && setOutputQty(val)}
                                                readOnly={mode === 'FAST'}
                                                style={{ width: `${Math.max(1, (outputQty || 0).toString().length) + 3}ch` }}
                                                className={`min-w-[60px] text-center text-4xl lg:text-5xl font-black border-none outline-none py-1 transition-all bg-transparent placeholder:text-muted-foreground/10 ${
                                                    mode === 'TRAINING' 
                                                        ? 'text-[#A0522D] cursor-text' 
                                                        : 'text-foreground cursor-default'
                                                }`}
                                            />
                                            <span className="text-sm font-bold text-muted-foreground whitespace-nowrap opacity-60">
                                                {activeContainer?.unit || 'un'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Waste (Merma) */}
                                    <div className={`flex flex-col items-center gap-2 transition-opacity ${mode === 'FAST' ? 'opacity-60 grayscale' : 'opacity-100'}`}>
                                        <span className="text-[10px] font-bold text-destructive/70 uppercase tracking-widest flex items-center gap-2 bg-destructive/10 px-3 py-1 rounded-full">
                                            Merma
                                        </span>
                                        <div className={`flex items-center gap-3 p-2 rounded-xl border border-transparent transition-all ${mode === 'TRAINING' ? 'focus-within:bg-destructive/5 focus-within:border-destructive/20' : ''}`}>
                                            <NumberInput 
                                                value={wasteQty || 0}
                                                onValueChange={(val) => mode === 'TRAINING' && setWasteQty(val)}
                                                readOnly={mode === 'FAST'}
                                                style={{ width: `${Math.max(1, (wasteQty || 0).toString().length) + 3}ch` }}
                                                className={`min-w-[50px] text-center text-3xl lg:text-4xl font-black border-none outline-none py-1 transition-all bg-transparent placeholder:text-destructive/10 ${
                                                    mode === 'TRAINING' ? 'text-destructive cursor-text' : 'text-destructive/50 cursor-default'
                                                }`}
                                            />
                                            <span className="text-sm font-bold text-destructive/50 whitespace-nowrap">
                                                {activeContainer?.unit || 'un'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                             </div>
                         )}
                     </div>

                     {/* Ingredients / Calibration */}
                     {inputQty > 0 && (
                         <div className="animate-in fade-in slide-in-from-bottom-4">
                             <div className="flex justify-between items-center mb-4 px-2">
                                <h3 className="font-bold text-base lg:text-lg flex items-center gap-2 text-foreground/80">
                                    {mode === 'FAST' ? <FaCheckCircle className="text-primary"/> : <FaDumbbell className="text-[#A0522D]"/>}
                                    {mode === 'FAST' ? 'Consumo de Insumos (Calculado)' : 'Consumo Real (Para Entrenar)'}
                                </h3>
                                {mode === 'FAST' && <span className="text-[10px] lg:text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full hidden sm:inline-block">Automático según receta</span>}
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                 {sessionRecipe.map((ing, idx) => (
                                     <div key={ing.ingredientId + idx} className={`flex items-center justify-between p-3 lg:p-4 rounded-xl transition-all border ${ing.ingredientId.startsWith('CUSTOM_') ? 'bg-amber-50/50 border-amber-200' : 'bg-muted/20 border-transparent hover:border-border'}`}>
                                         <div className="flex items-center gap-3">
                                             {ing.ingredientId.startsWith('CUSTOM_') && (
                                                 <div className="text-amber-500 mt-1" title="Posible inconsistencia en inventario">
                                                     <FaExclamationTriangle />
                                                 </div>
                                             )}
                                             <div>
                                                 <span className="text-foreground font-bold block text-sm lg:text-base">{ing.ingredientName}</span>
                                                 {ing.ingredientId.startsWith('CUSTOM_') && <span className="text-[9px] text-amber-700 font-bold uppercase tracking-wider bg-amber-100 px-1.5 py-0.5 rounded">Revisar Inventario</span>}
                                             </div>
                                         </div>
                                         <div className="flex items-center gap-2">
                                             <NumberInput 
                                                value={ing.quantity || 0}
                                                onValueChange={(val) => handleIngredientChange(idx, val)}
                                                readOnly={mode !== 'TRAINING'} // ONLY Editable in Training
                                                style={{ width: `${Math.max(3, (ing.quantity || 0).toString().length) + 3}ch` }}
                                                className={`min-w-[70px] text-center px-2 py-2 rounded-lg border-2 outline-none transition-all text-lg font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                                    mode === 'TRAINING' 
                                                        ? 'bg-[#A0522D]/10 border-[#A0522D]/50 text-[#5D4037] focus:ring-[#A0522D] cursor-text' 
                                                        : 'bg-transparent border-transparent text-muted-foreground cursor-default opacity-80'
                                                }`}
                                             />
                                             <span className="text-xs font-bold text-muted-foreground w-8 text-center uppercase">{ing.unit}</span>
                                         </div>
                                     </div>
                                 ))}
                             </div>

                             {mode === 'TRAINING' && (
                                 <div className="mt-6 p-4 bg-[#A0522D]/10 text-[#5D4037] text-sm rounded-xl border border-[#A0522D]/20 flex gap-4 items-start">
                                     <div className="p-2 bg-white rounded-full shadow-sm text-[#A0522D] hidden sm:block">
                                         <FaDumbbell size={16} />
                                     </div>
                                     <div>
                                         <strong className="block mb-1 font-bold">Entrenando el Algoritmo</strong> 
                                         <ul className="list-disc list-inside space-y-1 opacity-90 text-xs sm:text-sm">
                                             <li>Se actualizará el promedio de <strong>Ingredientes por Lote</strong>.</li>
                                             {selectedProduct.productionStrategy === 'VOLUME_BATCH' && (
                                                 <li>Se actualizará el promedio de <strong>Rendimiento (Unidades por Lote)</strong>.</li>
                                             )}
                                             <li className="pt-1 mt-1 border-t border-[#A0522D]/20 w-full font-mono text-xs">
                                                 Iteración Actual: <strong className="text-[#A0522D]">#{ (selectedProduct.timesProduced || 0) + 1 }</strong>
                                             </li>
                                         </ul>
                                     </div>
                                 </div>
                             )}
                         </div>
                     )}
                     
                     {/* Action Button */}
                     <button
                        onClick={handleConfirm}
                        disabled={loading || inputQty <= 0}
                        className={`w-full py-5 lg:py-6 text-xl lg:text-2xl font-bold rounded-xl shadow-xl transition-all transform active:scale-[0.98] ${
                            loading || inputQty <= 0 ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground' :
                            mode === 'TRAINING'
                                ? 'bg-[#A0522D] text-white hover:bg-[#8B4513] shadow-[#A0522D]/25'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/25'
                        }`}
                     >
                        {loading 
                            ? "Guardando..." 
                            : (mode === 'TRAINING' ? "Guardar y Entrenar Receta" : "Confirmar Producción")
                        }
                     </button>
                 </div>
             )}

             {!selectedProduct && (
                 <div className="p-12 lg:p-24 text-center text-muted-foreground">
                     <FaClipboardList className="text-6xl mx-auto mb-4 opacity-10" />
                     <p className="text-lg">Selecciona una receta arriba para comenzar.</p>
                 </div>
             )}
        </div>
    </div>
  );
}
