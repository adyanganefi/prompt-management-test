import { useState, useEffect } from 'react';
import { agentsApi, modelProfilesApi } from '../../api';
import { ChevronDown, ChevronUp, AlertCircle, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';
import Modal from '../Modal';

const CreateVersionForm = ({ agentId, versions = [], onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    system_prompt: '',
    model_name: '',
    model_profile_id: '',
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    stop_sequences: '',
    notes: ''
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [helpContent, setHelpContent] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState([]);
  const [baseVersionId, setBaseVersionId] = useState(null);
  const [baseInitialized, setBaseInitialized] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  const baseVersion = versions?.find(v => v.id === baseVersionId) || null;

  // Default base version to the latest when versions change
  useEffect(() => {
    if (versions?.length && !baseInitialized) {
      setBaseVersionId(versions[0].id);
      setBaseInitialized(true);
      return;
    }
    if (baseVersionId && versions?.length && !versions.find(v => v.id === baseVersionId)) {
      setBaseVersionId(versions[0].id);
    }
  }, [versions, baseVersionId, baseInitialized]);

  // Load model profiles
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const res = await modelProfilesApi.list();
        setProfiles(res.data);
      } catch (error) {
        toast.error('Gagal memuat model profile');
      } finally {
        setProfilesLoading(false);
      }
    };
    loadProfiles();
  }, []);

  // Sync model profile selection with latest base version (or first profile as fallback)
  useEffect(() => {
    if (profilesLoading) return;

    setFormData((prev) => {
      if (baseVersion?.model_profile_id) {
        return { ...prev, model_profile_id: baseVersion.model_profile_id };
      }
      if (!prev.model_profile_id && profiles.length > 0) {
        return { ...prev, model_profile_id: profiles[0].id };
      }
      return prev;
    });
  }, [profilesLoading, baseVersion, profiles]);

  // Pre-fill from selected base version
  useEffect(() => {
    if (baseVersion) {
      setFormData({
        system_prompt: baseVersion.system_prompt || '',
        model_name: baseVersion.model_name || '',
        model_profile_id: baseVersion.model_profile_id || '',
        temperature: baseVersion.temperature || 0.7,
        max_tokens: baseVersion.max_tokens || 2048,
        top_p: baseVersion.top_p || 1.0,
        frequency_penalty: baseVersion.frequency_penalty || 0.0,
        presence_penalty: baseVersion.presence_penalty || 0.0,
        stop_sequences: baseVersion.stop_sequences?.join(', ') || '',
        notes: ''
      });
    }
  }, [baseVersion]);

  // Function to open help modal
  const openHelpModal = (title, content) => {
    setHelpContent({ title, content });
    setShowHelpModal(true);
  };

  // Calculate changes when showing preview
  useEffect(() => {
    if (showPreview && baseVersion) {
      const changesFound = [];
      
      if (formData.system_prompt !== baseVersion.system_prompt) {
        changesFound.push({ field: 'System Prompt', old: baseVersion.system_prompt, new: formData.system_prompt });
      }
      if (formData.model_name !== baseVersion.model_name) {
        changesFound.push({ field: 'Model', old: baseVersion.model_name, new: formData.model_name });
      }
      if ((formData.model_profile_id || '') !== (baseVersion.model_profile_id || '')) {
        const fromName = profiles.find(p => p.id === baseVersion.model_profile_id)?.name || '(none)';
        const toName = profiles.find(p => p.id === formData.model_profile_id)?.name || '(none)';
        changesFound.push({ field: 'Model Profile', old: fromName, new: toName });
      }
      if (parseFloat(formData.temperature) !== parseFloat(baseVersion.temperature)) {
        changesFound.push({ field: 'Temperature', old: baseVersion.temperature, new: formData.temperature });
      }
      if (parseInt(formData.max_tokens) !== parseInt(baseVersion.max_tokens)) {
        changesFound.push({ field: 'Max Tokens', old: baseVersion.max_tokens, new: formData.max_tokens });
      }
      if (parseFloat(formData.top_p) !== parseFloat(baseVersion.top_p)) {
        changesFound.push({ field: 'Top P', old: baseVersion.top_p, new: formData.top_p });
      }
      if (parseFloat(formData.frequency_penalty) !== parseFloat(baseVersion.frequency_penalty)) {
        changesFound.push({ field: 'Frequency Penalty', old: baseVersion.frequency_penalty, new: formData.frequency_penalty });
      }
      if (parseFloat(formData.presence_penalty) !== parseFloat(baseVersion.presence_penalty)) {
        changesFound.push({ field: 'Presence Penalty', old: baseVersion.presence_penalty, new: formData.presence_penalty });
      }
      const stopOld = baseVersion.stop_sequences?.join(', ') || '';
      if (formData.stop_sequences !== stopOld) {
        changesFound.push({ field: 'Stop Sequences', old: stopOld || '(none)', new: formData.stop_sequences || '(none)' });
      }
      if ((formData.notes || '') !== (baseVersion.notes || '')) {
        changesFound.push({ field: 'Catatan', old: baseVersion.notes || '(none)', new: formData.notes || '(none)' });
      }
      
      setChanges(changesFound);
    }
  }, [showPreview, formData, baseVersion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        temperature: parseFloat(formData.temperature),
        max_tokens: parseInt(formData.max_tokens),
        top_p: parseFloat(formData.top_p),
        frequency_penalty: parseFloat(formData.frequency_penalty),
        presence_penalty: parseFloat(formData.presence_penalty),
        stop_sequences: formData.stop_sequences 
          ? formData.stop_sequences.split(',').map(s => s.trim()).filter(Boolean)
          : null
      };
      
      if (!formData.model_profile_id) {
        toast.error('Pilih Model Profile terlebih dahulu');
        setLoading(false);
        return;
      }

      await agentsApi.createVersion(agentId, payload);
      toast.success('Versi baru berhasil dibuat!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal membuat versi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Base version selection */}
      {versions?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-800 font-medium">Pilih versi dasar</p>
              <p className="text-sm text-blue-700 mt-1">
                Form otomatis terisi sesuai versi yang dipilih (termasuk model profile jika tersedia).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Gunakan data dari versi</label>
              <select
                className="input"
                value={baseVersionId || 'blank'}
                onChange={(e) => {
                  const nextId = e.target.value === 'blank' ? null : e.target.value;
                  setBaseVersionId(nextId);
                  if (nextId === null) {
                    setFormData({
                      system_prompt: '',
                      model_name: '',
                      model_profile_id: profiles[0]?.id || '',
                      temperature: 0.7,
                      max_tokens: 2048,
                      top_p: 1.0,
                      frequency_penalty: 0.0,
                      presence_penalty: 0.0,
                      stop_sequences: '',
                      notes: ''
                    });
                  }
                }}
              >
                <option value="blank">Mulai dari kosong</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    Versi {version.version_number} • {version.model_name}
                  </option>
                ))}
              </select>
            </div>
            {baseVersion && (
              <div className="text-sm text-blue-800">
                <p className="font-medium">Ringkasan versi {baseVersion.version_number}</p>
                <p className="text-blue-700 line-clamp-2 mt-1">{baseVersion.system_prompt}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* System Prompt */}
        <div>
          <label className="label">System Prompt *</label>
          <textarea
            className="input min-h-[150px] font-mono text-sm"
            placeholder="Anda adalah asisten yang membantu..."
            value={formData.system_prompt}
            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
            required
          />
          <p className="text-xs text-dark-400 mt-1">
            Instruksi dasar untuk AI agent. Definisikan peran, kemampuan, dan batasan.
          </p>
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Model Profile *</label>
            {profilesLoading ? (
              <div className="flex items-center gap-2 text-dark-500"><LoadingSpinner size="sm" /> Memuat...</div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-red-500">Buat Model Profile terlebih dahulu di menu Model Profile.</p>
            ) : (
              <select
                className="input"
                value={formData.model_profile_id}
                onChange={(e) => setFormData({ ...formData, model_profile_id: e.target.value })}
                required
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="label">Model Name *</label>
            <input
              type="text"
              className="input"
              placeholder="Nama model, misal gpt-4o"
              value={formData.model_name}
              onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
              required
            />
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Pengaturan Lanjutan
        </button>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-dark-50 rounded-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label flex items-center gap-2">
                  Temperature
                  <HelpCircle 
                    className="w-4 h-4 text-dark-400 hover:text-primary-600 cursor-help" 
                    onClick={() => openHelpModal(
                      'Temperature',
                      'Mengontrol tingkat kreativitas dan keacakan output model.\n\n' +
                      '## Cara Kerja:\n' +
                      '• Temperature mengubah distribusi probabilitas kata berikutnya\n' +
                      '• Nilai rendah = output lebih konsisten dan prediktabel\n' +
                      '• Nilai tinggi = output lebih kreatif dan bervariasi\n\n' +
                      '## Rentang Nilai:\n' +
                      '• 0.0: Output sangat konsisten, selalu memilih kata dengan probabilitas tertinggi\n' +
                      '• 0.1 - 0.3: Konsisten untuk fakta, kode, dan jawaban pasti\n' +
                      '• 0.4 - 0.6: Keseimbangan untuk percakapan sehari-hari\n' +
                      '• 0.7 - 0.9: Lebih kreatif untuk menulis dan ide baru\n' +
                      '• 1.0: Maksimal kreatif, output sangat bervariasi\n\n' +
                      '## Panduan Penggunaan:\n' +
                      '• **0.0-0.3**: Matematika, coding, fakta, instruksi\n' +
                      '• **0.4-0.6**: Chatbot, penjelasan, artikel informatif\n' +
                      '• **0.7-0.9**: Cerita, puisi, brainstorming, kreatif writing\n' +
                      '• **0.9-1.0**: Ide unik, humor, eksplorasi konsep baru\n\n' +
                      '## Contoh Praktis:\n' +
                      '**Prompt yang sama: "Jelaskan apa itu kecerdasan buatan"**\n\n' +
                      '**Tanpa Temperature (atau Temperature 0.5 default):**\n' +
                      '"Kecerdasan buatan adalah teknologi yang memungkinkan komputer untuk melakukan tugas-tugas yang biasanya memerlukan kecerdasan manusia. AI dapat belajar dari data, mengenali pola, dan membuat keputusan berdasarkan informasi yang tersedia. Contohnya termasuk pengenalan gambar, pemrosesan bahasa alami, dan sistem rekomendasi."\n\n' +
                      '**Temperature 0.1 (Sangat Konsisten):**\n' +
                      '"Kecerdasan buatan adalah teknologi yang memungkinkan mesin untuk melakukan tugas-tugas yang biasanya memerlukan kecerdasan manusia. AI dapat belajar dari data, mengenali pola, dan membuat keputusan berdasarkan informasi yang diberikan."\n\n' +
                      '**Temperature 0.9 (Sangat Kreatif):**\n' +
                      '"Bayangkan kecerdasan buatan sebagai otak digital raksasa yang bisa belajar, berpikir, dan bahkan bermimpi! AI adalah jembatan antara dunia manusia dan mesin, di mana komputer tidak hanya menghitung angka tapi juga memahami emosi, menciptakan seni, dan mungkin suatu hari nanti memiliki kesadaran sendiri!"'
                    )}
                  />
                </label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                />
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  Max Tokens
                  <HelpCircle 
                    className="w-4 h-4 text-dark-400 hover:text-primary-600 cursor-help" 
                    onClick={() => openHelpModal(
                      'Max Tokens',
                      'Membatasi panjang maksimal output yang dihasilkan model.\n\n' +
                      '## Cara Kerja:\n' +
                      '• Hanya mengontrol panjang RESPONSE AI, bukan total token\n' +
                      '• Prompt token dihitung terpisah dan tidak termasuk dalam limit\n' +
                      '• Model akan berhenti secara otomatis saat mencapai batas token\n\n' +
                      '## Realita API:\n' +
                      '• `max_tokens` = batas untuk completion tokens SAJA\n' +
                      '• `prompt_tokens` = token dari input/prompt (tidak terbatas oleh max_tokens)\n' +
                      '• `total_tokens` = prompt_tokens + completion_tokens\n\n' +
                      '## Contoh:\n' +
                      'Prompt: "Jelaskan AI" (5 token)\n' +
                      'max_tokens: 100\n' +
                      '→ Response maksimal: 100 token\n' +
                      '→ Total token yang dibayar: 5 (prompt) + 100 (response) = 105 token\n\n' +
                      '## Panduan Penggunaan:\n' +
                      '• **50-200 token**: Jawaban singkat, definisi, konfirmasi\n' +
                      '• **200-500 token**: Penjelasan detail, paragraf singkat\n' +
                      '• **500-1000 token**: Artikel pendek, tutorial langkah demi langkah\n' +
                      '• **1000-2000 token**: Artikel lengkap, dokumentasi\n' +
                      '• **2000+ token**: Buku, laporan komprehensif, analisis mendalam\n\n' +
                      '## Estimasi Panjang:\n' +
                      '• 100 token ≈ 75-100 kata ≈ 1/2 halaman\n' +
                      '• 500 token ≈ 375-500 kata ≈ 1 halaman\n' +
                      '• 1000 token ≈ 750-1000 kata ≈ 2 halaman\n' +
                      '• 2000 token ≈ 1500-2000 kata ≈ 4 halaman\n\n' +
                      '## Contoh Praktis:\n' +
                      '**Prompt yang sama: "Jelaskan sejarah Indonesia secara singkat"**\n\n' +
                      '**Tanpa Max Tokens (Full Response):**\n' +
                      '"Indonesia adalah negara kepulauan terbesar di dunia dengan populasi sekitar 270 juta jiwa. Sejarahnya sangat kaya dan dimulai dari masa prasejarah dengan migrasi manusia dari Asia Tenggara sekitar 2.000 tahun yang lalu. Pada abad ke-7 hingga ke-14, muncul kerajaan-kerajaan besar seperti Sriwijaya di Sumatera dan Majapahit di Jawa. Sriwijaya dikenal sebagai pusat perdagangan maritim yang kuat, sementara Majapahit mencapai puncak kejayaannya pada abad ke-14. Setelah itu, Indonesia mengalami pengaruh Islam yang menyebar dari abad ke-13. Pada abad ke-16, bangsa Eropa mulai datang dengan Portugis sebagai yang pertama, diikuti oleh Belanda yang menguasai Indonesia selama 350 tahun melalui VOC dan pemerintah kolonial. Perjuangan kemerdekaan dimulai pada awal abad ke-20 dan mencapai puncaknya dengan Proklamasi Kemerdekaan 17 Agustus 1945 oleh Soekarno dan Hatta. Setelah merdeka, Indonesia mengalami berbagai tantangan pembangunan dan demokratisasi yang terus berlangsung hingga saat ini."\n\n' +
                      '**Max Tokens 100 (Jawaban Singkat):**\n' +
                      '"Indonesia adalah negara kepulauan terbesar di dunia dengan populasi sekitar 270 juta jiwa. Sejarahnya dimulai dari kerajaan-kerajaan Hindu-Buddha kuno seperti Sriwijaya dan Majapahit, kemudian mengalami penjajahan Belanda selama 350 tahun, dan akhirnya merdeka pada 17 Agustus 1945."\n\n' +
                      '**Max Tokens 50 (Terlalu Pendek - Terpotong):**\n' +
                      '"Indonesia adalah negara kepulauan terbesar di dunia dengan populasi sekitar 270 juta jiwa. Sejarahnya dimulai dari kerajaan-kerajaan kuno seperti Sriwijaya dan Majapahit, kemudian mengalami..."\n\n' +
                      '**Penjelasan Perilaku LLM:**\n' +
                      '• **Tidak ada "penyesuaian cerdas"** - model berhenti secara paksa saat mencapai limit\n' +
                      '• **Jawaban bisa terpotong** di tengah kalimat jika limit terlalu ketat\n' +
                      '• **Model tidak "meringkas" otomatis** - hanya berhenti generate token\n' +
                      '• **Untuk jawaban singkat**: gunakan prompt yang meminta ringkasan, bukan hanya mengurangi max_tokens'
                    )}
                  />
                </label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="128000"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: e.target.value })}
                />
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  Top P
                  <HelpCircle 
                    className="w-4 h-4 text-dark-400 hover:text-primary-600 cursor-help" 
                    onClick={() => openHelpModal(
                      'Top P (Nucleus Sampling)',
                      'Menentukan persentase kata dengan probabilitas tertinggi yang akan dipertimbangkan model.\n\n' +
                      '## Cara Kerja:\n' +
                      '• Model menghitung probabilitas semua kata yang mungkin muncul selanjutnya\n' +
                      '• Hanya memilih dari Top P% kata dengan probabilitas tertinggi\n' +
                      '• Lebih fokus dan konsisten dibanding temperature\n\n' +
                      '## Rentang Nilai:\n' +
                      '• 0.1: Sangat ketat, hanya kata dengan probabilitas >10%\n' +
                      '• 0.3: Ketat, hanya kata dengan probabilitas >30%\n' +
                      '• 0.5: Moderat, hanya kata dengan probabilitas >50%\n' +
                      '• 0.7: Longgar, hanya kata dengan probabilitas >70%\n' +
                      '• 1.0: Semua kata, sama seperti temperature (default)\n\n' +
                      '## Perbandingan dengan Temperature:\n' +
                      '• **Temperature**: Mengubah seluruh distribusi probabilitas (memperbesar/memperkecil perbedaan)\n' +
                      '• **Top P**: Memotong bagian ekor distribusi (membatasi pilihan kata)\n\n' +
                      '## Contoh Praktis:\n' +
                      '**Prompt yang sama: "Cuaca hari ini sangat"**\n\n' +
                      '**Tanpa Top P (atau Top P 1.0 - semua kata tersedia):**\n' +
                      'Model bisa memilih dari semua kata yang mungkin: "cerah", "mendung", "hujan", "panas", "dingin", "berawan", dll.\n' +
                      '**Output yang mungkin:** "Cuaca hari ini sangat cerah", "Cuaca hari ini sangat mendung", "Cuaca hari ini sangat panas", dll.\n\n' +
                      '**Top P 0.5 (hanya 50% kata terbaik):**\n' +
                      'Model hanya memilih dari kata-kata dengan probabilitas tertinggi sampai mencapai 50% kumulatif.\n' +
                      'Jika probabilitas: cerah(40%) + mendung(30%) + hujan(20%) + panas(5%) + dingin(3%) + berawan(2%)\n' +
                      'Maka hanya bisa pilih: "cerah", "mendung", "hujan"\n' +
                      '**Output yang mungkin:** "Cuaca hari ini sangat cerah", "Cuaca hari ini sangat mendung", "Cuaca hari ini sangat hujan"\n\n' +
                      '**Top P 0.1 (hanya 10% kata terbaik):**\n' +
                      'Model sangat ketat, hanya memilih dari kata dengan probabilitas >10%.\n' +
                      'Dari probabilitas di atas, hanya bisa pilih: "cerah" (40% > 10%)\n' +
                      '**Output yang mungkin:** Hampir selalu "Cuaca hari ini sangat cerah"\n\n' +
                      '**Dampak yang Terlihat:**\n' +
                      '• **Top P 1.0**: Output bervariasi, bisa pilih kata langka\n' +
                      '• **Top P 0.5**: Output konsisten tapi masih ada variasi\n' +
                      '• **Top P 0.1**: Output sangat prediktabel, selalu pilih kata terkuat'
                    )}
                  />
                </label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.top_p}
                  onChange={(e) => setFormData({ ...formData, top_p: e.target.value })}
                />
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  Freq. Penalty
                  <HelpCircle 
                    className="w-4 h-4 text-dark-400 hover:text-primary-600 cursor-help" 
                    onClick={() => openHelpModal(
                      'Frequency Penalty',
                      'Mengurangi kemungkinan kata/frasa yang sudah sering muncul dalam teks sebelumnya.\n\n' +
                      '## Cara Kerja:\n' +
                      '• Model menghitung frekuensi setiap kata dalam konteks\n' +
                      '• Mengurangi probabilitas kata yang sudah sering muncul\n' +
                      '• Mendorong variasi kata dan menghindari pengulangan\n\n' +
                      '## Rentang Nilai:\n' +
                      '• 0.0: Tidak ada penalti (default)\n' +
                      '• 0.1 - 0.5: Penalti ringan, sedikit variasi\n' +
                      '• 0.6 - 1.0: Penalti sedang, variasi cukup\n' +
                      '• 1.1 - 2.0: Penalti kuat, variasi maksimal\n\n' +
                      '## Perbandingan dengan Presence Penalty:\n' +
                      '• Frequency: Menghukum kata spesifik yang berulang\n' +
                      '• Presence: Menghukum topik/konsep yang sudah disebutkan\n\n' +
                      '## Contoh Praktis:\n' +
                      '**Prompt yang sama: "Ceritakan pengalaman liburan ke Bali"**\n\n' +
                      '**Tanpa Frequency Penalty (atau Frequency Penalty 0.0):**\n' +
                      '"Liburan ke Bali sangat menyenangkan. Bali memiliki pantai yang indah, pura yang megah, dan budaya yang kaya. Pantai di Bali sangat bersih dan pasirnya putih. Pura di Bali seperti Tanah Lot dan Uluwatu sangat indah. Budaya Bali dengan tariannya yang khas juga menarik. Pantai-pantai di Bali selalu ramai pengunjung. Pura-pura di Bali memiliki arsitektur yang unik..."\n\n' +
                      '**Frequency Penalty 0.7 (Penalti Sedang):**\n' +
                      '"Liburan ke Bali sangat menyenangkan. Pulau dewata memiliki garis pantai yang memukau, candi kuno yang megah, dan tradisi seni yang hidup. Perairan di sana jernih dengan hamparan pasir lembut. Kompleks keagamaan seperti Tanah Lot dan Uluwatu menawarkan pemandangan spektakuler. Kesenian tradisional dengan gerakan tarian yang anggun memikat hati. Kawasan wisata di sana selalu dipadati pelancong. Bangunan suci di Bali menampilkan desain arsitektur khas..."\n\n' +
                      '**Frequency Penalty 1.5 (Penalti Kuat):**\n' +
                      '"Petualangan di Bali sungguh mengesankan. Nusantara tropis ini menyimpan pesona laut yang memesona, situs religi kuno yang menakjubkan, dan warisan budaya yang mendalam. Perairan biru jernih dengan tekstur pasir halus menciptakan panorama tropis. Kompleks kepercayaan seperti Tanah Lot dan Uluwatu memberikan pengalaman spiritual luar biasa. Ekspresi artistik dengan ritme gerakan yang elegan menghipnotis penonton. Destinasi pariwisata di sana selalu menarik minat wisatawan. Arsitektur sakral Bali menunjukkan kreativitas desain yang tinggi..."\n\n' +
                      '**Dampak yang Terlihat:**\n' +
                      '• **Tanpa penalty**: Kata "Bali", "pantai", "pura" diulang berkali-kali\n' +
                      '• **Penalty 0.7**: Menggunakan sinonim seperti "pulau dewata", "garis pantai", "candi kuno"\n' +
                      '• **Penalty 1.5**: Hampir tidak ada pengulangan kata, kosakata sangat bervariasi'
                    )}
                  />
                </label>
                <input
                  type="number"
                  className="input"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={formData.frequency_penalty}
                  onChange={(e) => setFormData({ ...formData, frequency_penalty: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-2">
                  Presence Penalty
                  <HelpCircle 
                    className="w-4 h-4 text-dark-400 hover:text-primary-600 cursor-help" 
                    onClick={() => openHelpModal(
                      'Presence Penalty',
                      'Mengurangi kemungkinan topik/konsep yang sudah disebutkan dalam percakapan.\n\n' +
                      '## Cara Kerja:\n' +
                      '• Model mendeteksi topik yang sudah dibahas\n' +
                      '• Mengurangi probabilitas untuk kembali ke topik yang sama\n' +
                      '• Mendorong eksplorasi topik baru dalam response panjang\n\n' +
                      '## Rentang Nilai:\n' +
                      '• 0.0: Tidak ada penalti (default)\n' +
                      '• 0.1 - 0.5: Penalti ringan, tetap bisa kembali ke topik\n' +
                      '• 0.6 - 1.0: Penalti sedang, lebih suka topik baru\n' +
                      '• 1.1 - 2.0: Penalti kuat, menghindari topik yang sama\n\n' +
                      '## Perbandingan dengan Frequency Penalty:\n' +
                      '• **Frequency**: "Jangan ulangi kata \'pantai\' yang sudah sering disebut"\n' +
                      '• **Presence**: "Jangan bahas Bali lagi, ganti topik lain seperti Jakarta atau Surabaya"\n\n' +
                      '## Contoh Praktis:\n' +
                      '**Prompt yang sama: "Ceritakan tentang olahraga sepakbola"**\n\n' +
                      '**Tanpa Presence Penalty (atau Presence Penalty 0.0):**\n' +
                      '"Sepakbola adalah olahraga paling populer di dunia. Sepakbola dimainkan dengan bola dan kaki. Sepakbola memiliki banyak penggemar di seluruh dunia. Sepakbola juga disebut soccer di beberapa negara. Sepakbola memiliki aturan main yang sederhana namun menarik. Sepakbola bisa dimainkan di lapangan rumput atau sintetis..."\n\n' +
                      '**Presence Penalty 0.7 (Penalti Sedang):**\n' +
                      '"Sepakbola memang olahraga terpopuler secara global. Selain itu, basket juga menarik dengan permainan yang lebih cepat dan atraktif. Bola basket menggunakan tangan dan melibatkan gerakan vertikal yang tinggi. Permainan basket membutuhkan koordinasi yang baik antara mata dan tangan. Basket juga memiliki variasi seperti street ball yang lebih bebas..."\n\n' +
                      '**Presence Penalty 1.5 (Penalti Kuat):**\n' +
                      '"Olahraga terpopuler memang sepakbola. Tapi mari kita bahas tentang musik klasik yang memiliki sejarah panjang dan kompleks. Musik klasik dimulai dari era Baroque dengan komposer seperti Bach dan Handel. Era Klasik menghasilkan Mozart dan Beethoven yang revolusioner. Musik Romantik membawa emosi yang lebih dalam melalui Chopin dan Liszt. Saat ini, musik klasik masih hidup dalam orkestra profesional dan pendidikan..."\n\n' +
                      '**Dampak yang Terlihat:**\n' +
                      '• **Tanpa penalty**: Tetap membahas sepakbola terus menerus\n' +
                      '• **Penalty 0.7**: Mulai beralih ke basket tapi masih seputar olahraga\n' +
                      '• **Penalty 1.5**: Berpindah topik ke musik klasik (bukan olahraga lagi)'
                    )}
                  />
                </label>
                <input
                  type="number"
                  className="input"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={formData.presence_penalty}
                  onChange={(e) => setFormData({ ...formData, presence_penalty: e.target.value })}
                />
              </div>
              <div>
                <label className="label flex items-center gap-2">
                  Stop Sequences
                  <HelpCircle 
                    className="w-4 h-4 text-dark-400 hover:text-primary-600 cursor-help" 
                    onClick={() => openHelpModal(
                      'Stop Sequences',
                      'Kata atau frasa yang memberitahu model kapan harus berhenti menghasilkan teks.\n\n' +
                      '## Cara Kerja:\n' +
                      '• Model berhenti segera ketika menemukan sequence yang cocok\n' +
                      '• Sequence tidak akan muncul di output final\n' +
                      '• Bisa menggunakan beberapa sequence sekaligus\n\n' +
                      '## Format Input:\n' +
                      '• Pisahkan dengan koma: "sequence1, sequence2, sequence3"\n' +
                      '• Gunakan escape untuk karakter khusus: "\\n" untuk newline\n' +
                      '• Case-sensitive (peka huruf besar/kecil)\n\n' +
                      '## Contoh Penggunaan:\n' +
                      '• **Pisah Paragraf:** "\\n\\n", "###", "---"\n' +
                      '• **Chat Format:** "\\nHuman:", "\\nAI:", "[END]"\n' +
                      '• **Code Generation:** "```", "# End of function"\n' +
                      '• **List Items:** "\\n\\n", "•", "-"\n\n' +
                      '## Contoh Praktis:\n\n' +
                      '**1. Kontrol Panjang Response:**\n' +
                      '**Prompt:** "Jelaskan cara membuat kue coklat"\n' +
                      '**Tanpa Stop Sequences:**\n' +
                      '"Untuk membuat kue coklat, pertama-tama siapkan bahan: tepung, gula, telur, coklat, mentega. Kemudian campurkan bahan kering terlebih dahulu. Setelah itu tambahkan bahan cair dan aduk rata. Tuangkan adonan ke dalam loyang yang sudah diolesi mentega. Panggang dalam oven dengan suhu 180 derajat selama 45 menit. Setelah matang, dinginkan kue dan sajikan. Kue coklat ini sangat enak dimakan saat masih hangat..."\n\n' +
                      '**Dengan Stop Sequences: "\\n", "Langkah"**\n' +
                      '**Output:** "Untuk membuat kue coklat, pertama-tama siapkan bahan: tepung, gula, telur, coklat, mentega."\n\n' +
                      '**2. Kontrol Output Panjang:**\n' +
                      '**Prompt:** "Jelaskan cara kerja mesin pencari"\n' +
                      '**Tanpa Stop Sequences:**\n' +
                      '"Mesin pencari seperti Google bekerja dengan mengindeks jutaan halaman web. Proses ini melibatkan crawling, indexing, dan ranking algoritma. Setelah itu, mesin pencari menganalisis konten dan memberikan hasil yang paling relevan..."\n\n' +
                      '**Dengan Stop Sequences: "."**\n' +
                      '**Output:** "Mesin pencari seperti Google bekerja dengan mengindeks jutaan halaman web"\n\n' +
                      '**Penjelasan:** Model berhenti ketika menemukan titik pertama, sehingga output menjadi lebih pendek dan ringkas.\n\n' +
                      '**Prompt:** "Buat fungsi JavaScript untuk menghitung factorial"\n' +
                      '**Tanpa Stop Sequences:**\n' +
                      '```javascript\n' +
                      'function factorial(n) {\n' +
                      '  if (n <= 1) return 1;\n' +
                      '  return n * factorial(n - 1);\n' +
                      '}\n' +
                      '```\n\n' +
                      'Ini adalah fungsi factorial yang menggunakan rekursi. Fungsi ini akan menghitung factorial dari angka n. Sebagai contoh, factorial(5) akan menghasilkan 120..."\n\n' +
                      '**Dengan Stop Sequences: "```", "# End"**\n' +
                      '**Output:**\n' +
                      '```javascript\n' +
                      'function factorial(n) {\n' +
                      '  if (n <= 1) return 1;\n' +
                      '  return n * factorial(n - 1);\n' +
                      '}\n' +
                      '```\n\n' +
                      '**4. Generate List:**\n' +
                      '**Prompt:** "Buat daftar 5 resep makanan Indonesia"\n' +
                      '**Tanpa Stop Sequences:**\n' +
                      'Berikut adalah 5 resep makanan Indonesia yang populer:\n' +
                      '1. Nasi Goreng - Makanan yang terbuat dari nasi yang digoreng dengan bumbu dan bahan lainnya\n' +
                      '2. Rendang - Masakan daging yang dimasak dengan santan dan bumbu rempah selama berjam-jam\n' +
                      '3. Sate Ayam - Daging ayam yang ditusuk dan dibakar, disajikan dengan bumbu kacang\n' +
                      '4. Gado-gado - Salad sayuran dengan bumbu kacang yang khas\n' +
                      '5. Soto Betawi - Sup daging sapi dengan santan dan bumbu rempah\n\n' +
                      'Itu adalah beberapa resep makanan Indonesia yang sangat terkenal dan lezat..."\n\n' +
                      '**Dengan Stop Sequences: "\\n\\n"**\n' +
                      '**Output:**\n' +
                      '1. Nasi Goreng\n' +
                      '2. Rendang\n' +
                      '3. Sate Ayam\n' +
                      '4. Gado-gado\n' +
                      '5. Soto Betawi'
                    )}
                  />
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Pisahkan dengan koma"
                  value={formData.stop_sequences}
                  onChange={(e) => setFormData({ ...formData, stop_sequences: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="label">Catatan Versi (Opsional)</label>
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder="Perubahan: memperbaiki respons untuk..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        {/* Preview Changes (if has base version) */}
        {baseVersion && (
          <button
            type="button"
            className="w-full btn btn-secondary"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Sembunyikan' : 'Lihat'} Perbandingan dengan Versi {baseVersion.version_number}
          </button>
        )}

        {showPreview && baseVersion && (
          <div className="border border-dark-200 rounded-xl overflow-hidden">
            <div className="bg-dark-50 px-4 py-3 border-b border-dark-200">
              <h4 className="font-medium text-dark-900">Perbandingan Perubahan</h4>
            </div>
            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
              {changes.length === 0 ? (
                <p className="text-dark-500 text-center py-4">Tidak ada perubahan terdeteksi (kecuali kredensial)</p>
              ) : (
                changes.map((change, i) => (
                  <div key={i} className="border border-dark-100 rounded-lg p-3">
                    <p className="font-medium text-dark-700 text-sm mb-2">{change.field}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-red-50 p-2 rounded max-h-48 overflow-auto">
                        <span className="text-red-600 font-medium">Sebelum:</span>
                        <p className="text-red-800 mt-1 break-words whitespace-pre-wrap">
                          {change.old || '(kosong)'}
                        </p>
                      </div>
                      <div className="bg-green-50 p-2 rounded max-h-48 overflow-auto">
                        <span className="text-green-600 font-medium">Sesudah:</span>
                        <p className="text-green-800 mt-1 break-words whitespace-pre-wrap">
                          {change.new || '(kosong)'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-dark-100">
          <button 
            type="button"
            onClick={onCancel}
            className="btn btn-secondary flex-1"
          >
            Batal
          </button>
          <button 
            type="submit"
            className="btn btn-primary flex-1"
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Buat Versi'}
          </button>
        </div>
        
        <p className="text-xs text-dark-400 text-center">
          ⚠️ Versi yang dibuat bersifat permanen dan tidak dapat diubah
        </p>
      </form>

      {/* Help Modal */}
      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title={helpContent.title}
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          <div 
            className="prose prose-sm max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: helpContent.content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/^### (.*$)/gim, '<h4 class="text-base font-semibold mt-4 mb-2">$1</h4>')
                .replace(/^## (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
                .replace(/^# (.*$)/gim, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
                .replace(/\n\n/g, '</p><p class="mb-3">')
                .replace(/\n/g, '<br/>')
            }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default CreateVersionForm;
