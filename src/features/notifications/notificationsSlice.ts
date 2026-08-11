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
  /**
   * A new custom-cake request landed while the user was away from the Custom
   * Cakes queue.
   */
  hasUnseenCustomCakes: boolean;
  /** Live SSE connection state for the Custom Cakes indicator. */
  customCakeStreamStatus: StreamStatus;
}

const initialState: NotificationsState = {
  hasUnseenOrders: false,
  streamStatus: "connecting",
  hasUnseenEnquiries: false,
  enquiryStreamStatus: "connecting",
  hasUnseenCustomCakes: false,
  customCakeStreamStatus: "connecting",
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
    /** A new custom-cake request arrived off-screen — raise the sidebar dot. */
    customCakeArrived(state) {
      state.hasUnseenCustomCakes = true;
    },
    /** User opened the Custom Cakes queue — clear the dot. */
    customCakesSeen(state) {
      state.hasUnseenCustomCakes = false;
    },
    setCustomCakeStreamStatus(state, action: PayloadAction<StreamStatus>) {
      state.customCakeStreamStatus = action.payload;
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
  customCakeArrived,
  customCakesSeen,
  setCustomCakeStreamStatus,
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
export const selectHasUnseenCustomCakes = (s: RootState) =>
  s.notifications.hasUnseenCustomCakes;
export const selectCustomCakeStreamStatus = (s: RootState) =>
  s.notifications.customCakeStreamStatus;

export default notificationsSlice.reducer;
