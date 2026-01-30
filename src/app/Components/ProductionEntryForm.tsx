"use client";

import React, { useState, useEffect } from "react";
import { FaBolt, FaClipboardCheck, FaExclamationTriangle, FaLeaf, FaWeightHanging, FaBoxOpen } from "react-icons/fa";
import { NumberInput } from "./ui/NumberInput";

// Component Types (Can be moved if reused)
export interface IngredientInput {
    id: string;
    name: string;
    standardQty: number; // Standard amount per 1 container
    unit: string;
}

export interface ContainerDef {
    id: string;
    name: string;
    standardCapacity: number; // e.g., 20 units or 10 liters
    unit: string; // "un" or "lts"
}

export interface CalibrationData {
    containerId: string;
    yieldFactor: number; // e.g. 1.1 means 10% more output than standard
    ingredientModifiers?: Record<string, number>; // e.g. { "meatId": 1.05 } (5% more meat)
}

interface Props {
    productName: string;
    containerDefinitions: ContainerDef[];
    ingredients: IngredientInput[]; // Recipe for 1 Standard Container
    lastCalibration?: CalibrationData; // The "Learned Truth"
    onConfirm: (data: any) => void;
}

export default function ProductionEntryForm({
    productName,
    containerDefinitions,
    ingredients,
    lastCalibration,
    onConfirm
}: Props) {
    const [mode, setMode] = useState<'QUICK' | 'DETAILED'>('QUICK');
    const [selectedContainerId, setSelectedContainerId] = useState<string>(containerDefinitions[0]?.id || "");
    const [containerCount, setContainerCount] = useState<number>(1);
    
    // Detailed Mode State
    const [realOutput, setRealOutput] = useState<number>(0);
    const [ingredientAdjustments, setIngredientAdjustments] = useState<Record<string, number>>({});

    const selectedContainer = containerDefinitions.find(c => c.id === selectedContainerId);
    
    // --- CALCULATIONS ---

    // 1. Standard Theory
    const standardYieldPerContainer = selectedContainer ? selectedContainer.standardCapacity : 0;
    const totalStandardYield = standardYieldPerContainer * containerCount;

    // 2. Calibrated Reality (The "Learned" Prediction)
    // Only apply calibration if it matches the selected container (or could be global, but per-container is safer)
    const calibrationFactor = (lastCalibration && lastCalibration.containerId === selectedContainerId) 
        ? lastCalibration.yieldFactor 
        : 1;

    const learnedYieldPerContainer = standardYieldPerContainer * calibrationFactor;
    const learnedTotalYield = learnedYieldPerContainer * containerCount;

    // 3. Display Value
    // In Quick Mode, we show the "Learned Prediction". 
    // In Training Mode, we show the "User Input" (defaulting to Learned Prediction initially).
    const displayYield = mode === 'QUICK' ? Math.round(learnedTotalYield) : realOutput;

    // Effect: Init Detailed Values when context changes
    useEffect(() => {
        if (selectedContainer) {
            setRealOutput(Math.round(learnedTotalYield));
            
            // Init Ingredients (Base * Count * CalibrationModifier)
            const initialIngredients: Record<string, number> = {};
            ingredients.forEach(ing => {
                const modifier = (lastCalibration?.ingredientModifiers?.[ing.id]) || 1;
                initialIngredients[ing.id] = parseFloat((ing.standardQty * containerCount * modifier).toFixed(2));
            });
            setIngredientAdjustments(initialIngredients);
        }
    }, [selectedContainerId, containerCount, lastCalibration]); // Re-run when basis changes

    // --- HANDLERS ---
    const handleConfirm = () => {
        const payload = {
            mode,
            containerId: selectedContainerId,
            containerCount,
            producedQuantity: displayYield, // The final number to add to stock
            // In Quick Mode, backend uses "Estimated". In Detailed, it saves the new calibration.
            ingredientsUsed: mode === 'QUICK' ? 'ESTIMATED' : ingredientAdjustments 
        };
        onConfirm(payload);
    };

    if (!selectedContainer) return <div className="p-4 text-center text-muted-foreground">Configuración de contenedores faltante.</div>;

    // Styles
    const activeTab = "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/50";
    const inactiveTab = "bg-muted/50 text-muted-foreground hover:bg-muted";

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            
            {/* --- TOP: Mode Toggle --- */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/20 rounded-xl mb-6 self-center w-full max-w-[300px]">
                <button
                    onClick={() => setMode('QUICK')}
                    className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg text-xs font-bold transition-all ${mode === 'QUICK' ? activeTab : inactiveTab}`}
                >
                    <FaBolt size={14} className="mb-1" />
                    MODO RÁPIDO
                </button>
                <button
                    onClick={() => setMode('DETAILED')}
                    className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg text-xs font-bold transition-all ${mode === 'DETAILED' ? activeTab : inactiveTab}`}
                >
                    <FaClipboardCheck size={14} className="mb-1" />
                    ENTRENAMIENTO
                </button>
            </div>

            {/* --- MIDDLE: Container Selection (Chips) --- */}
            <div className="mb-6">
                 <p className="text-xs font-bold text-muted-foreground uppercase text-center mb-2">Selecciona Contenedor</p>
                 <div className="flex flex-wrap justify-center gap-2">
                    {containerDefinitions.map(def => (
                        <button
                            key={def.id}
                            onClick={() => setSelectedContainerId(def.id)}
                            className={`
                                relative pl-3 pr-4 py-2 rounded-full border transition-all flex items-center gap-2
                                ${selectedContainerId === def.id 
                                    ? 'bg-secondary text-secondary-foreground border-secondary shadow-sm scale-105 font-bold' 
                                    : 'bg-card border-border text-muted-foreground hover:bg-muted'}
                            `}
                        >
                            <span className="bg-background/20 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                {def.unit === 'Lts' ? '🥣' : '📦'}
                            </span>
                            <span className="text-sm">{def.name}</span>
                        </button>
                    ))}
                 </div>
            </div>

            {/* --- MAIN INPUTS --- */}
            <div className="flex-1 overflow-y-auto px-1">
                
                {/* 1. Counter (Common) */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center gap-6 bg-card border border-border p-2 rounded-2xl shadow-sm">
                        <button 
                            onClick={() => setContainerCount(Math.max(1, containerCount - 1))}
                            className="w-12 h-12 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center text-2xl font-bold text-muted-foreground transition-all active:scale-95"
                        >-</button>
                        
                        <div className="text-center w-24">
                            <div className="text-4xl font-black text-foreground">{containerCount}</div>
                            <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                                {containerCount === 1 ? 'Unidad' : 'Unidades'}
                            </div>
                        </div>

                        <button 
                            onClick={() => setContainerCount(containerCount + 1)}
                            className="w-12 h-12 rounded-xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center text-2xl font-bold transition-all active:scale-95"
                        >+</button>
                    </div>
                </div>

                {/* 2. Mode Specific Content */}
                {mode === 'QUICK' ? (
                     <div className="text-center animate-in zoom-in-95 duration-200">
                        <div className="p-4 bg-muted/10 rounded-xl border border-border/50">
                            <p className="text-sm text-muted-foreground mb-1">Producción Estimada</p>
                            <div className="text-5xl font-serif font-bold text-primary mb-1">
                                {Math.round(learnedTotalYield)} <span className="text-xl font-sans text-muted-foreground font-medium">{selectedContainer.unit}</span>
                            </div>
                            
                            {/* Feedback Text */}
                            {calibrationFactor !== 1 ? (
                                <p className="text-xs text-amber-600 font-medium flex items-center justify-center gap-1 mt-2">
                                     <FaBolt size={10} />
                                     Ajustado por inteligencia: {calibrationFactor > 1 ? '+' : ''}{((calibrationFactor - 1) * 100).toFixed(0)}% vs estándar
                                </p>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-2">Basado en capacidad estándar ({standardYieldPerContainer} {selectedContainer.unit}/cont)</p>
                            )}
                        </div>
                     </div>
                ) : (
                    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                        
                        {/* A. Real Output Input */}
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-primary uppercase flex items-center gap-2">
                                    <FaBoxOpen /> Producción Real
                                </label>
                                {realOutput !== standardYieldPerContainer * containerCount && (
                                     <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${realOutput > totalStandardYield ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {realOutput > totalStandardYield ? '▲' : '▼'} Desviación: {((realOutput - totalStandardYield) / totalStandardYield * 100).toFixed(0)}%
                                     </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <NumberInput
                                    value={realOutput}
                                    onValueChange={setRealOutput}
                                    className="flex-1 p-3 text-right font-bold text-lg bg-background border-2 border-input rounded-lg focus:border-primary focus:outline-none"
                                />
                                <span className="font-bold text-muted-foreground w-10">{selectedContainer.unit}</span>
                            </div>
                        </div>

                        {/* B. Real Ingredients Input */}
                        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                            <label className="text-xs font-bold text-primary uppercase mb-3 block flex items-center gap-2">
                                <FaWeightHanging /> Insumos Gastados
                            </label>
                            
                            <div className="space-y-3">
                                {ingredients.map(ing => {
                                    const theor = ing.standardQty * containerCount;
                                    const curr = ingredientAdjustments[ing.id] || 0;
                                    const diff = curr - theor;
                                    const isModified = Math.abs(diff) > 0.01;

                                    return (
                                        <div key={ing.id} className="flex flex-col gap-1 pb-2 border-b border-border/40 last:border-0">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-foreground">{ing.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <NumberInput
                                                        value={curr}
                                                        onValueChange={(val) => setIngredientAdjustments(prev => ({...prev, [ing.id]: val}))}
                                                        className={`w-20 p-1 text-right border rounded text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${isModified ? 'border-amber-400 bg-amber-50' : 'border-border bg-transparent'}`}
                                                    />
                                                    <span className="text-xs text-muted-foreground w-6">{ing.unit}</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                                                <span>Teórico: {theor} {ing.unit}</span>
                                                {isModified && (
                                                    <span className="text-amber-600 font-bold">
                                                        {diff > 0 ? '+' : ''}{diff.toFixed(2)} {ing.unit}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- FOOTER CONTENT --- */}
            <div className="mt-4 pt-4 border-t border-border">
                {mode === 'QUICK' ? (
                     <div className="flex items-center justify-between text-xs text-muted-foreground mb-4 px-2">
                        <span>📝 Descuento automático de stock</span>
                        <span>⚡ Registro en 1 click</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg mb-4 border border-amber-100">
                        <FaExclamationTriangle />
                        <span>Esto recalibrará el rendimiento futuro del sistema.</span>
                    </div>
                )}

                <button
                    onClick={handleConfirm}
                    className={`
                        w-full py-4 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98]
                        ${mode === 'QUICK' 
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'}
                    `}
                >
                    {mode === 'QUICK' ? 'CONFIRMAR PRODUCCIÓN' : 'GUARDAR Y CALIBRAR'}
                </button>
            </div>
        </div>
    );
}
