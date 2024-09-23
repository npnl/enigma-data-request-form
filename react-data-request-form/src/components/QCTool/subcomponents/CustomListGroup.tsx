import React from 'react';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import './CustomListGroup.css';  // Ensure you have this CSS file for styling
import { DataFrame, List } from '../../../types/DataTypes';

// CustomListGroup component for rendering a list with description and items
const CustomListGroup = ({ items }: { items: List | DataFrame }) => {
    return (
        <div className="mb-4 custom-table-container">
            <ListGroup className="mt-3 custom-list-group">
                {items.map((item, index) => (
                    <ListGroupItem key={index} className="custom-list-item">
                        {Object.entries(item).map(([key, val], idx) => (
                            <div key={idx} className="d-flex align-items-center justify-space-between mb-2">
                                <div className='d-flex flex-column'>
                                    {key != null && typeof key === 'string' &&
                                        (key as string)?.split('\n').map((line: string, index: number) => (
                                            <strong key={index}>{line}<br /></strong>
                                        ))
                                    }
                                </div>
                                {/* <strong>{key}:</strong> */}
                                <div>
                                <span className="custom-value">{val}</span>
                                </div>
                            </div>
                        ))}
                    </ListGroupItem>
                ))}
            </ListGroup>
        </div>
    );
};

export default CustomListGroup;
