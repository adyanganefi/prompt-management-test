const ApiGuideTab = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-dark-900">API Chat Guide</h2>
        <p className="text-dark-600">Panduan mengirim pertanyaan ke agent melalui API backend.</p>
      </div>

      <section className="card p-4 space-y-3">
        <h3 className="text-lg font-semibold text-dark-900">Prasyarat</h3>
        <ul className="list-disc list-inside text-dark-700 space-y-1 text-sm">
          <li>Memiliki Project API Key yang aktif (lihat menu API Keys) untuk header otorisasi.</li>
          <li>Agent memiliki versi aktif; atau sertakan <span className="font-mono">version_number</span> spesifik.</li>
          <li>Chat endpoint hanya menerima Bearer Project API Key.</li>
          <li>Session bisa lintas versi: riwayat tetap dipakai selama <span className="font-mono">session_id</span> sama dan API key sama.</li>
        </ul>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="text-lg font-semibold text-dark-900">Endpoint</h3>
        <div className="space-y-1 text-sm text-dark-700">
          <p><span className="font-mono">POST /api/chat</span></p>
          <p>Headers:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><span className="font-mono">Authorization: Bearer &lt;project_api_key&gt;</span></li>
            <li><span className="font-mono">Content-Type: application/json</span></li>
          </ul>
        </div>
        <div className="space-y-2 text-sm text-dark-700">
          <p>Body JSON:</p>
          <pre className="bg-dark-900 text-dark-50 p-3 rounded-lg text-xs overflow-auto">
{`{
  "message": "Halo, apa kabar?",
  "agent_name": "<nama_agent>",
  "version_number": 1,
  "session_id": "<optional_session_uuid>",
  "variables": {
    "name": "Budi",
    "age": "21"
  }
}`}
          </pre>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><span className="font-mono">agent_name</span> wajib: pencarian case-insensitive di project.</li>
            <li><span className="font-mono">version_number</span> opsional: kosongkan untuk memakai versi aktif agent.</li>
            <li><span className="font-mono">session_id</span> opsional: kosong/null untuk memulai sesi baru; kirim ulang nilai sebelumnya agar konteks dipakai (riwayat lintas versi). Jika kirim nilai yang tidak ada, request akan ditolak.</li>
            <li><span className="font-mono">variables</span> opsional: map nilai untuk placeholder di system prompt (misal prompt berisi <span className="font-mono">$name</span>, <span className="font-mono">$age</span>). Jika ada yang tidak diisi, placeholder dibiarkan apa adanya.</li>
          </ul>
        </div>
        <div className="space-y-1 text-sm text-dark-700">
          <p>Respons:</p>
          <pre className="bg-dark-900 text-dark-50 p-3 rounded-lg text-xs overflow-auto">
{`{
  "response": "jawaban dari model",
  "session_id": "<uuid>",
  "agent_name": "<nama_agent>",
  "version_number": 2,
  "tokens_used": 145,
  "prompt_tokens": 80,
  "completion_tokens": 65,
  "total_tokens": 145,
  "total_prompt_tokens": 80,
  "total_completion_tokens": 65,
  "model_name": "gpt-4o"
}`}
          </pre>
          <p className="text-dark-600 text-xs">Gunakan <span className="font-mono">session_id</span> dari respons berikutnya untuk mempertahankan konteks. <span className="font-mono">tokens_used</span> adalah total token untuk jawaban ini saja, sedangkan <span className="font-mono">total_tokens</span> adalah total kumulatif dari seluruh session.</p>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="text-lg font-semibold text-dark-900">Streaming (SSE)</h3>
        <div className="space-y-1 text-sm text-dark-700">
          <p><span className="font-mono">POST /api/chat/stream</span> (SSE)</p>
          <p>Headers:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><span className="font-mono">Authorization: Bearer &lt;project_api_key&gt;</span></li>
            <li><span className="font-mono">Content-Type: application/json</span></li>
          </ul>
        </div>
        <div className="space-y-2 text-sm text-dark-700">
          <p>Body JSON sama dengan endpoint normal.</p>
          <p>Server mengirim event SSE bertahap:</p>
          <pre className="bg-dark-900 text-dark-50 p-3 rounded-lg text-xs overflow-auto">
{`event: start
data: {"session_id":"<uuid>","agent_name":"<nama_agent>","version_number":2,"model_name":"gpt-4o"}

event: token
data: {"token":"Halo"}

event: token
data: {"token":" dunia"}

event: done
data: {"session_id":"<uuid>","agent_name":"<nama_agent>","version_number":2,"model_name":"gpt-4o","tokens_used":145,"prompt_tokens":80,"completion_tokens":65,"total_tokens":320,"total_prompt_tokens":180,"total_completion_tokens":140}`}
          </pre>
          <p className="text-xs text-dark-500">Gunakan event <span className="font-mono">token</span> untuk menampilkan jawaban bertahap. Nilai token usage akan terisi jika provider mendukung <span className="font-mono">stream_usage</span> pada streaming. <span className="font-mono">tokens_used</span> adalah total token untuk jawaban ini saja, sedangkan <span className="font-mono">total_tokens</span> adalah total kumulatif dari seluruh session (semua pesan assistant di session_id yang sama). <span className="font-mono">total_prompt_tokens</span> dan <span className="font-mono">total_completion_tokens</span> adalah akumulasi prompt dan completion tokens dari seluruh session.</p>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="text-lg font-semibold text-dark-900">Contoh cURL</h3>
        <pre className="bg-dark-900 text-dark-50 p-3 rounded-lg text-xs overflow-auto">
{`curl -X POST https://<host>/api/chat \
  -H "Authorization: Bearer <project_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Halo",
    "agent_name": "<nama_agent>",
    "version_number": 1,
    "session_id": null,
    "variables": {"name": "Budi"}
  }'`}
        </pre>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="text-lg font-semibold text-dark-900">Tips</h3>
        <ul className="list-disc list-inside text-dark-700 space-y-1 text-sm">
          <li>Simpan <span className="font-mono">session_id</span> per user/client untuk menjaga konteks percakapan.</li>
          <li>Jika ingin reset konteks, kirim <span className="font-mono">session_id</span> kosong/null.</li>
          <li>Pastikan API Key aktif; jika tidak, request akan ditolak.</li>
        </ul>
      </section>
    </div>
  );
};

export default ApiGuideTab;
