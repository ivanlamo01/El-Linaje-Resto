const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Ruta de la base de datos (en carpeta de datos del usuario)
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'database.sqlite');

console.log('[SQLite] Database path:', dbPath);

// Crear conexión
const db = new Database(dbPath, { verbose: console.log });

// Habilitar Foreign Keys
db.pragma('foreign_keys = ON');

// Inicializar tablas
function initDatabase() {
    console.log('[SQLite] Initializing database schema...');
    
    // Tabla de Productos
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            firebase_id TEXT UNIQUE,
            name TEXT NOT NULL,
            Barcode TEXT,
            price REAL NOT NULL,
            stock INTEGER DEFAULT 0,
            category TEXT,
            description TEXT,
            sync_status TEXT DEFAULT 'synced',
            last_modified INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);
    // Migración: Agregar columna Barcode si no existe
    try {
        db.exec("ALTER TABLE products ADD COLUMN Barcode TEXT");
        console.log('[SQLite] Added Barcode column to products table.');
    } catch (error) {
        // Ignorar error si la columna ya existe
    }

    // Tabla de Ventas
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales (
            id TEXT PRIMARY KEY,
            firebase_id TEXT,
            total REAL NOT NULL,
            items TEXT NOT NULL,
            payment_method TEXT,
            timestamp INTEGER NOT NULL,
            sync_status TEXT DEFAULT 'pending',
            synced_at INTEGER
        )
    `);

    // Tabla de Clientes (opcional, para el futuro)
    db.exec(`
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            firebase_id TEXT UNIQUE,
            name TEXT,
            email TEXT,
            phone TEXT,
            doc_type INTEGER,
            doc_number INTEGER,
            sync_status TEXT DEFAULT 'synced',
            last_modified INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);

    // Cola de sincronización
    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            data TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            attempts INTEGER DEFAULT 0,
            last_error TEXT
        )
    `);

    console.log('[SQLite] Schema initialized successfully.');
}

// Inicializar la base de datos inmediatamente al cargar el módulo
initDatabase();

// Funciones CRUD para Productos
const productQueries = {
    getAll: db.prepare('SELECT * FROM products ORDER BY name ASC'),
    getById: db.prepare('SELECT * FROM products WHERE id = ?'),
    insert: db.prepare(`
        INSERT INTO products (id, firebase_id, name, Barcode, price, stock, category, description, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    update: db.prepare(`
        UPDATE products 
        SET name = ?, Barcode = ?, price = ?, stock = ?, category = ?, description = ?, 
            sync_status = ?, last_modified = strftime('%s', 'now')
        WHERE id = ?
    `),
    delete: db.prepare('DELETE FROM products WHERE id = ?'),
    upsert: db.prepare(`
        INSERT INTO products (id, firebase_id, name, Barcode, price, stock, category, description, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(firebase_id) DO UPDATE SET
            name = excluded.name,
            Barcode = excluded.Barcode,
            price = excluded.price,
            stock = excluded.stock,
            category = excluded.category,
            description = excluded.description,
            sync_status = excluded.sync_status,
            last_modified = strftime('%s', 'now')
    `)
};

// Funciones CRUD para Ventas
const saleQueries = {
    getAll: db.prepare('SELECT * FROM sales ORDER BY timestamp DESC'),
    getPending: db.prepare("SELECT * FROM sales WHERE sync_status = 'pending' ORDER BY timestamp ASC"),
    insert: db.prepare(`
        INSERT INTO sales (id, total, items, payment_method, timestamp, sync_status)
        VALUES (?, ?, ?, ?, ?, ?)
    `),
    markSynced: db.prepare(`
        UPDATE sales 
        SET sync_status = 'synced', firebase_id = ?, synced_at = strftime('%s', 'now')
        WHERE id = ?
    `),
    getByRange: db.prepare(`
        SELECT * FROM sales 
        WHERE timestamp >= ? AND timestamp <= ? 
        ORDER BY timestamp DESC
    `),
    upsert: db.prepare(`
        INSERT INTO sales (id, firebase_id, total, items, payment_method, timestamp, sync_status, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            total = excluded.total,
            items = excluded.items,
            payment_method = excluded.payment_method,
            timestamp = excluded.timestamp,
            sync_status = excluded.sync_status,
            synced_at = excluded.synced_at
    `),
    getLastTimestamp: db.prepare('SELECT MAX(timestamp) as last_ts FROM sales'),
    getByFirebaseId: db.prepare('SELECT id FROM sales WHERE firebase_id = ?')
};

// Funciones para Cola de Sincronización
const syncQueries = {
    addToQueue: db.prepare(`
        INSERT INTO sync_queue (entity_type, entity_id, operation, data)
        VALUES (?, ?, ?, ?)
    `),
    getPending: db.prepare('SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 100'),
    remove: db.prepare('DELETE FROM sync_queue WHERE id = ?'),
    incrementAttempts: db.prepare(`
        UPDATE sync_queue 
        SET attempts = attempts + 1, last_error = ?
        WHERE id = ?
    `)
};

module.exports = {
    db,
    initDatabase,
    productQueries,
    saleQueries,
    syncQueries
};
