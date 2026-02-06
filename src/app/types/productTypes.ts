
export interface PromoProduct {
  barcode: string;
  quantity: number;
}

export interface RecetaItem {
    ingredientId: string;
    ingredientName: string; // Cached name for UI display
    quantity: number; // amount per standard unit/capacity
    waste?: number; // merma estimad/real
    wasteUnit?: string; // Unidad de la merma (puede ser distinta a la de uso)
    unit: string;
}


export type UsageCategory = 'PRODUCTION' | 'ASSEMBLY' | 'DUAL' | 'MENU';

export interface ProductoData {

  id: string;
  title: string;
  price: number;
  cost?: number; // Costo de adquisición
  Barcode: string;
  category: string;
  stock: number;
  usageCategory?: UsageCategory;

  variablePrice?: boolean;
  description?: string;
  products?: PromoProduct[];
  isPromo?: boolean;
  title_normalized?: string;
  category_normalized?: string
  categoryName?: string; // nombre
  dateAdded?: any;
  purchaseUnit?: string; // e.g. "Caja", "Bulto"
  conversionFactor?: number; // e.g. 12 (1 Caja = 12 Unidades)
  unit?: string; // e.g. "Kg", "Lts", "Un" (Base Inventory Unit)
  supplier?: string;
  
  // Production Logic
  productionStrategy?: 'VOLUME_BATCH' | 'UNIT_ASSEMBLY' | 'BASIC';
  defaultContainer?: {
      name: string; // e.g. "Olla Grande", "Batea"
      capacity: number; // e.g. 20 (Lts or Units)
      unit?: string; // e.g. "Lts", "Kg"
  };
  additionalContainers?: {
      name: string;
      capacity: number;
      unit?: string;
  }[];
  
  // Recipe Definition
  recipe?: RecetaItem[];
  
  // Usage Stats for Training Mode
  timesProduced?: number;
  calibrationCount?: number; // Number of times calibrated/trained

  // Calibration Data (Learned Truth)
  calibration?: {
      containerId: string;
      yieldFactor: number; // e.g. 1.1 (Produces 10% more than standard)
      ingredientModifiers?: Record<string, number>; // e.g. { "meat": 1.05 } (Uses 5% more meat)
  };

  [key: string]: unknown;
}

export interface ProductoProps extends ProductoData {
  onEdit?: () => void; // 👈 evento opcional para el botón Editar
  onDelete?: () => void; // 👈 evento opcional para el botón Borrar
  onSelect?: (checked: boolean) => void;
  isSelected?: boolean;
}

export type Product = {
  id: string;
  data: ProductoData;
};