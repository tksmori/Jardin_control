import { test, expect } from "@playwright/test";
test("flujo completo demo en escritorio y persistencia", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Todo listo para un nuevo día" }),
  ).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("jardincontrol.demo.v1"));
  await page.reload();
  await page
    .getByRole("link", { name: "Material de bodega", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar reposición", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("spinbutton")).toHaveCount(10);
  for (const el of await dialog.getByRole("spinbutton").all()) {
    const label = await el.getAttribute("aria-label");
    await el.fill(label?.includes("Baño") ? "4" : "2");
  }
  await expect(dialog.getByText("74", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Revisar movimiento" }).click();
  await dialog.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(dialog).not.toBeVisible();
  let data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jardincontrol.demo.v1")!),
  );
  expect(
    data.balances.find(
      (b: { materialId: string; locationId: string }) =>
        b.materialId === "confort" && b.locationId === "bodega",
    ).quantity,
  ).toBe(74);
  expect(data.movements[0].deliveries).toHaveLength(10);
  await page.getByRole("button", { name: "Agregar material" }).click();
  await page.getByLabel("Nombre del material").fill("Material E2E");
  await page.getByRole("button", { name: "Guardar material" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Ingreso: Material E2E", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Destino", exact: true })
    .selectOption("bodega");
  await page.getByLabel("Cantidad (unidad)").fill("20");
  await dialog.getByRole("button", { name: "Revisar movimiento" }).click();
  await dialog.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Consumo: Material E2E", exact: true })
    .click();
  await page.getByLabel("Cantidad (unidad)").fill("3");
  await dialog.getByRole("button", { name: "Revisar movimiento" }).click();
  await dialog.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .getByRole("button", { name: "Traslado: Material E2E", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Destino", exact: true })
    .selectOption("sala-1");
  await page.getByLabel("Cantidad (unidad)").fill("5");
  await dialog.getByRole("button", { name: "Revisar movimiento" }).click();
  await dialog.getByRole("button", { name: "Confirmar y guardar" }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("jardincontrol.demo.v1")!),
  );
  const material = data.materials.find(
    (m: { name: string }) => m.name === "Material E2E",
  );
  expect(
    data.balances.find(
      (b: { materialId: string; locationId: string }) =>
        b.materialId === material.id && b.locationId === "bodega",
    ).quantity,
  ).toBe(12);
  expect(
    data.balances.find(
      (b: { materialId: string; locationId: string }) =>
        b.materialId === material.id && b.locationId === "sala-1",
    ).quantity,
  ).toBe(5);
  await page
    .getByRole("link", { name: "Inventario salas", exact: true })
    .click();
  await expect(page.locator(".room-grid button")).toHaveCount(8);
  await expect(page.locator(".room-grid")).not.toContainText("Baño");
  await page.screenshot({
    path: "test-results/salas-escritorio.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("link", { name: "Historial de movimientos", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Material E2E", exact: false }).first(),
  ).toBeVisible();
  await page.goto("/");
  await page.screenshot({
    path: "test-results/dashboard-escritorio.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
test("importación con previsualización y confirmación", async ({ page }) => {
  await page.goto("/oficina");
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await page.getByLabel("Archivo CSV o XLSX (hasta 5 MB)").setInputFiles({
    name: "inicial.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "material;categoria;unidad;ubicacion;cantidad;minimo;junji;consumible\nCarpetas importadas;administrativo;unidad;oficina;15;3;no;sí",
    ),
  });
  await expect(
    page.getByRole("cell", { name: "Carpetas importadas", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Importar y registrar" }),
  ).toBeDisabled();
  await page
    .getByLabel("Confirmo agregar estos materiales y registrar sus ingresos.")
    .check();
  await page.getByRole("button", { name: "Importar y registrar" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Carpetas importadas" }),
  ).toContainText("15");
});
test("navegación y diseño móvil sin desbordamiento de página", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("link", { name: "Inventario salas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Inventario salas", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator(".room-grid button")).toHaveCount(8);
  await page.screenshot({
    path: "test-results/salas-movil.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("link", { name: "Comedor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Comedor", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("link", { name: "Materiales JUNJI", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Materiales JUNJI", exact: true }),
  ).toBeVisible();
});

test("importa XLSX decimal y exporta CSV compatible con Excel", async ({
  page,
}) => {
  await page.goto("/bodega");
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await page
    .getByLabel("Archivo CSV o XLSX (hasta 5 MB)")
    .setInputFiles("e2e/fixtures/inventario.xlsx");
  await expect(
    page.getByRole("cell", { name: "Material XLSX", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Confirmo agregar estos materiales y registrar sus ingresos.")
    .check();
  await page.getByRole("button", { name: "Importar y registrar" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Material XLSX" }),
  ).toContainText("2,5");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("jardincontrol-bodega.csv");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv).toContain("Material XLSX");
  expect(csv).toContain(";");
});
