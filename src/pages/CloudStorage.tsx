import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
   TableHead, TableRow, TextField, FormControl,
  InputLabel, Select, MenuItem, IconButton, Chip, InputBase,
  List, ListItemButton, ListItemText, Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import StorageIcon from '@mui/icons-material/Storage';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject, createBucket, deleteBucket } from '../store/gcpStore';
import { GCP_REGIONS, STORAGE_CLASSES } from '../data/gcpData';

const SIDEBAR_ITEMS = [
  { label: 'Buckets', id: 'buckets' },
  { label: 'Monitoring', id: 'monitoring' },
  { label: 'Settings', id: 'settings', section: 'Configuration' },
  { label: 'Transfer', id: 'transfer' },
];

const CloudStorage: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;
  const [showCreate, setShowCreate] = useState(false);
  const [bucketName, setBucketName] = useState('');
  const [location, setLocation] = useState('us-central1');
  const [storageClass, setStorageClass] = useState('STANDARD');
  const [sizeGb, setSizeGb] = useState(0);

  const handleCreate = () => {
    if (!bucketName.trim()) return;
    createBucket({ name: bucketName.trim(), location, storageClass, sizeGb, labels: {} });
    setShowCreate(false); setBucketName(''); setSizeGb(0);
  };

  if (!project) {
    return (<Box sx={{ textAlign: 'center', mt: 8, color: '#5f6368' }}><Typography variant="h6">Select a project first</Typography></Box>);
  }

  if (showCreate) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton size="small" onClick={() => setShowCreate(false)}><ArrowBackIcon fontSize="small" /></IconButton>
          <Typography sx={{ fontSize: '20px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>Create a bucket</Typography>
        </Box>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Bucket name" value={bucketName} onChange={e => setBucketName(e.target.value)} fullWidth size="small" helperText="Globally unique name" />
          <FormControl fullWidth size="small"><InputLabel>Location</InputLabel>
            <Select value={location} label="Location" onChange={e => setLocation(e.target.value)}>
              {GCP_REGIONS.map(r => (<MenuItem key={r.name} value={r.name}>{r.name} ({r.location})</MenuItem>))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small"><InputLabel>Default storage class</InputLabel>
            <Select value={storageClass} label="Default storage class" onChange={e => setStorageClass(e.target.value)}>
              {STORAGE_CLASSES.map(sc => (<MenuItem key={sc.name} value={sc.name}>{sc.label} (${sc.pricePerGbMonth}/GB/mo)</MenuItem>))}
            </Select>
          </FormControl>
          <TextField label="Initial size (GB)" type="number" size="small" value={sizeGb} onChange={e => setSizeGb(Number(e.target.value))} slotProps={{ htmlInput: { min: 0 } }} />
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button variant="contained" onClick={handleCreate} disabled={!bucketName.trim()}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500 }}>Create</Button>
            <Button onClick={() => setShowCreate(false)} sx={{ textTransform: 'none', color: '#1a73e8' }}>Cancel</Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      <Paper elevation={0} sx={{ width: 220, borderRight: '1px solid #dadce0', flexShrink: 0, py: 1 }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <StorageIcon sx={{ fontSize: 18, color: '#5f6368' }} />
          <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#202124' }}>Cloud Storage</Typography>
        </Box>
        <Divider />
        <List dense sx={{ py: 0.5 }}>
          {SIDEBAR_ITEMS.map(item => (
            <React.Fragment key={item.id}>
              {item.section && <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', px: 2, pt: 1.5, pb: 0.5, letterSpacing: '0.5px' }}>{item.section.toUpperCase()}</Typography>}
              <ListItemButton selected={item.id === 'buckets'} sx={{ py: 0.5, pl: 2.5, '&.Mui-selected': { bgcolor: '#e8f0fe', color: '#1a73e8' } }}>
                <ListItemText
          primary={item.label}
          slotProps={{
            primary: {
              sx: {
                fontSize: '13px',
              },
            },
          }}
        />
              </ListItemButton>
            </React.Fragment>
          ))}
        </List>
      </Paper>
      <Box sx={{ flex: 1, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontSize: '22px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>Buckets</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setBucketName(''); setSizeGb(0); setShowCreate(true); }}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500, fontSize: '13px' }}>Create</Button>
            <IconButton size="small" sx={{ color: '#5f6368' }}><RefreshIcon fontSize="small" /></IconButton>
          </Box>
        </Box>
        <Paper variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid #dadce0', bgcolor: '#f8f9fa' }}>
            <SearchIcon sx={{ color: '#5f6368', mr: 1, fontSize: 20 }} />
            <InputBase placeholder="Filter buckets" sx={{ fontSize: '13px', flex: 1 }} />
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Name</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Location</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Storage class</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Size</TableCell>
                <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Created</TableCell>
                <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {project.storageBuckets.length === 0 && (
                <TableRow><TableCell colSpan={6} sx={{ py: 8, textAlign: 'center' }}>
                  <FolderOpenIcon sx={{ fontSize: 48, color: '#dadce0', mb: 2 }} />
                  <Typography sx={{ color: '#5f6368', fontSize: '14px', mb: 0.5 }}>No buckets</Typography>
                  <Typography sx={{ color: '#80868b', fontSize: '13px' }}>Create a bucket to start storing objects</Typography>
                </TableCell></TableRow>
              )}
              {project.storageBuckets.map(bucket => (
                <TableRow key={bucket.id} hover>
                  <TableCell sx={{ fontWeight: 500, fontSize: '13px', color: '#1a73e8', cursor: 'pointer' }}>{bucket.name}</TableCell>
                  <TableCell sx={{ fontSize: '13px' }}>{bucket.location}</TableCell>
                  <TableCell><Chip label={bucket.storageClass} size="small" variant="outlined" sx={{ fontSize: '11px', height: 22 }} /></TableCell>
                  <TableCell sx={{ fontSize: '13px' }}>{bucket.sizeGb} GB</TableCell>
                  <TableCell sx={{ fontSize: '13px' }}>{new Date(bucket.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => deleteBucket(bucket.id)} sx={{ color: '#d93025' }}><DeleteIcon fontSize="small" /></IconButton>
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

export default CloudStorage;
