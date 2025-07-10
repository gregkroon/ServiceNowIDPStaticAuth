import React, { useState } from 'react';
import { useDebounce } from 'react-use';
import {
  InfoCard,
  Table,
  TableColumn,
  Progress,
  StatusOK,
  StatusError,
  StatusWarning,
  StatusAborted,
} from '@backstage/core-components';
import { useApi, identityApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useAsync } from 'react-use';
import { Alert } from '@material-ui/lab';
import {
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
  Menu,
  ButtonGroup,
  Chip,
} from '@material-ui/core';
import MoreVertIcon from '@material-ui/icons/MoreVert';

const SERVICENOW_INSTANCE_URL = 'https://ven03172.service-now.com';
const SERVICENOW_CI_SYSID_ANNOTATION = 'servicenow.com/ci-sysid';

export type Incident = {
  sys_id: string;
  number: string;
  short_description: string;
  state: string;
  priority: string;
  opened_at: string;
};

export type Change = {
  sys_id: string;
  number: string;
  short_description: string;
  state: string;
  priority: string;
  risk: string;
  start_date: string;
  end_date: string;
};

type ViewType = 'incidents' | 'changes';

const PriorityStatus = ({ priority }: { priority: string }) => {
  switch (priority) {
    case '1': return <StatusError>1 - Critical</StatusError>;
    case '2': return <StatusWarning>2 - High</StatusWarning>;
    case '3': return <StatusOK>3 - Moderate</StatusOK>;
    default: return <StatusAborted>{priority} - Low</StatusAborted>;
  }
};

const RiskStatus = ({ risk }: { risk: string }) => {
  switch (risk) {
    case '1': return <StatusError>High</StatusError>;
    case '2': return <StatusWarning>Medium</StatusWarning>;
    case '3': return <StatusOK>Low</StatusOK>;
    default: return <StatusAborted>Unknown</StatusAborted>;
  }
};

const ChangeStateChip = ({ state }: { state: string }) => {
  const stateMap: { [key: string]: { label: string; color: 'primary' | 'secondary' | 'default' } } = {
    '-5': { label: 'New', color: 'primary' },
    '-4': { label: 'Assess', color: 'secondary' },
    '-3': { label: 'Authorize', color: 'secondary' },
    '-2': { label: 'Scheduled', color: 'primary' },
    '-1': { label: 'Implement', color: 'secondary' },
    '0': { label: 'Review', color: 'secondary' },
    '3': { label: 'Closed', color: 'default' },
    '4': { label: 'Cancelled', color: 'default' },
  };
  const stateInfo = stateMap[state] || { label: state, color: 'default' as const };
  return <Chip label={stateInfo.label} color={stateInfo.color} size="small" />;
};

export const ServiceNowEntityWidget = () => {
  const { entity } = useEntity();
  const identityApi = useApi(identityApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const [viewType, setViewType] = useState<ViewType>('incidents');
  const [stateFilter, setStateFilter] = useState('active=true');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [debouncedDescriptionFilter, setDebouncedDescriptionFilter] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [refreshCount, setRefreshCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState<'create' | 'update' | 'resolve' | 'close' | null>(null);
  const [selectedItem, setSelectedItem] = useState<Incident | Change | null>(null);
  const [pendingMenuItem, setPendingMenuItem] = useState<Incident | Change | null>(null);
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemPriority, setNewItemPriority] = useState('3');
  const [newChangeRisk, setNewChangeRisk] = useState('3');
  const [newChangeStartDate, setNewChangeStartDate] = useState('');
  const [newChangeEndDate, setNewChangeEndDate] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);

  useDebounce(() => {
    setDebouncedDescriptionFilter(descriptionInput);
  }, 500, [descriptionInput]);

  const ciSysId = entity.metadata.annotations?.[SERVICENOW_CI_SYSID_ANNOTATION] ?? '';

  const { value, loading, error } = useAsync(
    async (): Promise<{ items: (Incident | Change)[]; totalCount: number } | null> => {
      if (!ciSysId) return null;
      const { token } = await identityApi.getCredentials();
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      let queryParts = [`cmdb_ci=${ciSysId}`];
      if (stateFilter) queryParts.push(stateFilter);
      if (debouncedDescriptionFilter) queryParts.push(`short_descriptionLIKE${debouncedDescriptionFilter}`);
      const query = queryParts.join('^');
      
      const fields = viewType === 'incidents' 
        ? 'sys_id,number,short_description,state,priority,opened_at'
        : 'sys_id,number,short_description,state,priority,risk,start_date,end_date';
      
      const offset = page * pageSize;
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${pageSize}&sysparm_offset=${offset}`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${text}`);
      }
      
      const totalCount = parseInt(response.headers.get('X-Total-Count') || '0', 10);
      const data = (await response.json()) as { result?: (Incident | Change)[] };
      return { items: data.result ?? [], totalCount };
    },
    [identityApi, discoveryApi, ciSysId, stateFilter, debouncedDescriptionFilter, page, pageSize, refreshCount, viewType],
  );

  const handleAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
      setRefreshCount(c => c + 1);
      return true;
    } catch (e: any) {
      console.error("Failed to perform action:", e);
      setActionError(e);
      return false;
    }
  };

  const sendApiRequest = async (url: string, options: RequestInit) => {
    const { token } = await identityApi.getCredentials();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed: ${response.status} ${response.statusText} - ${text}`);
    }
  };

  const handleCreateItem = async () => {
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}`;
      
      const baseData = {
        short_description: newItemDescription,
        cmdb_ci: ciSysId,
        priority: newItemPriority,
      };
      
      const requestData = viewType === 'incidents' 
        ? baseData 
        : {
            ...baseData,
            risk: newChangeRisk,
            start_date: newChangeStartDate,
            end_date: newChangeEndDate,
          };
      
      await sendApiRequest(url, {
        method: 'POST',
        body: JSON.stringify(requestData),
      });
    });
    
    if (success) {
      setDialogOpen(null);
      setNewItemDescription('');
      setNewItemPriority('3');
      setNewChangeRisk('3');
      setNewChangeStartDate('');
      setNewChangeEndDate('');
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      await sendApiRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({ short_description: newItemDescription }),
      });
    });
    if (success) setDialogOpen(null);
  };

  const handleResolveItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      const resolveState = viewType === 'incidents' ? '6' : '3'; // Resolved for incidents, Closed for changes
      await sendApiRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({ state: resolveState, close_notes: actionNotes }),
      });
    });
    if (success) setDialogOpen(null);
  };

  const handleCloseItem = async () => {
    if (!selectedItem) return;
    const success = await handleAction(async () => {
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const table = viewType === 'incidents' ? 'incident' : 'change_request';
      const url = `${proxyBaseUrl}/servicenow/api/now/table/${table}/${selectedItem.sys_id}`;
      const closeState = viewType === 'incidents' ? '7' : '4'; // Closed for incidents, Cancelled for changes
      await sendApiRequest(url, {
        method: 'PATCH',
        body: JSON.stringify({ state: closeState, close_notes: actionNotes }),
      });
    });
    if (success) setDialogOpen(null);
  };

  const openDialog = (type: 'update' | 'resolve' | 'close', item: Incident | Change) => {
    setSelectedItem(item);
    setNewItemDescription(item.short_description || '');
    setActionNotes('');
    setDialogOpen(type);
    setMenuPosition(null);
    setPendingMenuItem(null);
  };

  const getStateFilterOptions = () => {
    if (viewType === 'incidents') {
      return [
        { value: 'active=true', label: 'Active' },
        { value: 'state=6', label: 'Resolved' },
        { value: 'state=7', label: 'Closed' },
        { value: '', label: 'All' },
      ];
    } else {
      return [
        { value: 'active=true', label: 'Active' },
        { value: 'state=3', label: 'Closed' },
        { value: 'state=4', label: 'Cancelled' },
        { value: '', label: 'All' },
      ];
    }
  };

  const getColumns = (): TableColumn<Incident | Change>[] => {
    const baseColumns = [
      { 
        title: 'Number', 
        field: 'number', 
        width: '10%', 
        render: (rowData: Incident | Change) => (
          <a 
            href={`${SERVICENOW_INSTANCE_URL}/nav_to.do?uri=${viewType === 'incidents' ? 'incident' : 'change_request'}.do?sys_id=${rowData.sys_id}`} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            {rowData.number}
          </a>
        ) 
      },
      { title: 'Description', field: 'short_description' },
      { 
        title: 'State', 
        field: 'state', 
        width: '10%',
        render: (rowData: Incident | Change) => 
          viewType === 'changes' ? <ChangeStateChip state={rowData.state} /> : rowData.state
      },
      { 
        title: 'Priority', 
        field: 'priority', 
        width: '15%', 
        render: (rowData: Incident | Change) => <PriorityStatus priority={rowData.priority} /> 
      },
    ];

    if (viewType === 'incidents') {
      baseColumns.push({ title: 'Opened At', field: 'opened_at', type: 'datetime' });
    } else {
      baseColumns.push(
        { 
          title: 'Risk', 
          field: 'risk', 
          width: '10%', 
          render: (rowData: Change) => <RiskStatus risk={rowData.risk} /> 
        },
        { title: 'Start Date', field: 'start_date', type: 'datetime' },
        { title: 'End Date', field: 'end_date', type: 'datetime' }
      );
    }

    baseColumns.push({
      title: 'Actions',
      field: 'actions',
      width: '5%',
      render: (rowData: Incident | Change) => (
        <IconButton
          aria-label="more"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuPosition({ top: e.clientY, left: e.clientX });
            setPendingMenuItem(rowData);
          }}
        >
          <MoreVertIcon />
        </IconButton>
      ),
    });

    return baseColumns;
  };

  const handleViewTypeChange = (newViewType: ViewType) => {
    setViewType(newViewType);
    setPage(0);
    setStateFilter('active=true');
    setDescriptionInput('');
    setDebouncedDescriptionFilter('');
  };

  return (
    <InfoCard>
      <Grid container spacing={2} direction="column">
        <Grid item>
          <Grid container spacing={2} alignItems="center" justifyContent="space-between">
            <Grid item>
              <ButtonGroup variant="contained" color="primary">
                <Button 
                  variant={viewType === 'incidents' ? 'contained' : 'outlined'}
                  onClick={() => handleViewTypeChange('incidents')}
                >
                  Incidents
                </Button>
                <Button 
                  variant={viewType === 'changes' ? 'contained' : 'outlined'}
                  onClick={() => handleViewTypeChange('changes')}
                >
                  Changes
                </Button>
              </ButtonGroup>
            </Grid>
            <Grid item>
              <Button variant="contained" color="primary" onClick={() => setDialogOpen('create')}>
                Create {viewType === 'incidents' ? 'Incident' : 'Change'}
              </Button>
            </Grid>
          </Grid>
        </Grid>
        
        <Grid item>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                label="Search Description" 
                variant="outlined" 
                value={descriptionInput}
                onChange={e => setDescriptionInput(e.target.value)} 
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth variant="outlined">
                <InputLabel>State</InputLabel>
                <Select value={stateFilter} onChange={e => setStateFilter(e.target.value as string)} label="State">
                  {getStateFilterOptions().map(option => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Grid>

        <Grid item>
          {loading && <Progress />}
          {error && <Alert severity="error">{error.message}</Alert>}
          {actionError && <Alert severity="error">{actionError.message}</Alert>}
          {!loading && !error && value && (
            <Table
              columns={getColumns()}
              data={value.items}
              options={{ search: false, paging: true, pageSize: 5, padding: 'dense' }}
              page={page}
              totalCount={value.totalCount}
              onPageChange={setPage}
              onRowsPerPageChange={setPageSize}
            />
          )}
        </Grid>
      </Grid>

      <Menu
        open={Boolean(menuPosition)}
        onClose={() => {
          setMenuPosition(null);
          setPendingMenuItem(null);
        }}
        anchorReference="anchorPosition"
        anchorPosition={menuPosition ?? undefined}
        keepMounted
      >
        <MenuItem onClick={() => pendingMenuItem && openDialog('update', pendingMenuItem)}>
          Update
        </MenuItem>
        <MenuItem onClick={() => pendingMenuItem && openDialog('resolve', pendingMenuItem)}>
          {viewType === 'incidents' ? 'Resolve' : 'Close'}
        </MenuItem>
        <MenuItem onClick={() => pendingMenuItem && openDialog('close', pendingMenuItem)}>
          {viewType === 'incidents' ? 'Close' : 'Cancel'}
        </MenuItem>
      </Menu>

      <Dialog open={dialogOpen === 'create'} onClose={() => setDialogOpen(null)} maxWidth="md" fullWidth>
        <DialogTitle>Create New {viewType === 'incidents' ? 'Incident' : 'Change'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will create a new {viewType === 'incidents' ? 'incident' : 'change request'} linked to the '{entity.metadata.name}' component.
          </DialogContentText>
          <TextField 
            autoFocus 
            margin="dense" 
            label="Short Description" 
            type="text" 
            fullWidth 
            value={newItemDescription} 
            onChange={e => setNewItemDescription(e.target.value)} 
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Priority</InputLabel>
            <Select value={newItemPriority} onChange={e => setNewItemPriority(e.target.value as string)} label="Priority">
              <MenuItem value="1">1 - Critical</MenuItem>
              <MenuItem value="2">2 - High</MenuItem>
              <MenuItem value="3">3 - Moderate</MenuItem>
              <MenuItem value="4">4 - Low</MenuItem>
            </Select>
          </FormControl>
          
          {viewType === 'changes' && (
            <>
              <FormControl fullWidth margin="dense">
                <InputLabel>Risk</InputLabel>
                <Select value={newChangeRisk} onChange={e => setNewChangeRisk(e.target.value as string)} label="Risk">
                  <MenuItem value="1">High</MenuItem>
                  <MenuItem value="2">Medium</MenuItem>
                  <MenuItem value="3">Low</MenuItem>
                </Select>
              </FormControl>
              <TextField
                margin="dense"
                label="Start Date"
                type="datetime-local"
                fullWidth
                value={newChangeStartDate}
                onChange={e => setNewChangeStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                margin="dense"
                label="End Date"
                type="datetime-local"
                fullWidth
                value={newChangeEndDate}
                onChange={e => setNewChangeEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>
          <Button onClick={handleCreateItem} color="primary">Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen === 'update'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>Update {viewType === 'incidents' ? 'Incident' : 'Change'}</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label="Short Description" 
            type="text" 
            fullWidth 
            value={newItemDescription} 
            onChange={e => setNewItemDescription(e.target.value)} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>
          <Button onClick={handleUpdateItem} color="primary">Update</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen === 'resolve'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>{viewType === 'incidents' ? 'Resolve Incident' : 'Close Change'}</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label={viewType === 'incidents' ? 'Resolution Notes' : 'Close Notes'} 
            type="text" 
            fullWidth 
            value={actionNotes} 
            onChange={e => setActionNotes(e.target.value)} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>
          <Button onClick={handleResolveItem} color="primary">
            {viewType === 'incidents' ? 'Resolve' : 'Close'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen === 'close'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>{viewType === 'incidents' ? 'Close Incident' : 'Cancel Change'}</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label={viewType === 'incidents' ? 'Close Notes' : 'Cancel Notes'} 
            type="text" 
            fullWidth 
            value={actionNotes} 
            onChange={e => setActionNotes(e.target.value)} 
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>
          <Button onClick={handleCloseItem} color="primary">
            {viewType === 'incidents' ? 'Close' : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </InfoCard>
  );
};
