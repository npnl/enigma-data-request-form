import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { hideModal } from '../../redux/modalSlice';
import { RootState } from '../../redux/store';

export type ModalType = 'error' | 'success' | 'loading' | null;

const ModalComponent: React.FC = () => {
  const { isVisible, title, message, modalType } = useSelector((state: RootState) => state.modal);
  const dispatch = useDispatch();

  const getHeaderStyle = () => {
    switch (modalType) {
      case 'error': return { backgroundColor: 'red', color: 'white' };
      case 'success': return { backgroundColor: 'green', color: 'white' };
      case 'loading': return { backgroundColor: 'orange', color: 'white' };
      default: return { backgroundColor: 'orange', color: 'white'};
    }
  };

  return (
    <Modal show={isVisible} onHide={() => dispatch(hideModal())}>
      <Modal.Header style={getHeaderStyle()}>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant={modalType === 'error' ? 'danger' :
                         modalType === 'success' ? 'success' :
                         modalType === 'loading' ? 'warning' : 'warning'} 
                onClick={() => dispatch(hideModal())}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ModalComponent;
