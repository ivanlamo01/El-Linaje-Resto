const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    version: process.versions.electron,
    
    // Métodos SQLite
    db: {
        getProducts: () => ipcRenderer.invoke('db-get-products'),
        saveSale: (saleData) => ipcRenderer.invoke('db-save-sale', saleData),
        addProduct: (product) => ipcRenderer.invoke('db-add-product', product),
        syncProducts: (products) => ipcRenderer.invoke('db-sync-products', products),
        updateStock: (id, newStock) => ipcRenderer.invoke('db-update-stock', { id, newStock }),
        getPendingSales: () => ipcRenderer.invoke('db-get-pending-sales'),
        getSalesByRange: (start, end) => ipcRenderer.invoke('db-get-sales-by-range', { start, end }),
        markSaleSynced: (id, firebaseId) => ipcRenderer.invoke('db-mark-sale-synced', { id, firebaseId }),
        syncSales: (sales) => ipcRenderer.invoke('db-sync-sales', sales),
        getLastSaleTimestamp: () => ipcRenderer.invoke('db-get-last-sale-timestamp')
    },
    auth: {
        signInWithGoogle: () => ipcRenderer.invoke('auth-google-login')
    }
});
