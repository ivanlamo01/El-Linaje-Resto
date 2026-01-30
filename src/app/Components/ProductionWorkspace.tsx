"use client";

import React, { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { doc, updateDoc, addDoc, collection, getDocs } from "firebase/firestore";
import { ProductoProps, RecetaItem } from "../types/productTypes";
import { FaSave, FaArrowLeft, FaTrash, FaPlus, FaSearch, FaExclamationTriangle, FaMagic, FaWeightHanging, FaCube } from "react-icons/fa";
import { SmartInput } from "./ui/SmartInput";
import { NumberInput } from "./ui/NumberInput";

interface Props {
  initialData?: ProductoProps | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductionWorkspace({ initialData, onClose, onSaved }: Props) {
  // State
  const [formData, setFormData] = useState<Partial<ProductoProps>>({
    title: "",
    productionStrategy: 'VOLUME_BATCH',
    recipe: [],
    // Defaults
    price: 0,
    stock: 0,
    category: "Cocina",
  });

  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  
  // Ingredient Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [showIngredientPicker, setShowIngredientPicker] = useState(false);

  const [saving, setSaving] = useState(false);

  // Load Initial Data
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        recipe: initialData.recipe || []
      });
    }
    // Load Inventory for ingredients
    loadInventory();
  }, [initialData]);

  const loadInventory = async () => {
    setLoadingInventory(true);
    try {
        const q = collection(db, "Productos");
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setInventoryItems(items);
    } catch (err) {
        console.error("Error loading inventory", err);
    } finally {
        setLoadingInventory(false);
    }
  };

  const handleAddIngredient = (item: any) => {
    const newIngredient: RecetaItem = {
        ingredientId: item.id,
        ingredientName: item.title,
        quantity: 1, // Default, user edits
        unit: item.purchaseUnit || 'un' // Default unit
    };

    setFormData(prev => ({
        ...prev,
        recipe: [...(prev.recipe || []), newIngredient]
    }));
    setShowIngredientPicker(false);
    setSearchTerm("");
  };

  // Add Custom Ingredient (Text Only)
  const handleAddCustomIngredient = () => {
      if (!searchTerm) return;
      const newIngredient: RecetaItem = {
          ingredientId: "CUSTOM_" + Date.now(), // Unique ID for custom item
          ingredientName: searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1), // Auto-capitalize
          quantity: 1,
          unit: 'un'
      };
      setFormData(prev => ({
          ...prev,
          recipe: [...(prev.recipe || []), newIngredient]
      }));
      setShowIngredientPicker(false);
      setSearchTerm("");
  };

  const handleRemoveIngredient = (index: number) => {
      setFormData(prev => ({
          ...prev,
          recipe: prev.recipe?.filter((_, i) => i !== index)
      }));
  };

  const handleUpdateIngredient = (index: number, field: keyof RecetaItem, value: any) => {
      const updatedRecipe = [...(formData.recipe || [])];
      updatedRecipe[index] = { ...updatedRecipe[index], [field]: value };
      setFormData({ ...formData, recipe: updatedRecipe });
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
          const cleanData = { ...formData };
          // Sanitize
          if (!cleanData.title) throw new Error("Title required");
          
          if (initialData?.id) {
              await updateDoc(doc(db, "Productos", initialData.id), cleanData);
          } else {
              await addDoc(collection(db, "Productos"), {
                  ...cleanData,
                  createdAt: new Date().toISOString()
              });
          }
          onSaved();
      } catch (err) {
          console.error("Error saving:", err);
          alert("Error al guardar: " + err);
      } finally {
          setSaving(false);
      }
  };

  // Filtered ingredients for picker
  const filteredInventory = inventoryItems.filter(i => 
      i.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
      // Exclude already added
      !formData.recipe?.some(r => r.ingredientId === i.id)
  );

  return (
    <div className="w-full bg-card border border-border rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-4 overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
            <div className="flex items-center gap-4">
                <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
                    <FaArrowLeft />
                </button>
                <h2 className="text-2xl font-serif font-bold text-foreground">
                    {initialData ? "Editar Producción" : "Cargar Nueva Producción"}
                </h2>
            </div>
            <button 
                onClick={handleSubmit} 
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50 hover:shadow-primary/25"
                disabled={saving}
            >
                <FaSave />
                {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-px bg-border">
            
            {/* Left Col: Basic Config */}
            <div className="col-span-1 bg-card p-8 space-y-8">
                <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-2 ml-1">Nombre del Producto Final</label>
                    <SmartInput 
                        value={formData.title} 
                        onValueChange={val => setFormData({...formData, title: val})}
                        className="w-full text-xl font-bold px-4 py-3 bg-muted/30 rounded-xl border-2 border-transparent focus:border-primary/50 focus:bg-background focus:outline-none transition-all placeholder:text-muted-foreground/30"
                        placeholder="Ej: Salsa Filetto"
                        autoFocus
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-semibold text-muted-foreground ml-1">Estrategia de Carga</label>
                    <div className="grid grid-cols-1 gap-3">
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, productionStrategy: 'VOLUME_BATCH'})}
                            className={`flex items-center p-4 rounded-xl border-2 transition-all ${formData.productionStrategy === 'VOLUME_BATCH' ? 'bg-primary/5 border-primary ring-0 shadow-sm' : 'bg-background border-border hover:border-primary/30 hover:bg-muted/30'}`}
                        >
                            <div className={`p-3 rounded-full mr-4 ${formData.productionStrategy === 'VOLUME_BATCH' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                <FaWeightHanging size={20} />
                            </div>
                            <div className="text-left">
                                <span className={`block font-bold ${formData.productionStrategy === 'VOLUME_BATCH' ? 'text-primary' : 'text-foreground'}`}>Producción por Lote</span>
                                <span className="text-xs text-muted-foreground">Ej: Ollas, Pastas, Amasados (Granel)</span>
                            </div>
                        </button>
                        
                        <button 
                            type="button"
                            onClick={() => setFormData({...formData, productionStrategy: 'UNIT_ASSEMBLY'})}
                            className={`flex items-center p-4 rounded-xl border-2 transition-all ${formData.productionStrategy === 'UNIT_ASSEMBLY' ? 'bg-primary/5 border-primary ring-0 shadow-sm' : 'bg-background border-border hover:border-primary/30 hover:bg-muted/30'}`}
                        >
                            <div className={`p-3 rounded-full mr-4 ${formData.productionStrategy === 'UNIT_ASSEMBLY' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                <FaCube size={20} />
                            </div>
                            <div className="text-left">
                                <span className={`block font-bold ${formData.productionStrategy === 'UNIT_ASSEMBLY' ? 'text-primary' : 'text-foreground'}`}>Ensamblaje Unitario</span>
                                <span className="text-xs text-muted-foreground">Ej: Hamburguesas, Ensaladas (Unidades)</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Container Management (Volume Batch Only) */}
                {formData.productionStrategy === 'VOLUME_BATCH' && (
                    <div className="p-5 bg-muted/20 rounded-xl space-y-4 border border-border">
                         <div className="flex justify-between items-center">
                            <h3 className="font-bold text-sm text-muted-foreground flex items-center gap-2">
                                <FaExclamationTriangle className="text-amber-500" /> Contenedores / Rendimiento
                            </h3>
                            <button 
                                onClick={() => setFormData(prev => ({
                                    ...prev,
                                    additionalContainers: [...(prev.additionalContainers || []), { name: "", capacity: 0, unit: "Lts" }]
                                }))}
                                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                                <FaPlus size={10} /> Agregar Opción
                            </button>
                         </div>

                         <div className="space-y-3">
                            {/* Primary Container */}
                            <div className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-12 md:col-span-5">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Principal (Lote)</label>
                                    <SmartInput 
                                        placeholder="Ej: Olla 20L" 
                                        value={formData.defaultContainer?.name || ""}
                                        onValueChange={val => setFormData({
                                            ...formData, 
                                            defaultContainer: {...formData.defaultContainer!, name: val}
                                        })}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background/50 focus:bg-background outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="col-span-6 md:col-span-3">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Capacidad</label>
                                    <NumberInput 
                                        placeholder="0"
                                        value={formData.defaultContainer?.capacity || 0}
                                        onValueChange={val => setFormData({
                                            ...formData, 
                                            defaultContainer: {...formData.defaultContainer!, capacity: val}
                                        })}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background/50 focus:bg-background outline-none focus:ring-2 focus:ring-primary/20 text-center"
                                    />
                                </div>
                                <div className="col-span-6 md:col-span-4">
                                    <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Unidad</label>
                                    <SmartInput 
                                        placeholder="Lts"
                                        value={formData.defaultContainer?.unit || ""}
                                        onValueChange={val => setFormData({
                                            ...formData, 
                                            defaultContainer: {...formData.defaultContainer!, unit: val}
                                        })}
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background/50 focus:bg-background outline-none focus:ring-2 focus:ring-primary/20 text-center"
                                    />
                                </div>
                            </div>

                            {/* Additional Containers */}
                            {formData.additionalContainers?.map((cont, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center animate-in fade-in slide-in-from-top-1">
                                    <div className="col-span-12 md:col-span-5">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Alternativa #{idx + 1}</label>
                                        <SmartInput 
                                            placeholder="Ej: Frasco 500ml" 
                                            value={cont.name}
                                            onValueChange={val => {
                                                const updated = [...(formData.additionalContainers || [])];
                                                updated[idx].name = val;
                                                setFormData({...formData, additionalContainers: updated});
                                            }}
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background/50 focus:bg-background outline-none focus:ring-2 focus:ring-primary/20 border-l-4 border-l-secondary/50"
                                        />
                                    </div>
                                    <div className="col-span-5 md:col-span-3">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Rend./Lote</label>
                                        <NumberInput 
                                            placeholder="0"
                                            value={cont.capacity || 0}
                                            onValueChange={val => {
                                                const updated = [...(formData.additionalContainers || [])];
                                                updated[idx].capacity = val;
                                                setFormData({...formData, additionalContainers: updated});
                                            }}
                                            title="Cuántas unidades de ESTE envase salen por cada 1 Lote de receta"
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background/50 focus:bg-background outline-none focus:ring-2 focus:ring-primary/20 text-center"
                                        />
                                    </div>
                                    <div className="col-span-5 md:col-span-3">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Unidad</label>
                                        <SmartInput 
                                            placeholder="un"
                                            value={cont.unit || ""}
                                            onValueChange={val => {
                                                const updated = [...(formData.additionalContainers || [])];
                                                updated[idx].unit = val;
                                                setFormData({...formData, additionalContainers: updated});
                                            }}
                                            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background/50 focus:bg-background outline-none focus:ring-2 focus:ring-primary/20 text-center"
                                        />
                                    </div>
                                    <div className="col-span-2 md:col-span-1 flex justify-end pt-4">
                                        <button 
                                            onClick={() => {
                                                const updated = formData.additionalContainers?.filter((_, i) => i !== idx);
                                                setFormData({...formData, additionalContainers: updated});
                                            }}
                                            className="text-muted-foreground hover:text-destructive transition-colors text-xs"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                )}
            </div>

            {/* Right Col: Ingredients Manager */}
            <div className="col-span-2 bg-card p-4 lg:p-8 flex flex-col min-h-[500px] lg:min-h-0 lg:h-auto">
                <div className="flex justify-between items-end mb-6 border-b border-border pb-6">
                    <div>
                        <h3 className="font-serif font-bold text-2xl text-foreground">Ingredientes / Receta</h3>
                         <p className="text-sm text-muted-foreground mt-1">
                            {formData.productionStrategy === 'VOLUME_BATCH' 
                                ? "Define los ingredientes para preparar 1 Lote/Medida Típica." 
                                : "Define los ingredientes por cada 1 Unidad terminada."}
                        </p>
                    </div>
                    <button 
                        onClick={() => setShowIngredientPicker(true)}
                        className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 bg-primary/10 px-4 py-2.5 rounded-xl hover:bg-primary/20 transition-all"
                    >
                        <FaPlus /> Agregar Ingrediente
                    </button>
                </div>

                {/* Ingredient List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[60vh] lg:max-h-none">
                    {(!formData.recipe || formData.recipe.length === 0) ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/5">
                            <FaMagic className="text-4xl opacity-20 mb-4" />
                            <p className="font-medium">No hay ingredientes cargados.</p>
                            <button onClick={() => setShowIngredientPicker(true)} className="text-primary hover:underline mt-2 text-sm">Buscar Insumos</button>
                        </div>
                    ) : (
                        formData.recipe.map((ing, idx) => (
                            <div key={ing.ingredientId + idx} className="flex items-center gap-4 p-4 bg-background border border-border rounded-xl group hover:border-primary/30 hover:shadow-sm transition-all">
                                    {/* Indicator for Custom Ingredients */}
                                {ing.ingredientId.startsWith('CUSTOM_') ? (
                                    <div className="text-amber-500" title="Item no registrado. Revisar Inventario.">
                                        <FaExclamationTriangle />
                                    </div>
                                ) : (
                                    <div className="text-emerald-500" title="Enlazado a Inventario">
                                        <FaCube />
                                    </div>
                                )}

                                {/* Name */}
                                <div className="flex-1">
                                    <SmartInput 
                                        value={ing.ingredientName}
                                        onValueChange={(val) => handleUpdateIngredient(idx, 'ingredientName', val)}
                                        className="w-full bg-transparent border-none focus:ring-0 font-bold text-foreground p-0 text-lg decoration-dotted hover:underline decoration-muted-foreground/30 underline-offset-4 placeholder:text-muted-foreground/50"
                                        placeholder="Nombre del insumo"
                                    />
                                    {ing.ingredientId.startsWith('CUSTOM_') && (
                                        <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full ml-1 font-bold uppercase tracking-wider border border-amber-100">
                                            ⚠️ Revisar Inventario
                                        </span>
                                    )}
                                </div>

                                {/* Quantity */}
                                <div className="flex items-center gap-2">
                                    <NumberInput 
                                        value={ing.quantity || 0}
                                        onValueChange={(val) => handleUpdateIngredient(idx, 'quantity', val)}
                                        placeholder="0"
                                        style={{ width: `${Math.max(3, (ing.quantity || 0).toString().length) + 4}ch` }}
                                        className="min-w-[80px] bg-muted/20 border-2 border-foreground/50 hover:border-foreground focus:border-primary focus:bg-background rounded-lg px-2 py-1.5 text-center font-mono font-bold outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>

                                {/* Unit (Editable) */}
                                <div className="w-24">
                                     <SmartInput 
                                        value={ing.unit}
                                        onValueChange={(val) => handleUpdateIngredient(idx, 'unit', val)}
                                        className="w-full bg-muted/20 border border-transparent hover:border-border focus:border-primary/50 focus:bg-background rounded-lg px-3 py-1.5 text-center text-sm font-medium outline-none transition-all"
                                        placeholder="Unidad"
                                    />
                                </div>

                                <button 
                                    onClick={() => handleRemoveIngredient(idx)}
                                    className="p-3 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>

        {/* Ingredient Picker Overlay */}
        {showIngredientPicker && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-24" onClick={() => setShowIngredientPicker(false)}>
                <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 border border-border" onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-border bg-muted/30">
                        <div className="relative">
                            <FaSearch className="absolute left-4 top-3.5 text-muted-foreground" />
                            <SmartInput 
                                placeholder="Buscar insumo..."
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-background border border-input focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-lg transition-all"
                                value={searchTerm}
                                onValueChange={setSearchTerm}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto">
                        {loadingInventory ? (
                            <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando inventario...</div>
                        ) : filteredInventory.length > 0 ? (
                            filteredInventory.map(item => (
                                <button 
                                    key={item.id}
                                    onClick={() => handleAddIngredient(item)}
                                    className="w-full text-left p-4 hover:bg-primary/5 border-b border-border/50 flex justify-between items-center transition-colors group"
                                >
                                    <div>
                                        <span className="font-bold text-foreground group-hover:text-primary transition-colors">{item.title}</span>
                                        {item.stock <= 0 && <span className="ml-2 text-xs text-destructive font-bold bg-destructive/10 px-1.5 py-0.5 rounded">Sin Stock</span>}
                                    </div>
                                    <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded group-hover:bg-primary/10 group-hover:text-primary transition-colors">{item.purchaseUnit || "Unidad"}</span>
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center flex flex-col items-center">
                                <p className="text-muted-foreground mb-4">No se encontraron insumos exactos.</p>
                                {searchTerm && (
                                    <button 
                                        onClick={handleAddCustomIngredient}
                                        className="px-6 py-2.5 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/90 transition-all shadow-md"
                                    >
                                        + Agregar "{searchTerm}" (Manual)
                                    </button>
                                )}
                                <p className="text-xs text-muted-foreground mt-4 max-w-xs mx-auto text-center leading-relaxed">
                                    <span className="font-semibold text-amber-600 block mb-1">⚠️ Atención del Encargado</span>
                                    Al usar este ingrediente manual, aparecerá una alerta de <strong>"Revisar Inventario"</strong> para controlar posibles faltantes o errores de carga en el stock.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
