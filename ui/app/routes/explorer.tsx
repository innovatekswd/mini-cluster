import { useLocation, useNavigate, useParams } from 'react-router';
import { ExplorerPage } from '~/components/Explorer/ExplorerPage';

/**
 * Convert URL path segment to filesystem path
 * - Windows: C:/Users → C:\Users
 * - Linux: home/user → /home/user
 */
function urlToFsPath(urlPath: string): string {
  if (!urlPath) return '';
  
  // Check if it's a Windows path (starts with drive letter like C:)
  const driveMatch = urlPath.match(/^([A-Za-z]):(?:\/|$)/);
  if (driveMatch) {
    // Windows path: convert / to \
    return urlPath.replace(/\//g, '\\');
  }
  
  // Linux/Unix path: prepend /
  return '/' + urlPath;
}

/**
 * Convert filesystem path to URL path segment
 * - Windows: C:\Users → C:/Users
 * - Linux: /home/user → home/user (strip leading /)
 */
function fsToUrlPath(fsPath: string): string {
  if (!fsPath) return '';
  
  // Check if it's a Windows path
  if (/^[A-Za-z]:\\/.test(fsPath)) {
    // Windows path: convert \ to /
    return fsPath.replace(/\\/g, '/');
  }
  
  // Linux/Unix path: strip leading /
  return fsPath.replace(/^\//, '');
}

export default function Explorer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { machineId } = useParams<{ machineId?: string }>();
  
  // Extract natural path from URL splat (e.g., /explorer/machine-123/home/user)
  // The splat comes after /explorer/:machineId/
  const splatPath = location.pathname.replace(/^\/explorer\/[^/]*\//, '').replace(/^\/explorer\/?$/, '');
  const initialPath = urlToFsPath(splatPath);
  
  // Default machine ID to 'local' if not specified
  const currentMachineId = machineId || 'local';
  
  const handleNavigate = (path: string) => {
    if (path) {
      const urlSegment = fsToUrlPath(path);
      navigate(`/explorer/${currentMachineId}/${urlSegment}`, { replace: true });
    } else {
      navigate(`/explorer/${currentMachineId}`, { replace: true });
    }
  };
  
  const handleMachineChange = (newMachineId: string) => {
    navigate(`/explorer/${newMachineId}`, { replace: true });
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
