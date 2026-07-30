import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, FormControl, InputLabel, Select,
  MenuItem, Chip, InputBase, List, ListItemButton, ListItemText,
  Divider, IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HubIcon from '@mui/icons-material/Hub';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject, createVpc, createSubnet } from '../store/gcpStore';
import { GCP_REGIONS, VPC_SUBNET_MODES } from '../data/gcpData';

const VpcNetworks: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;
  const [showCreateVpc, setShowCreateVpc] = useState(false);
  const [showCreateSubnet, setShowCreateSubnet] = useState(false);
  const [selectedVpcId, setSelectedVpcId] = useState('');
  const [vpcName, setVpcName] = useState('');
  const [subnetMode, setSubnetMode] = useState<'Auto' | 'Custom'>('Auto');
  const [subnetName, setSubnetName] = useState('');
  const [subnetRegion, setSubnetRegion] = useState('us-central1');
  const [subnetCidr, setSubnetCidr] = useState('10.0.0.0/24');

  const handleCreateVpc = () => {
    if (!vpcName.trim()) return;
    createVpc(vpcName.trim(), subnetMode);
    setShowCreateVpc(false); setVpcName(''); setSubnetMode('Auto');
  };

  const handleCreateSubnet = () => {
    if (!subnetName.trim() || !selectedVpcId) return;
    createSubnet(selectedVpcId, subnetName.trim(), subnetRegion, subnetCidr);
    setShowCreateSubnet(false); setSubnetName(''); setSubnetCidr('10.0.0.0/24');
  };

  if (!project) return (<Box sx={{ textAlign: 'center', mt: 8, color: '#5f6368' }}><Typography variant="h6">Select a project first</Typography></Box>);

  if (showCreateVpc) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton size="small" onClick={() => setShowCreateVpc(false)}><ArrowBackIcon fontSize="small" /></IconButton>
          <Typography sx={{ fontSize: '20px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>Create a VPC network</Typography>
        </Box>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Name" value={vpcName} onChange={e => setVpcName(e.target.value)} fullWidth size="small" />
          <FormControl fullWidth size="small"><InputLabel>Subnet creation mode</InputLabel>
            <Select value={subnetMode} label="Subnet creation mode" onChange={e => setSubnetMode(e.target.value as 'Auto' | 'Custom')}>
              {VPC_SUBNET_MODES.map(m => (<MenuItem key={m} value={m}>{m}</MenuItem>))}
            </Select>
          </FormControl>
          {subnetMode === 'Auto' && <Typography variant="caption" sx={{ color: '#5f6368' }}>Auto mode creates subnets in each region automatically.</Typography>}
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button variant="contained" onClick={handleCreateVpc} disabled={!vpcName.trim()}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500 }}>Create</Button>
            <Button onClick={() => setShowCreateVpc(false)} sx={{ textTransform: 'none', color: '#1a73e8' }}>Cancel</Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  if (showCreateSubnet) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton size="small" onClick={() => setShowCreateSubnet(false)}><ArrowBackIcon fontSize="small" /></IconButton>
          <Typography sx={{ fontSize: '20px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>Add subnet</Typography>
        </Box>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Subnet name" value={subnetName} onChange={e => setSubnetName(e.target.value)} fullWidth size="small" />
          <FormControl fullWidth size="small"><InputLabel>Region</InputLabel>
            <Select value={subnetRegion} label="Region" onChange={e => setSubnetRegion(e.target.value)}>
              {GCP_REGIONS.map(r => (<MenuItem key={r.name} value={r.name}>{r.name} ({r.location})</MenuItem>))}
            </Select>
          </FormControl>
          <TextField label="IP range (CIDR)" value={subnetCidr} onChange={e => setSubnetCidr(e.target.value)} fullWidth size="small" helperText="e.g., 10.0.0.0/24" />
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button variant="contained" onClick={handleCreateSubnet} disabled={!subnetName.trim()}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500 }}>Add</Button>
            <Button onClick={() => setShowCreateSubnet(false)} sx={{ textTransform: 'none', color: '#1a73e8' }}>Cancel</Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      <Paper elevation={0} sx={{ width: 220, borderRight: '1px solid #dadce0', flexShrink: 0, py: 1 }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountTreeIcon sx={{ fontSize: 18, color: '#5f6368' }} />
          <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#202124' }}>VPC Network</Typography>
        </Box>
        <Divider />
        <List dense sx={{ py: 0.5 }}>
          {['VPC networks', 'Subnets', 'IP addresses', 'Routes'].map((item, i) => (
            <ListItemButton key={item} selected={i === 0} sx={{ py: 0.5, pl: 2.5, '&.Mui-selected': { bgcolor: '#e8f0fe', color: '#1a73e8' } }}>
              <ListItemText primary={item} slotProps={{ primary: { sx: { fontSize: '13px' } } }} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
      <Box sx={{ flex: 1, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontSize: '22px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>VPC networks</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setVpcName(''); setShowCreateVpc(true); }}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500, fontSize: '13px' }}>Create VPC network</Button>
            <IconButton size="small" sx={{ color: '#5f6368' }}><RefreshIcon fontSize="small" /></IconButton>
          </Box>
        </Box>
        <Paper variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid #dadce0', bgcolor: '#f8f9fa' }}>
            <SearchIcon sx={{ color: '#5f6368', mr: 1, fontSize: 20 }} />
            <InputBase placeholder="Filter VPC networks" sx={{ fontSize: '13px', flex: 1 }} />
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Name</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Mode</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Subnets</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {project.vpcNetworks.length === 0 && (
                <TableRow><TableCell colSpan={4} sx={{ py: 8, textAlign: 'center' }}>
                  <HubIcon sx={{ fontSize: 48, color: '#dadce0', mb: 2 }} />
                  <Typography sx={{ color: '#5f6368', fontSize: '14px' }}>No VPC networks</Typography>
                </TableCell></TableRow>
              )}
              {project.vpcNetworks.map(vpc => (
                <React.Fragment key={vpc.id}>
                  <TableRow hover>
                    <TableCell sx={{ fontWeight: 500, fontSize: '13px', color: '#1a73e8', cursor: 'pointer' }}>{vpc.name}</TableCell>
                    <TableCell><Chip label={vpc.subnetMode} size="small" variant="outlined" sx={{ fontSize: '11px', height: 22 }} /></TableCell>
                    <TableCell sx={{ fontSize: '13px' }}>{vpc.subnets.length}</TableCell>
                    <TableCell>
                      {vpc.subnetMode === 'Custom' && (
                        <Button size="small" startIcon={<AddIcon />} onClick={() => { setSelectedVpcId(vpc.id); setShowCreateSubnet(true); }}
                          sx={{ textTransform: 'none', fontSize: '12px', color: '#1a73e8' }}>Add subnet</Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {vpc.subnets.map(s => (
                    <TableRow key={s.id} sx={{ bgcolor: '#fafafa' }}>
                      <TableCell sx={{ pl: 4, fontSize: '12px', color: '#5f6368' }}>└ {s.name}</TableCell>
                      <TableCell sx={{ fontSize: '12px', color: '#5f6368' }}>{s.region}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>{s.ipCidrRange}</TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
};

export default VpcNetworks;
