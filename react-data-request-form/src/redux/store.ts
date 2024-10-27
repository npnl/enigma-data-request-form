// src/store.ts
import { configureStore } from "@reduxjs/toolkit";
import metricsReducer from "./metricsSlice";
import modalReducer from "./modalSlice";
import requestsReducer from "./requestsSlice";
import qcReducer from "./qcSlice";

export const store = configureStore({
  reducer: {
    metrics: metricsReducer,
    modal: modalReducer,
    requests: requestsReducer,
    qcData: qcReducer,
  },
});

// Types for TypeScript integration with Redux
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
