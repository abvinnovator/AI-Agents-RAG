import React from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, FormControl,
  Select, MenuItem, TextField, Switch,
} from '@mui/material';
import { useSupportStore } from '../../hooks/useSupportStore';
import { updateEscalationRule } from '../../store/supportStore';
import { SUPPORT_ROLES, getRoleLabel, type SupportRole } from '../../store/authStore';
import { SeverityBadge } from '../../components/support/StatusBadge';

const EscalationMatrix: React.FC = () => {
  const supportState = useSupportStore();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5">Escalation Matrix</Typography>
        <Typography variant="subtitle1">
          Configure how tickets are routed based on severity
        </Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Severity</TableCell>
              <TableCell>Target Role</TableCell>
              <TableCell>Response Time</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {supportState.escalationRules.map(rule => (
              <TableRow key={rule.id}>
                <TableCell><SeverityBadge severity={rule.severity} /></TableCell>
                <TableCell>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <Select
                      value={rule.targetRole}
                      onChange={e => updateEscalationRule(rule.id, { targetRole: e.target.value as SupportRole })}
                    >
                      {SUPPORT_ROLES.map(r => (
                        <MenuItem key={r} value={r}>{getRoleLabel(r)}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    type="number"
                    value={rule.responseTimeMinutes}
                    onChange={e => updateEscalationRule(rule.id, { responseTimeMinutes: Number(e.target.value) })}
                    sx={{ width: 100 }}
                    slotProps={{ htmlInput: { min: 1 } }}
                    helperText="minutes"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: '#5f6368' }}>
                    {rule.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={rule.active}
                    onChange={e => updateEscalationRule(rule.id, { active: e.target.checked })}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Paper sx={{ mt: 2, p: 2 }}>
        <Typography variant="body2" sx={{ color: '#5f6368' }}>
          <strong>How it works:</strong> When a user raises a ticket, the AI agent (future) will classify it and suggest a routing based on this matrix.
          As Super Admin, you can approve or override the AI's decision before the ticket reaches a support engineer.
        </Typography>
      </Paper>
    </Box>
  );
};

export default EscalationMatrix;
