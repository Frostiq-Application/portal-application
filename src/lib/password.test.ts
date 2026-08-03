import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password";

describe("passwordStrength", () => {
  it("asks for the whole rule while the field is empty", () => {
    const s = passwordStrength("");
    expect(s.score).toBe(0);
    expect(s.label).toBe("");
    expect(s.meetsMinimum).toBe(false);
    expect(s.hint).toMatch(/8 characters/);
  });

  it("refuses a password the API would reject", () => {
    // Long enough, but no number — the server's rule, not just the length.
    const noNumber = passwordStrength("cakeshopowner");
    expect(noNumber.meetsMinimum).toBe(false);
    expect(noNumber.label).toBe("Too weak");
    expect(noNumber.hint).toBe("Add a number.");

    const noLetter = passwordStrength("12345678");
    expect(noLetter.meetsMinimum).toBe(false);
    expect(noLetter.hint).toBe("Add a letter.");

    const tooShort = passwordStrength("cake1");
    expect(tooShort.meetsMinimum).toBe(false);
    expect(tooShort.hint).toMatch(/8 characters minimum/);
  });

  it("scores upward from the minimum", () => {
    const bare = passwordStrength("cakes123");
    expect(bare.meetsMinimum).toBe(true);
    expect(bare.label).toBe("Fair");

    // One extra — length.
    expect(passwordStrength("cakeshop1234").label).toBe("Good");

    // Length, mixed case and a symbol cap it out.
    const strong = passwordStrength("CakeShop!2345");
    expect(strong.score).toBe(4);
    expect(strong.label).toBe("Strong");
    expect(strong.hint).toBeNull();
  });

  it("never scores above the bar without clearing it", () => {
    // 20 characters of one case, no digits: long, still not acceptable.
    const s = passwordStrength("abcdefghijklmnopqrst");
    expect(s.meetsMinimum).toBe(false);
    expect(s.score).toBe(1);
  });
});
