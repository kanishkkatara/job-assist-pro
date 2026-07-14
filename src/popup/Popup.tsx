import React, { useState, useEffect } from 'react';
import { useStorageLocal, useStorageSession } from '../hooks/useStorage';
import { addApplication } from '../utils/db';

export function Popup() {
  const [profiles] = useStorageLocal<any[]>('profiles', []);
  const [settings] = useStorageLocal<any>('settings', { apiKey: '', model: 'gpt-4o-mini' });
  const [activeProfileId, setActiveProfileId] = useStorageLocal<string | null>('activeProfileId', null);
  const [jd, setJd] = useStorageSession<any>('currentJD', null);
  
  const [loading, setLoading] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const showBanner = (msg: string) => {
    setBanner(msg);
    setTimeout(() => setBanner(null), 4000);
  };

  const sendToContent = async (payload: any) => {
    return new Promise<any>((resolve) => {
      chrome.runtime.sendMessage({ type: 'RELAY_TO_CONTENT', payload }, (response) => {
        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
        else resolve(response || {});
      });
    });
  };

  const handleCaptureJD = async () => {
    setLoading('capture');
    try {
      const res = await sendToContent({ type: 'EXTRACT_JD' });
      if (res.error) throw new Error(res.error);
      if (res.jd) {
        setJd(res.jd);
        await addApplication({
          id: res.jd.url || Date.now().toString(),
          title: res.jd.title || 'Unknown Title',
          company: res.jd.company || 'Unknown Company',
          url: res.jd.url || '',
          status: 'Discovered',
          jdText: res.jd.text || '',
          capturedAt: Date.now()
        });
        showBanner(`✅ JD captured: "${res.jd.title}"`);
      }
    } catch (e) {
      showBanner('❌ Could not capture JD.');
    }
    setLoading(null);
  };

  const handleOpenDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div style={{ width: '380px', padding: '16px', fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>JobAssist Pro</h2>
        <select 
          value={activeProfileId || ''} 
          onChange={(e) => setActiveProfileId(e.target.value)}
          style={{ padding: '4px', maxWidth: '150px' }}
        >
          <option value="">— Select a profile —</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </header>

      {banner && (
        <div style={{ background: '#d4edda', color: '#155724', padding: '8px', borderRadius: '4px', marginBottom: '16px' }}>
          {banner}
        </div>
      )}

      {!activeProfileId ? (
        <div style={{ textAlign: 'center', color: '#666' }}>
          <p>No active profile selected.</p>
          <button onClick={handleOpenDashboard}>Open Dashboard</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '8px' }}>
            <strong>Current JD: </strong> {jd ? jd.title : 'None captured'}
            <div style={{ marginTop: '8px' }}>
              <button onClick={handleCaptureJD} disabled={loading === 'capture'}>
                {loading === 'capture' ? 'Capturing...' : (jd ? 'Recapture JD' : 'Capture JD')}
              </button>
              {jd && <button onClick={() => setJd(null)} style={{ marginLeft: '8px' }}>Clear</button>}
            </div>
          </div>

          <button disabled={!jd} style={{ padding: '8px' }}>⚡ Auto-fill Form</button>
          <button disabled={!jd} style={{ padding: '8px' }}>💬 Answer Questions</button>
          <button disabled={!jd} style={{ padding: '8px' }}>📝 Generate Cover Letter</button>
        </div>
      )}
      
      <footer style={{ marginTop: '16px', borderTop: '1px solid #eee', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
        <a href="#" onClick={handleOpenDashboard}>📊 Dashboard</a>
        <span>{profiles.length} profile(s)</span>
      </footer>
    </div>
  );
}
