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
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject, createFirewallRule, deleteFirewallRule } from '../store/gcpStore';
import { FIREWALL_PROTOCOLS } from '../data/gcpData';

const FirewallRules: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;
  const [dialogOpen, setDialogOpen] = useState(false);

  const [name, setName] = useState('');
  const [network, setNetwork] = useState('');
  const [direction, setDirection] = useState<'INGRESS' | 'EGRESS'>('INGRESS');
  const [priority, setPriority] = useState(1000);
  const [action, setAction] = useState<'ALLOW' | 'DENY'>('ALLOW');
  const [protocol, setProtocol] = useState('tcp');
  const [ports, setPorts] = useState('80,443');
  const [sourceRanges, setSourceRanges] = useState('0.0.0.0/0');

  const resetForm = () => {
    setName('');
    setNetwork('');
    setDirection('INGRESS');
    setPriority(1000);
    setAction('ALLOW');
    setProtocol('tcp');
    setPorts('80,443');
    setSourceRanges('0.0.0.0/0');
  };

  const handleCreate = () => {
    if (!name.trim() || !network || !project) return;
    createFirewallRule({
      name: name.trim(),
      network,
      direction,
      priority,
      action,
      protocol,
      ports,
      sourceRanges,
    });
    setDialogOpen(false);
    resetForm();
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
        <Typography variant="h5">Firewall Rules</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { resetForm(); setDialogOpen(true); }}
          disabled={project.vpcNetworks.length === 0}
        >
          Create Firewall Rule
        </Button>
      </Box>

      {project.vpcNetworks.length === 0 && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: '#fef7e0' }}>
          <Typography variant="body2" sx={{ color: '#e37400' }}>
            Create a VPC network first before adding firewall rules.
          </Typography>
        </Paper>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Network</TableCell>
              <TableCell>Direction</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Protocols/Ports</TableCell>
              <TableCell>Source</TableCell>
              <TableCell align="right">Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {project.firewallRules.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No firewall rules.
                </TableCell>
              </TableRow>
            )}
            {project.firewallRules.map((rule) => (
              <TableRow key={rule.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{rule.name}</TableCell>
                <TableCell>{rule.network}</TableCell>
                <TableCell>
                  <Chip label={rule.direction} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{rule.priority}</TableCell>
                <TableCell>
                  <Chip
                    label={rule.action}
                    size="small"
                    color={rule.action === 'ALLOW' ? 'success' : 'error'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {rule.protocol}:{rule.ports}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {rule.sourceRanges}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => deleteFirewallRule(rule.id)} sx={{ color: '#d93025' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create a firewall rule</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Name" value={name} onChange={e => setName(e.target.value)} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Network</InputLabel>
              <Select value={network} label="Network" onChange={e => setNetwork(e.target.value)}>
                {project.vpcNetworks.map(v => (
                  <MenuItem key={v.id} value={v.name}>{v.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Direction</InputLabel>
              <Select value={direction} label="Direction" onChange={e => setDirection(e.target.value as 'INGRESS' | 'EGRESS')}>
                <MenuItem value="INGRESS">Ingress</MenuItem>
                <MenuItem value="EGRESS">Egress</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Priority"
              type="number"
              value={priority}
              onChange={e => setPriority(Number(e.target.value))}
              slotProps={{ htmlInput: { min: 0, max: 65535 } }}
              helperText="0 (highest) to 65535 (lowest)"
            />
            <FormControl fullWidth>
              <InputLabel>Action</InputLabel>
              <Select value={action} label="Action" onChange={e => setAction(e.target.value as 'ALLOW' | 'DENY')}>
                <MenuItem value="ALLOW">Allow</MenuItem>
                <MenuItem value="DENY">Deny</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Protocol</InputLabel>
              <Select value={protocol} label="Protocol" onChange={e => setProtocol(e.target.value)}>
                {FIREWALL_PROTOCOLS.map(p => (
                  <MenuItem key={p} value={p}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Ports"
              value={ports}
              onChange={e => setPorts(e.target.value)}
              helperText="Comma-separated, e.g. 80,443,8080"
            />
            <TextField
              label="Source IP ranges"
              value={sourceRanges}
              onChange={e => setSourceRanges(e.target.value)}
              helperText="CIDR, e.g. 0.0.0.0/0"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!name.trim() || !network}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FirewallRules;
