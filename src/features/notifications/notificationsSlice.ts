import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/app/store";
import type { StreamStatus } from "@/hooks/useOrderStream";

interface NotificationsState {
  /** A new order landed while the user was away from the Orders screen. */
  hasUnseenOrders: boolean;
  /** Live SSE connection state, surfaced app-wide for the Orders indicator. */
  streamStatus: StreamStatus;
  /** A new enquiry landed while the user was away from the Queries screen. */
  hasUnseenEnquiries: boolean;
  /** Live SSE connection state for the Queries indicator. */
  enquiryStreamStatus: StreamStatus;
}

const initialState: NotificationsState = {
  hasUnseenOrders: false,
  streamStatus: "connecting",
  hasUnseenEnquiries: false,
  enquiryStreamStatus: "connecting",
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
    /** A new enquiry arrived off-screen — raise the sidebar dot. */
    enquiryArrived(state) {
      state.hasUnseenEnquiries = true;
    },
    /** User opened the Queries screen — clear the dot. */
    enquiriesSeen(state) {
      state.hasUnseenEnquiries = false;
    },
    setEnquiryStreamStatus(state, action: PayloadAction<StreamStatus>) {
      state.enquiryStreamStatus = action.payload;
    },
    /**
     * Back to a blank slate when the session ends. These dots say "something
     * arrived for *you* while you weren't looking" — carrying one into the next
     * person's session points them at another brand's order.
     */
    resetNotifications() {
      return initialState;
    },
  },
});

export const {
  newOrderArrived,
  ordersSeen,
  setStreamStatus,
  enquiryArrived,
  enquiriesSeen,
  setEnquiryStreamStatus,
  resetNotifications,
} = notificationsSlice.actions;

export const selectHasUnseenOrders = (s: RootState) =>
  s.notifications.hasUnseenOrders;
export const selectStreamStatus = (s: RootState) =>
  s.notifications.streamStatus;
export const selectHasUnseenEnquiries = (s: RootState) =>
  s.notifications.hasUnseenEnquiries;
export const selectEnquiryStreamStatus = (s: RootState) =>
  s.notifications.enquiryStreamStatus;

export default notificationsSlice.reducer;
