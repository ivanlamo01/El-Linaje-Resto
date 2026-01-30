"use client";

import React, { useState, useEffect } from "react";
import { ProductoProps } from "../types/productTypes";
import { NumberInput } from "./ui/NumberInput";
import { SmartInput } from "./ui/SmartInput";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: ProductoProps;
  onConfirm: (quantity: number, purchaseUnit: string, conversionFactor: number) => Promise<void>;
}

const PurchaseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
}) => {
  const [purchaseQty, setPurchaseQty] = useState<string>("");
  const [purchaseUnit, setPurchaseUnit] = useState<string>(product.purchaseUnit || "Unidad");
  const [conversionFactor, setConversionFactor] = useState<string>(product.conversionFactor?.toString() || "1");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPurchaseQty("");
      setPurchaseUnit(product.purchaseUnit || "Unidad");
      setConversionFactor(product.conversionFactor?.toString() || "1");
      // If no config exists or it's just 1, maybe hint to configure? 
      // User requirement: "Allow changing it at least once to save".
      if (!product.purchaseUnit) setShowConfig(true);
      else setShowConfig(false);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseQty || Number(purchaseQty) <= 0) return;

    setIsLoading(true);
    try {
      const qty = Number(purchaseQty);
      const factor = Number(conversionFactor);
      
      await onConfirm(qty, purchaseUnit, factor);
      onClose();
    } catch (error) {
      console.error("Error submitting purchase:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalToAdd = Number(purchaseQty || 0) * Number(conversionFactor || 1);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-card border border-border text-card-foreground w-full max-w-md rounded-xl shadow-2xl p-6 relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 text-center">
            <h2 className="text-2xl font-serif font-bold text-primary mb-1">
                Ingreso de Mercadería
            </h2>
            <p className="text-sm text-muted-foreground">
                Producto: <span className="font-semibold text-foreground">{product.title}</span>
            </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Purchase Quantity */}
            <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                    <label className="text-sm font-medium text-muted-foreground block text-left">
                        Cantidad Comprada
                    </label>
                    <div className="relative">
                        <NumberInput
                            value={Number(purchaseQty) || 0}
                            onValueChange={(val) => setPurchaseQty(val.toString())}
                            autoFocus
                            className="w-full text-xl font-bold p-3 bg-muted/30 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all text-foreground"
                            placeholder="0"
                        />
                    </div>
                </div>
                
                {/* Unit Display / Selection */}
                <div className="w-1/3 space-y-2">
                     <label className="text-sm font-medium text-muted-foreground block text-left">
                        Unidad
                    </label>
                    {showConfig ? (
                        <SmartInput 
                            value={purchaseUnit}
                            onValueChange={setPurchaseUnit}
                            className="w-full p-3 bg-muted/30 border border-input rounded-lg text-sm"
                            placeholder="Ej: Caja"
                        />
                    ) : (
                        <div 
                            onClick={() => setShowConfig(true)}
                            className="w-full p-3 bg-muted border border-border rounded-lg text-center font-medium cursor-pointer hover:bg-muted/80 text-sm truncate"
                            title="Click para cambiar unidad de compra"
                        >
                            {purchaseUnit}
                        </div>
                    )}
                </div>
            </div>

            {/* Conversion Config */}
            {(showConfig || Number(conversionFactor) !== 1) && (
                <div className="p-4 bg-muted/20 border border-border rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Conversión:</span>
                        <button 
                            type="button" 
                            onClick={() => setShowConfig(!showConfig)}
                            className="text-xs text-secondary hover:underline"
                        >
                            {showConfig ? "Ocultar config" : "Editar"}
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                        <span>1 <strong>{purchaseUnit || "Unidad"}</strong> = </span>
                        <NumberInput
                            value={Number(conversionFactor) || 0}
                            onValueChange={(val) => setConversionFactor(val.toString())}
                            className="w-16 p-1 text-center font-bold bg-background border border-input rounded"
                        />
                        <span>Unidades de Stock</span>
                    </div>
                </div>
            )}

            {/* Summary */}
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-center">
                <p className="text-sm text-primary">
                    Estás ingresando {purchaseQty || 0} {purchaseUnit || "Bultos"}.
                </p>
                <p className="text-base font-bold text-foreground mt-1">
                    Se sumarán {totalToAdd} {product.unit || 'un'} al stock.
                </p>
                <div className="text-xs text-muted-foreground mt-2 border-t border-primary/10 pt-2">
                    Stock Actual: {product.stock} ➝ Nuevo Stock: {product.stock + totalToAdd}
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 py-3 px-4 rounded-lg border border-border text-muted-foreground font-medium hover:bg-muted/50 transition-colors"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isLoading || !purchaseQty}
                    className="flex-1 py-3 px-4 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-md disabled:opacity-50"
                >
                    {isLoading ? "Guardando..." : "Confirmar Compra"}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default PurchaseModal;
