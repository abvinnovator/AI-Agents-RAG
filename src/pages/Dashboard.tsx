import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
} from '@mui/material';
import DnsIcon from '@mui/icons-material/Dns';
import StorageIcon from '@mui/icons-material/Storage';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TableChartIcon from '@mui/icons-material/TableChart';
import SecurityIcon from '@mui/icons-material/Security';
import BalanceIcon from '@mui/icons-material/Balance';
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
      <Box sx={{ textAlign: 'center', mt: 10 }}>
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
        >
          Go to Resource Manager
        </Button>
      </Box>
    );
  }

  const resourceCards = [
    {
      title: 'VM Instances',
      count: project.vmInstances.length,
      running: project.vmInstances.filter(v => v.status === 'RUNNING').length,
      icon: <DnsIcon />,
      path: '/compute',
      color: '#1a73e8',
    },
    {
      title: 'VPC Networks',
      count: project.vpcNetworks.length,
      icon: <AccountTreeIcon />,
      path: '/vpc',
      color: '#34a853',
    },
    {
      title: 'Firewall Rules',
      count: project.firewallRules.length,
      icon: <SecurityIcon />,
      path: '/firewall',
      color: '#ea4335',
    },
    {
      title: 'Storage Buckets',
      count: project.storageBuckets.length,
      icon: <StorageIcon />,
      path: '/storage',
      color: '#fbbc04',
    },
    {
      title: 'BigQuery Datasets',
      count: project.bigqueryDatasets.length,
      icon: <TableChartIcon />,
      path: '/bigquery',
      color: '#4285f4',
    },
    {
      title: 'Load Balancers',
      count: project.loadBalancers.length,
      icon: <BalanceIcon />,
      path: '/load-balancing',
      color: '#9334e6',
    },
  ];

  return (
    <Box>
      {/* Project header */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>
          Project: {project.name}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip label={`ID: ${project.projectId}`} size="small" variant="outlined" />
          <Chip label={`Number: ${project.number}`} size="small" variant="outlined" />
          <Typography variant="caption" sx={{ color: '#80868b' }}>
            Created {new Date(project.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
      </Paper>

      {/* Resource cards */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Resources
      </Typography>
      <Grid container spacing={2}>
        {resourceCards.map((card) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={card.title}>
            <Card
              sx={{
                cursor: 'pointer',
                '&:hover': { boxShadow: '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)' },
                transition: 'box-shadow 0.2s',
                height: '100%',
              }}
              onClick={() => navigate(card.path)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                  <Box sx={{ color: card.color, mr: 1.5 }}>{card.icon}</Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {card.title}
                  </Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 400, color: card.color }}>
                  {card.count}
                </Typography>
                {'running' in card && card.running !== undefined && (
                  <Typography variant="caption" sx={{ color: '#5f6368' }}>
                    {card.running} running
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Dashboard;
