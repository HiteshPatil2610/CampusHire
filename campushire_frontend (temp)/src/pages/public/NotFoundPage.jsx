import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { PATHS } from '../../routes/paths';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="auth-container page-enter">
      <div className="auth-card" style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🧭</div>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Page Not Found</h1>
        <p className="text-secondary" style={{ fontSize: 13, marginBottom: 24 }}>
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
          <Button onClick={() => navigate(PATHS.landing)}>Home</Button>
        </div>
      </div>
    </div>
  );
}
