import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import BehavioralMetricSection from './BehavioralCategory';

const BehavioralMetricContainer: React.FC = () => {
  const metricsData = useSelector((state: RootState) => state.metrics.behavioralMetrics);

  return (
    Object.keys(metricsData).length > 0 ? (
      <div className="metrics-dashboard mt-4">
        <h2 className='mb-3'>Behavior</h2>
        {Object.keys(metricsData).map((category) => (
          <BehavioralMetricSection
            key={category}
            category={category}
            metrics={metricsData[category]}
          />
        ))}
      </div>
    ) : <div className="metrics-empty">No metrics data available</div>
  );
};

export default BehavioralMetricContainer;
