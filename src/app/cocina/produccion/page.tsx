"use client";

import React, { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, doc, updateDoc, increment, deleteDoc } from "firebase/firestore";
import { db } from "../../config/firebase"; 
import ProductionLogger from "../../Components/ProductionLogger"; // The New Logger
import ProductionWorkspace from "../../Components/ProductionWorkspace"; 
import { FaHistory, FaArrowLeft, FaBoxOpen, FaCog } from "react-icons/fa";
import Link from "next/link";
import { ProductoData } from "../../types/productTypes";
import ProductionHistoryModal from "../../Components/ProductionHistoryModal"; // Import History Modal

// Use the central type or extend it locally
interface KitchenProduct extends ProductoData {}

export default function KitchenProductionPage() {
  const [products, setProducts] = useState<KitchenProduct[]>([]);
  const [allProducts, setAllProducts] = useState<KitchenProduct[]>([]); // New state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View State: 'LOGGER' (Daily Use) or 'MANAGER' (Create/Edit Recipes)
  const [viewMode, setViewMode] = useState<'LOGGER' | 'MANAGER'>('LOGGER');
  const [productToEdit, setProductToEdit] = useState<KitchenProduct | null>(null);
  
  // History Modal State
  const [productForHistory, setProductForHistory] = useState<KitchenProduct | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Load Products
  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching products for kitchen...");
      const q = collection(db, "Productos"); 
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as KitchenProduct));
      
      // Filter for Production Items Only
      const productionItems = data.filter(p => 
          (p.productionStrategy === 'VOLUME_BATCH' || p.productionStrategy === 'UNIT_ASSEMBLY') &&
          p.usageCategory !== 'MENU' // Exclude Menu items if they accidentally have this strategy
      );

      // Client-side sort
      productionItems.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

      setProducts(productionItems);
      setAllProducts(data); // Store full list for stock lookups
    } catch (error: any) {
      console.error("Error loading kitchen products:", error);
      setError(error.message || "Error desconocido al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div className="p-6 md:p-10 min-h-screen bg-transparent text-foreground">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="flex items-center gap-4">
            <Link href="/cocina" className="p-3 rounded-full hover:bg-muted/50 text-muted-foreground transition-colors">
                <FaArrowLeft size={20} />
            </Link>
            <div>
                <h1 className="text-4xl font-serif font-bold text-primary">Producción del Día</h1>
                <p className="text-muted-foreground">
                    {viewMode === 'LOGGER' ? "Registra tu producción diaria." : "Gestiona tus recetas maestras."}
                </p>
            </div>
        </div>
        
        <div className="flex items-center gap-3">
             {viewMode === 'LOGGER' ? (
                <button 
                    onClick={() => setViewMode('MANAGER')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card border border-border rounded-lg shadow-sm hover:shadow-md transition-all"
                >
                    <FaCog className="text-muted-foreground" />
                    <span>Administrar Recetas</span>
                </button>
             ) : (
                <button 
                    onClick={() => {
                        setViewMode('LOGGER');
                        setProductToEdit(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary/10 text-primary border border-primary/20 rounded-lg shadow-sm hover:bg-primary/20 transition-all"
                >
                    <FaArrowLeft />
                    <span>Volver a Producción</span>
                </button>
             )}

            <Link href="/inventario" className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card border border-border rounded-lg shadow-sm hover:shadow-md hover:border-primary/50 transition-all">
                <FaBoxOpen className="text-emerald-600" />
                <span className="hidden md:inline">Ver Stock Insumos</span>
            </Link>
        </div>
      </div>

      {loading ? (
         <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-pulse gap-4">
             <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             <p>Cargando cocina...</p>
         </div>
      ) : (
          <>
            {/* LOGGER MODE (Default) */}
            {viewMode === 'LOGGER' && (
                <ProductionLogger 
                    products={products} // Only Recipes
                    inventory={allProducts} // All Items (for stock lookup)
                    onProductionCompleted={loadProducts}
                />
            )}

            {/* MANAGER MODE (Create / Edit Recipes) */}
            {viewMode === 'MANAGER' && (
                <div className="space-y-6">
                    {!productToEdit ? (
                        <div className="space-y-6">
                             <div className="text-center p-8 bg-muted/10 rounded-xl border border-dashed border-border">
                                 <button 
                                    onClick={() => setProductToEdit({} as any)} // Empty object signals new
                                    className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg"
                                 >
                                    + Crear Nueva Receta
                                 </button>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                 {products.map(p => (
                                     <div key={p.id} className="p-4 bg-card border border-border rounded-xl shadow-sm flex justify-between items-center group hover:border-primary transition-colors">
                                         <div>
                                             <h3 className="font-bold text-lg">{p.title}</h3>
                                             <p className="text-sm text-muted-foreground">
                                                 {p.productionStrategy === 'VOLUME_BATCH' ? 'Por Lote' : 'Por Unidad'}
                                             </p>
                                             {(p.timesProduced !== undefined && p.timesProduced > 0) && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setProductForHistory(p);
                                                        setShowHistoryModal(true);
                                                    }}
                                                    className="text-xs font-bold text-[#A0522D] mt-1 flex items-center gap-1 hover:underline hover:scale-105 transition-all cursor-pointer bg-[#A0522D]/5 px-2 py-1 rounded-md"
                                                    title="Ver Historial y Receta Madre"
                                                >
                                                    <FaHistory size={10} />
                                                    {p.timesProduced} Entrenamientos (Ver Historial)
                                                </button>
                                             )}
                                         </div>
                                         <button 
                                            onClick={() => setProductToEdit(p)}
                                            className="px-3 py-1.5 text-sm bg-muted text-foreground rounded-lg hover:bg-primary hover:text-primary-foreground transition-colors"
                                         >
                                            Editar
                                         </button>
                                     </div>
                                 ))}
                             </div>
                        </div>
                    ) : (
                        <ProductionWorkspace 
                            initialData={productToEdit.id ? productToEdit : null}
                            onClose={() => setProductToEdit(null)}
                            onSaved={() => {
                                loadProducts();
                                setProductToEdit(null);
                            }}
                        />
                    )}
                </div>
            )}
          </>
      )}
      
      {/* History Modal */}
      <ProductionHistoryModal 
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        product={productForHistory}
        filterMode="TRAINING"
      />
      
    </div>
  );
}
