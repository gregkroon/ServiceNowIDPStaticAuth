import React from 'react';
import {
  InfoCard,
  Table,
  TableColumn,
  Progress,
} from '@backstage/core-components';
import {
  useApi,
  identityApiRef,
  discoveryApiRef,
} from '@backstage/core-plugin-api';
import { useAsync } from 'react-use';
import { Alert } from '@material-ui/lab';

// The base URL of your ServiceNow instance for creating direct links
const SERVICENOW_INSTANCE_URL = 'https://ven03172.service-now.com';

/**
 * The shape of a single ServiceNow Incident record.
 */
export type Incident = {
  sys_id: string;
  number: string;
  short_description: string;
  state: string;
  priority: string;
  opened_at: string;
};

/**
 * The definition for the columns in our incidents table.
 */
const columns: TableColumn<Incident>[] = [
  {
    title: 'Number',
    field: 'number',
    width: '10%',
    render: rowData => (
      <a
        href={`${SERVICENOW_INSTANCE_URL}/nav_to.do?uri=incident.do?sys_id=${rowData.sys_id}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {rowData.number}
      </a>
    ),
  },
  { title: 'Description', field: 'short_description' },
  { title: 'State', field: 'state', width: '10%' },
  { title: 'Priority', field: 'priority', width: '10%' },
  { title: 'Opened At', field: 'opened_at', type: 'datetime' },
];

/**
 * The main widget component that fetches and displays ServiceNow incidents.
 */
export const ServiceNowWidget = () => {
  // Get references to Backstage/Harness core APIs
  const identityApi = useApi(identityApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const { value: incidents, loading, error } = useAsync(
    async (): Promise<Incident[]> => {
      // Get the authentication token first
      const { token } = await identityApi.getCredentials();

      // Dynamically get the correct base URL for the proxy service
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');

      // This is a static query that does not depend on an entity.
      const query = 'active=true';
      const fields = 'sys_id,number,short_description,state,priority,opened_at';
      const limit = 10;

      // Construct the full, correct URL dynamically
      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${limit}`;

      // Use the standard browser fetch with the manually added Auth header
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Failed to fetch ServiceNow incidents: ${response.status} ${response.statusText} - ${text}`,
        );
      }

      const data = (await response.json()) as { result?: Incident[] };
      return data.result ?? [];
    },
    [identityApi, discoveryApi], // Dependency array
  );

  return (
    // The title prop has been removed from InfoCard.
    // The parent page component will now provide the main title for the card.
    <InfoCard>
      {loading && <Progress />}
      {error && <Alert severity="error">{error.message}</Alert>}
      {!loading && !error && (
        <Table
          // The title prop has also been removed from the Table for a cleaner look.
          columns={columns}
          data={incidents || []}
          options={{ paging: false, search: false, padding: 'dense' }}
        />
      )}
    </InfoCard>
  );
};