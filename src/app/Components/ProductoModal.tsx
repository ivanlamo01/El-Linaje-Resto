"use client";

import React, { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { ProductoProps } from "../types/productTypes";
import { FaBox, FaCashRegister, FaBarcode, FaTags, FaLayerGroup, FaCube, FaWeightHanging, FaTrash, FaTimes, FaSave } from "react-icons/fa";

interface Props {
  product?: ProductoProps | null; // If null/undefined -> Creation Mode
  onClose: () => void;
  onSaved?: () => void; // Callback to reload list
  onDelete?: () => void; // Optional delete handler
  variant?: 'INVENTORY' | 'PRODUCTION'; // New Prop
}

const ProductoModal: React.FC<Props> = ({ product, onClose, onSaved, onDelete, variant = 'INVENTORY' }) => {
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
    Barcode: "",
    category: "",
    stock: 0,
    variablePrice: false,
    purchaseUnit: "",
    conversionFactor: 1,
    unit: "",
    supplier: "",
    productionStrategy: variant === 'PRODUCTION' ? 'UNIT_ASSEMBLY' : 'BASIC', // Default strategy based on variant
    defaultContainer: { name: "", capacity: 0 },
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setFormData({
        title: product.title || "",
        price: product.price || 0,
        Barcode: product.Barcode || "",
        category: product.category || "",
        stock: product.stock || 0,
        variablePrice: product.variablePrice || false,
        purchaseUnit: product.purchaseUnit || "",
        conversionFactor: product.conversionFactor || 1,
        unit: product.unit || "",
        supplier: product.supplier || "",
        productionStrategy: product.productionStrategy || (variant === 'PRODUCTION' ? 'UNIT_ASSEMBLY' : 'BASIC'),
        defaultContainer: product.defaultContainer || { name: "", capacity: 0 },
      });
    } else {
       // Reset for new creation
       setFormData({
        title: "",
        price: 0,
        Barcode: "",
        category: "",
        stock: 0,
        variablePrice: false,
        purchaseUnit: "",
        conversionFactor: 1,
        unit: "",
        supplier: "",
        productionStrategy: variant === 'PRODUCTION' ? 'UNIT_ASSEMBLY' : 'BASIC',
        defaultContainer: { name: "", capacity: 0 },
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
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder={variant === 'PRODUCTION' ? "Ej. Milanesas de Carne" : "Ej. Harina 000"}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all shadow-sm text-sm"
                  required
                />
            </div>

            {variant !== 'PRODUCTION' && (
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">
                             Costo / Precio Compra
                        </label>
                        <input
                          type="number"
                          name="price"
                          value={formData.price || ""}
                          onChange={handleChange}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium shadow-sm text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-foreground mb-1 uppercase tracking-wider">
                             Stock Actual
                        </label>
                        <input
                          type="number"
                          name="stock"
                          value={formData.stock || ""}
                          onChange={handleChange}
                          placeholder="0"
                          className="w-full px-3 py-2 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium shadow-sm text-sm"
                        />
                    </div>
                </div>
            )}

            {/* Configuration specific to Inventory (Suppliers) */}
            {variant === 'INVENTORY' && (
                <div className="p-4 border border-border rounded-xl space-y-3 bg-muted/20">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-2 mb-2">
                       <FaBox className="text-primary"/> Configuración de Compra
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Unidad Compra (Bulto)</label>
                            <input
                              type="text"
                              name="purchaseUnit"
                              value={formData.purchaseUnit}
                              onChange={handleChange}
                              placeholder="Ej: Caja"
                              className="w-full px-3 py-1.5 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground text-xs focus:outline-none transition-all shadow-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Contenido del Bulto</label>
                            <input
                              type="number"
                              name="conversionFactor"
                              value={formData.conversionFactor || ""}
                              onChange={handleChange}
                              placeholder="Ej: 12"
                              className="w-full px-3 py-1.5 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground text-xs focus:outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm"
                            />
                        </div>
                    </div>
                    
                  
                  {/* Base Unit Field & Supplier */}
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Unidad Base (Inventario)</label>
                          <input
                            type="text"
                            name="unit"
                            value={formData.unit || ""}
                            onChange={handleChange}
                            placeholder="Ej: Litros, Kg, Unidades"
                            className="w-full px-3 py-1.5 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground text-xs focus:outline-none transition-all shadow-sm"
                          />
                      </div>
                      <div>
                          <label className="block text-[9px] font-bold text-muted-foreground mb-1 uppercase tracking-wider">Proveedor</label>
                          <input
                            type="text"
                            name="supplier"
                            value={formData.supplier || ""}
                            onChange={handleChange}
                            placeholder="Ej: Distribuidora X"
                            className="w-full px-3 py-1.5 rounded-lg bg-background border border-foreground/30 focus:border-primary text-foreground text-xs focus:outline-none transition-all shadow-sm"
                          />
                      </div>
                  </div>

                  <p className="text-[9px] text-muted-foreground mt-1 text-center italic">
                      1 {formData.purchaseUnit || "Bulto"} = {(formData.conversionFactor || 1)} {(formData.unit || 'uds')}
                  </p>
              </div>
            )}

            {variant === 'INVENTORY' && (
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

            {/* --- PRODUCTION CONFIGURATION --- */}
            {(variant === 'PRODUCTION' || formData.productionStrategy !== 'BASIC') && (
                <div className="p-4 border border-border rounded-xl space-y-3 bg-muted/20">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                       <FaLayerGroup className="text-primary"/> Estrategia de Producción
                    </h3>
                    
                    <div className="flex gap-2">
                        {[
                            { val: 'BASIC', label: 'Simple', icon: <FaBox /> },
                            { val: 'VOLUME_BATCH', label: 'Volumen', icon: <FaWeightHanging /> },
                            { val: 'UNIT_ASSEMBLY', label: 'Unitario', icon: <FaCube /> }
                        ].map((opt: any) => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, productionStrategy: opt.val as any }))}
                              className={`flex-1 text-[10px] p-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                                  formData.productionStrategy === opt.val 
                                      ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                                      : 'bg-transparent border-border text-muted-foreground hover:bg-muted/20'
                              }`}
                            >
                                <span className="text-sm">{opt.icon}</span>
                                <span className="font-medium">{opt.label}</span>
                            </button>
                        ))}
                    </div>

                    {formData.productionStrategy && formData.productionStrategy !== 'BASIC' && (
                        <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-[9px] font-bold text-muted-foreground mb-1">Contenedor Típico</label>
                                  <input
                                      type="text"
                                      value={formData.defaultContainer?.name || ""}
                                      onChange={(e) => setFormData(prev => ({
                                          ...prev, 
                                          defaultContainer: { ...prev.defaultContainer!, name: e.target.value } 
                                      }))}
                                      placeholder={formData.productionStrategy === 'VOLUME_BATCH' ? "Ej: Olla 20L" : "Ej: Batea"}
                                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-foreground/30 text-foreground text-xs focus:border-primary outline-none shadow-sm"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[9px] font-bold text-muted-foreground mb-1">Capacidad Std</label>
                                  <input
                                      type="number"
                                      value={formData.defaultContainer?.capacity || ""}
                                      onChange={(e) => setFormData(prev => ({
                                          ...prev, 
                                          defaultContainer: { ...prev.defaultContainer!, capacity: Number(e.target.value) } 
                                      }))}
                                      placeholder="Ej: 20"
                                      className="w-full px-3 py-1.5 rounded-lg bg-background border border-foreground/30 text-foreground text-xs focus:border-primary outline-none shadow-sm"
                                  />
                              </div>
                            </div>
                        </div>
                    )}
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
