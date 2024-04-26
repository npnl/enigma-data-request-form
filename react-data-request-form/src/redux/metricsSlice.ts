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

export const fetchMetrics = createAsyncThunk<
  GetMetricResponse,
  void,
  { rejectValue: string }
>("metrics/fetchMetrics", async (_, { rejectWithValue }) => {
  try {
    const response = await HttpClient.get<GetMetricResponse>("metrics");
    // console.log(response);
    return response;
  } catch (error: any) {
    return rejectWithValue(error.message || "An unknown error occurred");
  }
});

export const fetchBooleanData = createAsyncThunk<DataFrame, void, { rejectValue: string }>(
  'metrics/booleanData',
  async (_, { rejectWithValue }) => {
    try {
      const response = await ApiUtils.fetchBooleanData(); // Assuming this returns a DataFrame
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || "An unknown error occurred");
    }
  }
);

interface ColumnMapping {
  [key: string]: string;
}


const colMapping: ColumnMapping = {
  'T1': 'T1_in_BIDS',
  'T2': 'T2_in_BIDS',
  'DWI': 'DWI_in_BIDS',
  'FLAIR': 'FLAIR_in_BIDS',
  'Native_Lesion': 'Raw_Lesion_in_BIDS',
  'MNI_T1': 'MNI_T1_in_BIDS',
  'MNI_Lesion_Mask': 'MNI_Lesion_mask_in_BIDS'
};


function applyFiltersAndGetCount(data: DataFrame, cols: string[], session: Timepoint = 'baseline'): number {
  let filteredData = data.filter(row =>
    cols.every(col => row[col] !== null && row[col] !== undefined) &&
    row['SES'] !== null && row['BIDS_ID'] !== null
  );
  
  if (session === 'baseline') {
    return filteredData.filter(row => row['SES'] as string === 'ses-1').length;
  } else {
    let sessionFiltered = filteredData.filter(row => ['ses-1', 'ses-2'].includes(row['SES'] as string));

    let bidsGroups = sessionFiltered.reduce((acc: {[key: string]: Set<string>}, row) => {
      const bidsId = row['BIDS_ID'] as string; 
      acc[bidsId] = acc[bidsId] || new Set<string>();
      acc[bidsId].add(row['SES'] as string);
      return acc;
    }, {});

    let validBidsIds = Object.keys(bidsGroups).filter(id => bidsGroups[id].size === 2);

    const bidsIds = filteredData.filter(row => {
      const rowId = row['BIDS_ID'] as number
      return validBidsIds.includes(rowId.toString())})

    return bidsIds.length;
  }
}


export const updateRowCount = createAsyncThunk(
  "metrics/updateRowCount",
  async (_, { dispatch, getState, rejectWithValue }) => {
    const state = getState() as RootState;
    const timepoint = state.metrics.timepoint
    const behavioralRequiredMetrics = Object.values(
      state.metrics.behavioralMetrics
    ).flatMap((category) => category.filter((metric) => metric.is_required)).map(
      (metric) => metric.metric_name
    );
    const imagingRequiredMetrics = Object.values(
      state.metrics.imagingMetrics
    ).flatMap((category) => category.filter((metric) => metric.is_required)).map((metric) => colMapping[metric.metric_name]);    
      
    const response = applyFiltersAndGetCount(state.metrics.booleanData, behavioralRequiredMetrics.concat(imagingRequiredMetrics), timepoint)
    return response
    // try {
    //   const response = await HttpClient.post<RecordCountResponse>(
    //     "rows-count",
    //     {
    //       timepoint: state.metrics.timepoint as string,
    //       behavioral: behavioralRequiredMetrics.map(
    //         (metric) => metric.metric_name
    //       ),
    //       imaging: imagingRequiredMetrics.map((metric) => colMapping[metric.metric_name]),
    //     }
    //   );
    //   return response.count;
    // } catch (error) {
    //   return rejectWithValue("Error fetching row count");
    // }
  }
);

export const setTimepointAndUpdateRowCount = createAsyncThunk(
    'metrics/setTimepointAndUpdateRowCount',
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

function isMetricsData(data: any): data is Metric {
//   console.log(Object.values(data));
  return Object.values(data).every(
    (category) =>
      Array.isArray(category) &&
      category.every(
        (metric) =>
          "metric_name" in metric &&
          "variable_type" in metric &&
          "description" in metric
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
    booleanData: {} as DataFrame,
    status: "idle",
    error: null as string | null | unknown,
  },
  reducers: {
    setTimepoint: (state, action: PayloadAction<{ timepoint: Timepoint }>) => {
      const { timepoint } = action.payload;
      state.timepoint = timepoint;
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
      let metrics: Metric[] = [];
      if (category === "imaging") {
        metrics = state.imagingMetrics[category];
      } else {
        metrics = state.behavioralMetrics[category];
      }
      const metricIndex = metrics.findIndex(
        (m) => m.metric_name === metricName
      );
      if (metricIndex !== -1) {
        metrics[metricIndex].is_selected = isSelected;
      }
    },
    setSelectedAll: (state, action: PayloadAction<{ category: string }>) => {
      const { category } = action.payload;
      const categoryData = state.behavioralMetrics[category];
      if (categoryData && Array.isArray(categoryData)) {
        categoryData.forEach((metric) => {
          metric.is_selected = true;
        });
      }
    },
    resetSelectedAll: (state, action: PayloadAction<{ category: string }>) => {
      const { category } = action.payload;
      const categoryData = state.behavioralMetrics[category];
      if (categoryData && Array.isArray(categoryData)) {
        categoryData.forEach((metric) => {
          metric.is_selected = false;
        });
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
      let metrics: Metric[] = [];
      if (category === "imaging") {
        metrics = state.imagingMetrics[category];
      } else {
        metrics = state.behavioralMetrics[category];
      }
      if (Object.keys(metrics).length > 0) {
        const metricIndex = metrics.findIndex(
          (m) => m.metric_name === metricName
        );
        if (metricIndex !== -1) {
          metrics[metricIndex].is_required = isRequired;
        }
      }
    },
    setRequiredAll: (state, action: PayloadAction<{ category: string }>) => {
      const { category } = action.payload;
      const categoryData = state.behavioralMetrics[category];
      if (categoryData && Array.isArray(categoryData)) {
        categoryData.forEach((metric) => {
          metric.is_required = true;
        });
      }
    },
    resetRequiredAll: (state, action: PayloadAction<{ category: string }>) => {
      const { category } = action.payload;
      const categoryData = state.behavioralMetrics[category];
      if (categoryData && Array.isArray(categoryData)) {
        categoryData.forEach((metric) => {
          metric.is_required = false;
        });
      }
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
      const metrics = state.behavioralMetrics[category];
      const metricIndex = metrics.findIndex(
        (m) => m.metric_name === metricName
      );
      if (metricIndex !== -1) {
        metrics[metricIndex].filter_value1 = value;
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
      const metrics = state.behavioralMetrics[category];
      const metricIndex = metrics.findIndex(
        (m) => m.metric_name === metricName
      );
      if (metricIndex !== -1) {
        metrics[metricIndex].filter_value2 = value;
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
          //   const behavioralMetrics = action.payload["behavioral"];
          if (isMetricsData(behavioral)) {
            const dataWithDefaults = Object.fromEntries(
              Object.entries(behavioral).map(([category, metrics]) => [
                category,
                metrics.map((metric) => ({
                  ...metric,
                  is_required: metric.is_required ?? false,
                  is_selected: metric.is_selected ?? false,
                  filter_value1: metric.filter_value1 ?? "",
                  filter_value2: metric.filter_value2 ?? "",
                })),
              ])
            );
            state.behavioralMetrics = dataWithDefaults as MetricsData;
          }

          //   const imagingMetrics = action.payload['imaging']
          const imagingMetricsWithDefaults = imaging.map((metricName) => ({
            metric_name: metricName,
            variable_type: "image",
            description: "",
            is_selected: false,
            is_required: false,
            filter_value1: undefined,
            filter_value2: undefined,
          }));
          state.imagingMetrics = {
            imaging: imagingMetricsWithDefaults,
          } as MetricsData;
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
        state.rowCount = action.payload; // Update the row count in state
      })
      .addCase(updateRowCount.rejected, (state, action) => {
        state.error = action.payload; // Handle any errors
      })
      builder
      .addCase(fetchBooleanData.fulfilled, (state, action) => {
        state.booleanData = action.payload; 
        state.rowCount = applyFiltersAndGetCount(action.payload, [])
      })
      .addCase(fetchBooleanData.rejected, (state, action) => {
        state.error = action.payload; 
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
} = metricsSlice.actions;
