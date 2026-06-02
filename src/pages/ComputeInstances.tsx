import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, TextField,
  MenuItem, FormControlLabel, Checkbox, Select, InputLabel, FormControl,
  Tabs, Tab, InputBase, List, ListItemButton, ListItemText, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useGcpStore } from '../hooks/useGcpStore';
import {
  findProject, createVmInstance, updateVmStatus, deleteVm,
} from '../store/gcpStore';
import { GCP_REGIONS, MACHINE_TYPES, DISK_TYPES, OS_IMAGES } from '../data/gcpData';
import { DnsOutlined } from '@mui/icons-material';

const statusColor: Record<string, 'success' | 'default' | 'error' | 'warning'> = {
  RUNNING: 'success', STOPPED: 'default', TERMINATED: 'error', STAGING: 'warning',
};

const SIDEBAR_ITEMS = [
  { label: 'VM instances', id: 'instances' },
  { label: 'Instance templates', id: 'templates' },
  { label: 'Machine images', id: 'images' },
  { label: 'Disks', id: 'disks', section: 'Storage' },
  { label: 'Snapshots', id: 'snapshots' },
  { label: 'Images', id: 'os-images' },
];

const CREATE_STEPS = [
  'Machine configuration', 'OS and storage', 'Networking', 'Security',
];

const ComputeInstances: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [activeSidebar, setActiveSidebar] = useState('instances');
  const [activeStep, setActiveStep] = useState(0);

  // Form state
  const [vmName, setVmName] = useState('');
  const [region, setRegion] = useState('us-central1');
  const [zone, setZone] = useState('us-central1-a');
  const [machineType, setMachineType] = useState('e2-medium');
  const [image, setImage] = useState('debian-12');
  const [diskType, setDiskType] = useState('pd-balanced');
  const [diskSize, setDiskSize] = useState(10);
  const [externalIp, setExternalIp] = useState(true);
  const [machineCategory, setMachineCategory] = useState('General Purpose');

  const selectedRegion = GCP_REGIONS.find(r => r.name === region);
  const zones = selectedRegion?.zones || [];
  const filteredMachines = MACHINE_TYPES.filter(m => m.category === machineCategory);
  const selectedMachine = MACHINE_TYPES.find(m => m.name === machineType);
  const monthlyEstimate = selectedMachine ? (selectedMachine.pricePerHour * 730) : 0;
  const diskMonthly = diskSize * (DISK_TYPES.find(d => d.name === diskType)?.pricePerGbMonth || 0.1);

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    const r = GCP_REGIONS.find(r => r.name === newRegion);
    if (r && r.zones.length > 0) setZone(r.zones[0]);
  };

  const resetForm = () => {
    setVmName(''); setRegion('us-central1'); setZone('us-central1-a');
    setMachineType('e2-medium'); setImage('debian-12'); setDiskType('pd-balanced');
    setDiskSize(10); setExternalIp(true); setActiveStep(0);
  };

  const handleCreate = () => {
    if (!vmName.trim() || !project) return;
    const network = project.vpcNetworks[0]?.name || 'default';
    createVmInstance({
      name: vmName.trim(), zone, machineType,
      bootDisk: { image, sizeGb: diskSize, type: diskType },
      networkInterface: { network, subnet: '', externalIp },
      labels: {},
    });
    setShowCreate(false); resetForm();
  };

  if (!project) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8, color: '#5f6368' }}>
        <Typography variant="h6">Select a project first</Typography>
      </Box>
    );
  }

  // ── CREATE INSTANCE PAGE ──
  if (showCreate) {
    return (
      <Box sx={{ display: 'flex', bgcolor: '#f8f9fa', minHeight: 'calc(100vh - 64px)' }}>
        {/* Left: Step Nav */}
        <Paper elevation={0} sx={{ width: 220, borderRight: '1px solid #dadce0', flexShrink: 0 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid #dadce0' }}>
            <IconButton size="small" onClick={() => { setShowCreate(false); resetForm(); }} sx={{ mr: 1 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography component="span" sx={{ fontWeight: 500, fontSize: '14px', color: '#202124' }}>
              Create an instance
            </Typography>
          </Box>
          <List dense sx={{ py: 1 }}>
            {CREATE_STEPS.map((step, i) => (
              <ListItemButton
                key={step} selected={activeStep === i}
                onClick={() => setActiveStep(i)}
                sx={{
                  py: 1, pl: 3, fontSize: '13px',
                  '&.Mui-selected': { bgcolor: '#e8f0fe', color: '#1a73e8', borderRight: '3px solid #1a73e8' },
                }}
              >
                <ListItemText primary={step} slotProps={{
            primary: {
              sx: {
                fontSize: '13px',
              },
            },
          }} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* Center: Config Form */}
        <Box sx={{ flex: 1, p: 3, overflow: 'auto' }}>
          <Typography sx={{ fontSize: '20px', fontWeight: 400, color: '#202124', mb: 3, fontFamily: '"Google Sans", sans-serif' }}>
            {CREATE_STEPS[activeStep]}
          </Typography>

          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 600 }}>
              <TextField label="Name" value={vmName} onChange={e => setVmName(e.target.value)} fullWidth size="small"
                helperText="Lowercase letters, numbers, and hyphens" />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Region</InputLabel>
                  <Select value={region} label="Region" onChange={e => handleRegionChange(e.target.value)}>
                    {GCP_REGIONS.map(r => (<MenuItem key={r.name} value={r.name}>{r.name} ({r.location})</MenuItem>))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Zone</InputLabel>
                  <Select value={zone} label="Zone" onChange={e => setZone(e.target.value)}>
                    {zones.map(z => (<MenuItem key={z} value={z}>{z}</MenuItem>))}
                  </Select>
                </FormControl>
              </Box>

              {/* Machine type category tabs */}
              <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#202124', mt: 1 }}>Machine type</Typography>
              <Tabs value={['General Purpose', 'Compute Optimized', 'Memory Optimized', 'Accelerator Optimized'].indexOf(machineCategory)}
                onChange={(_, v) => { const cats = ['General Purpose', 'Compute Optimized', 'Memory Optimized', 'Accelerator Optimized']; setMachineCategory(cats[v]); }}
                sx={{ '& .MuiTab-root': { textTransform: 'none', fontSize: '13px', minHeight: 40 } }}
              >
                <Tab label="General purpose" /> <Tab label="Compute optimized" /> <Tab label="Memory optimized" /> <Tab label="GPUs" />
              </Tabs>

              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                      <TableCell padding="checkbox" /> <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Series</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>vCPUs</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>Memory</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>$/hr</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredMachines.map(m => (
                      <TableRow key={m.name} hover selected={machineType === m.name}
                        onClick={() => setMachineType(m.name)} sx={{ cursor: 'pointer' }}>
                        <TableCell padding="checkbox">
                          <input type="radio" checked={machineType === m.name} readOnly style={{ accentColor: '#1a73e8' }} />
                        </TableCell>
                        <TableCell sx={{ fontSize: '13px', fontWeight: 500 }}>{m.name}</TableCell>
                        <TableCell sx={{ fontSize: '13px' }}>{m.vCPUs}</TableCell>
                        <TableCell sx={{ fontSize: '13px' }}>{m.memoryGb} GB</TableCell>
                        <TableCell sx={{ fontSize: '13px' }}>${m.pricePerHour}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 600 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Boot disk image</InputLabel>
                <Select value={image} label="Boot disk image" onChange={e => setImage(e.target.value)}>
                  {OS_IMAGES.map(img => (<MenuItem key={img.name} value={img.name}>{img.label}</MenuItem>))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Boot disk type</InputLabel>
                <Select value={diskType} label="Boot disk type" onChange={e => setDiskType(e.target.value)}>
                  {DISK_TYPES.map(d => (<MenuItem key={d.name} value={d.name}>{d.label} (${d.pricePerGbMonth}/GB/mo)</MenuItem>))}
                </Select>
              </FormControl>
              <TextField label="Boot disk size (GB)" type="number" size="small" value={diskSize}
                onChange={e => setDiskSize(Number(e.target.value))} slotProps={{ htmlInput: { min: 10, max: 65536 } }} />
            </Box>
          )}

          {activeStep === 2 && (
            <Box sx={{ maxWidth: 600 }}>
              <FormControlLabel control={<Checkbox checked={externalIp} onChange={e => setExternalIp(e.target.checked)} />}
                label={<Typography sx={{ fontSize: '14px' }}>Assign external IP address</Typography>} />
              <Typography variant="caption" sx={{ display: 'block', color: '#5f6368', ml: 4 }}>
                Network: {project.vpcNetworks[0]?.name || 'default'}
              </Typography>
            </Box>
          )}

          {activeStep === 3 && (
            <Typography sx={{ fontSize: '14px', color: '#5f6368' }}>
              Security settings use default GCP configurations. Service account and SSH keys can be configured after creation.
            </Typography>
          )}

          {/* Bottom actions */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2, borderTop: '1px solid #dadce0', pt: 2 }}>
            <Button variant="contained" onClick={handleCreate} disabled={!vmName.trim()}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500 }}>
              Create
            </Button>
            <Button onClick={() => { setShowCreate(false); resetForm(); }}
              sx={{ textTransform: 'none', color: '#1a73e8' }}>Cancel</Button>
          </Box>
        </Box>

        {/* Right: Pricing Panel */}
        <Paper elevation={0} sx={{ width: 260, p: 2.5, borderLeft: '1px solid #dadce0', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#202124', mb: 2 }}>Monthly estimate</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '13px', color: '#5f6368' }}>Compute ({selectedMachine?.name})</Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>${monthlyEstimate.toFixed(2)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '13px', color: '#5f6368' }}>Storage ({diskSize} GB)</Typography>
              <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>${diskMonthly.toFixed(2)}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#202124' }}>Total</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#1a73e8' }}>
                ${(monthlyEstimate + diskMonthly).toFixed(2)}/mo
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  }

  // ── VM INSTANCES LIST PAGE ──
  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {/* Left: Compute Engine Sidebar */}
      <Paper elevation={0} sx={{ width: 220, borderRight: '1px solid #dadce0', flexShrink: 0, py: 1 }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <DnsOutlined sx={{ fontSize: 18, color: '#5f6368' }} />
          <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#202124' }}>Compute Engine</Typography>
        </Box>
        <Divider />
        <List dense sx={{ py: 0.5 }}>
          {SIDEBAR_ITEMS.map((item) => (
            <React.Fragment key={item.id}>
              {item.section && (
                <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', px: 2, pt: 1.5, pb: 0.5, letterSpacing: '0.5px' }}>
                  {item.section.toUpperCase()}
                </Typography>
              )}
              <ListItemButton selected={activeSidebar === item.id} onClick={() => setActiveSidebar(item.id)}
                sx={{ py: 0.5, pl: 2.5, '&.Mui-selected': { bgcolor: '#e8f0fe', color: '#1a73e8' } }}>
                <ListItemText primary={item.label} slotProps={{
            primary: {
              sx: {
                fontSize: '13px',
              },
            },
          }} />
              </ListItemButton>
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontSize: '22px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>
            VM instances
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setShowCreate(true); }}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500, fontSize: '13px' }}>
              Create instance
            </Button>
            <IconButton size="small" sx={{ color: '#5f6368' }}><RefreshIcon fontSize="small" /></IconButton>
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
          sx={{ mb: 2, borderBottom: '1px solid #dadce0', '& .MuiTab-root': { textTransform: 'none', fontSize: '13px', minHeight: 40, fontWeight: 500 },
            '& .Mui-selected': { color: '#1a73e8' }, '& .MuiTabs-indicator': { bgcolor: '#1a73e8' } }}>
          <Tab label="Instances" /> <Tab label="Observability" /> <Tab label="Instance schedules" />
        </Tabs>

        {/* Table Card */}
        <Paper variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
          {/* Search bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid #dadce0', bgcolor: '#f8f9fa' }}>
            <SearchIcon sx={{ color: '#5f6368', mr: 1, fontSize: 20 }} />
            <InputBase placeholder="Filter VM instances" sx={{ fontSize: '13px', flex: 1 }} />
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Status</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Name</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Zone</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Machine type</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Internal IP</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>External IP</TableCell>
                <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {project.vmInstances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 8, textAlign: 'center' }}>
                    <CloudQueueIcon sx={{ fontSize: 48, color: '#dadce0', mb: 2 }} />
                    <Typography sx={{ color: '#5f6368', fontSize: '14px', mb: 0.5 }}>No VM instances</Typography>
                    <Typography sx={{ color: '#80868b', fontSize: '13px', mb: 2 }}>
                      Create an instance to get started with Compute Engine
                    </Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => { resetForm(); setShowCreate(true); }}
                      sx={{ textTransform: 'none', bgcolor: '#1a73e8', fontWeight: 500, fontSize: '13px' }}>
                      Create instance
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {project.vmInstances.map((vm) => (
                <TableRow key={vm.id} hover>
                  <TableCell><Chip label={vm.status} size="small" color={statusColor[vm.status]} variant="outlined"
                    sx={{ fontSize: '11px', height: 22 }} /></TableCell>
                  <TableCell sx={{ fontWeight: 500, fontSize: '13px', color: '#1a73e8', cursor: 'pointer' }}>{vm.name}</TableCell>
                  <TableCell sx={{ fontSize: '13px' }}>{vm.zone}</TableCell>
                  <TableCell sx={{ fontSize: '13px' }}>{vm.machineType}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    10.{Math.floor(Math.random() * 255)}.{Math.floor(Math.random() * 255)}.{Math.floor(Math.random() * 255)}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {vm.networkInterface.externalIp ? `34.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}` : '—'}
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
        </Paper>
      </Box>
    </Box>
  );
};

export default ComputeInstances;
