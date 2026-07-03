// Headless runtime check of the hero slice: FULL client-side proof path in a real
// browser — in-browser proving + on-chain verify + interactive Poseidon-decrypt reveal.
import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:4173/";
const VIEW_KEY = "987654321987654321";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(URL, { waitUntil: "networkidle" });
console.log("loaded:", await page.title());

// 1) settle & prove -> on-chain verify (real tx)
await page.getByRole("button", { name: "Settle & prove" }).click();
await page.waitForSelector(".trust", { timeout: 120000 });
const trust = (await page.locator(".trust").innerText()).replace(/\s+/g, " ").trim();
console.log("ON-CHAIN:", trust);

// 2) wrong key first -> stays sealed (judge-driven "never fooled")
await page.locator(".keyentry__input").fill("123456");
await page.getByRole("button", { name: "Reveal" }).click();
await page.waitForSelector(".reject-inline", { timeout: 15000 });
console.log("WRONG KEY:", (await page.locator(".reject-inline").innerText()).trim());

// 3) correct view key -> amount materializes
await page.locator(".keyentry__input").fill(VIEW_KEY);
await page.getByRole("button", { name: "Reveal" }).click();
await page.waitForSelector(".amount-value", { timeout: 15000 });
const revealed = (await page.locator(".amount-value").innerText()).replace(/\s+/g, " ").trim();
console.log("AUDITOR REVEAL:", revealed);

// 4) sanctioned -> rejected
await page.getByRole("button", { name: "Attempt disclosure" }).click();
await page.waitForSelector(".deny-verdict", { timeout: 60000 });
console.log("SANCTIONED:", (await page.locator(".deny-verdict").innerText()).trim());

await page.screenshot({ path: "hero-slice.png", fullPage: true });
console.log("screenshot -> app/hero-slice.png");
console.log(errors.length ? "CONSOLE ERRORS:\n" + errors.join("\n") : "no console/page errors");
await browser.close();
const ok = trust.includes("Verified on-chain") && revealed.includes("1,250,000");
console.log(ok ? "\nHERO RUNTIME OK ✅" : "\nHERO RUNTIME FAILED ❌");
process.exit(ok ? 0 : 1);
