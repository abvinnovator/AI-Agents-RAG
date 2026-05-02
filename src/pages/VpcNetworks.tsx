import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject, createVpc, createSubnet } from '../store/gcpStore';
import { GCP_REGIONS, VPC_SUBNET_MODES } from '../data/gcpData';

const VpcNetworks: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;

  const [vpcDialogOpen, setVpcDialogOpen] = useState(false);
  const [subnetDialogOpen, setSubnetDialogOpen] = useState(false);
  const [selectedVpcId, setSelectedVpcId] = useState('');

  // VPC form
  const [vpcName, setVpcName] = useState('');
  const [subnetMode, setSubnetMode] = useState<'Auto' | 'Custom'>('Auto');

  // Subnet form
  const [subnetName, setSubnetName] = useState('');
  const [subnetRegion, setSubnetRegion] = useState('us-central1');
  const [subnetCidr, setSubnetCidr] = useState('10.0.0.0/24');

  const handleCreateVpc = () => {
    if (!vpcName.trim()) return;
    createVpc(vpcName.trim(), subnetMode);
    setVpcDialogOpen(false);
    setVpcName('');
    setSubnetMode('Auto');
  };

  const handleCreateSubnet = () => {
    if (!subnetName.trim() || !selectedVpcId) return;
    createSubnet(selectedVpcId, subnetName.trim(), subnetRegion, subnetCidr);
    setSubnetDialogOpen(false);
    setSubnetName('');
    setSubnetCidr('10.0.0.0/24');
  };

  if (!project) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8, color: '#5f6368' }}>
        <Typography variant="h6">Select a project first</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">VPC Networks</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setVpcDialogOpen(true)}
        >
          Create VPC Network
        </Button>
      </Box>

      {project.vpcNetworks.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', color: '#80868b' }}>
          <Typography>No VPC networks. Create one to get started.</Typography>
        </Paper>
      ) : (
        project.vpcNetworks.map((vpc) => (
          <Accordion key={vpc.id} defaultExpanded sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontWeight: 500 }}>{vpc.name}</Typography>
                <Chip
                  label={vpc.subnetMode}
                  size="small"
                  variant="outlined"
                  color={vpc.subnetMode === 'Auto' ? 'primary' : 'secondary'}
                />
                <Typography variant="caption" sx={{ color: '#80868b' }}>
                  {vpc.subnets.length} subnets
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                {vpc.subnetMode === 'Custom' && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      setSelectedVpcId(vpc.id);
                      setSubnetDialogOpen(true);
                    }}
                  >
                    Add Subnet
                  </Button>
                )}
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Region</TableCell>
                      <TableCell>IP Range</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vpc.subnets.map((subnet) => (
                      <TableRow key={subnet.id} hover>
                        <TableCell>{subnet.name}</TableCell>
                        <TableCell>{subnet.region}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {subnet.ipCidrRange}
                        </TableCell>
                      </TableRow>
                    ))}
                    {vpc.subnets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ color: '#80868b' }}>
                          No subnets
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* Create VPC Dialog */}
      <Dialog open={vpcDialogOpen} onClose={() => setVpcDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create a VPC network</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={vpcName}
              onChange={e => setVpcName(e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Subnet creation mode</InputLabel>
              <Select
                value={subnetMode}
                label="Subnet creation mode"
                onChange={e => setSubnetMode(e.target.value as 'Auto' | 'Custom')}
              >
                {VPC_SUBNET_MODES.map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {subnetMode === 'Auto' && (
              <Typography variant="caption" sx={{ color: '#5f6368' }}>
                Auto mode creates subnets in each region automatically.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVpcDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateVpc} disabled={!vpcName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Subnet Dialog */}
      <Dialog open={subnetDialogOpen} onClose={() => setSubnetDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add subnet</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Subnet name"
              value={subnetName}
              onChange={e => setSubnetName(e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Region</InputLabel>
              <Select value={subnetRegion} label="Region" onChange={e => setSubnetRegion(e.target.value)}>
                {GCP_REGIONS.map(r => (
                  <MenuItem key={r.name} value={r.name}>{r.name} ({r.location})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="IP range (CIDR)"
              value={subnetCidr}
              onChange={e => setSubnetCidr(e.target.value)}
              fullWidth
              helperText="e.g., 10.0.0.0/24"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSubnetDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateSubnet} disabled={!subnetName.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VpcNetworks;
