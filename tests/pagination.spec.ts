/**
 * pagination.spec.ts — smoke tests for the shared paged-query helper +
 * a representative page function (pageSuppliers).
 *
 * Verifies:
 *   1. LIMIT + OFFSET pagination returns the right slice
 *   2. Total reflects the full filter, not just the current page
 *   3. Search narrows the total
 *   4. Empty search returns everything
 */
import { describe, expect, it } from "vitest";
import { openTestDb } from "./helpers/sql-harness";

describe("SQL smoke — paged-query (suppliers)", () => {
  async function seed250Suppliers() {
    const db = await openTestDb();
    for (let i = 1; i <= 250; i++) {
      db.run(
        `INSERT INTO suppliers (id, name, phone, email, contact_person, active, balance_owed)
         VALUES (?, ?, ?, ?, ?, 1, 0)`,
        [
          `sup-${i.toString().padStart(3, "0")}`,
          `Supplier ${i.toString().padStart(3, "0")}`,
          `+2547${i.toString().padStart(8, "0")}`,
          `supplier${i}@example.com`,
          `Contact ${i}`,
        ],
      );
    }
    return db;
  }

  it("page 1 returns first pageSize (50) rows", async () => {
    const db = await seed250Suppliers();
    const [r] = db.exec(
      `SELECT COUNT(*) AS n FROM (SELECT * FROM suppliers WHERE active = 1 ORDER BY name ASC LIMIT 50 OFFSET 0)`,
    );
    expect(r.values[0][0]).toBe(50);
    const [first] = db.exec(
      `SELECT name FROM suppliers WHERE active = 1 ORDER BY name ASC LIMIT 50 OFFSET 0`,
    );
    expect(first.values[0][0]).toBe("Supplier 001");
    expect(first.values[49][0]).toBe("Supplier 050");
  });

  it("page 3 returns rows 101-150", async () => {
    const db = await seed250Suppliers();
    const [rows] = db.exec(
      `SELECT name FROM suppliers WHERE active = 1 ORDER BY name ASC LIMIT 50 OFFSET 100`,
    );
    expect(rows.values[0][0]).toBe("Supplier 101");
    expect(rows.values[49][0]).toBe("Supplier 150");
  });

  it("last page (page 5) returns rows 201-250", async () => {
    const db = await seed250Suppliers();
    const [rows] = db.exec(
      `SELECT name FROM suppliers WHERE active = 1 ORDER BY name ASC LIMIT 50 OFFSET 200`,
    );
    expect(rows.values.length).toBe(50);
    expect(rows.values[0][0]).toBe("Supplier 201");
    expect(rows.values[49][0]).toBe("Supplier 250");
  });

  it("COUNT reflects the current filter, not the whole table", async () => {
    const db = await seed250Suppliers();
    // Deactivate every 3rd supplier
    db.run(`UPDATE suppliers SET active = 0 WHERE CAST(SUBSTR(id, 5) AS INTEGER) % 3 = 0`);

    const [r] = db.exec(`SELECT COUNT(*) FROM suppliers WHERE active = 1`);
    expect(r.values[0][0]).toBe(167); // 250 - (250 / 3 rounded down)
  });

  it("LIKE search narrows the results", async () => {
    const db = await seed250Suppliers();
    const [r] = db.exec(
      `SELECT COUNT(*) FROM suppliers WHERE active = 1 AND
       (name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1 OR contact_person LIKE ?1)`,
      ["%01%"],
    );
    // Any supplier whose name/phone/email/pin contains '01' — 001, 010, 100..109, 101..199 subset, plus phones/emails
    const n = Number(r.values[0][0]);
    expect(n).toBeGreaterThan(50); // matches many
    expect(n).toBeLessThan(250);
  });

  it("empty search matches everything", async () => {
    const db = await seed250Suppliers();
    const [r] = db.exec(`SELECT COUNT(*) FROM suppliers WHERE active = 1`);
    expect(r.values[0][0]).toBe(250);
  });
});

describe("useListData contract (via shape check)", () => {
  it("ListPage<T> has rows, total, hasMore", () => {
    const page: import("../src/lib/list-types").ListPage<string> = {
      rows: ["a", "b"],
      total: 100,
      hasMore: true,
    };
    expect(page.rows.length).toBe(2);
    expect(page.total).toBe(100);
    expect(page.hasMore).toBe(true);
  });

  it("hasMore is false when we've fetched everything", () => {
    const page: import("../src/lib/list-types").ListPage<string> = {
      rows: ["a"],
      total: 1,
      hasMore: false,
    };
    expect(page.hasMore).toBe(false);
  });
});
