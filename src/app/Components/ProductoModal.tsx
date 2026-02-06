"use client";

import React, { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { ProductoProps, UsageCategory, RecetaItem, ProductoData } from "../types/productTypes";
import { FaBox, FaCashRegister, FaBarcode, FaTags, FaLayerGroup, FaCube, FaWeightHanging, FaTrash, FaTimes, FaSave } from "react-icons/fa";
import { SmartInput } from "./ui/SmartInput";
import { NumberInput } from "./ui/NumberInput";

interface Props {
  product?: ProductoProps | null; // If null/undefined -> Creation Mode
  onClose: () => void;
  onSaved?: () => void; // Callback to reload list
  onDelete?: () => void; // Optional delete handler
  variant?: 'INVENTORY' | 'PRODUCTION'; // New Prop
  availableIngredients?: ProductoData[];
}

const ProductoModal: React.FC<Props> = ({ product, onClose, onSaved, onDelete, variant = 'INVENTORY', availableIngredients = [] }) => {
  const isEditing = !!product?.id;

// ... (existing state and useEffect code remains the same)

  const handleDelete = () => {
      if (confirm('¿Estás seguro de que deseas eliminar este item? Esta acción no se puede deshacer.')) {
          if (onDelete) onDelete();
      }
  };


  const [formData, setFormData] = useState<Partial<ProductoProps>>({
    title: "",
    price: 0,
    cost: 0,
    Barcode: "",
    category: "",
    stock: 0,
    variablePrice: false,
    purchaseUnit: "",
    conversionFactor: 1,
    unit: "",
    supplier: "",
    usageCategory: 'PRODUCTION',
    productionStrategy: variant === 'PRODUCTION' ? 'UNIT_ASSEMBLY' : 'BASIC', // Default strategy based on variant
    defaultContainer: { name: "", capacity: 0 },
    recipe: [],
  });

  // Recipe Editor State
  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [ingredientQty, setIngredientQty] = useState(0);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title || "",
        price: product.price || 0,
        cost: product.cost !== undefined ? product.cost : (product.price || 0), // Fallback for migration
        Barcode: product.Barcode || "",
        category: product.category || "",
        stock: product.stock || 0,
        variablePrice: product.variablePrice || false,
        purchaseUnit: product.purchaseUnit || "",
        conversionFactor: product.conversionFactor || 1,
        unit: product.unit || "",
        supplier: product.supplier || "",
        usageCategory: product.usageCategory || 'PRODUCTION',
        productionStrategy: product.productionStrategy || (variant === 'PRODUCTION' ? 'UNIT_ASSEMBLY' : 'BASIC'),
        defaultContainer: product.defaultContainer || { name: "", capacity: 0 },
        recipe: product.recipe || [],
      });
    } else {
       // Reset for new creation
       setFormData({
        title: "",
        price: 0,
        cost: 0,
        Barcode: "",
        category: "",
        stock: 0,
        variablePrice: false,
        purchaseUnit: "",
        conversionFactor: 1,
        unit: "",
        supplier: "",
        usageCategory: 'PRODUCTION',
        productionStrategy: variant === 'PRODUCTION' ? 'UNIT_ASSEMBLY' : 'BASIC',
        defaultContainer: { name: "", capacity: 0 },
        recipe: [],
      });
    }
  }, [product, variant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" 
        ? checked 
        : (name === "price" || name === "stock" || name === "conversionFactor") 
            ? (value === "" ? 0 : Number(value)) // Keep as number in state, but logic above handles display
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Sanitize Data
      const cleanData: any = { ...formData };
      
      // Remove defaultContainer if strategy is BASIC (not needed)
      if (cleanData.productionStrategy === 'BASIC') {
          delete cleanData.defaultContainer;
      }
      
      // Clean recipe
      if (!cleanData.recipe || cleanData.recipe.length === 0) {
          delete cleanData.recipe;
      }

      // Remove any empty string keys (Fixes Firebase "field must not be empty" error)
      Object.keys(cleanData).forEach(key => {
          if (key === "") delete cleanData[key];
      });

      if (isEditing && product?.id) {
        // UPDATE
        const ref = doc(db, "Productos", product.id);
        await updateDoc(ref, cleanData);
      } else {
        // CREATE
        await addDoc(collection(db, "Productos"), {
            ...cleanData,
            createdAt: new Date().toISOString()
        });
      }
      
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error("Error al guardar:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200 p-2 md:p-4">
      {/* Reduced padding, added max-h, custom scrollbar */}
      <div className="bg-card border border-border flex flex-col rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 max-h-[95vh] md:max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        
        {/* Header - Fixed */}
        <div className="flex justify-between items-start p-6 border-b border-border bg-card rounded-t-2xl z-20 shrink-0">
            <div>
                <h2 className="text-xl font-serif font-bold text-foreground">
                    {isEditing ? "Editar Item" : (variant === 'PRODUCTION' ? "Nueva Receta" : "Nuevo Insumo")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {variant === 'PRODUCTION' ? "Configuración de producción." : "Detalles para inventario."}
                </p>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                <FaTimes size={20} />
            </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto custom-scrollbar p-6 space-y-4 shrink-1 bg-card/50">
          <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">Nombre del Item</label>
                <SmartInput
                  name="title"
                  value={formData.title}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, title: val }))}
                  placeholder={variant === 'PRODUCTION' ? "Ej. Milanesas de Carne" : "Ej. Harina 000"}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all shadow-sm text-sm"
                  required
                />
            </div>

            <div className="mb-2">
                <label className="block text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">Uso del Producto (Inventario)</label>
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { id: 'PRODUCTION', label: 'Insumo Cocina', icon: <FaWeightHanging />, title: 'Materia prima para cocinar (Carne, Verdura)' },
                        { id: 'ASSEMBLY', label: 'Insumo Armado', icon: <FaBox />, title: 'Listo para armar platos (Pan, Aderezos)' },
                        { id: 'DUAL', label: 'Uso Dual', icon: <FaCube />, title: 'Se usa tanto en cocina como en armado' },
                        { id: 'MENU', label: 'Item Menú', icon: <FaCashRegister />, title: 'Producto final de venta' },
                    ].map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, usageCategory: opt.id as UsageCategory }))}
                            className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 text-[10px] font-bold shadow-sm ${
                                formData.usageCategory === opt.id
                                    ? 'bg-primary text-primary-foreground border-primary ring-1 ring-primary/50'
                                    : 'bg-background border-border/50 text-muted-foreground hover:bg-muted hover:border-border hover:text-foreground'
                            }`}
                            title={opt.title}
                        >
                            <span className="text-lg">{opt.icon}</span>
                            <span>{opt.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Price Input for MENU Items */}
            {formData.usageCategory === 'MENU' && (
                <div className="p-4 border border-emerald-500/20 rounded-xl space-y-2 bg-emerald-500/5 animate-in fade-in">
                    <h3 className="text-xs font-bold text-emerald-700 flex items-center gap-2 mb-1">
                       <FaCashRegister /> Precio de Venta
                    </h3>
                    <div>
                        <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">
                              Precio en Menú ($)
                        </label>
                        <div className="relative">
                           <span className="absolute left-3 top-2 text-muted-foreground text-xs">$</span>
                           <NumberInput
                           value={formData.price || 0}
                           onValueChange={(val) => setFormData(prev => ({ ...prev, price: val }))}
                           placeholder="0"
                           className="w-full pl-6 pr-3 py-2 rounded-lg bg-background border border-emerald-500/30 focus:border-emerald-500 text-foreground text-lg font-bold shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                           />
                        </div>
                   </div>
                </div>
            )}



            {variant === 'INVENTORY' && formData.usageCategory !== 'MENU' && (
                <div className="p-4 border border-border rounded-xl space-y-4 bg-muted/20 animate-in fade-in">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-2 mb-1">
                       <FaBox className="text-primary"/> Configuración de Compra y Stock
                    </h3>
                    
                    <div className="flex items-center gap-2 text-xs bg-background p-3 rounded-lg border border-border/50 shadow-sm">
                        <div className="flex-1">
                            <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider text-center">Unidad Compra</label>
                            <SmartInput
                                value={formData.purchaseUnit}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, purchaseUnit: val }))}
                                placeholder="Ej: Caja"
                                className="w-full text-center font-bold bg-transparent border-none focus:ring-0 p-0 text-sm placeholder:text-muted-foreground/30 focus:outline-none"
                            />
                        </div>
                        <div className="text-muted-foreground font-bold text-lg">→</div>
                        <div className="w-20">
                            <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider text-center">Trae...</label>
                             <NumberInput
                                value={formData.conversionFactor || 0}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, conversionFactor: val }))}
                                placeholder="1"
                                className="w-full text-center font-bold bg-muted/50 rounded border border-border/50 py-0.5 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="flex-1">
                             <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider text-center">Unidad Uso</label>
                            <SmartInput
                                value={formData.unit || ""}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, unit: val }))}
                                placeholder="Ej: Un"
                                className="w-full text-center font-bold bg-transparent border-none focus:ring-0 p-0 text-sm placeholder:text-muted-foreground/30 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">
                                  Costo por {formData.purchaseUnit || "Bulto"}
                             </label>
                             <div className="relative">
                                <span className="absolute left-3 top-2 text-muted-foreground text-xs">$</span>
                                <NumberInput
                                value={formData.cost || 0}
                                onValueChange={(val) => setFormData(prev => ({ ...prev, cost: val }))}
                                placeholder="0"
                                className="w-full pl-6 pr-3 py-2 rounded-lg bg-background border border-foreground/20 focus:border-primary text-foreground text-sm font-bold shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                                />
                             </div>
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">
                                 Stock {formData.purchaseUnit ? `(en ${formData.purchaseUnit}s)` : ''}
                            </label>
                            <NumberInput
                              value={
                                 (formData.purchaseUnit && formData.conversionFactor && formData.conversionFactor > 1)
                                    ? Number(((formData.stock || 0) / formData.conversionFactor).toFixed(2))
                                    : (formData.stock || 0)
                              }
                              onValueChange={(val) => {
                                 const factor = (formData.purchaseUnit && formData.conversionFactor && formData.conversionFactor > 1) 
                                    ? formData.conversionFactor 
                                    : 1;
                                 setFormData(prev => ({ ...prev, stock: val * factor }))
                              }}
                              placeholder="0"
                              className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/20 focus:border-primary text-foreground text-sm font-bold shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none"
                            />
                             {(formData.purchaseUnit && formData.conversionFactor && formData.conversionFactor > 1) && (
                                <div className="text-[10px] text-end text-muted-foreground font-medium mt-1">
                                    Total: {Number((formData.stock || 0).toFixed(2))} {formData.unit || 'uds'}
                                </div>
                            )}
                        </div>
                    </div>
              </div>
            )}

            {/* Stock & Cost Inputs (Hidden for MENU) - Actually this block is Category/Barcode, so show it for all except PRODUCTION variants if needed, or keeping original logic */}
            {variant !== 'PRODUCTION' && (
                <div className="grid grid-cols-2 gap-4">
                   <div>
                        <label className="block text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">Categoría</label>
                        <input
                          type="text"
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          placeholder="Ej. Almacén"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all shadow-sm text-sm"
                        />
                   </div>
                   <div>
                        <label className="block text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">Código de Barras</label>
                        <input
                          type="text"
                          name="Barcode"
                          value={formData.Barcode}
                          onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all shadow-sm text-sm"
                        />
                   </div>
                </div>
            )}

            {variant !== 'PRODUCTION' && (
                <label className="flex items-center gap-3 text-foreground cursor-pointer p-2 hover:bg-muted/10 rounded-lg transition-colors border border-transparent hover:border-border/30">
                  <input
                    type="checkbox"
                    name="variablePrice"
                    checked={formData.variablePrice}
                    onChange={handleChange}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-xs font-bold">Precio variable (se define al vender/usar)</span>
                </label>
            )}


            {/* --- RECIPE EDITOR (Only for Menu) --- */}
            {formData.usageCategory === 'MENU' && (
                <div className="p-5 border border-primary/20 rounded-xl space-y-4 bg-primary/5 animate-in fade-in shadow-inner">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-primary flex items-center gap-2">
                           <FaLayerGroup /> Composición del Menú (Receta)
                        </h3>
                        <span className="text-[10px] text-muted-foreground bg-background px-2 py-1 rounded-full border border-border">
                            {formData.recipe?.length || 0} Ingredientes
                        </span>
                    </div>
                    
                    <div className="space-y-2">
                        {/* List Existing */}
                        {formData.recipe && formData.recipe.length > 0 ? (
                            <div className="space-y-1">
                                {formData.recipe.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs bg-background p-2 rounded border border-border">
                                        <div className="font-medium">{item.ingredientName}</div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-muted px-2 py-0.5 rounded">{item.quantity} {item.unit}</span>
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const newRecipe = [...(formData.recipe || [])];
                                                    newRecipe.splice(idx, 1);
                                                    setFormData(prev => ({ ...prev, recipe: newRecipe }));
                                                }}
                                                className="text-destructive hover:text-destructive/80 p-1"
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[10px] text-muted-foreground italic">Sin ingredientes definidos.</p>
                        )}

                        {/* Add New */}
                        <div className="flex gap-2 items-end pt-2 border-t border-border/50">
                            <div className="flex-1">
                                <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase">
                                    {formData.usageCategory === 'MENU' ? "Agregar Item de Armado" : "Agregar Ingrediente"}
                                </label>
                                <select 
                                    className="w-full px-2 py-1.5 rounded bg-background border border-foreground/30 text-xs focus:outline-none"
                                    value={selectedIngredientId}
                                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                                >
                                    <option value="">Seleccionar Item...</option>
                                    {availableIngredients
                                        .filter(i => {
                                            if (i.id === product?.id) return false;
                                            // MENU Restriction: Only Assembly or Dual items
                                            if (formData.usageCategory === 'MENU') {
                                                const cat = i.usageCategory || 'PRODUCTION'; // Default old items to PRODUCTION
                                                return cat === 'ASSEMBLY' || cat === 'DUAL';
                                            }
                                            return true;
                                        })
                                        .sort((a,b) => a.title.localeCompare(b.title))
                                        .map(i => (
                                            <option key={i.id} value={i.id}>{i.title} ({i.unit})</option>
                                        ))
                                    }
                                </select>
                            </div>
                            <div className="w-24">
                                <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase text-center">
                                    {formData.usageCategory === 'MENU' ? "Cant. x Plato" : "Cant. x Lote"}
                                </label>
                                <div className="relative">
                                    <NumberInput 
                                        value={ingredientQty} 
                                        onValueChange={setIngredientQty}
                                        className="w-full pl-2 pr-8 py-1.5 rounded bg-background border border-foreground/30 text-xs focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-2 top-1.5 text-[10px] text-muted-foreground pointer-events-none">
                                        {selectedIngredientId ? availableIngredients.find(i=>i.id===selectedIngredientId)?.unit : ''}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={!selectedIngredientId || ingredientQty <= 0}
                                onClick={() => {
                                    const ing = availableIngredients.find(i => i.id === selectedIngredientId);
                                    if (!ing) return;
                                    
                                    const newItem: RecetaItem = {
                                        ingredientId: ing.id,
                                        ingredientName: ing.title,
                                        quantity: ingredientQty,
                                        unit: ing.unit || 'un'
                                    };
                                    
                                    setFormData(prev => ({
                                        ...prev,
                                        recipe: [...(prev.recipe || []), newItem]
                                    }));
                                    
                                    setSelectedIngredientId("");
                                    setIngredientQty(0);
                                }}
                                className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs font-bold disabled:opacity-50"
                            >
                                + Add
                            </button>
                        </div>
                    </div>
                </div>
            )}

          </form>
        </div>

        {/* Footer - Fixed Sticky Bottom */}
        <div className="flex justify-between items-center bg-card border-t border-border p-4 rounded-b-2xl z-20 shrink-0">
            {isEditing && onDelete ? (
                <button
                    type="button"
                    onClick={() => {
                        if (window.confirm("¿Eliminar este item permanentemente?")) onDelete();
                    }}
                    className="p-3 rounded-xl text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Eliminar Item"
                >
                    <FaTrash size={18} />
                </button>
            ) : (
                <div className="w-8"></div> /* Spacer */
            )}

            <div className="flex gap-3">
                <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-xl border border-border text-foreground hover:bg-muted/10 transition-all font-bold text-sm"
                >
                Cancelar
                </button>
                <button
                type="submit"
                form="product-form"
                disabled={saving}
                className="px-6 py-2 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-md hover:shadow-primary/40 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                <FaSave /> {saving ? "..." : "Guardar"}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProductoModal;
