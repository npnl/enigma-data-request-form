import React from 'react';
import './CustomTable.css';
import { List, OrderingList } from '../../../types/DataTypes';

export interface Row {
    [columnName: string]: (number | string | null);
}

export interface DataFrame extends Array<Row> {}

interface CustomTableProps {
    dataFrame: DataFrame;
    ordering: OrderingList | null;
}

const CustomTable: React.FC<CustomTableProps> = ({ dataFrame, ordering }) => {
    // Get column names from the first row if exists
    var orderedColumnNames = dataFrame.length > 0 ? Object.keys(dataFrame[0]) : [];

    // Create a list of column names by iterating over the ordering keys
    if (ordering) {
        console.log(ordering)
        orderedColumnNames = Object.keys(ordering).sort()
        .map(key => String(ordering[Number(key)]))  // Map over the ordering keys to get the ordered column names
    }

    return (
        <div className="custom-table-container">
            <table className="custom-table">
                <thead>
                    <tr>
                        {orderedColumnNames.map((colName, index) => (
                            <th key={index}>{colName}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {dataFrame.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                            {orderedColumnNames.map((colName, colIndex) => (
                                <td key={colIndex}>
                                    {row[colName] != null && typeof row[colName] === 'string' &&
                                        (row[colName] as string)?.split('\n').map((line: string, index: number) => (
                                            <span key={index}>{line}<br /></span>
                                        ))
                                    }
                                    {row[colName] != null && typeof row[colName] === 'number' && row[colName]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
    
};

export default CustomTable;
