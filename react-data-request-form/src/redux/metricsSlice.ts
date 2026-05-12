// src/features/metrics/metricsSlice.ts
import {
  createSlice,
  PayloadAction,
  createAsyncThunk,
  SerializedError,
} from "@reduxjs/toolkit";
import ApiUtils from "../api/ApiUtils";
import HttpClient from "../api/HttpClient"; // Import HttpClient
import { DataFrame, Row } from "../types/DataTypes";
import {
  GetMetricResponse,
  MetricsData,
  Metric,
  Timepoint,
} from "../types/MetricsData";
import { RecordCountResponse } from "../types/RecordCountResponse";
import { RootState } from "./store";
import TimepointSelection from "../components/TimepointSelection";
import { getCurrentUserToken } from "../services/authService";
import { auth } from "../firebaseConfig";

export const fetchMetrics = createAsyncThunk<
  GetMetricResponse,
  void,
  { rejectValue: string }
>("metrics/fetchMetrics", async (_, { rejectWithValue }) => {
  try {
    if (!auth.currentUser) {
      await new Promise<void>((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          if (user) {
            unsubscribe();
            resolve();
          }
        });
      });
    }
    const token = await getCurrentUserToken();
    const response = await HttpClient.get<GetMetricResponse>("metrics", token);
    return response;
  } catch (error: any) {
    return rejectWithValue(error.message || "An unknown error occurred");
  }
});


export const updateRowCount = createAsyncThunk(
  "metrics/updateRowCount",
  async (_, { dispatch, getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const timepoint = state.metrics.timepoint;
    const behavioralRequiredMetrics = Object.values(
      state.metrics.behavioralMetrics
    )
      .flatMap((subcategories) => Object.values(subcategories)
      .flatMap((metrics) => metrics.filter((m) => m.is_required)))
      .map((metric) => metric.metric_name);
    const imagingRequiredMetrics = Object.values(state.metrics.imagingMetrics)
      .flatMap((subcategories) => Object.values(subcategories)
      .flatMap((metrics) => metrics.filter((m) => m.is_required)))
      .map((metric) => metric.metric_name);

    try {
      if (!auth.currentUser){
        await new Promise<void>((resolve) => {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
              unsubscribe();
              resolve();
            }
          });
        });
      }
      const token = await getCurrentUserToken();
      const filters = {
        timepoint: timepoint as string,
        required_metrics: behavioralRequiredMetrics.concat(imagingRequiredMetrics),
        or_groups: state.metrics.orGroups,
      };
      const response = await HttpClient.post<{
        success: boolean;
        count: number;
        total_sites: number;
        sessions_per_site: { [site: string]: number };
      }>("rows-count", filters, token);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "Error fetching row count");
    }
  }
);

export const setTimepointAndUpdateRowCount = createAsyncThunk(
  "metrics/setTimepointAndUpdateRowCount",
  async ({ timepoint }: { timepoint: Timepoint }, { dispatch }) => {
    // Assume setTimepoint can be a synchronous action
    dispatch(setTimepoint({ timepoint }));
    dispatch(updateRowCount());
  }
);


export const setRequiredAndUpdateRowCount = createAsyncThunk(
  "metrics/setRequiredAndUpdateRowCount",
  async (
    {
      category,
      metricName,
      isRequired,
    }: { category: string; metricName: string; isRequired: boolean },
    { dispatch, getState, rejectWithValue }
  ) => {
    dispatch(setRequired({ category, metricName, isRequired }));
    dispatch(updateRowCount());
  }
);

function isMetricsData(data: any): data is MetricsData {
  return Object.values(data).every((subcategories) =>
    typeof subcategories === "object" && subcategories !== null &&
    Object.values(subcategories).every(
      (metrics) =>
        Array.isArray(metrics) &&
        metrics.every(
          (metric) =>
            "metric_name" in metric &&
            "variable_type" in metric &&
            "description" in metric
        )
    )
  );
}

const metricsSlice = createSlice({
  name: "metrics",
  initialState: {
    timepoint: "baseline" as Timepoint,
    behavioralMetrics: {} as MetricsData,
    imagingMetrics: {} as MetricsData,
    rowCount: 0,
    totalSites: 0,
    sessionsPerSite: {} as { [site: string]: number },
    booleanData: {} as DataFrame,
    status: "idle",
    error: null as string | null | unknown,
    viewMode: "basic" as "basic" | "advanced",
    spaceMode: "native" as "native" | "mni", 
    orGroups: [] as string[][],
  },
  reducers: {
    setTimepoint: (state, action: PayloadAction<{ timepoint: Timepoint }>) => {
      const { timepoint } = action.payload;
      state.timepoint = timepoint;
    },
    restoreStateFromJSON: (
      state,
      action: PayloadAction<{
        timepoint: Timepoint;
        behavioral: MetricsData;
        imaging: MetricsData;
        orGroups: string[][];
        viewMode?: "basic" | "advanced";
      }>
    ) => {
      const { timepoint, behavioral, imaging, orGroups, viewMode } = action.payload;
      
      state.timepoint = timepoint;
      
      if (viewMode) {
        state.viewMode = viewMode;
      }
      state.behavioralMetrics = behavioral;
      state.imagingMetrics = imaging;
      state.orGroups = orGroups;
    },

    setSelected: (
      state,
      action: PayloadAction<{
        category: string;
        metricName: string;
        isSelected: boolean;
      }>
    ) => {
      const { category, metricName, isSelected } = action.payload;
      if (state.behavioralMetrics[category]) {
        const subcategories = state.behavioralMetrics[category];
        for (const [subcat, metrics] of Object.entries(subcategories)) {
          const metricIndex = metrics.findIndex(
            (m) => m.metric_name === metricName
          );
          if (metricIndex !== -1) {
            metrics[metricIndex].is_selected = isSelected;
            return;
          }
        }
      }
      if (state.imagingMetrics[category]) {
        const subcategories = state.imagingMetrics[category];
        for (const [subcat, metrics] of Object.entries(subcategories)) {
          const metricIndex = metrics.findIndex(
            (m) => m.metric_name === metricName
          );
          if (metricIndex !== -1) {
            metrics[metricIndex].is_selected = isSelected;
            return;
          }
        }
      }
    },
    setSelectedAll: (
      state,
      action: PayloadAction<{ category: string; subcategory?: string; isSelected?: boolean }>
    ) => {
      const { category, subcategory, isSelected = true } = action.payload;

      const updateSelection = (metrics: Metric[]) => {
        metrics.forEach((m) => {
          if (state.viewMode === "basic" && !m.essential) return;
          if (state.spaceMode === "native" && m.space === 'mni') return;
          if (state.spaceMode === "mni" && m.space !== 'mni') return;
          m.is_selected = isSelected;
        });
      };

      if (subcategory && state.behavioralMetrics[category]?.[subcategory]) {
        updateSelection(state.behavioralMetrics[category][subcategory]);
        return;
      }

      if (subcategory && state.imagingMetrics[category]?.[subcategory]) {
        updateSelection(state.imagingMetrics[category][subcategory]);
        return;
      }

      if (state.behavioralMetrics[category]) {
        Object.values(state.behavioralMetrics[category]).forEach(updateSelection);
      }

      if (state.imagingMetrics[category]) {
        Object.values(state.imagingMetrics[category]).forEach(updateSelection);
      }
    },
    resetSelectedAll: (
      state,
      action: PayloadAction<{ category: string; subcategory?: string }>
    ) => {
      const { category, subcategory } = action.payload;

      // Deselect all within a specific subcategory
      if (subcategory && state.behavioralMetrics[category]?.[subcategory]) {
        const metrics = state.behavioralMetrics[category][subcategory];
        metrics.forEach((metric) => {
          metric.is_selected = false;
        });
        return;
      }

      if (subcategory && state.imagingMetrics[category]?.[subcategory]) {
        const metrics = state.imagingMetrics[category][subcategory];
        metrics.forEach((metric) => {
          metric.is_selected = false;
        });
      return;
      }

      if (state.behavioralMetrics[category]) {
        const subcategories = state.behavioralMetrics[category];
        if (subcategories && typeof subcategories === "object") {
          for (const metrics of Object.values(subcategories)) {
            if (Array.isArray(metrics)) {
              metrics.forEach((metric) => {
                metric.is_selected = false;
              });
            }
          }
        }
      }

      if (state.imagingMetrics[category]) {
        const subcategories = state.imagingMetrics[category];
        if (subcategories && typeof subcategories === "object") {
          for (const metrics of Object.values(subcategories)) {
            if (Array.isArray(metrics)) {
              metrics.forEach((metric) => {
                metric.is_selected = false;
              });
            }
          }
        }
      }
    },
    setRequired: (
      state,
      action: PayloadAction<{
        category: string;
        metricName: string;
        isRequired: boolean;
      }>
    ) => {
      const { category, metricName, isRequired } = action.payload;

    if (state.behavioralMetrics[category]) {
      const subcategories = state.behavioralMetrics[category];
      for (const [subcat, metrics] of Object.entries(subcategories)) {
        const metricIndex = metrics.findIndex(
          (m) => m.metric_name === metricName
        );
        if (metricIndex !== -1) {
          metrics[metricIndex].is_required = isRequired;
          return; 
        }
      }
    }


    if (state.imagingMetrics[category]) {
      const subcategories = state.imagingMetrics[category];
      for (const [subcat, metrics] of Object.entries(subcategories)) {
        const metricIndex = metrics.findIndex(
          (m) => m.metric_name === metricName
        );
        if (metricIndex !== -1) {
          metrics[metricIndex].is_required = isRequired;
          return;
        }
      }
    }
  },
    setRequiredAll: (
      state,
      action: PayloadAction<{ category: string; subcategory?: string }>
    ) => {
      const { category, subcategory } = action.payload;

      if (subcategory && state.behavioralMetrics[category]?.[subcategory]) {
        const metrics = state.behavioralMetrics[category][subcategory];
        metrics.forEach((metric) => {
          metric.is_required = true;
        });
        return;
      }

      if (subcategory && state.imagingMetrics[category]?.[subcategory]) {
        const metrics = state.imagingMetrics[category][subcategory];
        metrics.forEach((metric) => {
          metric.is_required = true;
        });
      return;
      }

      if (state.behavioralMetrics[category]) {
        const subcategories = state.behavioralMetrics[category];
        if (subcategories && typeof subcategories === "object") {
          for (const metrics of Object.values(subcategories)) {
            if (Array.isArray(metrics)) {
              metrics.forEach((metric) => {
                metric.is_required = true;
              });
            }
          }
        }
      }

      if (state.imagingMetrics[category]) {
        const subcategories = state.imagingMetrics[category];
        if (subcategories && typeof subcategories === "object") {
          for (const metrics of Object.values(subcategories)) {
            if (Array.isArray(metrics)) {
              metrics.forEach((metric) => {
                metric.is_required = true;
              });
            }
          }
        }
      }
    },
    resetRequiredAll: (
      state,
      action: PayloadAction<{ category: string; subcategory?: string }>
    ) => {
      const { category, subcategory } = action.payload;

      // Deselect all within a specific subcategory
      if (subcategory && state.behavioralMetrics[category]?.[subcategory]) {
        const metrics = state.behavioralMetrics[category][subcategory];
        metrics.forEach((metric) => {
          metric.is_required = false;
        });
        return;
      }

      if (subcategory && state.imagingMetrics[category]?.[subcategory]) {
        const metrics = state.imagingMetrics[category][subcategory];
        metrics.forEach((metric) => {
          metric.is_required = false;
        });
      return;
      }

      if (state.behavioralMetrics[category]) {
        const subcategories = state.behavioralMetrics[category];
        if (subcategories && typeof subcategories === "object") {
          for (const metrics of Object.values(subcategories)) {
            if (Array.isArray(metrics)) {
              metrics.forEach((metric) => {
                metric.is_required = false;
              });
            }
          }
        }
      }

      if (state.imagingMetrics[category]) {
        const subcategories = state.imagingMetrics[category];
        if (subcategories && typeof subcategories === "object") {
          for (const metrics of Object.values(subcategories)) {
            if (Array.isArray(metrics)) {
              metrics.forEach((metric) => {
                metric.is_required = false;
              });
            }
          }
        }
      }
    },
    setViewMode: (state, action: PayloadAction<"basic" | "advanced">) => {
      state.viewMode = action.payload;
    },

    setSpaceMode: (state, action: PayloadAction<"native" | "mni">) => {
      state.spaceMode = action.payload;
    },
    resetFormState: (state) => {
      state.timepoint = "baseline";
      state.rowCount = 0;
      state.totalSites = 0;
      state.sessionsPerSite = {};
      state.orGroups = [];

      const clearMetrics = (metricsData: MetricsData) => {
        Object.values(metricsData).forEach((subcategories) => {
          Object.values(subcategories).forEach((metrics) => {
            metrics.forEach((m) => {
              m.is_selected = false;
              m.is_required = false;
              m.filter_value1 = "";
              m.filter_value2 = "";
            });
          });
        });
      };
      clearMetrics(state.behavioralMetrics);
      clearMetrics(state.imagingMetrics);
    },
    setOrGroups(state, action: PayloadAction<string[][]>) {
      state.orGroups = action.payload;
    },
    addOrGroup(state) {
      state.orGroups.push([]); // creates an empty group
    },
    updateOrGroup(state, action: PayloadAction<{ index: number; metrics: string[] }>) {
      const { index, metrics } = action.payload;
      state.orGroups[index] = metrics;
    },
    removeOrGroup(state, action: PayloadAction<number>) {
      state.orGroups.splice(action.payload, 1);
    },
    setFilterValue1: (
      state,
      action: PayloadAction<{
        category: string;
        metricName: string;
        value: string | number;
      }>
    ) => {
      const { category, metricName, value } = action.payload;

      if (state.behavioralMetrics[category]) {
        const subcategories = state.behavioralMetrics[category];
        for (const [subcat, metrics] of Object.entries(subcategories)) {
          const metricIndex = metrics.findIndex(
            (m) => m.metric_name === metricName
          );
          if (metricIndex !== -1) {
            metrics[metricIndex].filter_value1 = value;
            return; // stop once found
          }
        }
      }

      if (state.imagingMetrics[category]) {
        const subcategories = state.imagingMetrics[category];
        for (const [subcat, metrics] of Object.entries(subcategories)) {
          const metricIndex = metrics.findIndex(
            (m) => m.metric_name === metricName
          );
          if (metricIndex !== -1) {
            metrics[metricIndex].filter_value1 = value;
            return;
          }
        }
      }
    },
        setFilterValue2: (
      state,
      action: PayloadAction<{
        category: string;
        metricName: string;
        value: string | number;
      }>
    ) => {
      const { category, metricName, value } = action.payload;

      if (state.behavioralMetrics[category]) {
        const subcategories = state.behavioralMetrics[category];
        for (const [subcat, metrics] of Object.entries(subcategories)) {
          const metricIndex = metrics.findIndex(
            (m) => m.metric_name === metricName
          );
          if (metricIndex !== -1) {
            metrics[metricIndex].filter_value2 = value;
            return; 
          }
        }
      }

      if (state.imagingMetrics[category]) {
        const subcategories = state.imagingMetrics[category];
        for (const [subcat, metrics] of Object.entries(subcategories)) {
          const metricIndex = metrics.findIndex(
            (m) => m.metric_name === metricName
          );
          if (metricIndex !== -1) {
            metrics[metricIndex].filter_value2 = value;
            return;
          }
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMetrics.pending, (state) => {
        state.status = "loading";
      })
      .addCase(
        fetchMetrics.fulfilled,
        (state, action: PayloadAction<GetMetricResponse>) => {
          state.status = "succeeded";
          const { behavioral, imaging } = action.payload;
          const addDefaultToMetrics = (data: MetricsData) =>
          Object.fromEntries(
            Object.entries(data).map(([category, subcategories]) => [
              category,
              Object.fromEntries(
                Object.entries(subcategories).map(
                  ([subcat, metrics]) => [
                      subcat,
                      metrics.map((metric) => ({
                        ...metric,
                        is_required: metric.is_required ?? false,
                        is_selected: metric.is_selected ?? false,
                        filter_value1: metric.filter_value1 ?? "",
                        filter_value2: metric.filter_value2 ?? "",
                      })),
                    ]
                  )
                ),
              ])
            );
            if(isMetricsData(behavioral)) {
              state.behavioralMetrics = addDefaultToMetrics(behavioral);
            }
            if(isMetricsData(imaging)) {
              state.imagingMetrics = addDefaultToMetrics(imaging);
            }
            
          }
      )
      .addCase(
        fetchMetrics.rejected,
        (
          state,
          action: PayloadAction<
            string | undefined,
            string,
            never,
            SerializedError
          >
        ) => {
          state.status = "failed";
          state.error = action.payload || "Failed to fetch data";
        }
      );
    builder
      .addCase(updateRowCount.fulfilled, (state, action) => {
        state.rowCount = action.payload.count; // Update the row count in state
        state.totalSites = action.payload.total_sites || 0;
        state.sessionsPerSite = action.payload.sessions_per_site || {};
      })
      .addCase(updateRowCount.rejected, (state, action) => {
        state.error = action.payload; // Handle any errors
      });
  },
});

export default metricsSlice.reducer;
export const {
  setTimepoint,
  setSelected,
  setSelectedAll,
  resetSelectedAll,
  setRequired,
  setRequiredAll,
  resetRequiredAll,
  setFilterValue1,
  setFilterValue2,
  setViewMode,
  setSpaceMode,
  setOrGroups,
  addOrGroup,
  updateOrGroup,
  removeOrGroup,
  restoreStateFromJSON,
  resetFormState,
} = metricsSlice.actions;
