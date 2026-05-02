import React, { useEffect } from 'react';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, AppBar, Toolbar, IconButton, Chip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import RuleIcon from '@mui/icons-material/Rule';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../hooks/useAuthStore';
import { logout } from '../../store/authStore';
import { RoleBadge } from '../../components/support/StatusBadge';

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[]; // which roles can see this
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/support-panel/dashboard', roles: ['super_admin', 'L1', 'L2', 'L3', 'L4', 'TSE'] },
  { label: 'Team Management', icon: <PeopleIcon fontSize="small" />, path: '/support-panel/team', roles: ['super_admin'] },
  { label: 'Escalation Matrix', icon: <RuleIcon fontSize="small" />, path: '/support-panel/escalation', roles: ['super_admin'] },
  { label: 'Ticket Queue', icon: <ConfirmationNumberIcon fontSize="small" />, path: '/support-panel/tickets', roles: ['super_admin'] },
  { label: 'My Tickets', icon: <AssignmentIcon fontSize="small" />, path: '/support-panel/my-tickets', roles: ['L1', 'L2', 'L3', 'L4', 'TSE'] },
];

const PanelLayout: React.FC = () => {
  const auth = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!auth.session) {
      navigate('/support-panel/login', { replace: true });
    }
  }, [auth.session, navigate]);

  if (!auth.session) return null;

  const visibleNav = navItems.filter(item => item.roles.includes(auth.session!.role));

  const handleLogout = () => {
    logout();
    navigate('/support-panel/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      {/* Top Bar */}
      <AppBar
        position="fixed"
        sx={{
          bgcolor: '#1e8e3e',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3)',
        }}
      >
        <Toolbar sx={{ minHeight: '48px !important', px: 1 }}>
          <SupportAgentIcon sx={{ mr: 1, fontSize: 20 }} />
          <Typography variant="body1" sx={{ fontWeight: 500, color: '#fff', mr: 2, fontSize: '0.9375rem' }}>
            Support Panel
          </Typography>

          <RoleBadge role={auth.session.role} />

          <Box sx={{ flexGrow: 1 }} />

          <Chip
            icon={<SupportAgentIcon sx={{ fontSize: '14px !important' }} />}
            label={`Agent: ${auth.session.agentName}`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.6875rem', mr: 1 }}
          />

          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', mr: 2 }}>
            {auth.session.displayName}
          </Typography>

          <IconButton size="small" sx={{ color: '#fff', mr: 0.5 }} onClick={() => navigate('/')} title="GCP Simulator">
            <HomeIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" sx={{ color: '#fff' }} onClick={handleLogout} title="Logout">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Side Nav */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid #dadce0',
            mt: '48px',
            bgcolor: '#fff',
          },
        }}
      >
        <Box sx={{ py: 1 }}>
          <List dense disablePadding>
            {visibleNav.map(item => (
              <ListItemButton
                key={item.path}
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{ py: 0.5, pl: 2, minHeight: 36, borderRadius: '0 24px 24px 0', mr: 1.5 }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                  {item.icon}
                </ListItemIcon>
               <ListItemText
                primary={
                  <Typography sx={{ fontSize: '0.8125rem' }}>
                    {item.label}
                  </Typography>
                }
              />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, mt: '48px', p: 3, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
};

export default PanelLayout;
