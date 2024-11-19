import React, { useMemo } from "react";
import DataTable, { TableStyles } from "react-data-table-component";
import { Button } from "react-bootstrap";
import * as Papa from "papaparse";
import { DataFrame, Row } from "../../types/DataTypes";

interface DataTableProps {
  dataFrame: DataFrame;
  title?: string;
  showControls?: boolean;
  paginate?: boolean;
  selectable?: boolean;
  onSelect?: (selected: {
    allSelected: boolean;
    selectedCount: number;
    selectedRows: Row[];
  }) => void;
  columnNames?: string[];
}

const customStyles: TableStyles = {
  rows: {
    style: {
      minHeight: "45px",
    },
  },
  headCells: {
    style: {
      paddingLeft: "8px",
      paddingRight: "8px",
      fontSize: "16px",
      whiteSpace: "normal",
      overflow: "visible",
      textOverflow: "clip",
    },
  },
  cells: {
    style: {
      paddingLeft: "8px",
      paddingRight: "8px",
      fontSize: "14px",
    },
  },
};

export const CustomDataTable: React.FC<DataTableProps> = ({
  dataFrame,
  title,
  showControls = false,
  paginate = false,
  selectable = false,
  onSelect,
  columnNames,
}) => {
  const columns = useMemo(() => {
    const keys = columnNames || Object.keys(dataFrame[0] || {});
    return keys.map((key) => ({
      name: key,
      selector: (row: { [x: string]: any }) => row[key],
      sortable: true,
    }));
  }, [dataFrame, columnNames]);

  if (!dataFrame || dataFrame.length === 0) {
    return <div>No data available.</div>;
  }

  const handleDownload = () => {
    const csv = Papa.unparse(dataFrame);
    const csvBlob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(csvBlob);
    link.download = "data.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div>
      <div className="d-flex justify-content-between">
        {title && <h3>{title}</h3>}
      </div>
      <div className="table-responsive">
        <DataTable
          columns={columns}
          data={dataFrame}
          customStyles={customStyles}
          pagination={paginate}
          paginationPerPage={20}
          persistTableHead
          highlightOnHover
          selectableRows={selectable}
          onSelectedRowsChange={onSelect}
        />
      </div>
      {showControls && (
        <Button variant="primary" onClick={handleDownload} className="mb-2">
          Download CSV
        </Button>
      )}
    </div>
  );
};

export default CustomDataTable;
