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



const PriorityStatus = ({ priority }: { priority: string }) => {

  switch (priority) {

    case '1': return <StatusError>1 - Critical</StatusError>;

    case '2': return <StatusWarning>2 - High</StatusWarning>;

    case '3': return <StatusOK>3 - Moderate</StatusOK>;

    default: return <StatusAborted>{priority} - Low</StatusAborted>;

  }

};



export const ServiceNowEntityWidget = () => {

  const { entity } = useEntity();

  const identityApi = useApi(identityApiRef);

  const discoveryApi = useApi(discoveryApiRef);



  const [stateFilter, setStateFilter] = useState('active=true');

  const [descriptionInput, setDescriptionInput] = useState('');

  const [debouncedDescriptionFilter, setDebouncedDescriptionFilter] = useState('');

  const [page, setPage] = useState(0);

  const [pageSize, setPageSize] = useState(5);

  const [refreshCount, setRefreshCount] = useState(0);

  const [dialogOpen, setDialogOpen] = useState<'create' | 'update' | 'resolve' | 'close' | null>(null);

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  const [pendingMenuIncident, setPendingMenuIncident] = useState<Incident | null>(null);

  const [newIncidentDescription, setNewIncidentDescription] = useState('');

  const [newIncidentPriority, setNewIncidentPriority] = useState('3');

  const [actionNotes, setActionNotes] = useState('');

  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const [actionError, setActionError] = useState<Error | null>(null);



  useDebounce(() => {

    setDebouncedDescriptionFilter(descriptionInput);

  }, 500, [descriptionInput]);



  const ciSysId = entity.metadata.annotations?.[SERVICENOW_CI_SYSID_ANNOTATION] ?? '';



  const { value, loading, error } = useAsync(

    async (): Promise<{ incidents: Incident[]; totalCount: number } | null> => {

      if (!ciSysId) return null;

      const { token } = await identityApi.getCredentials();

      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');

      let queryParts = [`cmdb_ci=${ciSysId}`];

      if (stateFilter) queryParts.push(stateFilter);

      if (debouncedDescriptionFilter) queryParts.push(`short_descriptionLIKE${debouncedDescriptionFilter}`);

      const query = queryParts.join('^');

      const fields = 'sys_id,number,short_description,state,priority,opened_at';

      const offset = page * pageSize;

      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${pageSize}&sysparm_offset=${offset}`;

      const response = await fetch(url, {

        headers: { Authorization: `Bearer ${token}` },

      });

      if (!response.ok) {

        const text = await response.text();

        throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${text}`);

      }

      const totalCount = parseInt(response.headers.get('X-Total-Count') || '0', 10);

      const data = (await response.json()) as { result?: Incident[] };

      return { incidents: data.result ?? [], totalCount };

    },

    [identityApi, discoveryApi, ciSysId, stateFilter, debouncedDescriptionFilter, page, pageSize, refreshCount],

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



  const handleCreateIncident = async () => {

    const success = await handleAction(async () => {

      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');

      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident`;

      await sendApiRequest(url, {

        method: 'POST',

        body: JSON.stringify({

          short_description: newIncidentDescription,

          cmdb_ci: ciSysId,

          priority: newIncidentPriority,

        }),

      });

    });

    if (success) {

      setDialogOpen(null);

      setNewIncidentDescription('');

      setNewIncidentPriority('3');

    }

  };



  const handleUpdateIncident = async () => {

    if (!selectedIncident) return;

    const success = await handleAction(async () => {

      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');

      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident/${selectedIncident.sys_id}`;

      await sendApiRequest(url, {

        method: 'PATCH',

        body: JSON.stringify({ short_description: newIncidentDescription }),

      });

    });

    if (success) setDialogOpen(null);

  };



  const handleResolveIncident = async () => {

    if (!selectedIncident) return;

    const success = await handleAction(async () => {

      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');

      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident/${selectedIncident.sys_id}`;

      await sendApiRequest(url, {

        method: 'PATCH',

        body: JSON.stringify({ state: '6', close_notes: actionNotes }),

      });

    });

    if (success) setDialogOpen(null);

  };



  const handleCloseIncident = async () => {

    if (!selectedIncident) return;

    const success = await handleAction(async () => {

      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');

      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident/${selectedIncident.sys_id}`;

      await sendApiRequest(url, {

        method: 'PATCH',

        body: JSON.stringify({ state: '7', close_notes: actionNotes }),

      });

    });

    if (success) setDialogOpen(null);

  };



  const openDialog = (type: 'update' | 'resolve' | 'close', incident: Incident) => {

    setSelectedIncident(incident);

    setNewIncidentDescription(incident.short_description || '');

    setActionNotes('');

    setDialogOpen(type);

    setMenuPosition(null);

    setPendingMenuIncident(null);

  };



  const columns: TableColumn<Incident>[] = [

    { title: 'Number', field: 'number', width: '10%', render: rowData => (<a href={`${SERVICENOW_INSTANCE_URL}/nav_to.do?uri=incident.do?sys_id=${rowData.sys_id}`} target="_blank" rel="noopener noreferrer">{rowData.number}</a>) },

    { title: 'Description', field: 'short_description' },

    { title: 'State', field: 'state', width: '10%' },

    { title: 'Priority', field: 'priority', width: '15%', render: rowData => <PriorityStatus priority={rowData.priority} /> },

    { title: 'Opened At', field: 'opened_at', type: 'datetime' },

    {

      title: 'Actions',

      field: 'actions',

      width: '5%',

      render: rowData => (

        <IconButton

          aria-label="more"

          onClick={(e) => {

            e.preventDefault();

            e.stopPropagation();

            setMenuPosition({ top: e.clientY, left: e.clientX });

            setPendingMenuIncident(rowData);

          }}

        >

          <MoreVertIcon />

        </IconButton>

      ),

    },

  ];



  return (

    <InfoCard title={`Incidents for "${entity.metadata.name}"`} action={<Button variant="contained" color="primary" onClick={() => setDialogOpen('create')}>Create Incident</Button>}>

      <Grid container spacing={2} direction="column">

        <Grid item>

          <Grid container spacing={2}>

            <Grid item xs={12} md={4}>

              <TextField fullWidth label="Search Description" variant="outlined" onChange={e => setDescriptionInput(e.target.value)} />

            </Grid>

            <Grid item xs={12} md={4}>

              <FormControl fullWidth variant="outlined">

                <InputLabel>State</InputLabel>

                <Select value={stateFilter} onChange={e => setStateFilter(e.target.value as string)} label="State">

                  <MenuItem value="active=true">Active</MenuItem>

                  <MenuItem value="state=6">Resolved</MenuItem>

                  <MenuItem value="state=7">Closed</MenuItem>

                  <MenuItem value="">All</MenuItem>

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

              columns={columns}

              data={value.incidents}

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
    setPendingMenuIncident(null);
  }}
  anchorReference="anchorPosition"
  anchorPosition={menuPosition ?? undefined}
  keepMounted
>
  <MenuItem onClick={() => pendingMenuIncident && openDialog('update', pendingMenuIncident)}>
    Update
  </MenuItem>
  <MenuItem onClick={() => pendingMenuIncident && openDialog('resolve', pendingMenuIncident)}>
    Resolve
  </MenuItem>
  <MenuItem onClick={() => pendingMenuIncident && openDialog('close', pendingMenuIncident)}>
    Close
  </MenuItem>
</Menu>



      <Dialog open={dialogOpen === 'create'} onClose={() => setDialogOpen(null)}>

        <DialogTitle>Create New Incident</DialogTitle>

        <DialogContent>

          <DialogContentText>This will create a new incident linked to the '{entity.metadata.name}' component.</DialogContentText>

          <TextField autoFocus margin="dense" label="Short Description" type="text" fullWidth value={newIncidentDescription} onChange={e => setNewIncidentDescription(e.target.value)} />

          <FormControl fullWidth margin="dense">

            <InputLabel>Priority</InputLabel>

            <Select value={newIncidentPriority} onChange={e => setNewIncidentPriority(e.target.value as string)} label="Priority">

              <MenuItem value="1">1 - Critical</MenuItem>

              <MenuItem value="2">2 - High</MenuItem>

              <MenuItem value="3">3 - Moderate</MenuItem>

              <MenuItem value="4">4 - Low</MenuItem>

            </Select>

          </FormControl>

        </DialogContent>

        <DialogActions>

          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>

          <Button onClick={handleCreateIncident} color="primary">Create</Button>

        </DialogActions>

      </Dialog>



      <Dialog open={dialogOpen === 'update'} onClose={() => setDialogOpen(null)}>

        <DialogTitle>Update Incident</DialogTitle>

        <DialogContent>

          <TextField autoFocus margin="dense" label="Short Description" type="text" fullWidth value={newIncidentDescription} onChange={e => setNewIncidentDescription(e.target.value)} />

        </DialogContent>

        <DialogActions>

          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>

          <Button onClick={handleUpdateIncident} color="primary">Update</Button>

        </DialogActions>

      </Dialog>



      <Dialog open={dialogOpen === 'resolve'} onClose={() => setDialogOpen(null)}>

        <DialogTitle>Resolve Incident</DialogTitle>

        <DialogContent>

          <TextField autoFocus margin="dense" label="Resolution Notes" type="text" fullWidth value={actionNotes} onChange={e => setActionNotes(e.target.value)} />

        </DialogContent>

        <DialogActions>

          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>

          <Button onClick={handleResolveIncident} color="primary">Resolve</Button>

        </DialogActions>

      </Dialog>



      <Dialog open={dialogOpen === 'close'} onClose={() => setDialogOpen(null)}>

        <DialogTitle>Close Incident</DialogTitle>

        <DialogContent>

          <TextField autoFocus margin="dense" label="Close Notes" type="text" fullWidth value={actionNotes} onChange={e => setActionNotes(e.target.value)} />

        </DialogContent>

        <DialogActions>

          <Button onClick={() => setDialogOpen(null)}>Cancel</Button>

          <Button onClick={handleCloseIncident} color="primary">Close</Button>

        </DialogActions>

      </Dialog>

    </InfoCard>

  );

};
