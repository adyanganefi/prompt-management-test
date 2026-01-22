import { useState, useEffect } from 'react';
import { format, addHours } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { agentsApi } from '../api';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { ArrowRight, ArrowLeft, Plus, Minus, Equal } from 'lucide-react';

const VersionCompareModal = ({ isOpen, onClose, agentId, v1, v2 }) => {
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && agentId && v1 && v2) {
      fetchComparison();
    }
  }, [isOpen, agentId, v1, v2]);

  const fetchComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await agentsApi.compareVersions(agentId, v1, v2);
      setComparison(response.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg || d.type || JSON.stringify(d)).join('; '));
      } else if (detail && typeof detail === 'object') {
        setError(detail.msg || detail.type || JSON.stringify(detail));
      } else {
        setError(detail || 'Gagal memuat perbandingan versi');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderDiff = (field, oldVal, newVal) => {
    // For system_prompt and notes, show a more detailed diff with side-by-side view
    if (field === 'system_prompt' || field === 'notes') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-red-50 rounded-lg p-4 border border-red-100 min-h-[120px] max-h-[320px] overflow-auto">
            <h5 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2 sticky top-0 bg-red-50 pb-1">
              <Minus className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Versi {v1}</span>
            </h5>
            <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono break-words">
              {oldVal || '(kosong)'}
            </pre>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-100 min-h-[120px] max-h-[320px] overflow-auto">
            <h5 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2 sticky top-0 bg-green-50 pb-1">
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Versi {v2}</span>
            </h5>
            <pre className="text-xs text-green-700 whitespace-pre-wrap font-mono break-words">
              {newVal || '(kosong)'}
            </pre>
          </div>
        </div>
      );
    }

    // For other fields, simple comparison with responsive layout
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
        <div className="flex-1 bg-red-50 rounded-lg px-4 py-2 overflow-hidden">
          <span className="text-red-700 font-mono text-sm break-all">{String(oldVal) || '(kosong)'}</span>
        </div>
        <ArrowRight className="w-5 h-5 text-dark-400 flex-shrink-0 mx-auto sm:mx-0 rotate-90 sm:rotate-0" />
        <div className="flex-1 bg-green-50 rounded-lg px-4 py-2 overflow-hidden">
          <span className="text-green-700 font-mono text-sm break-all">{String(newVal) || '(kosong)'}</span>
        </div>
      </div>
    );
  };

  const fieldLabels = {
    system_prompt: 'System Prompt',
    model_name: 'Model',
    base_url: 'Base URL',
    temperature: 'Temperature',
    max_tokens: 'Max Tokens',
    top_p: 'Top P',
    frequency_penalty: 'Frequency Penalty',
    presence_penalty: 'Presence Penalty',
    stop_sequences: 'Stop Sequences',
    notes: 'Catatan'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Perbandingan Versi ${v1} vs ${v2}`} size="xl">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">
          <p>{error}</p>
        </div>
      ) : comparison ? (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-dark-50 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center flex-1">
                <p className="text-sm text-dark-500">Versi</p>
                <p className="text-2xl font-bold text-dark-900">{comparison.version_1.version_number}</p>
                <p className="text-xs text-dark-400">
                  {format(addHours(new Date(comparison.version_1.created_at), 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId })}
                </p>
                {comparison.version_1.is_active && (
                  <span className="badge badge-success mt-2">Aktif</span>
                )}
              </div>
              <div className="px-4 sm:px-6 hidden sm:block">
                <ArrowLeft className="w-6 h-6 text-dark-300" />
                <ArrowRight className="w-6 h-6 text-dark-300" />
              </div>
              <div className="sm:hidden text-dark-300 font-bold">VS</div>
              <div className="text-center flex-1">
                <p className="text-sm text-dark-500">Versi</p>
                <p className="text-2xl font-bold text-dark-900">{comparison.version_2.version_number}</p>
                <p className="text-xs text-dark-400">
                  {format(addHours(new Date(comparison.version_2.created_at), 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId })}
                </p>
                {comparison.version_2.is_active && (
                  <span className="badge badge-success mt-2">Aktif</span>
                )}
              </div>
            </div>
          </div>

          {/* Differences */}
          {Object.keys(comparison.differences).length === 0 ? (
            <div className="text-center py-8">
              <Equal className="w-12 h-12 text-dark-300 mx-auto mb-3" />
              <p className="text-dark-500">Tidak ada perbedaan yang terdeteksi</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="font-semibold text-dark-900">
                {Object.keys(comparison.differences).length} Perbedaan Ditemukan
              </h4>
              
              {Object.entries(comparison.differences).map(([field, values]) => (
                <div key={field} className="border border-dark-100 rounded-xl overflow-hidden">
                  <div className="bg-dark-50 px-4 py-2 border-b border-dark-100">
                    <h5 className="font-medium text-dark-700">{fieldLabels[field] || field}</h5>
                  </div>
                  <div className="p-4">
                    {renderDiff(field, values.version_1, values.version_2)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-dark-100">
            <button onClick={onClose} className="btn btn-secondary">
              Tutup
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default VersionCompareModal;
