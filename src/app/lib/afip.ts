import Afip from '@afipsdk/afip.js';
import os from 'os';

const AFIP_CUIT = process.env.AFIP_CUIT ? parseInt(process.env.AFIP_CUIT) : 0;

// Helper to fix PEM format if it's messed up (e.g. missing newlines)
const fixPem = (str: string | undefined) => {
    if (!str) return "";

    // 1. Replace literal "\n" with actual newlines
    let clean = str.replace(/\\n/g, '\n').trim();

    // 2. Check if it's a one-liner without newlines (and has headers)
    if (clean.includes("BEGIN CERTIFICATE") && !clean.includes("\n")) {
        clean = clean.replace("-----BEGIN CERTIFICATE-----", "-----BEGIN CERTIFICATE-----\n")
            .replace("-----END CERTIFICATE-----", "\n-----END CERTIFICATE-----");
    }
    if (clean.includes("BEGIN PRIVATE KEY") && !clean.includes("\n")) {
        clean = clean.replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n")
            .replace("-----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----");
    }

    return clean;
};

const AFIP_CERT = fixPem(process.env.AFIP_CERT);
const AFIP_KEY = fixPem(process.env.AFIP_KEY);

// Production mode: Defaults to TRUE unless explicitly set to 'false'
const AFIP_PRODUCTION = process.env.AFIP_PRODUCTION === 'false' ? false : true;

// Puntos de Venta Configuration
const AFIP_POS_PRODUCTOS = process.env.AFIP_POS_PRODUCTOS ? parseInt(process.env.AFIP_POS_PRODUCTOS) : 10;
const AFIP_POS_SERVICIOS = process.env.AFIP_POS_SERVICIOS ? parseInt(process.env.AFIP_POS_SERVICIOS) : 9;
const AFIP_POS_AMBOS = process.env.AFIP_POS_AMBOS ? parseInt(process.env.AFIP_POS_AMBOS) : 9;

function getPuntoVenta(concepto: number): number {
    switch (concepto) {
        case 2: return AFIP_POS_SERVICIOS;
        case 3: return AFIP_POS_AMBOS;
        default: return AFIP_POS_PRODUCTOS;
    }
}

let afipInstance: any = null;

export const getAfipClient = () => {
    if (afipInstance) return afipInstance;

    if (!AFIP_CUIT || !AFIP_CERT || !AFIP_KEY) {
        console.warn("AFIP SDK: Faltan variables de entorno (AFIP_CUIT, AFIP_CERT, AFIP_KEY). El servicio no funcionará correctamente.");
        return null;
    }

    try {
        afipInstance = new Afip({
            CUIT: AFIP_CUIT,
            cert: AFIP_CERT,
            key: AFIP_KEY,
            production: AFIP_PRODUCTION,
            access_token: process.env.AFIP_SDK_ACCESS_TOKEN, 
            res_folder: os.tmpdir() 
        });
        return afipInstance;
    } catch (error) {
        console.error("Error inicializando AFIP SDK:", error);
        return null;
    }
};

/**
 * Obtiene un cliente AFIP configurado solo con el Access Token para tareas administrativas.
 * Útil para crear certificados o autorizar web services.
 * @param cuit Optional CUIT to initialize the client with
 */
export const getAfipAdminClient = (cuit?: number) => {
    const accessToken = process.env.AFIP_SDK_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error("AFIP_SDK_ACCESS_TOKEN no configurado");
    }

    return new Afip({ 
        access_token: accessToken,
        production: true,
        res_folder: os.tmpdir(),
        CUIT: cuit
    });
};

/**
 * Genera una Factura C (Código 11) para Monotributistas.
 * @param importe Total de la factura
 * @param concepto 1 = Productos, 2 = Servicios, 3 = Productos y Servicios
 * @param docNro Número de documento del comprador (0 para consumidor final sin identificar si es monto bajo)
 * @param docTipo Tipo de documento (96 = DNI, 80 = CUIT, 99 = Consumidor Final)
 */
export const crearFacturaC = async (importe: number, concepto: number = 1, docNro: number = 0, docTipo: number = 99) => {
    const afip = getAfipClient();
    if (!afip) throw new Error("AFIP no configurado");

    try {
        // 1. Obtener el último número de comprobante
        const puntoVenta = getPuntoVenta(concepto);
        const tipoComprobante = 11; // 11 = Factura C

        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(puntoVenta, tipoComprobante);
        const nroComprobante = lastVoucher + 1;

        const date = new Date();
        const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

        // 2. Preparar datos del comprobante
        const data = {
            'CantReg': 1, // Cantidad de comprobantes a registrar
            'PtoVta': puntoVenta,
            'CbteTipo': tipoComprobante,
            'Concepto': concepto,
            'DocTipo': docTipo,
            'DocNro': docNro,
            'CbteDesde': nroComprobante,
            'CbteHasta': nroComprobante,
            'CbteFch': formattedDate,
            'ImpTotal': importe,
            'ImpTotConc': 0, // Importe neto no gravado
            'ImpNeto': importe, // Importe neto gravado (Para C es el total)
            'ImpOpEx': 0, // Importe exento
            'ImpIVA': 0, // Importe de IVA (0 para C)
            'ImpTrib': 0, // Importe de tributos
            'MonId': 'PES', // Moneda
            'MonCotiz': 1, // Cotización
        };

        // Si es servicio (2) o productos y servicios (3), requiere fechas de servicio
        if (concepto === 2 || concepto === 3) {
            Object.assign(data, {
                'FchServDesde': formattedDate,
                'FchServHasta': formattedDate,
                'FchVtoPago': formattedDate,
            });
        }

        // 3. Crear comprobante (CAE)
        const res = await afip.ElectronicBilling.createVoucher(data);

        return {
            success: true,
            cae: res.CAE,
            vencimientoCae: res.CAEFchVto,
            nroComprobante,
            puntoVenta,
            tipoComprobante
        };

    } catch (error: any) {
        console.error("Error creando factura AFIP:", error);
        throw new Error(error.message || "Error al crear factura en AFIP");
    }
};

/**
 * Genera una Nota de Crédito C (Código 13) para anular una Factura C.
 * @param importe Total de la nota de crédito (debe coincidir con la factura a anular)
 * @param comprobanteAsociado Número de la factura original a anular
 * @param concepto 1 = Productos, 2 = Servicios, 3 = Productos y Servicios
 * @param docNro Número de documento del comprador
 * @param docTipo Tipo de documento
 */
export const crearNotaCreditoC = async (
    importe: number,
    comprobanteAsociado: number,
    concepto: number = 1,
    docNro: number = 0,
    docTipo: number = 99,
    puntoVenta?: number
) => {
    const afip = getAfipClient();
    if (!afip) throw new Error("AFIP no configurado");

    try {
        const ptoVta = puntoVenta || getPuntoVenta(concepto);
        const tipoComprobante = 13; // 13 = Nota de Crédito C

        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, tipoComprobante);
        const nroComprobante = lastVoucher + 1;

        const date = new Date();
        const formattedDate = date.toISOString().slice(0, 10).replace(/-/g, '');

        const data = {
            'CantReg': 1,
            'PtoVta': ptoVta,
            'CbteTipo': tipoComprobante,
            'Concepto': concepto,
            'DocTipo': docTipo,
            'DocNro': docNro,
            'CbteDesde': nroComprobante,
            'CbteHasta': nroComprobante,
            'CbteFch': formattedDate,
            'ImpTotal': importe,
            'ImpTotConc': 0,
            'ImpNeto': importe,
            'ImpOpEx': 0,
            'ImpIVA': 0,
            'ImpTrib': 0,
            'MonId': 'PES',
            'MonCotiz': 1,
            'CbtesAsoc': [
                {
                    'Tipo': 11, // Factura C
                    'PtoVta': ptoVta,
                    'Nro': comprobanteAsociado
                }
            ]
        };

        if (concepto === 2 || concepto === 3) {
            Object.assign(data, {
                'FchServDesde': formattedDate,
                'FchServHasta': formattedDate,
                'FchVtoPago': formattedDate,
            });
        }

        const res = await afip.ElectronicBilling.createVoucher(data);

        return {
            success: true,
            cae: res.CAE,
            vencimientoCae: res.CAEFchVto,
            nroComprobante,
            puntoVenta: ptoVta,
            tipoComprobante
        };

    } catch (error: any) {
        console.error("Error creando Nota de Crédito AFIP:", error);
        throw new Error(error.message || "Error al crear Nota de Crédito en AFIP");
    }
};

/**
 * Obtiene información del servidor de AFIP (Estado del servicio)
 */
export const getServerStatus = async () => {
    const afip = getAfipClient();
    if (!afip) return null;
    return await afip.ElectronicBilling.getServerStatus();
};
