import { describe, expect, it } from "vitest";
import { museumDirectoryCorrections } from "@/lib/museum-directory-corrections";

describe("Correct museum identities", () => {
  it("places Musée Lumière in Lyon rather than Paris", () => {
    expect(museumDirectoryCorrections.find(m => m.name === "Musée Lumière")?.city).toBe("Lyon");
  });
  it("replaces the fictional Lyon museum with Musée des Beaux-Arts de Lyon", () => {
    expect(museumDirectoryCorrections.find(m => m.id === "10000000-0000-0000-0000-000000000003")).toMatchObject({ name: "Musée des Beaux-Arts de Lyon", city: "Lyon" });
  });
});