#!/usr/bin/env node
/**
 * SokoOS License Generator
 *
 * Generates RSA-signed license keys for SokoOS customers.
 * Used by the marketing site backend after a successful purchase.
 *
 * Usage:
 *   node scripts/generate-license.mjs --name "Afya Pharmacy" --email owner@afya.co.ke
 *   node scripts/generate-license.mjs --name "..." --email "..." --maint-months 12
 *   node scripts/generate-license.mjs --name "..." --email "..." --features pharmacy,etims,insurance
 *
 * Output: a single license key string. Send this to the customer.
 */

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PRIVATE_KEY_PATH = resolve(ROOT, "keys/license-private.pem");

// Parse CLI args
const args = parseArgs(process.argv.slice(2));

if (args.help || (!args.name && !args["batch"])) {
  printUsage();
  process.exit(0);
}

if (args.batch) {
  printBatchTemplate();
  process.exit(0);
}

if (!args.name || !args.email) {
  console.error("Error: --name and --email are required");
  printUsage();
  process.exit(1);
}

const license = buildLicense({
  name: args.name,
  email: args.email,
  maintMonths: parseInt(args["maint-months"] || "12", 10),
  features: (args.features || "pharmacy,etims,insurance,lan,reports").split(","),
  type: args.type || "perpetual",
});

console.log("\n┌────────────────────────────────────────────────────────────");
console.log(`│ License generated for: ${license.payload.name}`);
console.log(`│ Email:                 ${license.payload.email}`);
console.log(`│ License ID:            ${license.payload.kid}`);
console.log(`│ Type:                  ${license.payload.type}`);
console.log(`│ Issued:                ${license.payload.issued}`);
console.log(`│ Maintenance until:     ${license.payload.maint_exp}`);
console.log(`│ Features:              ${license.payload.feat.join(", ")}`);
console.log("└────────────────────────────────────────────────────────────\n");
console.log("Send this key to the customer:\n");
console.log(license.key);
console.log("");

// ============================================================
// Implementation
// ============================================================

function buildLicense({ name, email, maintMonths, features, type }) {
  const today = new Date();
  const maintExp = new Date(today);
  maintExp.setMonth(maintExp.getMonth() + maintMonths);

  const payload = {
    kid: `SOKO-${today.getFullYear()}-${randomBlock(4)}-${randomBlock(4)}`,
    name,
    email,
    issued: today.toISOString().slice(0, 10),
    maint_exp: maintExp.toISOString().slice(0, 10),
    type,
    feat: features.map((f) => f.trim()).filter(Boolean),
    ver: 1,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson));

  const privateKey = readFileSync(PRIVATE_KEY_PATH, "utf8");
  const signer = createSign("RSA-SHA256");
  signer.update(payloadJson);
  const signature = signer.sign(privateKey);
  const signatureB64 = base64UrlEncode(signature);

  return {
    payload,
    key: `SOKO-${payloadB64}.${signatureB64}`,
  };
}

function base64UrlEncode(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomBlock(length) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      out.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        out[key] = "true";
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function printUsage() {
  console.log(`
SokoOS License Generator

Usage:
  node scripts/generate-license.mjs --name <name> --email <email> [options]

Required:
  --name             Customer/business name (in quotes if it contains spaces)
  --email            Customer email

Options:
  --maint-months N   Maintenance period in months (default: 12)
  --features list    Comma-separated features (default: all)
                     Available: pharmacy,etims,insurance,lan,reports
  --type type        License type: perpetual | trial | subscription (default: perpetual)
  --help, -h         Show this help

Examples:
  node scripts/generate-license.mjs --name "Afya Pharmacy" --email owner@afya.co.ke
  node scripts/generate-license.mjs --name "Trial User" --email trial@example.com --type trial --maint-months 1
`);
}

function printBatchTemplate() {
  console.log("# Batch generation: pipe a CSV of name,email rows");
  console.log("# Example:");
  console.log("#   echo 'Afya Pharmacy,owner@afya.co.ke' | node scripts/generate-license.mjs --batch");
}
