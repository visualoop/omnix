/**
 * AI harness v2 barrel — import once during app boot to register every
 * tool + agent into the singleton registry.
 *
 * Usage:
 *   import "@/services/ai/v2";  // side-effect only
 *
 * After this import, `listTools()` will return the full toolset and
 * agents can be spawned against them.
 */
export * from "./tools/base";
export * as ToolRegistry from "./tools/registry";
export * from "./tools/write-helpers";

// Side-effect imports: register every tool at load time.
import "./tools/read";
import "./tools/write";
import "./tools/system";
