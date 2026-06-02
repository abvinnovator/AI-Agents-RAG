import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, FormControl, InputLabel, Select,
  MenuItem, Chip, InputBase, List, ListItemButton, ListItemText,
  Divider, IconButton, Collapse,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import TableChartIcon from '@mui/icons-material/TableChart';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import DatasetIcon from '@mui/icons-material/Dataset';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject, createDataset, createBqTable } from '../store/gcpStore';
import { GCP_REGIONS } from '../data/gcpData';

const BigQuery: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;
  const [showCreateDs, setShowCreateDs] = useState(false);
  const [showCreateTbl, setShowCreateTbl] = useState(false);
  const [selectedDsId, setSelectedDsId] = useState('');
  const [expandedDs, setExpandedDs] = useState<string[]>([]);
  const [dsName, setDsName] = useState('');
  const [dsLocation, setDsLocation] = useState('US');
  const [tblName, setTblName] = useState('');
  const [tblSize, setTblSize] = useState(0);
  const [tblRows, setTblRows] = useState(0);

  const handleCreateDs = () => {
    if (!dsName.trim()) return;
    createDataset({ name: dsName.trim(), location: dsLocation, tables: [] });
    setShowCreateDs(false); setDsName('');
  };

  const handleCreateTbl = () => {
    if (!tblName.trim() || !selectedDsId) return;
    createBqTable(selectedDsId, { name: tblName.trim(), sizeGb: tblSize, numRows: tblRows, schema: [] });
    setShowCreateTbl(false); setTblName(''); setTblSize(0); setTblRows(0);
  };

  const toggleDs = (id: string) => {
    setExpandedDs(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  if (!project) {
    return (<Box sx={{ textAlign: 'center', mt: 8, color: '#5f6368' }}><Typography variant="h6">Select a project first</Typography></Box>);
  }

  if (showCreateDs) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton size="small" onClick={() => setShowCreateDs(false)}><ArrowBackIcon fontSize="small" /></IconButton>
          <Typography sx={{ fontSize: '20px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>Create dataset</Typography>
        </Box>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Dataset ID" value={dsName} onChange={e => setDsName(e.target.value)} fullWidth size="small" />
          <FormControl fullWidth size="small"><InputLabel>Data location</InputLabel>
            <Select value={dsLocation} label="Data location" onChange={e => setDsLocation(e.target.value)}>
              <MenuItem value="US">US (multi-region)</MenuItem>
              <MenuItem value="EU">EU (multi-region)</MenuItem>
              {GCP_REGIONS.map(r => (<MenuItem key={r.name} value={r.name}>{r.name}</MenuItem>))}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button variant="contained" onClick={handleCreateDs} disabled={!dsName.trim()}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500 }}>Create dataset</Button>
            <Button onClick={() => setShowCreateDs(false)} sx={{ textTransform: 'none', color: '#1a73e8' }}>Cancel</Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  if (showCreateTbl) {
    const ds = project.bigqueryDatasets.find(d => d.id === selectedDsId);
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', py: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton size="small" onClick={() => setShowCreateTbl(false)}><ArrowBackIcon fontSize="small" /></IconButton>
          <Typography sx={{ fontSize: '20px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>Create table in {ds?.name}</Typography>
        </Box>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField label="Table name" value={tblName} onChange={e => setTblName(e.target.value)} fullWidth size="small" />
          <TextField label="Estimated size (GB)" type="number" size="small" value={tblSize} onChange={e => setTblSize(Number(e.target.value))} />
          <TextField label="Number of rows" type="number" size="small" value={tblRows} onChange={e => setTblRows(Number(e.target.value))} />
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button variant="contained" onClick={handleCreateTbl} disabled={!tblName.trim()}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500 }}>Create table</Button>
            <Button onClick={() => setShowCreateTbl(false)} sx={{ textTransform: 'none', color: '#1a73e8' }}>Cancel</Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {/* Left: Explorer sidebar */}
      <Paper elevation={0} sx={{ width: 260, borderRight: '1px solid #dadce0', flexShrink: 0, py: 1, overflow: 'auto' }}>
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TableChartIcon sx={{ fontSize: 18, color: '#5f6368' }} />
          <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#202124' }}>BigQuery</Typography>
        </Box>
        <Divider />
        <Box sx={{ px: 2, py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: '#f1f3f4', borderRadius: '4px', px: 1, py: 0.25 }}>
            <SearchIcon sx={{ fontSize: 16, color: '#5f6368', mr: 0.5 }} />
            <InputBase placeholder="Search datasets" sx={{ fontSize: '12px', flex: 1 }} />
          </Box>
        </Box>
        <List dense sx={{ py: 0 }}>
          {project.bigqueryDatasets.map(ds => (
            <React.Fragment key={ds.id}>
              <ListItemButton onClick={() => toggleDs(ds.id)} sx={{ py: 0.5, pl: 2 }}>
                {expandedDs.includes(ds.id) ? <ExpandLessIcon sx={{ fontSize: 16, mr: 0.5 }} /> : <ExpandMoreIcon sx={{ fontSize: 16, mr: 0.5 }} />}
                <DatasetIcon sx={{ fontSize: 16, color: '#5f6368', mr: 1 }} />
                <ListItemText primary={ds.name} slotProps={{
            primary: {
              sx: {
                fontSize: '13px',
              },
            },
          }} />
              </ListItemButton>
              <Collapse in={expandedDs.includes(ds.id)}>
                {ds.tables.map(t => (
                  <ListItemButton key={t.id} sx={{ py: 0.25, pl: 5 }}>
                    <TableChartIcon sx={{ fontSize: 14, color: '#5f6368', mr: 1 }} />
                    <ListItemText primary={t.name} slotProps={{
            primary: {
              sx: {
                fontSize: '13px',
              },
            },
          }} />
                  </ListItemButton>
                ))}
                <ListItemButton sx={{ py: 0.25, pl: 5 }} onClick={() => { setSelectedDsId(ds.id); setShowCreateTbl(true); }}>
                  <AddIcon sx={{ fontSize: 14, color: '#1a73e8', mr: 1 }} />
                  <ListItemText primary="Add table" slotProps={{
            primary: {
              sx: {
                fontSize: '13px',
              },
            },
          }} />
                </ListItemButton>
              </Collapse>
            </React.Fragment>
          ))}
        </List>
      </Paper>

      {/* Main */}
      <Box sx={{ flex: 1, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography sx={{ fontSize: '22px', fontWeight: 400, color: '#202124', fontFamily: '"Google Sans", sans-serif' }}>BigQuery</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setDsName(''); setShowCreateDs(true); }}
              sx={{ textTransform: 'none', bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' }, fontWeight: 500, fontSize: '13px' }}>Create dataset</Button>
            <IconButton size="small" sx={{ color: '#5f6368' }}><RefreshIcon fontSize="small" /></IconButton>
          </Box>
        </Box>

        {project.bigqueryDatasets.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: '8px' }}>
            <DatasetIcon sx={{ fontSize: 48, color: '#dadce0', mb: 2 }} />
            <Typography sx={{ color: '#5f6368', fontSize: '14px', mb: 0.5 }}>No datasets</Typography>
            <Typography sx={{ color: '#80868b', fontSize: '13px', mb: 2 }}>Create a dataset to start analyzing data</Typography>
          </Paper>
        ) : (
          project.bigqueryDatasets.map(ds => (
            <Paper variant="outlined" key={ds.id} sx={{ mb: 2, borderRadius: '8px', overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.5, bgcolor: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatasetIcon sx={{ fontSize: 18, color: '#5f6368' }} />
                  <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#202124' }}>{ds.name}</Typography>
                  <Chip label={ds.location} size="small" variant="outlined" sx={{ fontSize: '11px', height: 20 }} />
                </Box>
                <Button size="small" startIcon={<AddIcon />} onClick={() => { setSelectedDsId(ds.id); setShowCreateTbl(true); }}
                  sx={{ textTransform: 'none', fontSize: '12px', color: '#1a73e8' }}>Add table</Button>
              </Box>
              {ds.tables.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Table</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Size</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Rows</TableCell>
                      <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ds.tables.map(t => (
                      <TableRow key={t.id} hover>
                        <TableCell sx={{ fontWeight: 500, fontSize: '13px', color: '#1a73e8', cursor: 'pointer' }}>{t.name}</TableCell>
                        <TableCell sx={{ fontSize: '13px' }}>{t.sizeGb} GB</TableCell>
                        <TableCell sx={{ fontSize: '13px' }}>{t.numRows.toLocaleString()}</TableCell>
                        <TableCell sx={{ fontSize: '13px' }}>{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography sx={{ color: '#80868b', fontSize: '13px' }}>No tables yet</Typography>
                </Box>
              )}
            </Paper>
          ))
        )}
      </Box>
    </Box>
  );
};

export default BigQuery;
