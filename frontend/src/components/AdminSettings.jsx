import { useEffect, useState } from 'react';
import { getAdminSettings, updateAdminSettings } from '../lib/api.js';
import Icon from './Icon.jsx';

const initialSettings = {
  siteName: '',
  supportEmail: '',
  systemNotifications: true,
  platformFeeRate: '0',
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const { settings: saved } = await getAdminSettings();
      setSettings({
        siteName: saved.siteName,
        supportEmail: saved.supportEmail,
        systemNotifications: saved.systemNotifications,
        platformFeeRate: String(saved.platformFeeRate),
      });
      setLoaded(true);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    getAdminSettings({ signal: controller.signal })
      .then(({ settings: saved }) => {
        setSettings({
          siteName: saved.siteName,
          supportEmail: saved.supportEmail,
          systemNotifications: saved.systemNotifications,
          platformFeeRate: String(saved.platformFeeRate),
        });
        setLoaded(true);
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  function updateField(event) {
    const { name, value, checked, type } = event.target;
    setSettings((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { settings: saved } = await updateAdminSettings({
        ...settings,
        platformFeeRate: Number(settings.platformFeeRate),
      });
      setSettings({
        siteName: saved.siteName,
        supportEmail: saved.supportEmail,
        systemNotifications: saved.systemNotifications,
        platformFeeRate: String(saved.platformFeeRate),
      });
      setMessage('Platform settings saved successfully.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-card admin-settings-card">
      <div className="card-heading"><div><h2>Platform settings</h2><p>Configuration is saved to the platform database.</p></div><span className="admin-settings-icon"><Icon name="settings" size={17} /></span></div>
      {loading ? <p className="empty-table" role="status">Loading platform settings…</p> : !loaded
        ? <div className="empty-state"><strong>Could not load platform settings</strong><p>{error}</p><button type="button" className="small-primary" onClick={loadSettings}>Try again</button></div>
        : <>
        {error && <p className="admin-inline-error" role="alert">{error}</p>}
        {message && <p className="admin-inline-success" role="status">{message}</p>}
        <form className="admin-settings-form" onSubmit={saveSettings}>
          <label>Site name<input name="siteName" value={settings.siteName} onChange={updateField} maxLength="100" required /></label>
          <label>Support email<input name="supportEmail" type="email" value={settings.supportEmail} onChange={updateField} maxLength="254" required /></label>
          <label>Platform fee rate (%)<input name="platformFeeRate" type="number" value={settings.platformFeeRate} onChange={updateField} min="0" max="100" step="0.01" required /><small>Stored as platform configuration; any transaction processing must apply it in its relevant service.</small></label>
          <label className="admin-settings-toggle"><span><strong>System notifications</strong><small>Enable or disable the platform notification configuration.</small></span><input name="systemNotifications" type="checkbox" checked={settings.systemNotifications} onChange={updateField} /></label>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Icon name="check" size={15} />Save settings</>}</button>
        </form>
      </>}
    </section>
  );
}
