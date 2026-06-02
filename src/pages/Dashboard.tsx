import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  IconButton,
} from '@mui/material';
import DnsIcon from '@mui/icons-material/Dns';
import StorageIcon from '@mui/icons-material/Storage';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TableChartIcon from '@mui/icons-material/TableChart';
import BalanceIcon from '@mui/icons-material/Balance';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AppsIcon from '@mui/icons-material/Apps';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { useNavigate } from 'react-router-dom';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject } from '../store/gcpStore';

const Dashboard: React.FC = () => {
  const state = useGcpStore();
  const navigate = useNavigate();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;

  if (!project) {
    return (
      <Box sx={{ textAlign: 'center', mt: 10, px: 3 }}>
        <CloudOffIcon sx={{ fontSize: 64, color: '#dadce0', mb: 2 }} />
        <Typography variant="h5" sx={{ color: '#5f6368', mb: 1 }}>
          No project selected
        </Typography>
        <Typography variant="body2" sx={{ color: '#80868b', mb: 3 }}>
          Create an organization and project from the Resource Manager to get started.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/resource-manager')}
          sx={{ bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' } }}
        >
          Go to Resource Manager
        </Button>
      </Box>
    );
  }

  const actionButtons = [
    { label: 'Create a VM', path: '/compute' },
    { label: 'Run a query in BigQuery', path: '/bigquery' },
    { label: 'Create a storage bucket', path: '/storage' },
    { label: 'Deploy a load balancer', path: '/load-balancing' },
    { label: 'Configure firewall', path: '/firewall' },
    { label: 'Create VPC network', path: '/vpc' },
  ];

  const quickAccessCards = [
    { label: 'APIs & Services', icon: <AppsIcon />, path: '/resource-manager' },
    { label: 'IAM & Admin', icon: <ManageAccountsIcon />, path: '/resource-manager' },
    { label: 'Billing', icon: <AttachMoneyIcon />, path: '/billing' },
    { label: 'Compute Engine', icon: <DnsIcon />, path: '/compute' },
    { label: 'Cloud Storage', icon: <StorageIcon />, path: '/storage' },
    { label: 'BigQuery', icon: <TableChartIcon />, path: '/bigquery' },
    { label: 'VPC Network', icon: <AccountTreeIcon />, path: '/vpc' },
    { label: 'Load Balancing', icon: <BalanceIcon />, path: '/load-balancing' },
  ];

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, md: 5 }, py: 4 }}>
      {/* ── Hero Section ─── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 5 }}>
        <Box sx={{ flex: 1 }}>
          {/* Welcome heading */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <svg width="36" height="36" viewBox="0 0 24 24">
              <path d="M12.65 2.08c-.27-.05-.54-.08-.82-.08-3.73 0-6.87 2.55-7.78 6l2.92.73c.55-2.09 2.46-3.64 4.86-3.64.18 0 .35.01.52.04l.3-3.05z" fill="#EA4335"/>
              <path d="M4.05 7.92C3.38 9.16 3 10.54 3 12c0 1.77.57 3.4 1.54 4.73l2.52-2.15C6.38 13.67 6 12.87 6 12c0-.56.12-1.1.33-1.59L4.05 7.92z" fill="#FBBC05"/>
              <path d="M12 21c2.82 0 5.28-1.23 7.02-3.18l-2.7-2.09c-.98.93-2.28 1.49-3.73 1.58L12 21z" fill="#34A853"/>
              <path d="M21 12c0-.71-.1-1.4-.28-2.06l-8.72.01v3.64h5.01c-.35 1.2-1.13 2.13-2.14 2.73l2.7 2.09C19.78 16.65 21 14.5 21 12z" fill="#4285F4"/>
            </svg>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 400,
                color: '#202124',
                fontFamily: '"Google Sans", sans-serif',
                fontSize: '28px',
              }}
            >
              Welcome
            </Typography>
          </Box>

          <Typography
            variant="body1"
            sx={{ color: '#5f6368', mb: 0.5, fontSize: '14px' }}
          >
            You're working in{' '}
            <Typography
              component="span"
              sx={{ color: '#1a73e8', cursor: 'pointer', fontWeight: 500, fontSize: '14px' }}
            >
              {project.name}
            </Typography>
          </Typography>

          {/* Project details */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>
                Project number: {project.number}
              </Typography>
              <IconButton size="small" sx={{ p: 0.25 }}>
                <ContentCopyIcon sx={{ fontSize: 14, color: '#5f6368' }} />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>
                Project ID: {project.projectId}
              </Typography>
              <IconButton size="small" sx={{ p: 0.25 }}>
                <ContentCopyIcon sx={{ fontSize: 14, color: '#5f6368' }} />
              </IconButton>
            </Box>
          </Box>

          {/* Navigation links */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Typography
              sx={{
                color: '#1a73e8',
                fontSize: '13px',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Dashboard
            </Typography>
            <Typography
              sx={{
                color: '#1a73e8',
                fontSize: '13px',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Cloud Hub
            </Typography>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {actionButtons.map((btn) => (
              <Button
                key={btn.label}
                variant="outlined"
                startIcon={<AddIcon sx={{ fontSize: '16px !important' }} />}
                onClick={() => navigate(btn.path)}
                sx={{
                  textTransform: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#1a73e8',
                  borderColor: '#dadce0',
                  borderRadius: '20px',
                  px: 2,
                  py: 0.5,
                  bgcolor: '#fff',
                  '&:hover': {
                    bgcolor: '#e8f0fe',
                    borderColor: '#1a73e8',
                  },
                }}
              >
                {btn.label}
              </Button>
            ))}
          </Box>
        </Box>

        {/* Right: Promo Card */}
        <Paper
          elevation={0}
          sx={{
            width: 280,
            p: 2.5,
            ml: 4,
            bgcolor: '#e8f0fe',
            borderRadius: '12px',
            display: { xs: 'none', lg: 'block' },
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontSize: '14px',
              color: '#202124',
              fontWeight: 500,
              mb: 1.5,
              lineHeight: 1.4,
            }}
          >
            Join the Google Developer Program for access to tools, resources, and community.
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: '#1a73e8',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Join today <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Box>
        </Paper>
      </Box>

      {/* Decorative Dots */}
      <Box sx={{ position: 'relative' }}>
        <Box sx={{
          position: 'absolute', top: -220, right: 320, width: 12, height: 12,
          borderRadius: '50%', bgcolor: '#4285f4', opacity: 0.4,
          display: { xs: 'none', md: 'block' },
        }} />
        <Box sx={{
          position: 'absolute', top: -180, right: 280, width: 8, height: 8,
          borderRadius: '50%', bgcolor: '#fbbc04', opacity: 0.5,
          display: { xs: 'none', md: 'block' },
        }} />
        <Box sx={{
          position: 'absolute', top: -240, right: 350, width: 10, height: 10,
          borderRadius: '50%', bgcolor: '#34a853', opacity: 0.4,
          display: { xs: 'none', md: 'block' },
        }} />
      </Box>

      {/* ── Quick Access Section ─── */}
      <Box sx={{ mb: 4 }}>
        <Typography
          sx={{
            fontSize: '16px',
            fontWeight: 500,
            color: '#202124',
            mb: 2,
            fontFamily: '"Google Sans", sans-serif',
          }}
        >
          Quick access
        </Typography>

        <Grid container spacing={1.5}>
          {quickAccessCards.map((card) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={card.label}>
              <Paper
                elevation={0}
                onClick={() => navigate(card.path)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  cursor: 'pointer',
                  border: '1px solid #dadce0',
                  borderRadius: '8px',
                  bgcolor: '#fff',
                  transition: 'all 0.15s',
                  '&:hover': {
                    boxShadow: '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
                    borderColor: 'transparent',
                  },
                }}
              >
               <Box sx={{ color: '#5f6368', display: 'flex' }}>
  {React.cloneElement(
    card.icon as React.ReactElement<{ sx?: object }>,
    {
      sx: { fontSize: 20 },
    }
  )}
</Box>
                <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#202124' }}>
                  {card.label}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* View All Products */}
      <Button
        variant="outlined"
        startIcon={<AppsIcon sx={{ fontSize: '16px !important' }} />}
        sx={{
          textTransform: 'none',
          fontSize: '13px',
          fontWeight: 500,
          color: '#1a73e8',
          borderColor: '#dadce0',
          borderRadius: '4px',
          '&:hover': { bgcolor: '#e8f0fe', borderColor: '#1a73e8' },
        }}
      >
        View all products
      </Button>
    </Box>
  );
};

export default Dashboard;
