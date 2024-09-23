import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import DataForm from './DataForm'; // Assume this is your form component
import RequestsTable from './RequestsTable';
import env from '../config'

const NavBar = () => {
  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <Link className="navbar-brand" to="/">
          ENIGMA Stroke Recovery Group Data Request Form
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-toggle="collapse"
          data-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ml-auto">
            <li className="nav-item">
              <Link className="nav-link" to="/request-form">
                Data Request Form
              </Link>
            </li>
            {env.USER_MODE && env.USER_MODE === 'admin' && (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/view-requests">
                    View Requests
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/authors-list">
                    Authors List
                  </Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" to="/qc-tool">
                    QC GBH
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </nav>

    </div>
  );
};

export default NavBar;
