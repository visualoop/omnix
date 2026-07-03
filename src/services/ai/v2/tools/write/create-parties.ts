/**
 * Customer + Supplier + Category + Brand create tools. All write-tier.
 */
import { z } from "zod";
import { register } from "../registry";
import { defineWrite } from "../write-helpers";
import { upsertCustomer, upsertSupplier } from "@/services/erp";

// ─── Customer ──────────────────────────────────────────────
const customerParams = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  credit_limit: z.number().nonnegative().optional(),
  kra_pin: z.string().optional(),
});
register(defineWrite<z.infer<typeof customerParams>>({
  id: "create_customer",
  description: "Create or update a customer record",
  parameters: customerParams,
  ui: { label: "Create customer", icon: "User" },
  summary: (a) => `Create customer "${a.name}"${a.phone ? ` · ${a.phone}` : ""}`,
  async run(a) {
    const id = await upsertCustomer({
      name: a.name, phone: a.phone, email: a.email,
      credit_limit: a.credit_limit, kra_pin: a.kra_pin,
    } as any);
    return { title: `Created customer ${a.name}`, output: `Customer saved (id: ${id}).`, metadata: { id } };
  },
}));

// ─── Supplier ──────────────────────────────────────────────
const supplierParams = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  payment_terms: z.string().optional(),
});
register(defineWrite<z.infer<typeof supplierParams>>({
  id: "create_supplier",
  description: "Create or update a supplier record",
  parameters: supplierParams,
  ui: { label: "Create supplier", icon: "Building" },
  summary: (a) => `Create supplier "${a.name}"${a.contact_person ? ` · contact ${a.contact_person}` : ""}`,
  async run(a) {
    const id = await upsertSupplier({
      name: a.name, phone: a.phone, email: a.email, address: a.address,
      contact_person: a.contact_person, payment_terms: a.payment_terms,
    } as any);
    return { title: `Created supplier ${a.name}`, output: `Supplier saved (id: ${id}).`, metadata: { id } };
  },
}));
