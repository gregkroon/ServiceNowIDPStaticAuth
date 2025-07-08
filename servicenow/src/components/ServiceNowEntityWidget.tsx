import { useState } from 'react';
import { useApi, identityApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useAsync } from 'react-use';
import { Incident, ServiceNowIncidentsTable } from './ServiceNowIncidentsTable';
import { InfoCard } from '@backstage/core-components';
import { Alert } from '@material-ui/lab'; // FIX: Imported Alert from the correct library

const SERVICENOW_QUERY_ANNOTATION = 'servicenow.com/query';

export const ServiceNowEntityWidget = () => {
  const { entity } = useEntity();
  const identityApi = useApi(identityApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const query = entity.metadata.annotations?.[SERVICENOW_QUERY_ANNOTATION] ?? '';

  // --- ADD THIS LINE FOR DEBUGGING ---
  console.log(
    `Widget loaded for entity: "${entity.metadata.name}", using query: "${query}"`,
  );
  // ------------------------------------

  const { value, loading, error } = useAsync(
    async (): Promise<{ incidents: Incident[]; totalCount: number } | null> => {
      if (!query) return null;
      const { token } = await identityApi.getCredentials();
      const proxyBaseUrl = await discoveryApi.getBaseUrl('proxy');
      const fields = 'sys_id,number,short_description,state,priority,opened_at';
      const offset = page * pageSize;
      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${pageSize}&sysparm_offset=${offset}`;

      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${text}`);
       }
      const totalCount = parseInt(response.headers.get('X-Total-Count') || '0', 10);
      const data = (await response.json()) as { result?: Incident[] };
      return { incidents: data.result ?? [], totalCount };
    },
    [identityApi, discoveryApi, query, page, pageSize],
  );

  if (!query) {
    return (
      <InfoCard title="ServiceNow Incidents">
        <Alert severity="info">
          To display incidents, add the <b>'{SERVICENOW_QUERY_ANNOTATION}'</b> annotation to this component's catalog-info.yaml file.
        </Alert>
      </InfoCard>
    );
  }
  
  return (
    <ServiceNowIncidentsTable
      title={`Incidents for "${entity.metadata.name}"`}
      loading={loading}
      error={error}
      incidents={value?.incidents || []}
      page={page}
      onPageChange={setPage}
      pageSize={pageSize}
      onRowsPerPageChange={setPageSize}
      totalCount={value?.totalCount || 0}
    />
  );
};