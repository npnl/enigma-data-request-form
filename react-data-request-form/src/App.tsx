import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from './redux/store';
import { fetchMetrics, updateRowCount, fetchBooleanData } from './redux/metricsSlice';

import NavBar from './components/NavBar';
import DataView from './components/DataView';
import DataForm from './components/DataForm'; // Correct the path as needed
import RequestsTable from './components/RequestsTable';
import Modal from './components/Modal/Modal';
import env from './config'
import Summary from './components/RequestSummary/Summary';
import AuthorsList from './components/AuthorsList';
import QCDataDisplay from './components/QCTool/QCDataDisplay'
import QCDataTable from './components/QCTool/QCDataTable';

function App() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchMetrics());
    dispatch(fetchBooleanData())
  }, [dispatch]);

  console.log(env);

  return (
    <Router>
      <NavBar />
      <div className="App mx-3">

        <Routes>
          <Route path="/" element={<DataForm />} />
          <Route path="/request-form" element={<DataForm />} />
          <Route path="/view-requests" element={<RequestsTable />} />
          <Route path="/request-summary/:fileName" element={<Summary />} />
          <Route path="/view-data" element={<DataView />} />
          <Route path="/view-data/:fileNameParam" element={<DataView />} />
          <Route path="/authors-list" element={<AuthorsList />} />
          <Route path="/qc-tool" element={<QCDataTable />} />
          <Route path="/qc-tool/:bidsId/:sesId" element={<QCDataDisplay />} />
          {/* Add new routes here as needed */}
        </Routes>
        <Modal />
      </div>
    </Router>
  );
}

export default App;
