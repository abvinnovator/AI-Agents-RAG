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
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Select,
  InputLabel,
  FormControl,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import { useGcpStore } from '../hooks/useGcpStore';
import {
  findProject,
  createVmInstance,
  updateVmStatus,
  deleteVm,
} from '../store/gcpStore';
import {
  GCP_REGIONS,
  MACHINE_TYPES,
  DISK_TYPES,
  OS_IMAGES,
} from '../data/gcpData';

const statusColor: Record<string, 'success' | 'default' | 'error' | 'warning'> = {
  RUNNING: 'success',
  STOPPED: 'default',
  TERMINATED: 'error',
  STAGING: 'warning',
};

const ComputeInstances: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [vmName, setVmName] = useState('');
  const [region, setRegion] = useState('us-central1');
  const [zone, setZone] = useState('us-central1-a');
  const [machineType, setMachineType] = useState('e2-medium');
  const [image, setImage] = useState('debian-12');
  const [diskType, setDiskType] = useState('pd-balanced');
  const [diskSize, setDiskSize] = useState(10);
  const [externalIp, setExternalIp] = useState(true);

  const selectedRegion = GCP_REGIONS.find(r => r.name === region);
  const zones = selectedRegion?.zones || [];

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    const r = GCP_REGIONS.find(r => r.name === newRegion);
    if (r && r.zones.length > 0) setZone(r.zones[0]);
  };

  const resetForm = () => {
    setVmName('');
    setRegion('us-central1');
    setZone('us-central1-a');
    setMachineType('e2-medium');
    setImage('debian-12');
    setDiskType('pd-balanced');
    setDiskSize(10);
    setExternalIp(true);
  };

  const handleCreate = () => {
    if (!vmName.trim() || !project) return;
    const network = project.vpcNetworks[0]?.name || 'default';
    createVmInstance({
      name: vmName.trim(),
      zone,
      machineType,
      bootDisk: { image, sizeGb: diskSize, type: diskType },
      networkInterface: { network, subnet: '', externalIp },
      labels: {},
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

  const selectedMachineInfo = MACHINE_TYPES.find(m => m.name === machineType);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">VM Instances</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { resetForm(); setDialogOpen(true); }}
        >
          Create Instance
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Zone</TableCell>
              <TableCell>Machine Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Internal IP</TableCell>
              <TableCell>External IP</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {project.vmInstances.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No VM instances. Click "Create Instance" to get started.
                </TableCell>
              </TableRow>
            )}
            {project.vmInstances.map((vm) => (
              <TableRow key={vm.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{vm.name}</TableCell>
                <TableCell>{vm.zone}</TableCell>
                <TableCell>{vm.machineType}</TableCell>
                <TableCell>
                  <Chip
                    label={vm.status}
                    size="small"
                    color={statusColor[vm.status]}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  10.{Math.floor(Math.random() * 255)}.{Math.floor(Math.random() * 255)}.{Math.floor(Math.random() * 255)}
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {vm.networkInterface.externalIp
                    ? `34.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
                    : '—'}
                </TableCell>
                <TableCell align="right">
                  {vm.status === 'RUNNING' && (
                    <IconButton size="small" onClick={() => updateVmStatus(vm.id, 'STOPPED')} title="Stop">
                      <StopIcon fontSize="small" />
                    </IconButton>
                  )}
                  {vm.status === 'STOPPED' && (
                    <IconButton size="small" onClick={() => updateVmStatus(vm.id, 'RUNNING')} title="Start">
                      <PlayArrowIcon fontSize="small" color="success" />
                    </IconButton>
                  )}
                  <IconButton size="small" onClick={() => deleteVm(vm.id)} title="Delete" sx={{ color: '#d93025' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create VM Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create a VM instance</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={vmName}
              onChange={e => setVmName(e.target.value)}
              fullWidth
              helperText="Lowercase letters, numbers, and hyphens"
            />

            <FormControl fullWidth>
              <InputLabel>Region</InputLabel>
              <Select value={region} label="Region" onChange={e => handleRegionChange(e.target.value)}>
                {GCP_REGIONS.map(r => (
                  <MenuItem key={r.name} value={r.name}>
                    {r.name} ({r.location})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Zone</InputLabel>
              <Select value={zone} label="Zone" onChange={e => setZone(e.target.value)}>
                {zones.map(z => (
                  <MenuItem key={z} value={z}>{z}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Machine type</InputLabel>
              <Select value={machineType} label="Machine type" onChange={e => setMachineType(e.target.value)}>
                {MACHINE_TYPES.map(m => (
                  <MenuItem key={m.name} value={m.name}>
                    {m.name} ({m.vCPUs} vCPU, {m.memoryGb} GB) — ${m.pricePerHour}/hr
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedMachineInfo && (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f8f9fa' }}>
                <Typography variant="caption" sx={{ color: '#5f6368' }}>
                  {selectedMachineInfo.category} • {selectedMachineInfo.vCPUs} vCPUs • {selectedMachineInfo.memoryGb} GB memory
                  • Est. ${(selectedMachineInfo.pricePerHour * 730).toFixed(2)}/month
                </Typography>
              </Paper>
            )}

            <FormControl fullWidth>
              <InputLabel>Boot disk image</InputLabel>
              <Select value={image} label="Boot disk image" onChange={e => setImage(e.target.value)}>
                {OS_IMAGES.map(img => (
                  <MenuItem key={img.name} value={img.name}>{img.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Boot disk type</InputLabel>
              <Select value={diskType} label="Boot disk type" onChange={e => setDiskType(e.target.value)}>
                {DISK_TYPES.map(d => (
                  <MenuItem key={d.name} value={d.name}>
                    {d.label} (${d.pricePerGbMonth}/GB/mo)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Boot disk size (GB)"
              type="number"
              value={diskSize}
              onChange={e => setDiskSize(Number(e.target.value))}
              slotProps={{ htmlInput: { min: 10, max: 65536 } }}
            />

            <FormControlLabel
              control={<Checkbox checked={externalIp} onChange={e => setExternalIp(e.target.checked)} />}
              label="Assign external IP"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!vmName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComputeInstances;
