// Headless walkthrough: ONE real settlement flowing across the four personas,
// all on the live proof path.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:4173/";
const VIEW_KEY = "987654321987654321";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
const nav = (name) => page.locator(".nav-item", { hasText: name }).click();

await page.goto(URL, { waitUntil: "networkidle" });
console.log("loaded:", await page.title());

// Institution: settle once (real proof + real tx)
await nav("Institution");
await page.getByRole("button", { name: "Generate proof & settle on testnet" }).click();
await page.waitForSelector(".trust", { timeout: 120000 });
console.log("INSTITUTION:", (await page.locator(".trust").innerText()).replace(/\s+/g, " ").trim());

// Counterparty: knows the amount
await nav("Counterparty");
await page.waitForSelector(".received__amt", { timeout: 10000 });
console.log("COUNTERPARTY received:", (await page.locator(".received__amt").innerText()).replace(/\s+/g, " ").trim());

// Auditor: wrong key sealed, right key reveals
await nav("Auditor");
await page.locator(".keyentry__input").fill("123456");
await page.getByRole("button", { name: "Reveal & reconcile" }).click();
await page.waitForSelector(".reject-inline", { timeout: 10000 });
console.log("AUDITOR wrong key:", (await page.locator(".reject-inline").innerText()).trim().slice(0, 40), "…");
await page.locator(".keyentry__input").fill(VIEW_KEY);
await page.getByRole("button", { name: "Reveal & reconcile" }).click();
await page.waitForSelector(".amount-value", { timeout: 10000 });
const audited = (await page.locator(".amount-value").innerText()).replace(/\s+/g, " ").trim();
console.log("AUDITOR revealed:", audited);

// Public Explorer: sealed
await nav("Public Explorer");
await page.waitForSelector(".ledger", { timeout: 10000 });
const sealedCount = await page.locator(".pill--sealed").count();
const hasTx = await page.locator(".ledger__link").count();
console.log(`PUBLIC EXPLORER: ${sealedCount} sealed fields, tx link present: ${hasTx > 0}`);
await page.screenshot({ path: "personas.png", fullPage: true });

console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console/page errors");
await browser.close();
const ok = audited.includes("1,250,000") && sealedCount >= 2 && hasTx > 0;
console.log(ok ? "\nPERSONAS RUNTIME OK ✅" : "\nPERSONAS RUNTIME FAILED ❌");
process.exit(ok ? 0 : 1);
