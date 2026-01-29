"use client";

import React, { useState, useEffect } from "react";
import { FaTimes, FaCog } from "react-icons/fa";
import ProductionEntryForm, { ContainerDef, IngredientInput } from "./ProductionEntryForm";
import { ProductoData } from "../types/productTypes";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: ProductoData | null;
  onConfirm: (data: any) => Promise<void>;
  onConfigUpdate?: (id: string, data: any) => Promise<void>; // Prop to handle upgrades
}

const ProductionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
  onConfigUpdate,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'PRODUCTION' | 'CONFIG'>('PRODUCTION');
  
  // Local state for immediate UI feedback after config change
  const [localProduct, setLocalProduct] = useState<ProductoData | null>(null);

  useEffect(() => {
      setLocalProduct(product);
      setView('PRODUCTION'); // Reset view on open
  }, [product, isOpen]);

  if (!isOpen || !localProduct) return null;

  const productTitle = localProduct.title;

  // STRATEGY LOGIC
  const strategy = localProduct.productionStrategy || 'BASIC';

  // CONTAINER LOGIC
  const mockContainers: ContainerDef[] = localProduct.defaultContainer?.capacity 
    ? [ { 
        id: 'custom', 
        name: localProduct.defaultContainer.name, 
        standardCapacity: localProduct.defaultContainer.capacity, 
        unit: strategy === 'VOLUME_BATCH' ? 'Lts' : 'un' 
      } ]
    : strategy === 'VOLUME_BATCH' 
        ? [ { id: 'c1', name: 'Olla Chica', standardCapacity: 10, unit: 'Lts' }, { id: 'c2', name: 'Olla Grande', standardCapacity: 20, unit: 'Lts' } ]
    : strategy === 'UNIT_ASSEMBLY'
        ? [ { id: 'b1', name: 'Batea Std', standardCapacity: 20, unit: 'un' }, { id: 'b2', name: 'Caja Negra', standardCapacity: 50, unit: 'un' } ]
    : [ { id: 'basic', name: 'Lote', standardCapacity: 1, unit: 'un' } ];

  // INGREDIENTS
  const ingredients: IngredientInput[] = (localProduct.recipe && localProduct.recipe.length > 0)
    ? localProduct.recipe.map(r => ({ id: r.ingredientId, name: r.ingredientName, standardQty: r.quantity, unit: r.unit }))
    : strategy === 'UNIT_ASSEMBLY' 
      ? [ { id: 'i1', name: 'Carne / Base', standardQty: 2, unit: 'kg' }, { id: 'i2', name: 'Huevos / Ligante', standardQty: 5, unit: 'un' }, { id: 'i3', name: 'Pan Rallado', standardQty: 0.5, unit: 'kg' } ] 
      : [ { id: 'i1', name: 'Insumo Base', standardQty: 1, unit: 'kg' } ];

  const handleFormConfirm = async (data: any) => {
      setIsLoading(true);
      try {
          await onConfirm(data);
          onClose();
      } catch (error) {
          console.error("Error saving production:", error);
      } finally {
          setIsLoading(false);
      }
  };

  const saveConfig = async (newStrategy: string, newContainer: any) => {
      try {
          // Placeholder for future logic if needed
      } catch (e) { console.error(e); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-card border border-border text-card-foreground w-full max-w-md rounded-xl shadow-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-muted/30 p-4 border-b border-border flex justify-between items-center shrink-0">
            <div>
                <h2 className="text-xl font-serif font-bold text-primary">
                    {view === 'PRODUCTION' ? "Registrar Producción" : "Configuración"}
                </h2>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    {productTitle}
                </p>
            </div>
            <div className="flex items-center gap-2">
                {onConfigUpdate && (
                    <button 
                        onClick={() => setView(view === 'PRODUCTION' ? 'CONFIG' : 'PRODUCTION')}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-full hover:bg-muted"
                        title={view === 'PRODUCTION' ? "Configurar" : "Volver"}
                    >
                        {view === 'PRODUCTION' ? <FaCog /> : "↩"}
                    </button>
                )}
                <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                    <FaTimes />
                </button>
            </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
            {view === 'PRODUCTION' ? (
                <ProductionEntryForm 
                    productName={productTitle}
                    containerDefinitions={mockContainers}
                    ingredients={ingredients}
                    lastCalibration={localProduct.calibration} // Pass the learned truth
                    onConfirm={handleFormConfirm}
                />
            ) : (
                <ProductionConfigForm 
                    initialData={localProduct} 
                    onSave={(updates: any) => {
                        setLocalProduct(prev => prev ? ({ ...prev, ...updates }) : null);
                        setView('PRODUCTION');
                        // Helper to trigger DB save (requires imports)
                        onConfigUpdate && onConfigUpdate(localProduct.id, updates); 
                    }} 
                />
            )}
        </div>
      </div>
    </div>
  );
};

// Sub-component for Configuration
const ProductionConfigForm = ({ initialData, onSave }: any) => {
    const [strategy, setStrategy] = useState(initialData.productionStrategy || 'BASIC');
    const [container, setContainer] = useState(initialData.defaultContainer || { name: '', capacity: 0 });

    return (
        <div className="space-y-6">
             {/* Strategy Selector */}
             <div className="grid grid-cols-3 gap-2">
                  {[
                      { val: 'BASIC', label: 'Básica', icon: '📝' },
                      { val: 'VOLUME_BATCH', label: 'Olla/Volumen', icon: '🥣' },
                      { val: 'UNIT_ASSEMBLY', label: 'Ensamblaje', icon: '🍱' }
                  ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setStrategy(opt.val)}
                        className={`text-xs p-2 rounded border transition-all flex flex-col items-center gap-1 ${
                            strategy === opt.val 
                                ? 'bg-primary text-primary-foreground border-primary' 
                                : 'bg-background border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                          <span className="text-lg">{opt.icon}</span>
                          {opt.label}
                      </button>
                  ))}
            </div>

            {/* Container Inputs */}
            {strategy !== 'BASIC' && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre Contenedor</label>
                        <input
                            type="text"
                            value={container.name}
                            onChange={(e) => setContainer({...container, name: e.target.value})}
                            placeholder="Ej: Batea"
                            className="w-full px-3 py-2 rounded bg-muted/30 border border-input text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Capacidad (u/L)</label>
                        <input
                            type="number"
                            value={container.capacity}
                            onChange={(e) => setContainer({...container, capacity: Number(e.target.value)})}
                            placeholder="20"
                            className="w-full px-3 py-2 rounded bg-muted/30 border border-input text-sm"
                        />
                    </div>
                </div>
            )}

            <button 
                onClick={() => onSave({ productionStrategy: strategy, defaultContainer: container })}
                className="w-full py-2 bg-secondary text-secondary-foreground font-bold rounded-lg hover:bg-secondary/90"
            >
                Guardar Configuración
            </button>
        </div>
    );
}

export default ProductionModal;
