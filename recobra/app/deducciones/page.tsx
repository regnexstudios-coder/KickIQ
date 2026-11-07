import { DeadlineBadge } from "@/components/DeadlineBadge";
import { deadlineState } from "@/lib/deadlines";
import { supabaseServer } from "@/lib/supabase/server";

const REASON_ES: Record<string, string> = {
  missing_item: "Artículo faltante", wrong_item: "Artículo incorrecto", quality: "Calidad", late: "Retraso", cancelled: "Cancelado", other: "Otro",
};
const PLATFORM_ES: Record<string, string> = { glovo: "Glovo", ubereats: "Uber Eats", justeat: "Just Eat" };

interface Row {
  id: string; platform: string; amount: number; reason_code: string; reason_raw: string;
  deducted_at: string | null; deadline_at: string | null; disputable: boolean | null;
  orders: { external_order_id: string; ordered_at: string | null; platform_accounts: { locations: { client_id: string; clients: { name: string } } } };
  disputes: { status: string }[] | { status: string } | null;
}

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const day = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeZone: "Europe/Madrid" });

export default async function Deducciones({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const f = await searchParams;
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("deductions")
    .select("id,platform,amount,reason_code,reason_raw,deducted_at,deadline_at,disputable,disputes(status),orders!inner(external_order_id,ordered_at,platform_accounts!inner(locations!inner(client_id,clients!inner(name))))")
    .order("deadline_at", { ascending: true, nullsFirst: false })
    .limit(2000)
    .returns<Row[]>();
  if (error) return <p className="text-red-600">Error cargando deducciones: {error.message}</p>;

  const rows = (data ?? []).filter((r) => {
    const client = r.orders.platform_accounts.locations.clients.name;
    const dispute = Array.isArray(r.disputes) ? r.disputes[0] : r.disputes;
    const status = dispute?.status ?? "sin_disputa";
    return (!f.cliente || client === f.cliente)
      && (!f.plataforma || r.platform === f.plataforma)
      && (!f.estado || status === f.estado)
      && (!f.plazo || deadlineState(r.deadline_at).state === f.plazo);
  });
  const clients = [...new Set((data ?? []).map((r) => r.orders.platform_accounts.locations.clients.name))].sort();
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">Deducciones</h1>
        <p className="text-sm text-slate-600">{rows.length} filas · {eur.format(total)}</p>
      </div>

      <form className="flex flex-wrap gap-2 text-sm">
        <Select name="cliente" value={f.cliente} options={clients.map((c) => [c, c])} all="Todos los clientes" />
        <Select name="plataforma" value={f.plataforma} options={Object.entries(PLATFORM_ES)} all="Todas las plataformas" />
        <Select name="estado" value={f.estado} all="Cualquier estado" options={[["sin_disputa", "Sin disputa"], ["draft", "Borrador"], ["approved", "Aprobada"], ["submitted", "Enviada"], ["accepted", "Aceptada"], ["rejected", "Rechazada"], ["expired", "Vencida"]]} />
        <Select name="plazo" value={f.plazo} all="Cualquier plazo" options={[["urgent", "≤ 3 días"], ["soon", "≤ 7 días"], ["ok", "Más de 7 días"], ["expired", "Vencido"], ["unknown", "Sin fecha"]]} />
        <button className="rounded bg-slate-900 px-3 py-1.5 text-white">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>{["Plazo", "Cliente", "Plataforma", "Pedido", "Fecha pedido", "Motivo", "Importe", "Disputa"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const dispute = Array.isArray(r.disputes) ? r.disputes[0] : r.disputes;
              return (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2"><DeadlineBadge deadlineAt={r.deadline_at} /></td>
                  <td className="px-3 py-2">{r.orders.platform_accounts.locations.clients.name}</td>
                  <td className="px-3 py-2">{PLATFORM_ES[r.platform]}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.orders.external_order_id}</td>
                  <td className="px-3 py-2">{r.orders.ordered_at ? day.format(new Date(r.orders.ordered_at)) : "—"}</td>
                  <td className="px-3 py-2" title={r.reason_raw}>{REASON_ES[r.reason_code]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{eur.format(Number(r.amount))}</td>
                  <td className="px-3 py-2">{dispute?.status ?? "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Sin deducciones. Importa un informe con <code>pnpm import</code>.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Select({ name, value, options, all }: { name: string; value?: string; options: [string, string][]; all: string }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="rounded border bg-white px-2 py-1.5">
      <option value="">{all}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
