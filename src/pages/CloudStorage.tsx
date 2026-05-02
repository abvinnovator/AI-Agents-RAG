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
  IconButton,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject, createBucket, deleteBucket } from '../store/gcpStore';
import { GCP_REGIONS, STORAGE_CLASSES } from '../data/gcpData';

const CloudStorage: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;
  const [dialogOpen, setDialogOpen] = useState(false);

  const [bucketName, setBucketName] = useState('');
  const [location, setLocation] = useState('us-central1');
  const [storageClass, setStorageClass] = useState('STANDARD');
  const [sizeGb, setSizeGb] = useState(0);

  const handleCreate = () => {
    if (!bucketName.trim()) return;
    createBucket({
      name: bucketName.trim(),
      location,
      storageClass,
      sizeGb,
      labels: {},
    });
    setDialogOpen(false);
    setBucketName('');
    setSizeGb(0);
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
        <Typography variant="h5">Cloud Storage — Buckets</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setBucketName(''); setSizeGb(0); setDialogOpen(true); }}
        >
          Create Bucket
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Storage Class</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {project.storageBuckets.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No buckets. Click "Create Bucket" to get started.
                </TableCell>
              </TableRow>
            )}
            {project.storageBuckets.map((bucket) => (
              <TableRow key={bucket.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{bucket.name}</TableCell>
                <TableCell>{bucket.location}</TableCell>
                <TableCell>
                  <Chip label={bucket.storageClass} size="small" variant="outlined" />
                </TableCell>
                <TableCell>{bucket.sizeGb} GB</TableCell>
                <TableCell>{new Date(bucket.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => deleteBucket(bucket.id)} sx={{ color: '#d93025' }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create a bucket</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Bucket name"
              value={bucketName}
              onChange={e => setBucketName(e.target.value)}
              fullWidth
              helperText="Globally unique name"
            />
            <FormControl fullWidth>
              <InputLabel>Location</InputLabel>
              <Select value={location} label="Location" onChange={e => setLocation(e.target.value)}>
                {GCP_REGIONS.map(r => (
                  <MenuItem key={r.name} value={r.name}>{r.name} ({r.location})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Default storage class</InputLabel>
              <Select value={storageClass} label="Default storage class" onChange={e => setStorageClass(e.target.value)}>
                {STORAGE_CLASSES.map(sc => (
                  <MenuItem key={sc.name} value={sc.name}>
                    {sc.label} (${sc.pricePerGbMonth}/GB/mo)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Initial size (GB)"
              type="number"
              value={sizeGb}
              onChange={e => setSizeGb(Number(e.target.value))}
                slotProps={{  htmlInput: { min: 0 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!bucketName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CloudStorage;
