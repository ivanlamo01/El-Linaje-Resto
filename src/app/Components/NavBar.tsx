"use client";

import React, { useEffect, useState } from "react";
import { useAuthContext } from "../Context/AuthContext";
import Link from "next/link";
import { useSidebar } from "../Context/SidebarContext";
import { useTutorial } from "../Context/TutorialContext";
import ThemeToggle from "./ThemeToggle";
import {
  FaHome,
  FaSignOutAlt,
  FaChevronLeft,
  FaChevronRight,
  FaBars,
  FaTimes,
  FaUserCircle,
  FaUserCog,
  FaCaretDown,
  FaChair,
  FaUtensils,
  FaClipboardList,
  FaFire,
  FaBoxOpen
} from "react-icons/fa";

const NavBar: React.FC = () => {
  const { login, handleLogout, user } = useAuthContext();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { startTutorial } = useTutorial();
  const [mounted, setMounted] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* --- MOBILE HEADER (Visible only on lg:hidden) --- */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-md border-b border-border text-foreground flex items-center justify-between px-4 py-3 lg:hidden shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 relative">
             <img src="Ellinaje.png" alt="El Linaje" className="w-full h-full object-contain" />
          </div>
        </div>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="text-muted-foreground focus:outline-none p-2 rounded-lg hover:bg-secondary hover:text-foreground transition-colors"
        >
          {isMobileOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
        </button>
      </header>

      {/* --- SIDEBAR --- */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-sidebar border-r border-border text-sidebar-foreground flex flex-col shadow-xl z-40
        transition-all duration-300 ease-in-out
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${isCollapsed ? "lg:w-20" : "lg:w-64"}
        w-64
        `}
      >
        {/* LOGO AREA (Desktop) */}
        <div id="sidebar-logo" className={`flex items-center justify-center py-6 border-b border-border transition-all duration-300 ${isCollapsed ? "px-2" : "px-6"}`}>
          {!isCollapsed ? (
            <div className="relative w-48 h-20 transition-all duration-300">
               {/* Expanded: Larger Logo */}
               <img src="/Ellinaje.png" alt="El Linaje" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="relative w-12 h-12 overflow-hidden rounded-full border border-primary/20 bg-white/5 transition-all duration-300">
               {/* Collapsed: Zoom in on Top (The Cup) */}
               <img 
                  src="/Ellinaje.png" 
                  alt="EL" 
                  className="w-full h-full object-cover object-top scale-150 translate-y-2" 
               />
            </div>
          )}
        </div>

        {/* USER INFO */}
        {/* USER INFO */}
        {login ? (
          <div className="relative">
            <div 
              id="sidebar-user" 
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className={`flex items-center p-4 border-b border-border transition-all duration-300 cursor-pointer hover:bg-muted/50 ${isCollapsed ? "justify-center" : "gap-3"}`}
            >
              <div className="bg-secondary p-2.5 rounded-full text-foreground/80">
                <FaUserCircle size={20} />
              </div>
              {!isCollapsed && (
                <>
                  <div className="overflow-hidden flex-1">
                    <p className="text-sm font-semibold text-foreground truncate w-24">
                      {user?.nombre || "Usuario"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate w-24">
                      {user?.email}
                    </p>
                  </div>
                  <FaCaretDown className={`text-muted-foreground transition-transform duration-200 ${userDropdownOpen ? "rotate-180" : ""}`} size={12}/>
                </>
              )}
            </div>

            {/* User Dropdown */}
            {userDropdownOpen && (
              <div className={`absolute z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 w-48 
                ${isCollapsed ? "left-full top-0 ml-2" : "left-4 right-4 top-full mt-2"}`}>
                 <Link 
                   href="/profile" 
                   onClick={() => setUserDropdownOpen(false)}
                   className="flex items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
                 >
                   <FaUserCog className="text-primary"/> Mi Perfil
                 </Link>
                 <button 
                   onClick={() => {
                     handleLogout();
                     setUserDropdownOpen(false);
                   }}
                   className="w-full flex items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors border-t border-border"
                 >
                   <FaSignOutAlt /> Cerrar Sesión
                 </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`p-4 border-b border-border flex ${isCollapsed ? "justify-center" : ""}`}>
             <Link 
               href="/login"
               className={`flex items-center gap-3 w-full p-2 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary transition-colors ${isCollapsed ? "justify-center" : ""}`}
               title="Iniciar Sesión"
             >
                <FaUserCircle size={24} />
                {!isCollapsed && <span className="font-semibold text-sm">Iniciar Sesión</span>}
             </Link>
          </div>
        )}

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 flex flex-col py-4 gap-1 px-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <NavItem id="nav-home" href="/" icon={<FaHome size={18} />} label="Home" collapsed={isCollapsed} onClick={() => setIsMobileOpen(false)} />
          <NavItem id="nav-mesas" href="/mesas" icon={<FaChair size={18} />} label="Salón" collapsed={isCollapsed} onClick={() => setIsMobileOpen(false)} />
          <NavItem id="nav-menu" href="/menu" icon={<FaUtensils size={18} />} label="Menú" collapsed={isCollapsed} onClick={() => setIsMobileOpen(false)} />
          <NavItem id="nav-pedidos" href="/pedidos" icon={<FaClipboardList size={18} />} label="Pedidos" collapsed={isCollapsed} onClick={() => setIsMobileOpen(false)} />
          <NavItem id="nav-inventario" href="/inventario" icon={<FaBoxOpen size={18} />} label="Inventario" collapsed={isCollapsed} onClick={() => setIsMobileOpen(false)} />
          <NavItem id="nav-cocina" href="/cocina" icon={<FaFire size={18} />} label="Cocina" collapsed={isCollapsed} onClick={() => setIsMobileOpen(false)} />
        </nav>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-border flex flex-col gap-2 bg-card">
          {/* Toggle Button (Desktop Only) */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center w-full p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
            title={isCollapsed ? "Expandir" : "Contraer"}
          >
            {isCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>

          <ThemeToggle collapsed={isCollapsed} />
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        ></div>
      )}
    </>
  );
};

// Helper Component for Nav Items
const NavItem = ({ href, icon, label, collapsed, onClick, id }: { href: string; icon: React.ReactNode; label: string; collapsed: boolean; onClick?: () => void; id?: string }) => {
  return (
    <Link
      href={href}
      id={id}
      onClick={onClick}
      className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground 
                hover:bg-accent hover:text-accent-foreground transition-all duration-200
                ${collapsed ? "justify-center" : ""}
            `}
      title={collapsed ? label : ""}
    >
      <div className="group-hover:text-primary transition-colors">
        {icon}
      </div>
      {!collapsed && (
        <span className="font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-300 opacity-100">
          {label}
        </span>
      )}

      {/* Tooltip for collapsed mode */}
      {collapsed && (
        <div className="absolute left-16 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap hidden lg:block">
          {label}
        </div>
      )}
    </Link>
  )
}

export default NavBar;
