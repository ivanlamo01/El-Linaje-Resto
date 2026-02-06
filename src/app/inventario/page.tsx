"use client";

import React, { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, increment, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { FaBoxOpen, FaHammer, FaSearch, FaPlus, FaEdit, FaCartPlus, FaHistory } from "react-icons/fa";
import ProductionModal from "../Components/ProductionModal";
import ProductoModal from "../Components/ProductoModal";
import PurchaseModal from "../Components/PurchaseModal";
import ProductionHistoryModal from "../Components/ProductionHistoryModal";
import { ProductoData } from "../types/productTypes";

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modals State
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [selectedProductForProduction, setSelectedProductForProduction] = useState<ProductoData | null>(null);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<ProductoData | null>(null);

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [selectedProductForPurchase, setSelectedProductForPurchase] = useState<ProductoData | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<ProductoData | null>(null);

  // Load Products
  const loadProducts = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "Productos"), orderBy("stock", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ProductoData));
      setProducts(data);
    } catch (error) {
      console.error("Error loading inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Handlers
  const openProductionModal = (product: ProductoData) => {
    setSelectedProductForProduction(product);
    setIsProductionModalOpen(true);
  };

  const openCreateModal = () => {
      setSelectedProductForEdit(null);
      setIsProductModalOpen(true);
  };

  const openEditModal = (product: ProductoData) => {
      setSelectedProductForEdit(product);
      setIsProductModalOpen(true);
  };

  const openPurchaseModal = (product: ProductoData) => {
      setSelectedProductForPurchase(product);
      setIsPurchaseModalOpen(true);
  };

  const openHistoryModal = (product: ProductoData) => {
      setSelectedProductForHistory(product);
      setIsHistoryModalOpen(true);
  };

  const handleProductionConfirm = async (data: any) => {
    if (!selectedProductForProduction) return;

    const quantityProduced = Number(data.producedQuantity);
    
    // Optimistic Update
    setProducts(prev => prev.map(p => 
        p.id === selectedProductForProduction.id 
            ? { ...p, stock: p.stock + quantityProduced } 
            : p
    ));

    try {
      // 1. Increase Stock of Product
      const productRef = doc(db, "Productos", selectedProductForProduction.id);
      await updateDoc(productRef, { stock: increment(quantityProduced) });

      // 2. Decrease Raw Material (Recipe Based)
      if (selectedProductForProduction.recipe && selectedProductForProduction.recipe.length > 0) {
            for (const ingredient of selectedProductForProduction.recipe) {
                let amountToDeduct = 0;

                if (data.mode === 'DETAILED' && data.ingredientsUsed && data.ingredientsUsed[ingredient.ingredientId]) {
                    // Use the specific calibrated amount entered by user
                    amountToDeduct = data.ingredientsUsed[ingredient.ingredientId];
                } else {
                    // Quick Mode: standard formula
                    amountToDeduct = ingredient.quantity * quantityProduced;
                }

                if (amountToDeduct > 0) {
                    const ingredientRef = doc(db, "Productos", ingredient.ingredientId);
                    await updateDoc(ingredientRef, {
                        stock: increment(-amountToDeduct)
                    });
                }
            }
      }
      
      // 3. Log History (Consistent with Kitchen Logger)
      // Map 'DETAILED' to 'TRAINING' if needed, or just keep as is. Kitchen uses FAST/TRAINING.
      const historyMode = data.mode === 'DETAILED' ? 'TRAINING' : 'FAST';
      
      const historyRef = collection(doc(db, "Productos", selectedProductForProduction.id), "History");
      await addDoc(historyRef, {
        date: new Date().toISOString(),
        mode: historyMode,
        batches: quantityProduced, // Or 1 if unit based, but producedQuantity is total units usually
        totalYield: quantityProduced,
        inputs: selectedProductForProduction.recipe || [], // Snapshot of recipe used (simplified)
        changes: [], // Inventory production currently doesn't trigger auto-calibration of master recipe
        notes: "Producción desde Inventario",
        user: "Admin"
      });

      // Reload to ensure sync
      await loadProducts();
    } catch (error) {
      console.error("Error processing production:", error);
    }
  };

  // Logic: Purchase (Ingreso)
  const handlePurchaseConfirm = async (qty: number, unit: string, factor: number) => {
      if (!selectedProductForPurchase) return;
      try {
          const totalToAdd = qty * factor;
          const ref = doc(db, "Productos", selectedProductForPurchase.id);
          
          await updateDoc(ref, {
              stock: increment(totalToAdd),
              purchaseUnit: unit,
              conversionFactor: factor
          });

          await loadProducts();
      } catch (error) {
          console.error("Error processing purchase:", error);
      }
  };

  const handleDeleteProduct = async () => {
      if (!selectedProductForEdit) return;
      const id = selectedProductForEdit.id;

      // Optimistic
      setProducts(prev => prev.filter(p => p.id !== id));
      setIsProductModalOpen(false);

      try {
          await deleteDoc(doc(db, "Productos", id));
      } catch (error) {
          console.error("Error deleting product:", error);
          loadProducts();
      }
  };

  const [currentTab, setCurrentTab] = useState<'INSUMOS' | 'ARMADO' | 'MENU'>('INSUMOS');
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const filteredProducts = products.filter(p => {
    // 1. Text Filter
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.supplier && p.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // 2. Tab Filter
    // 2. Tab Filter
    let matchesTab = false;
    const cat = p.usageCategory || 'PRODUCTION'; // Default to PRODUCTION if undefined

    if (currentTab === 'INSUMOS') {
        matchesTab = cat === 'PRODUCTION' || cat === 'DUAL';
    } else if (currentTab === 'ARMADO') {
        matchesTab = cat === 'ASSEMBLY' || cat === 'DUAL';
    } else if (currentTab === 'MENU') {
        matchesTab = cat === 'MENU';
    }

    // 3. Category Filter
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;

    return matchesSearch && matchesTab && matchesCategory;
  });

  // Auto-Switch Tab Logic
  useEffect(() => {
      if (!selectedCategory) return;

      const categoryItems = products.filter(p => p.category === selectedCategory);
      const counts = {
         INSUMOS: categoryItems.filter(p => !p.usageCategory || p.usageCategory === 'PRODUCTION' || p.usageCategory === 'DUAL').length,
         ARMADO: categoryItems.filter(p => p.usageCategory === 'ASSEMBLY' || p.usageCategory === 'DUAL').length,
         MENU: categoryItems.filter(p => p.usageCategory === 'MENU').length
      };

      // If current tab has 0 items but another tab has items, switch!
      // Or be more aggressive: Always switch to the highest count tab
      const currentCount = counts[currentTab];
      
      if (currentCount === 0) {
          if (counts.INSUMOS > 0) setCurrentTab('INSUMOS');
          else if (counts.ARMADO > 0) setCurrentTab('ARMADO');
          else if (counts.MENU > 0) setCurrentTab('MENU');
      } else {
          // Optional: If you want to force switch to highest even if current has some
          // const max = Math.max(counts.INSUMOS, counts.ARMADO, counts.MENU);
          // if (max > currentCount) ... 
          // For now, "Don't leave me where there are none" is the safer, less jarring UX.
      }
  }, [selectedCategory, products]); // Dependency on products in case they load later

  // Bulk Selection Logic
  const toggleSelectItem = (id: string) => {
      const newSet = new Set(selectedItems);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedItems(newSet);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) {
          const allIds = filteredProducts.map(p => p.id);
          setSelectedItems(new Set(allIds));
      } else {
          setSelectedItems(new Set());
      }
  };

  return (
    <div className="p-8 min-h-screen pb-24">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h1 className="text-4xl font-serif font-bold text-primary mb-2">Inventario</h1>
                <p className="text-muted-foreground">Gestión de insumos y stock.</p>
            </div>
            
            <div className="flex gap-3 w-full md:w-auto items-center">
                 {/* Bulk Actions Indicator */}
                 {selectedItems.size > 0 && (
                     <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-bold text-sm animate-in fade-in flex items-center gap-2">
                         <span className="bg-primary text-primary-foreground text-xs w-5 h-5 flex items-center justify-center rounded-full">
                            {selectedItems.size}
                         </span>
                         Seleccionados
                     </div>
                 )}

                 <button 
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl shadow-md hover:bg-primary/90 transition-all font-medium whitespace-nowrap"
                 >
                    <FaPlus /> Nuevo Item
                 </button>

                {/* Category Filter */}
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary focus:outline-none max-w-[150px] text-sm"
                >
                    <option value="">Todas las Categorías</option>
                    {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                <div className="relative flex-1 md:w-60">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                        type="text" 
                        placeholder="Buscar..." 
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-card border border-border focus:ring-2 focus:ring-primary focus:outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>
        </div>

        {/* Smart Navigation Calculation */}
        {(() => {
             // Calculate stats for badges & auto-switch logic
             const getCategoryStats = (cat: string) => {
                 if (!cat) return { INSUMOS: 0, ARMADO: 0, MENU: 0 };
                 
                 const categoryItems = products.filter(p => p.category === cat);
                 return {
                     INSUMOS: categoryItems.filter(p => !p.usageCategory || p.usageCategory === 'PRODUCTION' || p.usageCategory === 'DUAL').length,
                     ARMADO: categoryItems.filter(p => p.usageCategory === 'ASSEMBLY' || p.usageCategory === 'DUAL').length,
                     MENU: categoryItems.filter(p => p.usageCategory === 'MENU').length
                 };
             };
             
             // Memoize this if perf issues, but for <1000 items it's fine inline or in render.
             // We need these stats available for the badges below.
             const stats = getCategoryStats(selectedCategory);
             
             // Auto-Switch Effect is handled via useEffect below since we can't do side effects in render.
             return (
               <div className="flex gap-4 border-b border-border mb-6 overflow-x-auto pb-1">
                <button
                    onClick={() => setCurrentTab('INSUMOS')}
                    className={`pb-3 px-4 text-lg font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                        currentTab === 'INSUMOS' 
                            ? 'text-primary border-primary' 
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                >
                    🥦 Insumos
                    {selectedCategory && stats.INSUMOS > 0 && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{stats.INSUMOS}</span>
                    )}
                </button>
                <button
                    onClick={() => setCurrentTab('ARMADO')}
                    className={`pb-3 px-4 text-lg font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                        currentTab === 'ARMADO' 
                            ? 'text-primary border-primary' 
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                >
                    🍔 Armado
                     {selectedCategory && stats.ARMADO > 0 && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{stats.ARMADO}</span>
                    )}
                </button>
                <button
                    onClick={() => setCurrentTab('MENU')}
                    className={`pb-3 px-4 text-lg font-bold transition-all border-b-2 flex items-center gap-2 whitespace-nowrap ${
                        currentTab === 'MENU' 
                            ? 'text-primary border-primary' 
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                >
                    📜 Menú
                     {selectedCategory && stats.MENU > 0 && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{stats.MENU}</span>
                    )}
                </button>
            </div>
             );
        })()}

        {/* Table Card */}
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-muted/30 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                            <th className="p-4 w-10 text-center">
                                <input 
                                    type="checkbox" 
                                    onChange={handleSelectAll}
                                    checked={filteredProducts.length > 0 && selectedItems.size === filteredProducts.length}
                                    className="accent-primary w-4 h-4 cursor-pointer"
                                />
                            </th>
                            <th className="p-4 font-serif font-bold text-primary text-base">Item</th>
                            <th className="p-4 font-serif font-bold text-primary text-base text-center">
                                {currentTab === 'MENU' ? 'Precio Venta' : 'Costo & Compra'}
                            </th>
                            <th className="p-4 font-serif font-bold text-primary text-base text-center">Stock (Unidad Uso)</th>
                            <th className="p-4 font-serif font-bold text-primary text-base text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-muted-foreground">Cargando datos...</td>
                            </tr>
                        ) : filteredProducts.length > 0 ? (
                            filteredProducts.map(product => {
                                // Cost Logic: Use 'cost' if exists, else 'price' (migration fallback)
                                const displayCost = product.cost !== undefined ? product.cost : product.price;
                                const displayPrice = product.price;

                                return (
                                <tr key={product.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${selectedItems.has(product.id) ? 'bg-primary/5' : ''}`}>
                                    <td className="p-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedItems.has(product.id)}
                                            onChange={() => toggleSelectItem(product.id)}
                                            className="accent-primary w-4 h-4 cursor-pointer"
                                        />
                                    </td>
                                    <td className="p-4 font-medium text-foreground">
                                        <div className="text-base">{product.title}</div>
                                        <div className="flex gap-2 mt-1">
                                            <div className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded inline-block">
                                                {product.category || "Sin Categoría"}
                                            </div>
                                            {/* Usage Category Badge */}
                                            {product.usageCategory === 'DUAL' && (
                                                <span className="text-[10px] bg-purple-500/10 text-purple-500 font-bold px-1.5 py-0.5 rounded">DUAL</span>
                                            )}
                                        </div>
                                    </td>
                                    
                                    {/* Cost / Price Column */}
                                    <td className="p-4 text-center">
                                        {currentTab !== 'MENU' ? (
                                             <div className="flex flex-col items-center gap-1">
                                                 <div className="font-bold text-foreground">
                                                     ${(displayCost || 0).toLocaleString()}
                                                     <span className="text-[10px] text-muted-foreground font-normal ml-1">
                                                         / {product.purchaseUnit || 'u'}
                                                     </span>
                                                 </div>

                                                 {product.purchaseUnit && (
                                                     <div className="text-[10px] text-muted-foreground">
                                                         Unit: {product.purchaseUnit}
                                                     </div>
                                                 )}

                                                 {product.conversionFactor && product.conversionFactor > 1 && (
                                                     <div className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-md font-bold mt-1">
                                                         1 {product.purchaseUnit ? product.purchaseUnit.slice(0,3) : 'Uni'} = {product.conversionFactor} {product.unit}
                                                     </div>
                                                 )}
                                             </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-lg text-emerald-600">
                                                    ${(displayPrice || 0).toLocaleString()}
                                                </span>
                                                {product.variablePrice && (
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Variable</span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    
                                    {/* Stock (Usage Unit) */}
                                    <td className="p-4 text-center font-medium">
                                        <div className="flex flex-col items-center">
                                            <span className={`font-bold text-lg ${product.stock <= 5 ? "text-destructive" : "text-foreground"}`}>
                                                {Number(product.stock.toFixed(3))}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{product.unit || "un"}</span>
                                            
                                            {/* Show Stock in Purchase Unit Estimate */}
                                            {product.conversionFactor && product.conversionFactor > 1 && (
                                                 <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                                                     ({(product.stock / product.conversionFactor).toFixed(1)} {product.purchaseUnit})
                                                 </span>
                                            )}
                                        </div>
                                    </td>

                                     <td className="p-4 text-center flex items-center justify-center gap-2">
                                         {/* Edit Button */}
                                            <button 
                                                onClick={() => openEditModal(product)}
                                                className="px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground font-medium text-xs transition-colors flex items-center gap-1"
                                                title="Editar Ficha"
                                            >
                                                <FaEdit size={12} />
                                            </button>

                                         {/* Purchase Button (Only for Insumos/Armado) */}
                                         {currentTab !== 'MENU' && (
                                            <button 
                                                onClick={() => openPurchaseModal(product)}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white font-medium text-xs transition-colors flex items-center gap-1 group"
                                                title="Ingresar Compra"
                                            >
                                                <FaCartPlus size={12} className="group-hover:scale-110 transition-transform"/>
                                            </button>
                                         )}

                                         {/* History Button (Only for items that are PRODUCED internally) */}
                                         {(product.usageCategory === 'PRODUCTION' || product.productionStrategy !== 'BASIC') && (
                                            <button 
                                                onClick={() => openHistoryModal(product)}
                                                className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500 hover:text-white font-medium text-xs transition-colors flex items-center gap-1 border border-yellow-500/20"
                                                title="Ver Historial de Producción"
                                            >
                                                <FaHistory size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                    No se encontraron items.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      {/* Modals */}
      <ProductionModal
            isOpen={isProductionModalOpen}
            onClose={() => setIsProductionModalOpen(false)}
            product={selectedProductForProduction}
            onConfirm={handleProductionConfirm}
      />
      {selectedProductForPurchase && (
          <PurchaseModal
             isOpen={isPurchaseModalOpen}
             onClose={() => setIsPurchaseModalOpen(false)}
             product={selectedProductForPurchase}
             onConfirm={handlePurchaseConfirm}
          />
      )}
      
      {isProductModalOpen && (
        <ProductoModal
            product={selectedProductForEdit} 
            onClose={() => setIsProductModalOpen(false)}
            onSaved={loadProducts}
            onDelete={handleDeleteProduct}
            availableIngredients={products}
        />
      )}

      {/* History Modal */}
      <ProductionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        product={selectedProductForHistory}
        filterMode="ALL"
      />
    </div>
  );
}
