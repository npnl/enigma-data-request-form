import React from "react";
import { RootState } from "../../redux/store";
import { useSelector } from "react-redux";
import {
  setSelected,
  setRequiredAndUpdateRowCount,
} from "../../redux/metricsSlice";
import { Metric } from "../../types/MetricsData";
import { useAppDispatch } from "../../hooks";

interface ImagingMetricProps {
  category: string;
  metricName: string;
}

const ImagingMetricInput: React.FC<ImagingMetricProps> = ({
  category,
  metricName,
}) => {
  const dispatch = useAppDispatch();
  const metricData = useSelector((state: RootState) =>
    state.metrics.imagingMetrics[category].find(
      (metric) => metric.metric_name === metricName
    )
  ) as Metric;

  const handleSelectedChange = () => {
    if (metricData.is_required && metricData.is_selected) {
      dispatch(
        setRequiredAndUpdateRowCount({
          category,
          metricName,
          isRequired: !metricData.is_required,
        })
      );
    }
    dispatch(
      setSelected({
        category,
        metricName,
        isSelected: !metricData.is_selected,
      })
    );
  };

  const handleRequiredChange = () => {
    dispatch(
      setRequiredAndUpdateRowCount({
        category,
        metricName,
        isRequired: !metricData.is_required,
      })
    );
  };

  const imageMetricMapping = {
    T1: "Native-space T1 images",
    T2: "Native-space T2 images",
    DWI: "DWI images",
    FLAIR: "FLAIR images",
    Native_Lesion: "Native-space lesion masks",
    MNI_T1: "MNI-space T1 images",
    MNI_Lesion_Mask: "MNI-space lesion masks",
  };

  return (
    <div>
      <div className="form-check">
        <input
          type="checkbox"
          id={metricName}
          className="form-check-input"
          checked={metricData?.is_selected}
          onChange={handleSelectedChange}
        />
        <label className="form-check-label text-break" htmlFor={metricName}>
          {Object.entries(imageMetricMapping).find(
            ([key, value]) => key === metricName
          )?.[1] ?? ""}
        </label>
      </div>
      {metricData?.is_selected && (
        <div className="form-check ml-2">
          <input
            type="checkbox"
            id={`checkbox_required_${metricName}`}
            className="form-check-input"
            checked={metricData?.is_required}
            onChange={handleRequiredChange}
          />
          <label
            className="form-check-label text-break"
            htmlFor={`checkbox_required_${metricName}`}
          >
            Record must have this
          </label>
        </div>
      )}
    </div>
  );
};

export default ImagingMetricInput;
