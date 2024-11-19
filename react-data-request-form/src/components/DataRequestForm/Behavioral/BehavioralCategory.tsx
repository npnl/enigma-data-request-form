import React, { useState } from 'react';
import BehavioralMetricInput from './BehavioralMetric';
import { Metric } from '../../../types/MetricsData';
import { Card } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleChevronRight, faCircleChevronDown } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedAll, setRequiredAll, resetRequiredAll, resetSelectedAll } from '../../../redux/metricsSlice';
import { RootState } from '../../../redux/store';

// Styled components
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

const StyleCheckbox = styled.input`
  margin-right: 0.5rem;
`;

const StyledLabel = styled.label`
  margin-right: 1rem;
  font-weight: normal;
`;

interface BehavioralMetricSectionProps {
  category: string;
  metrics: Metric[];
}

const BehavioralMetricCategory: React.FC<BehavioralMetricSectionProps> = ({ category, metrics }) => {
  const dispatch = useDispatch()
  const metricsData = useSelector((state: RootState) => state.metrics.behavioralMetrics[category])
  const isAllSelected = metricsData.every((metric) => metric.is_selected)
  const isAllRequired = metricsData.every((metric) => metric.is_required)
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  const handleSelectAll = () => {
    if (!isAllSelected) {
    dispatch(setSelectedAll({category}))
    }
    else {
      dispatch(resetSelectedAll({category}))
      dispatch(resetRequiredAll({category}))
    }
  }

  const handleRequiredAll = () => {
    if(!isAllRequired){
      dispatch(setRequiredAll({category}))
    }
    else {
      dispatch(resetRequiredAll({category}))
    }
  }

  return (
    <StyledCard>
      <Card.Body>
        <CardHeader onClick={toggleOpen}>
          <div className='d-flex'>
        <FontAwesomeIcon style={{cursor: 'pointer'}} onClick={toggleOpen} icon={isOpen ? faCircleChevronDown : faCircleChevronRight} className="float-left pt-1 mr-2" />
        <CardTitle>{category}</CardTitle>
        </div>
        </CardHeader>
        {isOpen && (
          <>
          <div className="col-12 d-flex justify-content-start ml-1 mt-2">
            <div className='mr-2'>
              <StyleCheckbox type="checkbox" className="form-check-input" id={`select_all_${category}`} onChange={handleSelectAll} checked={isAllSelected}/>
              <StyledLabel htmlFor={`select_all_${category}`}>Select All</StyledLabel>
            </div>
            {isAllSelected && <div>
              <StyleCheckbox type="checkbox" className="form-check-input" id={`all_required_${category}`} onChange={handleRequiredAll} checked={isAllRequired} />
              <StyledLabel htmlFor={`all_required_${category}`}>Make all required</StyledLabel>
            </div>}
          </div>
            <div className="metrics-list row">
              {metrics.map((metric) => (
                <BehavioralMetricInput
                  key={metric.metric_name}
                  category={category}
                  metricName={metric.metric_name}
                  description={metric.description}
                  type={metric.variable_type}
                />
              ))}
            </div>
          </>
        )}
      </Card.Body>
    </StyledCard>
  );
};

export default BehavioralMetricCategory;
