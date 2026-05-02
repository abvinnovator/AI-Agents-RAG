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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject, createDataset, createBqTable } from '../store/gcpStore';
import { GCP_REGIONS } from '../data/gcpData';

const BigQuery: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;

  const [dsDialogOpen, setDsDialogOpen] = useState(false);
  const [tblDialogOpen, setTblDialogOpen] = useState(false);
  const [selectedDsId, setSelectedDsId] = useState('');

  // Dataset form
  const [dsName, setDsName] = useState('');
  const [dsLocation, setDsLocation] = useState('US');

  // Table form
  const [tblName, setTblName] = useState('');
  const [tblSize, setTblSize] = useState(0);
  const [tblRows, setTblRows] = useState(0);

  const handleCreateDs = () => {
    if (!dsName.trim()) return;
    createDataset(dsName.trim(), dsLocation);
    setDsDialogOpen(false);
    setDsName('');
  };

  const handleCreateTbl = () => {
    if (!tblName.trim() || !selectedDsId) return;
    createBqTable(selectedDsId, tblName.trim(), tblSize, tblRows);
    setTblDialogOpen(false);
    setTblName('');
    setTblSize(0);
    setTblRows(0);
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
        <Typography variant="h5">BigQuery</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setDsName(''); setDsDialogOpen(true); }}
        >
          Create Dataset
        </Button>
      </Box>

      {project.bigqueryDatasets.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center', color: '#80868b' }}>
          <Typography>No datasets. Create one to get started.</Typography>
        </Paper>
      ) : (
        project.bigqueryDatasets.map((ds) => (
          <Accordion key={ds.id} defaultExpanded sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontWeight: 500 }}>{ds.name}</Typography>
                <Chip label={ds.location} size="small" variant="outlined" />
                <Typography variant="caption" sx={{ color: '#80868b' }}>
                  {ds.tables.length} tables
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => { setSelectedDsId(ds.id); setTblName(''); setTblDialogOpen(true); }}
                >
                  Create Table
                </Button>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Table</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Rows</TableCell>
                      <TableCell>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ds.tables.map((tbl) => (
                      <TableRow key={tbl.id} hover>
                        <TableCell sx={{ fontWeight: 500 }}>{tbl.name}</TableCell>
                        <TableCell>{tbl.sizeGb} GB</TableCell>
                        <TableCell>{tbl.rowCount.toLocaleString()}</TableCell>
                        <TableCell>{new Date(tbl.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {ds.tables.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ color: '#80868b' }}>
                          No tables
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

      {/* Create Dataset Dialog */}
      <Dialog open={dsDialogOpen} onClose={() => setDsDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create dataset</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Dataset ID" value={dsName} onChange={e => setDsName(e.target.value)} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Data location</InputLabel>
              <Select value={dsLocation} label="Data location" onChange={e => setDsLocation(e.target.value)}>
                <MenuItem value="US">US (multi-region)</MenuItem>
                <MenuItem value="EU">EU (multi-region)</MenuItem>
                {GCP_REGIONS.map(r => (
                  <MenuItem key={r.name} value={r.name}>{r.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDsDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateDs} disabled={!dsName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Create Table Dialog */}
      <Dialog open={tblDialogOpen} onClose={() => setTblDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create table</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Table name" value={tblName} onChange={e => setTblName(e.target.value)} fullWidth />
            <TextField
              label="Size (GB)"
              type="number"
              value={tblSize}
              onChange={e => setTblSize(Number(e.target.value))}
                 slotProps={{  htmlInput: { min: 0 } }}
            />
            <TextField
              label="Row count"
              type="number"
              value={tblRows}
              onChange={e => setTblRows(Number(e.target.value))}
              slotProps={{  htmlInput: { min: 0 } }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTblDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTbl} disabled={!tblName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BigQuery;
