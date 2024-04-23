export interface Row {
    [columnName: string]: (number | string | null);
}
// export interface DataFrame {
//     [index: number]: Row;
//   }

export interface DataFrame extends Array<Row> {
}

export interface FetchDataResponse {
    data: DataFrame;
}

export interface DataSummaries {
    data: DataFrame;
    imagingDataBySite: DataFrame;
    columnsSummary: DataFrame;
    recordsBySite: DataFrame;
}
  