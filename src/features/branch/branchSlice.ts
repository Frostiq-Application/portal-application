import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";

const BRANCH_KEY = "frostique-portal-branch";

/** Sentinel meaning "no branch scoping" — used by pages that support it (Orders). */
export const ALL_BRANCHES = "all";

interface BranchState {
  /**
   * Currently selected branch (shop) id shared across shop-scoped screens
   * (Catalog, Orders, …). `""` = nothing selected yet; `ALL_BRANCHES` = the
   * "All branches" option for pages that offer it.
   */
  selectedBranchId: string;
}

function loadBranch(): string {
  try {
    return localStorage.getItem(BRANCH_KEY) ?? "";
  } catch {
    return "";
  }
}

function persist(id: string) {
  try {
    localStorage.setItem(BRANCH_KEY, id);
  } catch {
    /* ignore */
  }
}

const branchSlice = createSlice({
  name: "branch",
  initialState: { selectedBranchId: loadBranch() } as BranchState,
  reducers: {
    setSelectedBranch(state, action: PayloadAction<string>) {
      state.selectedBranchId = action.payload;
      persist(action.payload);
    },
  },
});

export const { setSelectedBranch } = branchSlice.actions;

export const selectSelectedBranchId = (state: RootState) =>
  state.branch.selectedBranchId;

export default branchSlice.reducer;
