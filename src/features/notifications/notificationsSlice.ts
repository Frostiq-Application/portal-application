import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";
import type { StreamStatus } from "@/hooks/useOrderStream";

interface NotificationsState {
  /** A new order landed while the user was away from the Orders screen. */
  hasUnseenOrders: boolean;
  /** Live SSE connection state, surfaced app-wide for the Orders indicator. */
  streamStatus: StreamStatus;
}

const initialState: NotificationsState = {
  hasUnseenOrders: false,
  streamStatus: "connecting",
};

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    /** A new order arrived off-screen — raise the sidebar dot. */
    newOrderArrived(state) {
      state.hasUnseenOrders = true;
    },
    /** User opened the Orders screen — clear the dot. */
    ordersSeen(state) {
      state.hasUnseenOrders = false;
    },
    setStreamStatus(state, action: PayloadAction<StreamStatus>) {
      state.streamStatus = action.payload;
    },
  },
});

export const { newOrderArrived, ordersSeen, setStreamStatus } =
  notificationsSlice.actions;

export const selectHasUnseenOrders = (s: RootState) =>
  s.notifications.hasUnseenOrders;
export const selectStreamStatus = (s: RootState) =>
  s.notifications.streamStatus;

export default notificationsSlice.reducer;
