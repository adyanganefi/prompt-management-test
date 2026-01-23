import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.position = 'unset';
      document.body.style.width = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl'
  };

  const modalContent = (
    <div className="fixed top-0 left-0 w-screen h-screen z-[60] flex items-center justify-center p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div
        className="absolute top-0 left-0 w-full h-full bg-dark-900/60 backdrop-blur-sm"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        onClick={onClose}
      />
      <div className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl animate-slide-up max-h-[90vh] flex flex-col z-[70]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-100">
          <h2 className="text-xl font-semibold text-dark-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-100 transition-colors"
          >
            <X className="w-5 h-5 text-dark-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default Modal;
