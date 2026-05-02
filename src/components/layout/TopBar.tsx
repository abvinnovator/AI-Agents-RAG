import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Select,
  MenuItem,
  Box,
  IconButton,
  Chip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloudIcon from '@mui/icons-material/Cloud';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useNavigate } from 'react-router-dom';
import { useGcpStore } from '../../hooks/useGcpStore';
import { findProject, setCurrentProject, getAllProjectsInOrg, type Project } from '../../store/gcpStore';

interface TopBarProps {
  onToggleSidebar: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const state = useGcpStore();
  const navigate = useNavigate();
  const currentProject = state.currentProjectId ? findProject(state.currentProjectId) : null;

  // Get all projects across all orgs
  const allProjects: Project[] = [];
  state.organizations.forEach(org => {
    allProjects.push(...getAllProjectsInOrg(org.id));
  });

  return (
    <AppBar
      position="fixed"
      sx={{
        bgcolor: '#1a73e8',
        zIndex: (theme) => theme.zIndex.drawer + 1,
        boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3)',
      }}
    >
      <Toolbar sx={{ minHeight: '48px !important', px: 1 }}>
        <IconButton
          edge="start"
          color="inherit"
          onClick={onToggleSidebar}
          sx={{ mr: 1 }}
          size="small"
        >
          <MenuIcon />
        </IconButton>

        <CloudIcon sx={{ mr: 1, fontSize: 20 }} />
        <Typography
          variant="body1"
          sx={{
            fontWeight: 500,
            color: '#fff',
            mr: 2,
            letterSpacing: 0.3,
            fontSize: '0.9375rem',
          }}
        >
          Google Cloud
        </Typography>

        {/* Project selector */}
        {allProjects.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1 }}>
            <Select
              value={state.currentProjectId || ''}
              onChange={(e) => setCurrentProject(e.target.value as string)}
              size="small"
              displayEmpty
              sx={{
                color: '#fff',
                fontSize: '0.8125rem',
                height: 32,
                minWidth: 200,
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#fff' },
                '.MuiSvgIcon-root': { color: '#fff' },
              }}
            >
              <MenuItem value="" disabled>
                Select a project
              </MenuItem>
              {allProjects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </Box>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {currentProject && (
          <Chip
            label={`ID: ${currentProject.projectId}`}
            size="small"
            sx={{
              bgcolor: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '0.6875rem',
              mr: 1,
            }}
          />
        )}

        <IconButton
          size="small"
          sx={{ color: '#fff', mr: 1 }}
          onClick={() => navigate('/support-panel/login')}
          title="Support Panel"
        >
          <SupportAgentIcon sx={{ fontSize: 18 }} />
        </IconButton>

        <Typography
          variant="caption"
          sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.6875rem' }}
        >
          CloudOps Simulator
        </Typography>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
