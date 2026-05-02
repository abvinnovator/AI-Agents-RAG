import React, { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import SideNav, { DRAWER_WIDTH } from './SideNav';

const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      <TopBar onToggleSidebar={() => setSidebarOpen(o => !o)} />
      <SideNav open={sidebarOpen} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: '48px',
          ml: sidebarOpen ? 0 : `-${DRAWER_WIDTH}px`,
          p: 3,
          transition: 'margin 225ms cubic-bezier(0,0,0.2,1)',
          minWidth: 0,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default AppLayout;
