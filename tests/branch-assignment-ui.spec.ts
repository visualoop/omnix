import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const usersSource = readFileSync(resolve("src/pages/users.tsx"), "utf8");

describe("staff branch assignment UI", () => {
  it("does not hide assignment controls in a single-branch business", () => {
    expect(usersSource).toContain("<BranchAssignmentBlock userId={user.id} />");
    expect(usersSource).not.toContain("branches.length <= 1");
  });
});
