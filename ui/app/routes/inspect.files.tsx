import { useLocation, useNavigate, useParams } from 'react-router';
import { ExplorerPage } from '~/components/Explorer/ExplorerPage';

/**
 * Convert URL path segment to filesystem path
 */
function urlToFsPath(urlPath: string): string {
  if (!urlPath) return '';
  const driveMatch = urlPath.match(/^([A-Za-z]):(?:\/|$)/);
  if (driveMatch) {
    return urlPath.replace(/\//g, '\\');
  }
  return '/' + urlPath;
}

/**
 * Convert filesystem path to URL path segment
 */
function fsToUrlPath(fsPath: string): string {
  if (!fsPath) return '';
  if (/^[A-Za-z]:\\/.test(fsPath)) {
    return fsPath.replace(/\\/g, '/');
  }
  return fsPath.replace(/^\//, '');
}

export default function ObserveFilesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { machineId } = useParams<{ machineId?: string }>();

  // Extract path from /inspect/{machineId}/files/{path}
  const splatPath = location.pathname
    .replace(/^\/inspect\/[^/]+\/files\//, '')
    .replace(/^\/inspect\/[^/]+\/files\/?$/, '');
  const initialPath = urlToFsPath(splatPath);
  const currentMachineId = machineId || 'local';

  const handleNavigate = (path: string) => {
    if (path) {
      const urlSegment = fsToUrlPath(path);
      navigate(`/inspect/${currentMachineId}/files/${urlSegment}`, { replace: true });
    } else {
      navigate(`/inspect/${currentMachineId}/files`, { replace: true });
    }
  };

  const handleMachineChange = (newMachineId: string) => {
    navigate(`/inspect/${newMachineId}/files`, { replace: true });
  };

  return (
    <div className="h-full">
      <ExplorerPage
        initialPath={initialPath}
        machineId={currentMachineId}
        onNavigate={handleNavigate}
        onMachineChange={handleMachineChange}
      />
    </div>
  );
}
