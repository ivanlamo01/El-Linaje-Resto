const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');

// --- MANEJO DE ERRORES AL INICIO ---
// Esto mostrará una ventana si la app crashea antes de abrir
process.on('uncaughtException', (error) => {
    const errorMsg = error.stack || error.message || String(error);
    console.error('CRITICAL ERROR:', errorMsg);
    // Intentar mostrar diálogo si es posible
    if (dialog && dialog.showErrorBox) {
        dialog.showErrorBox('Error Crítico al Iniciar', `Se ha producido un error que impide iniciar la aplicación:\n\n${errorMsg}`);
    }
    process.exit(1);
});

const path = require('path');
const electronServe = require("electron-serve");
const serve = electronServe.default || electronServe;
const { initDatabase, productQueries, saleQueries } = require("./db");
const { v4: uuidv4 } = require("uuid");
const Store = require("electron-store");
const { autoUpdater } = require("electron-updater");

const store = new Store();
const isDev = !app.isPackaged;

// SINGLE INSTANCE LOCK
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // Alguien intentó ejecutar una segunda instancia, enfocamos nuestra ventana.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Inicializar serveURL para producción
  let serveURL;
  if (!isDev) {
    serveURL = serve({ directory: path.join(app.getAppPath(), "out") });
  }

  if (isDev) {
    // In dev, we reload electron when main process changes
    require("electron-reload")(__dirname, {
      electron: path.join(__dirname, "..", "node_modules", ".bin", "electron"),
    });
  }

  let mainWindow;

  function createWindow() {
    const mainWindowState = store.get("windowState", {
      width: 1280,
      height: 800,
    });

    mainWindow = new BrowserWindow({
      width: mainWindowState.width,
      height: mainWindowState.height,
      x: mainWindowState.x,
      y: mainWindowState.y,
      backgroundColor: "#ffffff", // Set a default background color to avoid black screen on load
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
      },
      autoHideMenuBar: true,
    });

    if (mainWindowState.isMaximized) {
      mainWindow.maximize();
    }

    const saveState = () => {
      if (!mainWindow) return;
      const bounds = mainWindow.getBounds();
      store.set("windowState", {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: mainWindow.isMaximized(),
      });
    };

    mainWindow.on("resize", saveState);
    mainWindow.on("move", saveState);
    mainWindow.on("close", saveState);

    if (isDev) {
      mainWindow.loadURL("http://localhost:3000");
      mainWindow.webContents.openDevTools();
    } else {
      // Usar la función serveURL ya inicializada
      serveURL(mainWindow);
      // Uncomment the next line to debug production builds
      mainWindow.webContents.openDevTools();
    }

    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  app.on("ready", () => {
    // Configurar Menú de Aplicación (Importante para shortcuts como Copiar/Pegar)
    const template = [
      {
        label: "Archivo",
        submenu: [{ role: "quit", label: "Salir" }],
      },
      {
        label: "Edición",
        submenu: [
          { role: "undo", label: "Deshacer" },
          { role: "redo", label: "Rehacer" },
          { type: "separator" },
          { role: "cut", label: "Cortar" },
          { role: "copy", label: "Copiar" },
          { role: "paste", label: "Pegar" },
          { role: "delete", label: "Eliminar" },
          { type: "separator" },
          { role: "selectAll", label: "Seleccionar todo" },
        ],
      },
      {
        label: "Ver",
        submenu: [
          { role: "reload", label: "Recargar" },
          { role: "forceReload", label: "Forzar Recarga" },
          { role: "toggleDevTools", label: "Herramientas de Desarrollador" },
          { type: "separator" },
          { role: "resetZoom", label: "Restablecer Zoom" },
          { role: "zoomIn", label: "Acercar" },
          { role: "zoomOut", label: "Alejar" },
          { type: "separator" },
          { role: "togglefullscreen", label: "Pantalla Completa" },
        ],
      },
      {
        label: "Ayuda",
        submenu: [
          {
            label: "Acerca de",
            click: async () => {
              const { dialog } = require("electron");
              await dialog.showMessageBox(mainWindow, {
                type: "info",
                title: "Acerca de Almacen MGD",
                message: "Almacen MGD Desktop",
                detail: `Versión: ${app.getVersion()}\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}`,
              });
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Inicializar base de datos
    initDatabase();
    createWindow();
    autoUpdater.autoDownload = true; 
    autoUpdater.allowPrerelease = true;
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // ========== IPC Handlers para Google Auth ==========
  ipcMain.handle("auth-google-login", async () => {
    return new Promise((resolve, reject) => {
      const CLIENT_ID =
        "89554017780-dsejb9g4uc2bbot1advdbq52cht6eu70.apps.googleusercontent.com";
      const REDIRECT_URI =
        "https://almacen-mgd.firebaseapp.com/__/auth/handler"; // Standard Firebase Handler

      // Use a standard Google OAuth 2.0 URL
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${CLIENT_ID}&` +
        `response_type=id_token&` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
        `scope=email%20profile%20openid&` +
        `nonce=${Math.random().toString(36).substring(7)}`;

      const authWindow = new BrowserWindow({
        width: 500,
        height: 600,
        show: true,
        parent: mainWindow,
        modal: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      // Intercept navigation
      authWindow.webContents.on("will-navigate", (event, url) => {
        handleNavigation(url);
      });

      // Intercept redirects (sometimes Google redirects instead of navigating)
      authWindow.webContents.on("will-redirect", (event, url) => {
        handleNavigation(url);
      });

      function handleNavigation(url) {
        // Check if we are redirected to our "handler" or similar
        // Google often returns token in the hash: #id_token=...
        if (url.startsWith(REDIRECT_URI)) {
          // We might not get the hash in 'url' here if it's a client side hash change?
          // Actually the OAuth response comes as a redirect with params in Hash or Query depending on flow.
          // For 'id_token' implicit flow, it is in the hash.

          // But Electron 'will-navigate' might see the full URL including hash if it's a server redirect?
          // Wait, Implicit flow fragment is client-side. The browser loads data from the URL.
          // If we are using `response_type=id_token`, the server redirects to `REDIRECT_URI#id_token=...`
          // Browsers do NOT send the hash to the server, but `will-navigate` / `will-redirect` in Electron usually exposes the full target URL.

          if (url.includes("id_token=")) {
            const rawHash = url.split("#")[1]; // Get everything after #
            const params = new URLSearchParams(rawHash);
            const idToken = params.get("id_token");

            if (idToken) {
              resolve(idToken);
              authWindow.close();
            }
          }
        }
      }

      authWindow.loadURL(authUrl);

      authWindow.on("closed", () => {
        // If closed without resolving, consider it cancelled
        // We can't easily check logic here but if promise is pending...
        // We can use a flag? Or just reject if not resolved.
        // For simplicity, let's leave it pending or reject with timeout?
      });
    });
  });

  // ========== IPC Handlers para SQLite ==========

  // Obtener todos los productos
  ipcMain.handle("db-get-products", async () => {
    try {
      const products = productQueries.getAll.all();
      return { success: true, data: products };
    } catch (error) {
      console.error("[IPC] Error getting products:", error);
      return { success: false, error: error.message };
    }
  });

  // Guardar una venta
  ipcMain.handle("db-save-sale", async (event, saleData) => {
    try {
      const saleId = uuidv4();
      saleQueries.insert.run(
        saleId,
        saleData.total,
        JSON.stringify(saleData.items),
        saleData.paymentMethod,
        Date.now(),
        "pending",
      );
      return { success: true, id: saleId };
    } catch (error) {
      console.error("[IPC] Error saving sale:", error);
      return { success: false, error: error.message };
    }
  });

  // Sincronizar productos desde un array (bajados de Firestore)
  ipcMain.handle("db-sync-products", async (event, products) => {
    try {
      const { db } = require("./db");
      const stmt = productQueries.upsert;
      const insertMany = db.transaction((items) => {
        for (const product of items) {
          stmt.run(
            product.id,
            product.id,
            product.name || product.title,
            product.Barcode || "",
            product.price || 0,
            product.stock || 0,
            product.category || "",
            product.description || "",
            "synced",
          );
        }
      });

      insertMany(products);
      return { success: true, count: products.length };
    } catch (error) {
      console.error("[IPC] Error syncing products:", error);
      return { success: false, error: error.message };
    }
  });

  // Actualizar stock de un producto
  ipcMain.handle("db-update-stock", async (event, { id, newStock }) => {
    try {
      // Primero obtener el producto actual para no perder datos
      const product = productQueries.getById.get(id);
      if (!product) {
        return { success: false, error: "Product not found" };
      }

      // Actualizar solo stock y sync_status
      productQueries.update.run(
        product.name,
        product.Barcode,
        product.price,
        newStock,
        product.category,
        product.description,
        "pending", // Marcar como pendiente para sync inversa (futuro)
        id,
      );
      return { success: true };
    } catch (error) {
      console.error("[IPC] Error updating stock:", error);
      return { success: false, error: error.message };
    }
  });

  // Obtener ventas pendientes de sincronizar
  ipcMain.handle("db-get-pending-sales", async () => {
    try {
      const sales = saleQueries.getPending.all();
      // Parse items JSON
      const parsedSales = sales.map((s) => ({
        ...s,
        items: JSON.parse(s.items || "[]"),
      }));
      return { success: true, data: parsedSales };
    } catch (error) {
      console.error("[IPC] Error getting pending sales:", error);
      return { success: false, error: error.message };
    }
  });

  // Obtener ventas por rango
  ipcMain.handle("db-get-sales-by-range", async (event, { start, end }) => {
    try {
      const sales = saleQueries.getByRange.all(start, end);
      // Parse items JSON and map to expected structure
      const parsedSales = sales.map((s) => ({
        id: s.id,
        total: s.total,
        date: { seconds: Math.floor(s.timestamp / 1000) }, // Mock Firestore Timestamp, mapped to 'date'
        paymentMethod: s.payment_method,
        products: JSON.parse(s.items || "[]").map((p) => ({
          title: p.title ?? "",
          description: p.description ?? "",
          price: Number(p.price) || 0,
          quantity: Number(p.quantity) || 1,
        })),
      }));
      return { success: true, data: parsedSales };
    } catch (error) {
      console.error("[IPC] Error getting sales by range:", error);
      return { success: false, error: error.message };
    }
  });

  // Marcar venta como sincronizada
  ipcMain.handle("db-mark-sale-synced", async (event, { id, firebaseId }) => {
    try {
      saleQueries.markSynced.run(firebaseId, id);
      return { success: true };
    } catch (error) {
      console.error("[IPC] Error marking sale as synced:", error);
      return { success: false, error: error.message };
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  // Sincronizar ventas (descargar de Firestore)
  ipcMain.handle("db-sync-sales", async (event, sales) => {
    try {
      const { db } = require("./db");
      let insertedCount = 0;
      let skippedCount = 0;

      const insertMany = db.transaction((items) => {
        for (const sale of items) {
          const id = sale.id;

          // Verificar si ya existe una venta con este firebase_id
          const existing = saleQueries.getByFirebaseId.get(id);

          if (existing) {
            // Ya existe, saltarla
            skippedCount++;
            continue;
          }

          // No existe, insertarla
          saleQueries.upsert.run(
            id, // id (PK)
            id, // firebase_id (same as PK for synced sales)
            sale.total,
            JSON.stringify(sale.products || []), // items (JSON string)
            sale.paymentMethod,
            sale.timestamp, // timestamp (ms)
            "synced", // sync_status
            Date.now(), // synced_at
          );
          insertedCount++;
        }
      });

      insertMany(sales);
      console.log(
        `[IPC] Synced ${insertedCount} sales, skipped ${skippedCount} duplicates.`,
      );
      return { success: true, count: insertedCount, skipped: skippedCount };
    } catch (error) {
      console.error("[IPC] Error syncing sales:", error);
      return { success: false, error: error.message };
    }
  });

  // Obtener timestamp de la última venta
  ipcMain.handle("db-get-last-sale-timestamp", async () => {
    try {
      const result = saleQueries.getLastTimestamp.get();
      return { success: true, timestamp: result ? result.last_ts : 0 };
    } catch (error) {
      console.error("[IPC] Error getting last timestamp:", error);
      return { success: false, error: error.message };
    }
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
}
