import React, { useState } from 'react';
import {
  Box, Typography, Paper, Button, TextField, FormControl, InputLabel,
  Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useGcpStore } from '../../hooks/useGcpStore';
import { findProject } from '../../store/gcpStore';
import {
  raiseTicket,
  TICKET_CATEGORIES, TICKET_SEVERITIES,
  getCategoryLabel, getSeverityLabel,
  type TicketCategory, type TicketSeverity,
} from '../../store/supportStore';

const RaiseTicket: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastTicketNumber, setLastTicketNumber] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general');
  const [severity, setSeverity] = useState<TicketSeverity>('P3');
  const [resourceType, setResourceType] = useState('');
  const [resourceName, setResourceName] = useState('');

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('general');
    setSeverity('P3');
    setResourceType('');
    setResourceName('');
  };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim() || !project) return;
    const ticket = raiseTicket({
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      projectId: project.id,
      projectName: project.name,
      linkedResourceType: resourceType || undefined,
      linkedResourceName: resourceName || undefined,
    });
    setLastTicketNumber(ticket.ticketNumber);
    setSubmitted(true);
    setDialogOpen(false);
    resetForm();
    setTimeout(() => setSubmitted(false), 5000);
  };

  if (!project) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8, color: '#5f6368' }}>
        <Typography variant="h6">Select a project first</Typography>
      </Box>
    );
  }

  // Build resource options from project
  const resourceOptions: { type: string; name: string }[] = [];
  project.vmInstances.forEach(vm => resourceOptions.push({ type: 'VM Instance', name: vm.name }));
  project.vpcNetworks.forEach(vpc => resourceOptions.push({ type: 'VPC Network', name: vpc.name }));
  project.storageBuckets.forEach(b => resourceOptions.push({ type: 'Storage Bucket', name: b.name }));
  project.bigqueryDatasets.forEach(ds => resourceOptions.push({ type: 'BigQuery Dataset', name: ds.name }));
  project.loadBalancers.forEach(lb => resourceOptions.push({ type: 'Load Balancer', name: lb.name }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5">Support</Typography>
          <Typography variant="subtitle1">Get help with your Google Cloud resources</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { resetForm(); setDialogOpen(true); }}
        >
          Create Support Case
        </Button>
      </Box>

      {submitted && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Case {lastTicketNumber} created successfully! Our support team will review it shortly.
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>How can we help?</Typography>
        <Typography variant="body2" sx={{ color: '#5f6368', mb: 2 }}>
          Create a support case to get help from our technical support team.
          Cases are routed based on severity and category.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {TICKET_SEVERITIES.map(s => (
            <Paper
              key={s}
              variant="outlined"
              sx={{ p: 2, flex: '1 1 200px', minWidth: 180 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: s === 'P1' ? '#c5221f' : s === 'P2' ? '#e37400' : s === 'P3' ? '#1967d2' : '#137333' }}>
                {s} — {getSeverityLabel(s)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>
                {s === 'P1' ? 'Response: 15 min' : s === 'P2' ? 'Response: 4 hours' : s === 'P3' ? 'Response: 8 hours' : 'Response: Business hours'}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Paper>

      {/* Create Case Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create a support case</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              fullWidth
              placeholder="Brief summary of the issue"
            />

            <TextField
              label="Description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={4}
              placeholder="Describe the issue in detail..."
            />

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select value={category} label="Category" onChange={e => setCategory(e.target.value as TicketCategory)}>
                {TICKET_CATEGORIES.map(c => (
                  <MenuItem key={c} value={c}>{getCategoryLabel(c)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select value={severity} label="Severity" onChange={e => setSeverity(e.target.value as TicketSeverity)}>
                {TICKET_SEVERITIES.map(s => (
                  <MenuItem key={s} value={s}>{s} — {getSeverityLabel(s)}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {resourceOptions.length > 0 && (
              <FormControl fullWidth>
                <InputLabel>Related resource (optional)</InputLabel>
                <Select
                  value={resourceName ? `${resourceType}::${resourceName}` : ''}
                  label="Related resource (optional)"
                  onChange={e => {
                    const val = e.target.value as string;
                    if (val) {
                      const [t, n] = val.split('::');
                      setResourceType(t);
                      setResourceName(n);
                    } else {
                      setResourceType('');
                      setResourceName('');
                    }
                  }}
                >
                  <MenuItem value="">None</MenuItem>
                  {resourceOptions.map((r, i) => (
                    <MenuItem key={i} value={`${r.type}::${r.name}`}>{r.type}: {r.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!title.trim() || !description.trim()}
          >
            Submit Case
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RaiseTicket;
