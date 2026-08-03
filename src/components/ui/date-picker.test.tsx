import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker, DateTimePicker } from "./date-picker";

/** Drives the picker the way a form does — controlled, string in, string out. */
function Harness({ initial = "", ...rest }: { initial?: string; min?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DatePicker value={value} onChange={setValue} {...rest} />
      <output data-testid="value">{value}</output>
    </>
  );
}

const value = () => screen.getByTestId("value").textContent;

describe("DatePicker", () => {
  it("emits the day that was clicked, in local time", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2025-03-10" />);

    await user.click(screen.getByRole("button", { name: /10 Mar 2025/ }));
    const grid = await screen.findByRole("grid");
    await user.click(
      within(grid).getByRole("button", { name: /March 11th, 2025/ }),
    );

    // The classic failure here is 2025-03-10: parsing "2025-03-11" as UTC
    // midnight and formatting it back through a negative-offset local zone.
    expect(value()).toBe("2025-03-11");
  });

  it("shows the placeholder while empty and clears back to it", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2025-03-10" />);

    await user.click(screen.getByRole("button", { name: /10 Mar 2025/ }));
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(value()).toBe("");
    expect(screen.getByRole("button", { name: /pick a date/i })).toBeVisible();
  });

  it("disables days outside the bounds it was given", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2025-03-10" min="2025-03-10" />);

    await user.click(screen.getByRole("button", { name: /10 Mar 2025/ }));
    const grid = await screen.findByRole("grid");

    expect(
      within(grid).getByRole("button", { name: /March 9th, 2025/ }),
    ).toBeDisabled();
    expect(
      within(grid).getByRole("button", { name: /March 11th, 2025/ }),
    ).toBeEnabled();
  });
});

describe("DateTimePicker", () => {
  it("keeps the time already set when the day changes", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState("2025-03-10T18:30");
      return (
        <>
          <DateTimePicker value={value} onChange={setValue} />
          <output data-testid="value">{value}</output>
        </>
      );
    }
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: /18:30/ }));
    const grid = await screen.findByRole("grid");
    await user.click(
      within(grid).getByRole("button", { name: /March 12th, 2025/ }),
    );

    // Moving a coupon window to another day shouldn't silently reset it to
    // midnight — the whole point of the field is the time.
    expect(value()).toBe("2025-03-12T18:30");
  });
});
