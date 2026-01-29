import Link from "next/link";
import { FaFire, FaClipboardList, FaBoxOpen } from "react-icons/fa";

export default function CocinaPage() {
  return (
    <div className="p-8 min-h-screen">
      <h1 className="text-4xl font-serif font-bold text-primary mb-8">Cocina (KDS)</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Module Card: Production */}
        <Link href="/cocina/produccion" className="group">
            <div className="bg-card border-2 border-border rounded-2xl p-8 hover:border-primary/50 hover:shadow-xl transition-all h-full cursor-pointer flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                    <FaFire size={32} />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Producción Diaria</h2>
                <p className="text-muted-foreground">Registrar elaboración de salsas, masas y pre-producción.</p>
            </div>
        </Link>

        {/* Module Card: Inventory (Quick Access) */}
        <Link href="/inventario" className="group">
            <div className="bg-card border-2 border-border rounded-2xl p-8 hover:border-primary/50 hover:shadow-xl transition-all h-full cursor-pointer flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition-transform">
                    <FaBoxOpen size={30} />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Insumos & Stock</h2>
                <p className="text-muted-foreground">Ver stock de materia prima y realizar ingresos de proveedores.</p>
            </div>
        </Link>

        {/* Module Card: Orders (Monitor) */}
        <div className="bg-muted/10 border-2 border-border border-dashed rounded-2xl p-8 h-full flex flex-col items-center text-center opacity-70">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4">
                <FaClipboardList size={32} />
            </div>
            <h2 className="text-2xl font-bold text-muted-foreground mb-2">Monitor de Pedidos</h2>
            <p className="text-muted-foreground text-sm">Próximamente</p>
        </div>

      </div>
    </div>
  );
}
