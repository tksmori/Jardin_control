import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
const uid = "11111111-1111-4111-8111-111111111111";
let id: string;
const input = (overrides: Record<string, unknown> = {}) => ({
  materialId: id,
  type: "ingreso",
  quantity: 100,
  sourceId: null,
  destinationId: "bodega",
  occurredAt: new Date().toISOString(),
  notes: "Prueba SQL",
  ...overrides,
});
async function movement(overrides: Record<string, unknown> = {}) {
  return db.query("select public.record_movement($1::jsonb)", [
    JSON.stringify(input(overrides)),
  ]);
}
async function balance(location = "bodega") {
  const r = await db.query<{ quantity: string }>(
    "select quantity from public.balances where material_id=$1 and location_id=$2",
    [id, location],
  );
  return Number(r.rows[0]?.quantity ?? 0);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await db.exec(
    await readFile("supabase/migrations/202611160001_inventory.sql", "utf8"),
  );
  await db.exec(
    `insert into auth.users values('${uid}');insert into public.authorized_users(user_id) values('${uid}');select set_config('request.jwt.claim.sub','${uid}',false);set role authenticated;`,
  );
  const result = await db.query<{ id: string }>(
    "select public.create_material($1::jsonb) as id",
    [
      JSON.stringify({
        name: "Confort SQL",
        categoryId: "aseo",
        unit: "rollo",
        minimum: 10,
        junji: true,
        consumable: true,
        notes: "",
      }),
    ],
  );
  id = result.rows[0].id;
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Migración real en PostgreSQL embebido", () => {
  it("crea exactamente siete salas y tres baños", async () => {
    const r = await db.query<{ kind: string; n: number }>(
      "select kind,count(*)::int as n from public.locations group by kind",
    );
    expect(r.rows.find((x) => x.kind === "sala")?.n).toBe(7);
    expect(r.rows.find((x) => x.kind === "consumo")?.n).toBe(3);
  });
  it("registra ingreso, consumo y traslado atómicos", async () => {
    await movement();
    expect(await balance()).toBe(100);
    await movement({
      type: "consumo",
      quantity: 5,
      sourceId: "bodega",
      destinationId: null,
    });
    expect(await balance()).toBe(95);
    await movement({
      type: "traslado",
      quantity: 10,
      sourceId: "bodega",
      destinationId: "sala-1",
    });
    expect(await balance()).toBe(85);
    expect(await balance("sala-1")).toBe(10);
    const r = await db.query<{ total: string }>(
      "select sum(quantity) as total from public.balances where material_id=$1",
      [id],
    );
    expect(Number(r.rows[0].total)).toBe(95);
  });
  it("guarda diez entregas y descuenta 26 rollos", async () => {
    const deliveries = [
      ...Array.from({ length: 7 }, (_, i) => ({
        locationId: `sala-${i + 1}`,
        quantity: 2,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        locationId: `bano-${i + 1}`,
        quantity: 4,
      })),
    ];
    await movement({
      type: "reposicion",
      quantity: 26,
      sourceId: "bodega",
      destinationId: null,
      deliveries,
    });
    expect(await balance()).toBe(59);
    const r = await db.query<{ n: number }>(
      "select count(*)::int as n from public.movement_details",
    );
    expect(r.rows[0].n).toBe(10);
    expect(await balance("sala-1")).toBe(10);
  });
  it("rechaza sobregiro, fracciones de rollos y escritura directa", async () => {
    await expect(
      movement({
        type: "consumo",
        quantity: 1000,
        sourceId: "bodega",
        destinationId: null,
      }),
    ).rejects.toThrow(/Stock/);
    await expect(movement({ quantity: 0.5 })).rejects.toThrow(/enteros/);
    await expect(
      db.exec("update public.balances set quantity=999"),
    ).rejects.toThrow(/permission denied/);
    expect(await balance()).toBe(59);
  });
  it("no permite borrar el historial y crea snapshot con detalles", async () => {
    await expect(db.exec("delete from public.movements")).rejects.toThrow(
      /permission denied/,
    );
    const r = await db.query<{
      snapshot: { movements: { deliveries: unknown[] }[] };
    }>("select public.inventory_snapshot() as snapshot");
    expect(
      r.rows[0].snapshot.movements.some((m) => m.deliveries.length === 10),
    ).toBe(true);
  });
  it("revierte una importación completa cuando una fila falla", async () => {
    const rows = [
      {
        name: "Primero",
        categoryId: "aseo",
        unit: "rollo",
        minimum: 0,
        quantity: 3,
        locationId: "bodega",
        consumable: true,
      },
      {
        name: "Segundo",
        categoryId: "aseo",
        unit: "rollo",
        minimum: 0,
        quantity: -1,
        locationId: "bodega",
        consumable: true,
      },
    ];
    await expect(
      db.query("select public.import_initial($1::jsonb)", [
        JSON.stringify(rows),
      ]),
    ).rejects.toThrow();
    const r = await db.query<{ n: number }>(
      "select count(*)::int as n from public.materials where name='Primero'",
    );
    expect(r.rows[0].n).toBe(0);
  });
  it("impide acceso a una cuenta autenticada no autorizada", async () => {
    await db.exec(
      "select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false)",
    );
    expect(
      (await db.query("select * from public.materials")).rows,
    ).toHaveLength(0);
    await expect(movement()).rejects.toThrow(/autorizado/);
    await expect(db.exec("select public.inventory_snapshot()")).rejects.toThrow(
      /autorizado/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${uid}',false)`);
  });
  it("bloquea eliminación del historial incluso con rol propietario", async () => {
    await db.exec("reset role");
    await expect(db.exec("delete from public.movements")).rejects.toThrow(
      /inmutable/,
    );
  });
});
