import TagInput from '../../ui/TagInput';
import UrlField from '../../ui/UrlField';
import Button from '../../ui/Button';

export default function TabSkillsLinks({ form, setField, onSave }) {
  // Format URL values to ensure they work smoothly with prefixes
  function cleanUrlValue(val, prefix) {
    if (!val) return '';
    let cleaned = val.replace(/^https?:\/\//i, '');
    if (prefix && cleaned.startsWith(prefix)) {
      cleaned = cleaned.slice(prefix.length);
    }
    return cleaned;
  }

  return (
    <div>
      <h3 className="section-title" style={{ marginBottom: 16 }}>
        Skills & Web Presence
      </h3>

      {/* Technical Skills */}
      <div className="field" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ margin: 0 }}>Technical Skills</label>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Press Enter or comma (,) to add tags · click × to remove
          </span>
        </div>
        <TagInput
          tags={form.technicalSkills || []}
          onChange={(tags) => setField('technicalSkills', tags)}
          placeholder="e.g. Python, Docker, GraphQL, Kubernetes…"
        />
      </div>

      {/* Soft Skills */}
      <div className="field" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <label style={{ margin: 0 }}>Soft Skills & Core Competencies</label>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Press Enter or comma (,) to add tags
          </span>
        </div>
        <TagInput
          tags={form.softSkills || []}
          onChange={(tags) => setField('softSkills', tags)}
          placeholder="e.g. Communication, Agile Mindset, Critical Thinking…"
        />
      </div>

      {/* Web & Social Links */}
      <div
        className="card"
        style={{
          background: 'var(--surface-1)',
          border: '0.5px solid var(--border)',
          padding: 18,
          marginBottom: 24,
        }}
      >
        <h4 style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-primary)' }}>
          Professional Profiles & Code Repositories
        </h4>

        {/* LinkedIn */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12 }}>LinkedIn Profile URL</label>
          <UrlField
            prefix="linkedin.com/"
            value={cleanUrlValue(form.linkedin, 'linkedin.com/')}
            onChange={(val) => setField('linkedin', val)}
            placeholder="in/username"
          />
        </div>

        {/* GitHub */}
        <div className="field" style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12 }}>GitHub Profile URL</label>
          <UrlField
            prefix="github.com/"
            value={cleanUrlValue(form.github, 'github.com/')}
            onChange={(val) => setField('github', val)}
            placeholder="username"
          />
        </div>

        {/* Portfolio */}
        <div className="field">
          <label style={{ fontSize: 12 }}>Personal Portfolio / Website</label>
          <UrlField
            prefix="https://"
            value={cleanUrlValue(form.portfolio, '')}
            onChange={(val) => setField('portfolio', val)}
            placeholder="portfolio-domain.dev"
          />
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '0.5px solid var(--border)' }}>
        <Button onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}
