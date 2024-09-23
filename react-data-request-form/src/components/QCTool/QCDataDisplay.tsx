import { CustomDataTable } from '../RequestSummary/DataTable';


import React, { useEffect, useState } from 'react';
import { Table, ListGroup, ListGroupItem, Container, Row, Col } from 'react-bootstrap';
import { DataFrame, List, OrderingList, pdfData, SelectedOptions } from '../../types/DataTypes';
import ApiUtils from '../../api/ApiUtils';
import CustomTable from './subcomponents/CustomTable';
import CustomListGroup from './subcomponents/CustomListGroup';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { hideModal, showModal } from '../../redux/modalSlice';

const QCDataDisplay: React.FC = () => {
  const [data, setData] = useState<pdfData | null>(null);
  const { bidsId, sesId } = useParams();
  const dispatch = useDispatch();

  useEffect(() => {
    // Fetching data from the API
    const fetchData = async () => {
      try {
        if (bidsId && sesId) {
          const response = await ApiUtils.fetchPDFData(bidsId, sesId);
          setData(response);
          dispatch(hideModal());
        }
      } catch (error) {
        dispatch(showModal({ title: "Error", message: "Failed to submit the request. Please try again.", modalType: 'error' }));
        console.error('Error fetching data', error);
      }
    };

    fetchData();
  }, [bidsId, sesId]);

  // Helper to render table content
  const render = (value: DataFrame | List | null, type: "table" | "list", ordering: OrderingList | null) => {
    if (value === null) {
      return <></>;
    }

    if (type === 'table') {
      if (Array.isArray(value)) {
        // Handle DataFrame
        return <CustomTable dataFrame={value} ordering={ordering} />;
      } else {
        console.error('Expected DataFrame for table, but received incompatible type.');
        return <p>Error: Data type mismatch for table.</p>;
      }
    } else if (type === 'list') {
      if (Array.isArray(value)) {
        // Handle List
        return <CustomListGroup items={value} />;
      } else {
        console.error('Expected List for list rendering, but received incompatible type.');
        return <p>Error: Data type mismatch for list.</p>;
      }
    }

    return <></>;
  };



  return (
    <Container>
      {data && data.visit && 
      <div className='d-flex justify-content-center my-4'>
        <h1>{bidsId}; Visit {data.visit}</h1>
        </div>}
      {data && (
        data.sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="m-8">
            <h2>{section.title}</h2>
            {section.subsections?.map((subsection, subsectionIndex) => (
              <>
                <div key={subsectionIndex}>
                  {subsection.title && <h3>{subsection.title}</h3>}
                  {subsection.description && (
                    <div className="description-box border bg-light">
                      <p>{subsection.description.split('\n').map((line, index) => (
                        <span key={index}>{line}<br /></span>
                      ))}</p>
                    </div>
                  )}
                  {render(subsection.value, subsection.type, subsection.ordering)}
                </div>
              </>
            ))}
          </div>
        ))
      )}
    </Container>
  );
};

export default QCDataDisplay;
