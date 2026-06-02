import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Select,
  MenuItem,
  Box,
  IconButton,
  InputBase,
  Avatar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TerminalIcon from '@mui/icons-material/Terminal';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useNavigate } from 'react-router-dom';
import { useGcpStore } from '../../hooks/useGcpStore';
import { findProject, setCurrentProject, getAllProjectsInOrg, type Project } from '../../store/gcpStore';

interface TopBarProps {
  onToggleSidebar: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar }) => {
  const state = useGcpStore();
  const navigate = useNavigate();
  state.currentProjectId ? findProject(state.currentProjectId) : null;

  const allProjects: Project[] = [];
  state.organizations.forEach(org => {
    allProjects.push(...getAllProjectsInOrg(org.id));
  });

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        bgcolor: '#fff',
        borderBottom: '1px solid #dadce0',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ minHeight: '64px !important', px: 2, gap: 1 }}>
        {/* Left: Hamburger + Logo + Project */}
        <IconButton
          edge="start"
          onClick={onToggleSidebar}
          sx={{ color: '#5f6368', mr: 0.5 }}
          size="small"
        >
          <MenuIcon />
        </IconButton>

        {/* Google Cloud Logo */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mr: 2 }}
          onClick={() => navigate('/')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" style={{ marginRight: 6 }}>
            <path d="M12.65 2.08c-.27-.05-.54-.08-.82-.08-3.73 0-6.87 2.55-7.78 6l2.92.73c.55-2.09 2.46-3.64 4.86-3.64.18 0 .35.01.52.04l.3-3.05z" fill="#EA4335"/>
            <path d="M4.05 7.92C3.38 9.16 3 10.54 3 12c0 1.77.57 3.4 1.54 4.73l2.52-2.15C6.38 13.67 6 12.87 6 12c0-.56.12-1.1.33-1.59L4.05 7.92z" fill="#FBBC05"/>
            <path d="M12 21c2.82 0 5.28-1.23 7.02-3.18l-2.7-2.09c-.98.93-2.28 1.49-3.73 1.58L12 21z" fill="#34A853"/>
            <path d="M21 12c0-.71-.1-1.4-.28-2.06l-8.72.01v3.64h5.01c-.35 1.2-1.13 2.13-2.14 2.73l2.7 2.09C19.78 16.65 21 14.5 21 12z" fill="#4285F4"/>
          </svg>
          <Typography
            sx={{
              fontWeight: 400,
              color: '#5f6368',
              fontSize: '18px',
              letterSpacing: '-0.5px',
              fontFamily: '"Google Sans", "Product Sans", sans-serif',
            }}
          >
            Google Cloud
          </Typography>
        </Box>

        {/* Project Selector */}
        {allProjects.length > 0 && (
          <Select
            value={state.currentProjectId || ''}
            onChange={(e) => setCurrentProject(e.target.value as string)}
            size="small"
            displayEmpty
            IconComponent={ArrowDropDownIcon}
            sx={{
              color: '#3c4043',
              fontSize: '14px',
              fontWeight: 500,
              height: 36,
              minWidth: 180,
              bgcolor: '#fff',
              borderRadius: '4px',
              '.MuiOutlinedInput-notchedOutline': { borderColor: '#dadce0' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#bdc1c6' },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#1a73e8' },
              '.MuiSvgIcon-root': { color: '#5f6368', fontSize: 20 },
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
        )}

        {/* Center: Search Bar */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', mx: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#f1f3f4',
              borderRadius: '8px',
              px: 2,
              py: 0.5,
              width: '100%',
              maxWidth: 720,
              '&:hover': { bgcolor: '#e8eaed' },
              '&:focus-within': { bgcolor: '#fff', boxShadow: '0 1px 6px rgba(32,33,36,0.28)' },
              transition: 'all 0.2s',
            }}
          >
            <SearchIcon sx={{ color: '#5f6368', mr: 1, fontSize: 20 }} />
            <InputBase
              placeholder="Search for resources, docs, products, and more"
              sx={{
                flexGrow: 1,
                fontSize: '14px',
                color: '#3c4043',
                '& ::placeholder': { color: '#5f6368', opacity: 1 },
              }}
            />
          </Box>
        </Box>

        {/* Right: Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton size="small" sx={{ color: '#5f6368' }} title="Gemini">
            <AutoAwesomeIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton size="small" sx={{ color: '#5f6368' }} title="Cloud Shell">
            <TerminalIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton size="small" sx={{ color: '#5f6368' }} title="Notifications">
            <NotificationsNoneIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton size="small" sx={{ color: '#5f6368' }} title="More">
            <MoreVertIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <IconButton
            size="small"
            sx={{ ml: 0.5 }}
            onClick={() => navigate('/support-panel/login')}
            title="Support Panel"
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: '#1a73e8',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              B
            </Avatar>
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
