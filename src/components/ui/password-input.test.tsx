import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "./password-input";

/**
 * The reveal toggle on every password box in the portal. What matters is that
 * it starts masked — a field that renders visible would put the password on
 * screen for anyone stood behind the counter.
 */
describe("PasswordInput", () => {
  const field = () => screen.getByLabelText("Password");

  it("starts masked and reveals on demand", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" defaultValue="s3cret-cake" />);

    expect(field()).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /show password/i }));
    expect(field()).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(field()).toHaveAttribute("type", "password");
  });
});
