import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux/store';
import ImagingMetricInput from './ImagingMetric';
import styled from 'styled-components';
import { Card } from 'react-bootstrap';

const ImagingMetricContainer: React.FC = () => {
    const StyledCard = styled(Card)`
  background-color: #f0f0f0;
  margin-bottom: 1rem;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
`;

const CardTitle = styled(Card.Title)`
  margin: 0; // Adjust title margins as needed
`;


  const category = 'imaging'
  const metricsData = useSelector((state: RootState) => state.metrics.imagingMetrics[category]);
  
  return (
    metricsData && Object.keys(metricsData).length > 0 ? (
      <><h2 className='mb-1'>Imaging</h2>
      <StyledCard className="metrics-dashboard">
        <div className="row p-4">
        {Object.keys(metricsData).map((idx : any) => (
            <div className="col-md-4 pt-2 pb-4 pr-3 pl-3 filter-input">
          <ImagingMetricInput
                key={idx}
                category={category} 
                metricName={metricsData[idx]?.metric_name}/>
            </div>
        ))}
        </div>
      </StyledCard>
      </>
    ) : <div className="metrics-empty">No metrics data available</div>
  );
};

export default ImagingMetricContainer;
