import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CategoryDialog } from "./CategoryDialog";
import type { Category } from "@/types";

// The dialog only needs the mutation hooks to exist; nothing here submits.
vi.mock("@/features/api/catalogApi", () => ({
  useCreateCategoryMutation: () => [vi.fn(), { isLoading: false }],
  useUpdateCategoryMutation: () => [vi.fn(), { isLoading: false }],
}));
// ImageUploader pulls in upload plumbing that has nothing to do with seeding.
vi.mock("@/components/ImageUploader", () => ({
  ImageUploader: () => <div data-testid="image-uploader" />,
}));

const category = (over: Partial<Category>): Category =>
  ({
    id: "c1",
    name: "Cakes",
    sortOrder: 3,
    imageUrl: null,
    ...over,
  }) as Category;

const nameField = () => screen.getByLabelText("Name") as HTMLInputElement;
const sortField = () => screen.getByLabelText("Sort order") as HTMLInputElement;

/**
 * These fields used to be filled by an effect, which painted the *previous*
 * category's values for a frame before correcting itself. They're now seeded
 * during render, so the assertions below are about the very first paint —
 * nothing here flushes an effect or waits.
 */
describe("CategoryDialog seeding", () => {
  it("shows the category's values on the first render, not after an effect", () => {
    render(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        shopId="s1"
        category={category({ name: "Cakes", sortOrder: 3 })}
      />,
    );
    expect(nameField().value).toBe("Cakes");
    expect(sortField().value).toBe("3");
  });

  it("re-seeds when the dialog is pointed at a different category", () => {
    const { rerender } = render(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        shopId="s1"
        category={category({ id: "c1", name: "Cakes", sortOrder: 3 })}
      />,
    );
    expect(nameField().value).toBe("Cakes");

    rerender(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        shopId="s1"
        category={category({ id: "c2", name: "Cupcakes", sortOrder: 7 })}
      />,
    );
    expect(nameField().value).toBe("Cupcakes");
    expect(sortField().value).toBe("7");
  });

  it("clears back to the create defaults when reopened with no category", () => {
    const { rerender } = render(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        shopId="s1"
        category={category({ name: "Cakes", sortOrder: 3 })}
      />,
    );
    expect(nameField().value).toBe("Cakes");

    rerender(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        shopId="s1"
        category={null}
      />,
    );
    expect(nameField().value).toBe("");
    expect(sortField().value).toBe("0");
  });

  it("does not re-seed while the same category stays open", () => {
    const { rerender } = render(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        shopId="s1"
        category={category({ id: "c1", name: "Cakes" })}
      />,
    );
    fireEvent.change(nameField(), { target: { value: "Edited by the user" } });

    // A re-render for an unrelated reason must not stomp on typing.
    rerender(
      <CategoryDialog
        open
        onOpenChange={() => {}}
        shopId="s1"
        category={category({ id: "c1", name: "Cakes" })}
      />,
    );
    expect(nameField().value).toBe("Edited by the user");
  });
});
