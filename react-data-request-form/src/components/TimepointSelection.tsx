import React, { useState } from "react";
import {
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  SelectChangeEvent,
} from "@mui/material";
import { Timepoint } from "../types/MetricsData";
import { useSelector } from "react-redux";
import { setTimepointAndUpdateRowCount } from "../redux/metricsSlice";
import { RootState } from "../redux/store";
import { useAppDispatch } from "../hooks";

const TimepointSelection = () => {
  const dispatch = useAppDispatch();
  const timepointSelection = useSelector(
    (state: RootState) => state.metrics.timepoint
  );
  const handleChange = (event: SelectChangeEvent<Timepoint>) => {
    const timepoint = event.target.value as Timepoint;
    dispatch(setTimepointAndUpdateRowCount({ timepoint }));
  };

  return (
    <FormControl fullWidth className="mt-4">
      <InputLabel id="timepoint-select-label">Select data type</InputLabel>
      <Select
        labelId="timepoint-select-label"
        id="timepoint-select"
        value={timepointSelection}
        label="Session Data Scope"
        onChange={handleChange}
      >
        <MenuItem value="baseline">
          Cross-sectional (Subjects with baseline timepoint only)
        </MenuItem>
        <MenuItem value="multi">
          Longitudinal (Subjects with multiple timepoints)
        </MenuItem>
      </Select>
    </FormControl>
  );
};

export default TimepointSelection;
