import Link from "next/link";
import { FaUtensils, FaClipboardList, FaChair, FaFire } from "react-icons/fa";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-foreground p-8 relative z-10">
      
      {/* Hero Section */}
      <div className="text-center mb-16 space-y-6 flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <div className="relative w-64 h-64 md:w-80 md:h-80 drop-shadow-2xl">
            <img src="/Ellinaje.png" alt="El Linaje" className="w-full h-full object-contain" />
        </div>
        <div className="h-1 w-32 bg-secondary mx-auto rounded-full opacity-80"></div>
        <p className="text-xl text-muted-foreground font-light tracking-[0.2em] uppercase">
          Gastronomía de Excelencia
        </p>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        <DashboardCard 
          href="/mesas" 
          icon={<FaChair className="w-8 h-8" />} 
          title="Salón" 
          description="Gestión de mesas y estados."
        />
        <DashboardCard 
          href="/pedidos" 
          icon={<FaClipboardList className="w-8 h-8" />} 
          title="Pedidos" 
          description="Toma de comandas." 
        />
        <DashboardCard 
          href="/menu" 
          icon={<FaUtensils className="w-8 h-8" />} 
          title="Menú Digital" 
          description="Catálogo de productos." 
        />
        <DashboardCard 
          href="/cocina" 
          icon={<FaFire className="w-8 h-8" />} 
          title="Cocina" 
          description="Monitor de preparación (KDS)." 
        />
      </div>
    </div>
  );
}

// Internal Component for aesthetic consistency
function DashboardCard({ href, icon, title, description }: { href: string, icon: React.ReactNode, title: string, description: string }) {
  return (
    <Link href={href} className="group block h-full">
      <div className="
        relative h-full p-8 flex flex-col items-center text-center transition-all duration-300
        bg-card/60 hover:bg-card/90 dark:bg-card/90 backdrop-blur-md
        border-2 border-primary/20 hover:border-secondary dark:border-primary/50
        rounded-lg shadow-sm hover:shadow-2xl
        group-hover:translate-y-[-4px]
      ">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-1 bg-secondary/40 group-hover:w-3/4 group-hover:bg-secondary transition-all duration-500 rounded-b-lg"></div>

        <div className="p-5 rounded-full mb-6 bg-secondary/10 border border-secondary/20 group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors duration-300">
          {icon}
        </div>
        
        <h2 className="text-3xl font-serif font-bold mb-3 text-foreground group-hover:scale-105 transition-transform origin-center">
            {title}
        </h2>
        
        <p className="text-muted-foreground font-medium text-sm">
            {description}
        </p>
      </div>
    </Link>
  )
}
