import React from 'react';
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DnsIcon from '@mui/icons-material/Dns';

import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import BalanceIcon from '@mui/icons-material/Balance';
import SecurityIcon from '@mui/icons-material/Security';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import { useNavigate, useLocation } from 'react-router-dom';

const DRAWER_WIDTH = 256;

interface SideNavProps {
  open: boolean;
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  section?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: <DashboardIcon fontSize="small" />, path: '/' },
  { label: 'Resource Manager', icon: <CorporateFareIcon fontSize="small" />, path: '/resource-manager', section: 'IAM & ADMIN' },
  { label: 'VPC Networks', icon: <AccountTreeIcon fontSize="small" />, path: '/vpc', section: 'NETWORKING' },
  { label: 'Firewall', icon: <SecurityIcon fontSize="small" />, path: '/firewall' },
  { label: 'VM Instances', icon: <DnsIcon fontSize="small" />, path: '/compute', section: 'COMPUTE' },
  { label: 'Cloud Storage', icon: <StorageIcon fontSize="small" />, path: '/storage', section: 'STORAGE' },
  { label: 'BigQuery', icon: <TableChartIcon fontSize="small" />, path: '/bigquery', section: 'BIG DATA' },
  { label: 'Load Balancing', icon: <BalanceIcon fontSize="small" />, path: '/load-balancing', section: 'NETWORKING' },
  { label: 'Billing', icon: <AttachMoneyIcon fontSize="small" />, path: '/billing', section: 'BILLING' },
  { label: 'Support', icon: <SupportAgentIcon fontSize="small" />, path: '/support', section: 'SUPPORT' },
  { label: 'My Cases', icon: <ConfirmationNumberIcon fontSize="small" />, path: '/my-cases' },
];

const SideNav: React.FC<SideNavProps> = ({ open }) => {
  const navigate = useNavigate();
  const location = useLocation();

  let lastSection = '';

  return (
    <Drawer
      variant="persistent"
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderRight: '1px solid #dadce0',
          mt: '64px',
          bgcolor: '#fff',
        },
      }}
    >
      <Box sx={{ py: 1 }}>
        <List dense disablePadding>
          {navItems.map((item) => {
            const showSection = item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;

            return (
              <React.Fragment key={item.path}>
                {showSection && (
                  <>
                    <Divider sx={{ my: 0.5 }} />
                    <Typography
                      variant="caption"
                      sx={{
                        px: 2,
                        py: 0.5,
                        display: 'block',
                        color: '#5f6368',
                        fontWeight: 500,
                        fontSize: '0.6875rem',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {item.section}
                    </Typography>
                  </>
                )}
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  sx={{ py: 0.5, pl: 2, minHeight: 36 }}
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
              </React.Fragment>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
};

export default SideNav;
export { DRAWER_WIDTH };
