import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { AppDispatch } from './redux/store';
import { fetchMetrics, updateRowCount } from './redux/metricsSlice';

import NavBar from './components/NavBar';
import DataView from './components/DataView';
import DataForm from './components/DataForm'; // Correct the path as needed
import RequestsTable from './components/RequestsTable';
import Modal from './components/Modal/Modal';
import env from './config'
import Summary from './components/RequestSummary/Summary';

function App() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(fetchMetrics());
    dispatch(updateRowCount());
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
          <Route path="/request-summary/:fileName" element={<Summary/>} />
          <Route path="/view-data/:fileNameParam" element={<DataView/>} />
          {/* Add new routes here as needed */}
        </Routes>
        <Modal />
      </div>
    </Router>
  );
}

export default App;
