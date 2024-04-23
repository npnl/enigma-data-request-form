import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import ApiUtils from '../api/ApiUtils';
import { DataRequestIn } from '../types/DataRequest';
import { DataFrame, DataSummaries } from '../types/DataTypes';


interface RequestsState {
    fileName: string;
    formSummary: DataRequestIn | undefined;
    isFormSummaryLoading: boolean;
    dataSummary: DataSummaries | undefined;
    isDataSummaryLoading: boolean;
  }
  
  const initialState: RequestsState = {
    fileName: '',
    formSummary: undefined,
    isFormSummaryLoading: false,
    dataSummary: undefined,
    isDataSummaryLoading: false,
  };
  
  export const fetchFormSummary = createAsyncThunk(
    'requests/fetchFormSummary',
    async (fileName: string, { rejectWithValue }) => {
      try {
        const response = await ApiUtils.fetchRequest(fileName);
        return response; 
      } catch (error) {
        return rejectWithValue(error); 
      }
    }
  );

  export const fetchDataSummary = createAsyncThunk(
    'requests/fetchDataSummary',
    async (fileName: string, { rejectWithValue }) => {
        try {
          const response = await ApiUtils.fetchDataAndSummary(fileName);
          return response; 
        } catch (error) {
          return rejectWithValue(error); 
        }
      }
    );
  
  const requestsSlice = createSlice({
    name: 'requests',
    initialState,
    reducers: {
      setFilename(state, action: PayloadAction<string>) {
        state.fileName = action.payload;
      },
    },
    extraReducers: (builder) => {
      builder
        .addCase(fetchFormSummary.pending, (state) => {
          state.isFormSummaryLoading = true;
        })
        .addCase(fetchFormSummary.fulfilled, (state, action) => {
          state.formSummary = action.payload;
          state.isFormSummaryLoading = false;
        })
        .addCase(fetchFormSummary.rejected, (state) => {
          state.isFormSummaryLoading = false;
        })
        .addCase(fetchDataSummary.pending, (state) => {
            state.isDataSummaryLoading = true;
          })
          .addCase(fetchDataSummary.fulfilled, (state, action) => {
            state.dataSummary = action.payload;
            state.isDataSummaryLoading = false;
          })
          .addCase(fetchDataSummary.rejected, (state) => {
            state.isDataSummaryLoading = false;
          });
    },
  });
  
  export const { setFilename } = requestsSlice.actions;
  export default requestsSlice.reducer;