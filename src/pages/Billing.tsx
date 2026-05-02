import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Chip,
} from '@mui/material';
import { useGcpStore } from '../hooks/useGcpStore';
import { findProject } from '../store/gcpStore';
import {
  MACHINE_TYPES,
  DISK_TYPES,
  STORAGE_CLASSES,
  LOAD_BALANCER_TYPES,
  BIGQUERY_PRICING,
} from '../data/gcpData';

interface LineItem {
  resource: string;
  description: string;
  monthlyEstimate: number;
}

const Billing: React.FC = () => {
  const state = useGcpStore();
  const project = state.currentProjectId ? findProject(state.currentProjectId) : null;

  if (!project) {
    return (
      <Box sx={{ textAlign: 'center', mt: 8, color: '#5f6368' }}>
        <Typography variant="h6">Select a project first</Typography>
      </Box>
    );
  }

  const lineItems: LineItem[] = [];

  // VMs
  project.vmInstances.forEach((vm) => {
    const mt = MACHINE_TYPES.find(m => m.name === vm.machineType);
    const vmCost = (mt?.pricePerHour || 0) * 730; // ~730 hrs/month

    const dt = DISK_TYPES.find(d => d.name === vm.bootDisk.type);
    const diskCost = (dt?.pricePerGbMonth || 0) * vm.bootDisk.sizeGb;

    lineItems.push({
      resource: `VM: ${vm.name}`,
      description: `${vm.machineType} in ${vm.zone} (${vm.status})`,
      monthlyEstimate: vm.status === 'RUNNING' ? vmCost + diskCost : diskCost,
    });
  });

  // Storage Buckets
  project.storageBuckets.forEach((bucket) => {
    const sc = STORAGE_CLASSES.find(s => s.name === bucket.storageClass);
    const cost = (sc?.pricePerGbMonth || 0) * bucket.sizeGb;
    lineItems.push({
      resource: `Bucket: ${bucket.name}`,
      description: `${bucket.storageClass} in ${bucket.location}, ${bucket.sizeGb} GB`,
      monthlyEstimate: cost,
    });
  });

  // BigQuery
  project.bigqueryDatasets.forEach((ds) => {
    const totalSize = ds.tables.reduce((acc, t) => acc + t.sizeGb, 0);
    const cost = totalSize * BIGQUERY_PRICING.storagePerGbMonth;
    lineItems.push({
      resource: `BigQuery: ${ds.name}`,
      description: `${ds.tables.length} tables, ${totalSize} GB in ${ds.location}`,
      monthlyEstimate: cost,
    });
  });

  // Load Balancers
  project.loadBalancers.forEach((lb) => {
    const lbType = LOAD_BALANCER_TYPES.find(t => t.name === lb.type);
    const cost = (lbType?.pricePerHour || 0.025) * 730;
    lineItems.push({
      resource: `LB: ${lb.name}`,
      description: `${lb.type} in ${lb.region}`,
      monthlyEstimate: cost,
    });
  });

  const total = lineItems.reduce((acc, item) => acc + item.monthlyEstimate, 0);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>Billing Estimate</Typography>
      <Typography variant="subtitle1" sx={{ mb: 3 }}>
        Simulated monthly cost estimate for project: {project.name}
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Resource</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Est. Monthly Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4, color: '#80868b' }}>
                  No billable resources yet.
                </TableCell>
              </TableRow>
            )}
            {lineItems.map((item, i) => (
              <TableRow key={i} hover>
                <TableCell sx={{ fontWeight: 500 }}>{item.resource}</TableCell>
                <TableCell sx={{ color: '#5f6368' }}>{item.description}</TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                  ${item.monthlyEstimate.toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {lineItems.length > 0 && (
        <Paper sx={{ mt: 2, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Estimated Monthly Total</Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography
              variant="h4"
              sx={{ color: total > 500 ? '#d93025' : total > 100 ? '#f9ab00' : '#1e8e3e', fontWeight: 500 }}
            >
              ${total.toFixed(2)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#80868b' }}>
              per month (simulated)
            </Typography>
          </Box>
        </Paper>
      )}

      {lineItems.length > 0 && (
        <Paper sx={{ mt: 2, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Cost Breakdown</Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(() => {
              const categories: Record<string, number> = {};
              lineItems.forEach(item => {
                const cat = item.resource.split(':')[0];
                categories[cat] = (categories[cat] || 0) + item.monthlyEstimate;
              });
              return Object.entries(categories).map(([cat, cost]) => (
                <Chip
                  key={cat}
                  label={`${cat}: $${cost.toFixed(2)}`}
                  variant="outlined"
                  sx={{ fontFamily: 'monospace' }}
                />
              ));
            })()}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default Billing;
