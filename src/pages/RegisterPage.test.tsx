import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

/**
 * Signup's two uniqueness questions.
 *
 * An email that already has an account is a dead end: the form has to say so
 * before the owner types a password, and must not let the submit through into a
 * 409 they'll only see as a toast. A shop name that already exists is NOT a dead
 * end — the server hands out `golden-cake-4f9c2a` — so the form stays submittable
 * and shows the address that's coming.
 */

const mockState = vi.hoisted(() => ({
  emailAvailable: true,
  slugAvailable: true,
  suggestedSlug: null as string | null,
  /** Every availability request the page made, so we can assert on debouncing. */
  checks: [] as { email?: string; appSlug?: string }[],
  registered: [] as { appSlug: string; ownerEmail: string }[],
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock("@/app/hooks", () => ({
  useAppDispatch: () => vi.fn(),
}));
vi.mock("@/features/api/authApi", () => ({
  useLoginMutation: () => [
    vi.fn(() => ({ unwrap: () => Promise.resolve({}) })),
    { isLoading: false },
  ],
}));
vi.mock("@/features/api/accountsApi", () => ({
  useRegisterAccountMutation: () => [
    (body: { appSlug: string; ownerEmail: string }) => {
      mockState.registered.push(body);
      return { unwrap: () => Promise.resolve({ ...body }) };
    },
    { isLoading: false },
  ],
  useRegistrationAvailabilityQuery: (
    args: { email?: string; appSlug?: string },
    opts?: { skip?: boolean },
  ) => {
    if (opts?.skip) return { currentData: undefined, isFetching: false };
    mockState.checks.push(args);
    return {
      currentData: {
        emailAvailable: args.email ? mockState.emailAvailable : null,
        slugAvailable: args.appSlug ? mockState.slugAvailable : null,
        suggestedSlug: args.appSlug ? mockState.suggestedSlug : null,
      },
      isFetching: false,
    };
  },
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );

const { RegisterPage } = await import("./RegisterPage");

const field = (label: RegExp) => screen.getByLabelText(label);
const submit = () => screen.getByRole("button", { name: /create shop/i });

/** Fill everything except the shop name, which each test drives itself. */
async function fillOwner(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field(/your name/i), "Asha Mehta");
  await user.type(field(/^email$/i), "asha@divinecake.com");
  await user.type(field(/phone/i), "9812345678");
  await user.type(field(/^password$/i), "Str0ngPass1");
}

describe("RegisterPage: email availability", () => {
  beforeEach(() => {
    mockState.emailAvailable = true;
    mockState.slugAvailable = true;
    mockState.suggestedSlug = null;
    mockState.checks = [];
    mockState.registered = [];
  });

  it("only asks about a whole address, once typing settles", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(field(/^email$/i), "asha@divine");
    // Half an address is never taken — nothing to ask about yet.
    expect(mockState.checks.some((c) => c.email)).toBe(false);

    await user.type(field(/^email$/i), "cake.com");
    await waitFor(() =>
      expect(mockState.checks.at(-1)?.email).toBe("asha@divinecake.com"),
    );
  });

  it("blocks the submit and offers a way out when the email is taken", async () => {
    mockState.emailAvailable = false;
    const user = userEvent.setup();
    renderPage();

    await user.type(field(/shop name/i), "Golden Cake");
    await fillOwner(user);

    const warning = await screen.findByRole("alert");
    expect(warning).toHaveTextContent(/already has an account/i);
    expect(screen.getByRole("link", { name: /sign in instead/i })).toBeVisible();
    expect(field(/^email$/i)).toHaveAttribute("aria-invalid", "true");
    expect(submit()).toBeDisabled();

    await user.click(submit());
    expect(mockState.registered).toHaveLength(0);
  });

  it("lets a free email through", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(field(/shop name/i), "Golden Cake");
    await fillOwner(user);

    await waitFor(() => expect(submit()).toBeEnabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RegisterPage: storefront address", () => {
  beforeEach(() => {
    mockState.emailAvailable = true;
    mockState.slugAvailable = true;
    mockState.suggestedSlug = null;
    mockState.checks = [];
    mockState.registered = [];
  });

  it("previews the address the shop name derives", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(field(/shop name/i), "Golden Cake");

    expect(await screen.findByText("/golden-cake")).toBeVisible();
  });

  it("shows the suffixed address a taken name will get, without blocking", async () => {
    mockState.slugAvailable = false;
    mockState.suggestedSlug = "golden-cake-4f9c2a";
    const user = userEvent.setup();
    renderPage();

    await user.type(field(/shop name/i), "Golden Cake");
    await fillOwner(user);

    expect(await screen.findByText(/already taken/i)).toBeVisible();
    expect(screen.getByText("/golden-cake-4f9c2a")).toBeVisible();
    // A shared name is not the owner's problem to solve — signup carries on.
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it("sends the plain address and lets the server allocate a free one", async () => {
    mockState.slugAvailable = false;
    mockState.suggestedSlug = "golden-cake-4f9c2a";
    const user = userEvent.setup();
    renderPage();

    await user.type(field(/shop name/i), "Golden Cake");
    await fillOwner(user);
    await waitFor(() => expect(submit()).toBeEnabled());
    await user.click(submit());

    // The suggestion is a preview, not an instruction: sending it back would
    // reserve nothing and race any other signup that saw the same suggestion.
    await waitFor(() => expect(mockState.registered).toHaveLength(1));
    expect(mockState.registered[0].appSlug).toBe("golden-cake");
  });
});
