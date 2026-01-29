"use client";

import React, { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, increment, deleteDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { FaBoxOpen, FaHammer, FaSearch, FaPlus, FaEdit, FaCartPlus } from "react-icons/fa";
import ProductionModal from "../Components/ProductionModal";
import ProductoModal from "../Components/ProductoModal";
import PurchaseModal from "../Components/PurchaseModal";
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

  const [currentTab, setCurrentTab] = useState<'PROVIDERS' | 'PRODUCTION'>('PROVIDERS');
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const filteredProducts = products.filter(p => {
    // 1. Text Filter
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.supplier && p.supplier.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // 2. Tab Filter
    const isProductionItem = p.productionStrategy === 'VOLUME_BATCH' || p.productionStrategy === 'UNIT_ASSEMBLY';
    const matchesTab = currentTab === 'PRODUCTION' ? isProductionItem : !isProductionItem;

    // 3. Category Filter
    const matchesCategory = selectedCategory ? p.category === selectedCategory : true;

    return matchesSearch && matchesTab && matchesCategory;
  });

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

        {/* Tabs */}
        <div className="flex gap-4 border-b border-border mb-6">
            <button
                onClick={() => setCurrentTab('PROVIDERS')}
                className={`pb-3 px-4 text-lg font-bold transition-all border-b-2 ${
                    currentTab === 'PROVIDERS' 
                        ? 'text-primary border-primary' 
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
            >
                🥫 Insumos / Proveedores
            </button>
            <button
                onClick={() => setCurrentTab('PRODUCTION')}
                className={`pb-3 px-4 text-lg font-bold transition-all border-b-2 ${
                    currentTab === 'PRODUCTION' 
                        ? 'text-primary border-primary' 
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
            >
                🥘 Stock Intermedio / Producción
            </button>
        </div>

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
                            <th className="p-4 font-serif font-bold text-primary text-base">Proveedor</th>
                            <th className="p-4 font-serif font-bold text-primary text-base">U. Compra</th>
                            <th className="p-4 font-serif font-bold text-primary text-base">U. Uso</th>
                            <th className="p-4 font-serif font-bold text-primary text-base text-center">Stock</th>
                            <th className="p-4 font-serif font-bold text-primary text-base text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="p-8 text-center text-muted-foreground">Cargando datos...</td>
                            </tr>
                        ) : filteredProducts.length > 0 ? (
                            filteredProducts.map(product => (
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
                                        <div className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded inline-block mt-1">
                                            {product.category || "Sin Categoría"}
                                        </div>
                                    </td>
                                    <td className="p-4 text-muted-foreground">
                                        {product.supplier || <span className="text-muted-foreground/30 italic">--</span>}
                                    </td>
                                    <td className="p-4">
                                        {product.purchaseUnit ? (
                                             <div className="flex flex-col">
                                                 <span className="font-bold">{product.purchaseUnit}</span>
                                                 {product.conversionFactor && product.conversionFactor > 1 && (
                                                     <span className="text-[10px] text-muted-foreground">x {product.conversionFactor} {product.unit}</span>
                                                 )}
                                             </div>
                                        ) : <span className="text-muted-foreground/30 italic">--</span>}
                                    </td>
                                    <td className="p-4 font-medium text-muted-foreground">
                                        {product.unit || "un"}
                                    </td>
                                    <td className={`p-4 text-center font-bold text-base ${product.stock <= 5 ? "text-destructive" : "text-foreground"}`}>
                                        {product.stock.toFixed(2)}
                                    </td>
                                    <td className="p-4 text-center flex items-center justify-center gap-2">
                                         {/* Purchase Button (Only for Providers) */}
                                         {currentTab === 'PROVIDERS' && (
                                            <button 
                                                onClick={() => openPurchaseModal(product)}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white font-medium text-xs transition-colors flex items-center gap-1 group"
                                                title="Ingresar Compra"
                                            >
                                                <FaCartPlus size={12} className="group-hover:scale-110 transition-transform"/> Ingreso
                                            </button>
                                         )}

                                         {/* Edit Button */}
                                         <button 
                                            onClick={() => openEditModal(product)}
                                            className="px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground font-medium text-xs transition-colors flex items-center gap-1"
                                            title="Editar Ficha"
                                        >
                                            <FaEdit size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))
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
        />
      )}
    </div>
  );
}
