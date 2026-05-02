import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Breadcrumbs,
  Link,
  Chip,
  Alert,
} from '@mui/material';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import FolderIcon from '@mui/icons-material/Folder';
import DescriptionIcon from '@mui/icons-material/Description';
import AddIcon from '@mui/icons-material/Add';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useNavigate } from 'react-router-dom';
import { useGcpStore } from '../hooks/useGcpStore';
import {
  createOrganization,
  createFolder,
  createProject,
  setCurrentProject,
  setCurrentOrg,
  deleteProject,
  type Organization,
  type Folder,
} from '../store/gcpStore';

type DialogType = 'org' | 'folder' | 'project' | null;

const ResourceManager: React.FC = () => {
  const state = useGcpStore();
  const navigate = useNavigate();

  // Navigation state
  const [currentOrg, setCurrentOrgLocal] = useState<Organization | null>(null);
  const [folderPath, setFolderPath] = useState<Folder[]>([]);
  const [dialogType, setDialogType] = useState<DialogType>(null);
  const [name, setName] = useState('');

  const currentFolder = folderPath.length > 0 ? folderPath[folderPath.length - 1] : null;

  const handleCreateOrg = () => {
    if (!name.trim()) return;
    const org = createOrganization(name.trim(), name.trim());
    setCurrentOrgLocal(org);
    setCurrentOrg(org.id);
    setDialogType(null);
    setName('');
  };

  const handleCreateFolder = () => {
    if (!name.trim()) return;
    const parentId = currentFolder ? currentFolder.id : currentOrg!.id;
    const parentType = currentFolder ? 'folder' as const : 'organization' as const;
    createFolder(name.trim(), parentId, parentType);
    // Refresh view
    refreshCurrentOrg();
    setDialogType(null);
    setName('');
  };

  const handleCreateProject = () => {
    if (!name.trim() || !currentFolder) return;
    const project = createProject(name.trim(), currentFolder.id, 'folder');
    setCurrentProject(project.id);
    setDialogType(null);
    setName('');
    refreshCurrentOrg();
  };

  const refreshCurrentOrg = () => {
    if (currentOrg) {
      const fresh = state.organizations.find(o => o.id === currentOrg.id);
      if (fresh) {
        setCurrentOrgLocal(fresh);
        // Refresh folder path
        if (folderPath.length > 0) {
          const newPath: Folder[] = [];
          let folders = fresh.folders;
          for (const fp of folderPath) {
            const found = findFolderById(folders, fp.id);
            if (found) {
              newPath.push(found);
              folders = found.folders;
            }
          }
          setFolderPath(newPath);
        }
      }
    }
  };

  // Re-derive from store on each render
  const liveOrg = currentOrg ? state.organizations.find(o => o.id === currentOrg.id) || null : null;

  let liveFolderPath: Folder[] = [];
  if (liveOrg && folderPath.length > 0) {
    let folders = liveOrg.folders;
    for (const fp of folderPath) {
      const found = findFolderById(folders, fp.id);
      if (found) {
        liveFolderPath.push(found);
        folders = found.folders;
      }
    }
  }
  const liveCurrentFolder = liveFolderPath.length > 0 ? liveFolderPath[liveFolderPath.length - 1] : null;

  const enterOrg = (org: Organization) => {
    setCurrentOrgLocal(org);
    setCurrentOrg(org.id);
    setFolderPath([]);
  };

  const enterFolder = (folder: Folder) => {
    setFolderPath([...liveFolderPath, folder]);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Back to org list
      setCurrentOrgLocal(null);
      setFolderPath([]);
    } else if (index === 0) {
      // Org root
      setFolderPath([]);
    } else {
      setFolderPath(liveFolderPath.slice(0, index));
    }
  };

  const selectProject = (projectId: string) => {
    setCurrentProject(projectId);
    navigate('/');
  };

  // ─── Render Org List ──────────────────────────────────────────
  if (!liveOrg) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5">Resource Manager</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setDialogType('org'); setName(''); }}
          >
            Create Organization
          </Button>
        </Box>

        {state.organizations.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Start by creating an Organization. The GCP hierarchy follows: Organization → Folder → Project → Resources.
          </Alert>
        )}

        <Paper>
          <List disablePadding>
            {state.organizations.map((org) => (
              <ListItemButton key={org.id} onClick={() => enterOrg(org)} sx={{ borderRadius: 0 }}>
                <ListItemIcon><CorporateFareIcon sx={{ color: '#1a73e8' }} /></ListItemIcon>
                <ListItemText
                  primary={org.displayName}
                  secondary={`Created ${new Date(org.createdAt).toLocaleDateString()}`}
                />
                <ArrowForwardIosIcon sx={{ fontSize: 14, color: '#80868b' }} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        <CreateDialog
          open={dialogType === 'org'}
          title="Create Organization"
          label="Organization name"
          value={name}
          onChange={setName}
          onClose={() => setDialogType(null)}
          onSubmit={handleCreateOrg}
        />
      </Box>
    );
  }

  // ─── Render Org/Folder contents ───────────────────────────────
  const displayFolders = liveCurrentFolder ? liveCurrentFolder.folders : liveOrg.folders;
  const displayProjects = liveCurrentFolder ? liveCurrentFolder.projects : [];

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigateToBreadcrumb(-1)}
          sx={{ fontSize: '0.875rem' }}
        >
          Organizations
        </Link>
        <Link
          component="button"
          underline="hover"
          color={liveFolderPath.length === 0 ? 'text.primary' : 'inherit'}
          onClick={() => navigateToBreadcrumb(0)}
          sx={{ fontSize: '0.875rem' }}
        >
          {liveOrg.displayName}
        </Link>
        {liveFolderPath.map((f, i) => (
          <Link
            key={f.id}
            component="button"
            underline="hover"
            color={i === liveFolderPath.length - 1 ? 'text.primary' : 'inherit'}
            onClick={() => navigateToBreadcrumb(i + 1)}
            sx={{ fontSize: '0.875rem' }}
          >
            {f.name}
          </Link>
        ))}
      </Breadcrumbs>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<CreateNewFolderIcon />}
          size="small"
          onClick={() => { setDialogType('folder'); setName(''); }}
        >
          Create Folder
        </Button>
        {liveCurrentFolder && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => { setDialogType('project'); setName(''); }}
          >
            Create Project
          </Button>
        )}
        {!liveCurrentFolder && (
          <Chip
            label="Navigate into a folder to create projects"
            size="small"
            variant="outlined"
            sx={{ alignSelf: 'center', color: '#5f6368' }}
          />
        )}
      </Box>

      {/* Contents */}
      <Paper>
        <List disablePadding>
          {displayFolders.map((folder) => (
            <ListItemButton key={folder.id} onClick={() => enterFolder(folder)} sx={{ borderRadius: 0 }}>
              <ListItemIcon><FolderIcon sx={{ color: '#fbbc04' }} /></ListItemIcon>
              <ListItemText
                primary={folder.name}
                secondary={`${folder.folders.length} folders, ${folder.projects.length} projects`}
              />
              <ArrowForwardIosIcon sx={{ fontSize: 14, color: '#80868b' }} />
            </ListItemButton>
          ))}
          {displayProjects.map((project) => (
            <ListItemButton key={project.id} onClick={() => selectProject(project.id)} sx={{ borderRadius: 0 }}>
              <ListItemIcon><DescriptionIcon sx={{ color: '#1a73e8' }} /></ListItemIcon>
              <ListItemText
                primary={project.name}
                secondary={`${project.projectId} • #${project.number}`}
              />
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProject(project.id);
                }}
                sx={{ color: '#80868b' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          ))}
          {displayFolders.length === 0 && displayProjects.length === 0 && (
            <Box sx={{ py: 4, textAlign: 'center', color: '#80868b' }}>
              <Typography variant="body2">No items yet. Create a folder or project.</Typography>
            </Box>
          )}
        </List>
      </Paper>

      {/* Dialogs */}
      <CreateDialog
        open={dialogType === 'folder'}
        title="Create Folder"
        label="Folder name"
        value={name}
        onChange={setName}
        onClose={() => setDialogType(null)}
        onSubmit={handleCreateFolder}
      />
      <CreateDialog
        open={dialogType === 'project'}
        title="Create Project"
        label="Project name"
        value={name}
        onChange={setName}
        onClose={() => setDialogType(null)}
        onSubmit={handleCreateProject}
        helperText="A unique project ID will be generated automatically."
      />
    </Box>
  );
};

// Helper
function findFolderById(folders: Folder[], id: string): Folder | undefined {
  for (const f of folders) {
    if (f.id === id) return f;
    const child = findFolderById(f.folders, id);
    if (child) return child;
  }
  return undefined;
}

// Reusable dialog
interface CreateDialogProps {
  open: boolean;
  title: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  helperText?: string;
}

const CreateDialog: React.FC<CreateDialogProps> = ({
  open, title, label, value, onChange, onClose, onSubmit, helperText,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{title}</DialogTitle>
    <DialogContent>
      <TextField
        autoFocus
        fullWidth
        label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        sx={{ mt: 1 }}
        helperText={helperText}
        onKeyDown={e => e.key === 'Enter' && onSubmit()}
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="contained" onClick={onSubmit} disabled={!value.trim()}>
        Create
      </Button>
    </DialogActions>
  </Dialog>
);

export default ResourceManager;
