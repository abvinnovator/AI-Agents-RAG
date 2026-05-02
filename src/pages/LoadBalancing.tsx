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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject, createLoadBalancer } from '../store/gcpStore';
import { GCP_REGIONS, LOAD_BALANCER_TYPES } from '../data/gcpData';

const LoadBalancing: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;
  const [dialogOpen, setDialogOpen] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('HTTP(S)');
  const [region, setRegion] = useState('us-central1');
  const [backends, setBackends] = useState<string[]>([]);

  const handleCreate = () => {
    if (!name.trim()) return;
    createLoadBalancer({ name: name.trim(), type, region, backends });
    setDialogOpen(false);
    setName('');
    setBackends([]);
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
        <Typography variant="h5">Load Balancing</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setName(''); setBackends([]); setDialogOpen(true); }}
        >
          Create Load Balancer
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Region</TableCell>
              <TableCell>Backends</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {project.loadBalancers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No load balancers.
                </TableCell>
              </TableRow>
            )}
            {project.loadBalancers.map((lb) => (
              <TableRow key={lb.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{lb.name}</TableCell>
                <TableCell><Chip label={lb.type} size="small" variant="outlined" /></TableCell>
                <TableCell>{lb.region}</TableCell>
                <TableCell>
                  {lb.backends.length > 0
                    ? lb.backends.map(bId => {
                        const vm = project.vmInstances.find(v => v.id === bId);
                        return vm?.name || bId;
                      }).join(', ')
                    : '—'}
                </TableCell>
                <TableCell>{new Date(lb.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create a load balancer</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Name" value={name} onChange={e => setName(e.target.value)} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select value={type} label="Type" onChange={e => setType(e.target.value)}>
                {LOAD_BALANCER_TYPES.map(t => (
                  <MenuItem key={t.name} value={t.name}>
                    {t.name} — {t.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Region</InputLabel>
              <Select value={region} label="Region" onChange={e => setRegion(e.target.value)}>
                {GCP_REGIONS.map(r => (
                  <MenuItem key={r.name} value={r.name}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {project.vmInstances.length > 0 && (
              <FormControl fullWidth>
                <InputLabel>Backend VMs</InputLabel>
                <Select
                  multiple
                  value={backends}
                  label="Backend VMs"
                  onChange={e => setBackends(e.target.value as string[])}
                  renderValue={(selected) =>
                    selected.map(id => project.vmInstances.find(v => v.id === id)?.name || id).join(', ')
                  }
                >
                  {project.vmInstances.map(vm => (
                    <MenuItem key={vm.id} value={vm.id}>{vm.name} ({vm.zone})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!name.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LoadBalancing;
