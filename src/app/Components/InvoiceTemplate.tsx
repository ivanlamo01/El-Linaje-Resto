
import { formatCurrency } from "@/app/lib/utils/afipHelpers";

export interface BusinessData {
  name: string;
  cuit: number | string;
  address: string;
  startActivity?: string;
  iibb?: string;
  condition?: string;
}

export interface InvoiceData {
  cae?: string;
  vencimientoCae?: string;
  nroComprobante?: number;
  puntoVenta?: number;
  tipoComprobante?: number;
  nombre?: string;
  docNro?: number;
  docTipo?: number;
  importe?: number;
  concepto?: number;
  cbteFch?: string;
  createdAt?: { toDate?: () => Date; seconds?: number };
  fecha?: string;
  items?: { title: string; quantity: number; price: number | string; description?: string }[];
}

const formatDateFromAfip = (fecha?: string) => {
  if (!fecha || fecha.length !== 8) return "-";
  const y = fecha.slice(0, 4);
  const m = fecha.slice(4, 6);
  const d = fecha.slice(6, 8);
  return `${d}/${m}/${y}`;
};

const getDocLabel = (docTipo?: number) => {
  switch (docTipo) {
    case 80:
      return "CUIT";
    case 96:
      return "DNI";
    case 99:
      return "Consumidor Final";
    default:
      return "Documento";
  }
};

export default function InvoiceTemplate({
  data,
  businessData,
}: {
  data: InvoiceData;
  businessData: BusinessData;
}) {
  const fecha = data.fecha || data.cbteFch || "";
  const comprobanteLabel = data.tipoComprobante === 11 ? "Factura C" : data.tipoComprobante === 13 ? "Nota de Crédito C" : "Comprobante";
  const numero = `${String(data.puntoVenta || 0).padStart(4, "0")}-${String(data.nroComprobante || 0).padStart(8, "0")}`;

  return (
    <div className="w-[820px] max-w-full bg-white text-black p-10 print:p-6">
      <div className="flex justify-between items-start border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-wide">{businessData.name}</h1>
          <p className="text-sm text-gray-600">CUIT: {businessData.cuit || "-"}</p>
          <p className="text-sm text-gray-600">{businessData.address}</p>
          {businessData.condition && (
            <p className="text-sm text-gray-600">{businessData.condition}</p>
          )}
          {businessData.iibb && (
            <p className="text-sm text-gray-600">IIBB: {businessData.iibb}</p>
          )}
          {businessData.startActivity && (
            <p className="text-sm text-gray-600">Inicio de actividad: {businessData.startActivity}</p>
          )}
        </div>
        <div className="text-right">
          <div className="inline-flex items-center justify-center border border-gray-300 px-4 py-2 text-2xl font-bold">C</div>
          <p className="text-xs text-gray-500 mt-2">{comprobanteLabel}</p>
          <p className="text-sm font-semibold">Nº {numero}</p>
          <p className="text-sm text-gray-600">Fecha: {formatDateFromAfip(fecha)}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-2">Cliente</h2>
          <p className="text-gray-700">{data.nombre || "Consumidor Final"}</p>
          <p className="text-gray-700">{getDocLabel(data.docTipo)}: {data.docNro || "-"}</p>
        </div>
        <div className="border border-gray-200 rounded-lg p-4">
          <h2 className="font-semibold mb-2">AFIP</h2>
          <p className="text-gray-700">CAE: {data.cae || "-"}</p>
          <p className="text-gray-700">Vto CAE: {formatDateFromAfip(data.vencimientoCae)}</p>
        </div>
      </div>

      <div className="mt-6 border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Detalle</th>
              <th className="text-center p-3">Cant.</th>
              <th className="text-right p-3">Precio Unit.</th>
              <th className="text-right p-3">Importe</th>
            </tr>
          </thead>
          <tbody>
            {(data.items && data.items.length > 0) ? (
              data.items.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="p-3 text-gray-700">
                    <div className="font-medium">{item.title}</div>
                    {item.description && <div className="text-xs text-gray-500">{item.description}</div>}
                  </td>
                  <td className="p-3 text-center text-gray-700">{item.quantity}</td>
                  <td className="p-3 text-right text-gray-700">{formatCurrency(Number(item.price))}</td>
                  <td className="p-3 text-right font-semibold">
                    {formatCurrency(Number(item.price) * Number(item.quantity))}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-t">
                <td className="p-3 text-gray-700" colSpan={3}>Venta al contado</td>
                <td className="p-3 text-right font-semibold">{formatCurrency(data.importe || 0)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-64 border border-gray-200 rounded-lg p-4 text-sm">
          <div className="flex justify-between mb-2">
            <span>Subtotal</span>
            <span>{formatCurrency(data.importe || 0)}</span>
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{formatCurrency(data.importe || 0)}</span>
          </div>
        </div>
      </div>

      <div className="mt-8 text-xs text-gray-500 text-center">
        Comprobante generado electrónicamente. Gracias por su compra.
      </div>
    </div>
  );
}
