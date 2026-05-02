import React from 'react';
import { Chip } from '@mui/material';
import type { TicketSeverity, TicketStatus, TicketCategory } from '../../store/supportStore';
import type { SupportRole } from '../../store/authStore';

const severityColors: Record<TicketSeverity, { bg: string; color: string }> = {
  P1: { bg: '#fce8e6', color: '#c5221f' },
  P2: { bg: '#fef7e0', color: '#e37400' },
  P3: { bg: '#e8f0fe', color: '#1967d2' },
  P4: { bg: '#e6f4ea', color: '#137333' },
};

const statusColors: Record<TicketStatus, { bg: string; color: string }> = {
  open: { bg: '#e8f0fe', color: '#1967d2' },
  assigned: { bg: '#fef7e0', color: '#e37400' },
  in_progress: { bg: '#e0f2f1', color: '#00796b' },
  escalated: { bg: '#fce8e6', color: '#c5221f' },
  waiting_approval: { bg: '#f3e8fd', color: '#7b1fa2' },
  resolved: { bg: '#e6f4ea', color: '#137333' },
  closed: { bg: '#f1f3f4', color: '#5f6368' },
};

const roleColors: Record<SupportRole, string> = {
  super_admin: '#1a73e8',
  L1: '#137333',
  L2: '#1967d2',
  L3: '#e37400',
  L4: '#c5221f',
  TSE: '#7b1fa2',
};

interface SeverityBadgeProps {
  severity: TicketSeverity;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => (
  <Chip
    label={severity}
    size="small"
    sx={{
      bgcolor: severityColors[severity].bg,
      color: severityColors[severity].color,
      fontWeight: 600,
      fontSize: '0.6875rem',
      height: 22,
    }}
  />
);

interface StatusBadgeProps {
  status: TicketStatus;
}

const statusLabels: Record<TicketStatus, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  escalated: 'Escalated',
  waiting_approval: 'Awaiting Approval',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <Chip
    label={statusLabels[status]}
    size="small"
    sx={{
      bgcolor: statusColors[status].bg,
      color: statusColors[status].color,
      fontWeight: 500,
      fontSize: '0.6875rem',
      height: 22,
    }}
  />
);

interface RoleBadgeProps {
  role: SupportRole;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => (
  <Chip
    label={role === 'super_admin' ? 'Admin' : role}
    size="small"
    variant="outlined"
    sx={{
      borderColor: roleColors[role],
      color: roleColors[role],
      fontWeight: 600,
      fontSize: '0.6875rem',
      height: 22,
    }}
  />
);

interface CategoryBadgeProps {
  category: TicketCategory;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category }) => (
  <Chip
    label={category}
    size="small"
    variant="outlined"
    sx={{
      fontSize: '0.6875rem',
      height: 22,
      textTransform: 'capitalize',
    }}
  />
);
