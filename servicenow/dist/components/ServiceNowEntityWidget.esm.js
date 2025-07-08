import { jsx, jsxs } from 'react/jsx-runtime';
import { useState } from 'react';
import { useApi, identityApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useAsync } from 'react-use';
import { ServiceNowIncidentsTable } from './ServiceNowIncidentsTable.esm.js';
import { InfoCard } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';

const SERVICENOW_QUERY_ANNOTATION = "servicenow.com/query";
const ServiceNowEntityWidget = () => {
  const { entity } = useEntity();
  const identityApi = useApi(identityApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const query = entity.metadata.annotations?.[SERVICENOW_QUERY_ANNOTATION] ?? "";
  console.log(
    `Widget loaded for entity: "${entity.metadata.name}", using query: "${query}"`
  );
  const { value, loading, error } = useAsync(
    async () => {
      if (!query) return null;
      const { token } = await identityApi.getCredentials();
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      const fields = "sys_id,number,short_description,state,priority,opened_at";
      const offset = page * pageSize;
      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${pageSize}&sysparm_offset=${offset}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText} - ${text}`);
      }
      const totalCount = parseInt(response.headers.get("X-Total-Count") || "0", 10);
      const data = await response.json();
      return { incidents: data.result ?? [], totalCount };
    },
    [identityApi, discoveryApi, query, page, pageSize]
  );
  if (!query) {
    return /* @__PURE__ */ jsx(InfoCard, { title: "ServiceNow Incidents", children: /* @__PURE__ */ jsxs(Alert, { severity: "info", children: [
      "To display incidents, add the ",
      /* @__PURE__ */ jsxs("b", { children: [
        "'",
        SERVICENOW_QUERY_ANNOTATION,
        "'"
      ] }),
      " annotation to this component's catalog-info.yaml file."
    ] }) });
  }
  return /* @__PURE__ */ jsx(
    ServiceNowIncidentsTable,
    {
      title: `Incidents for "${entity.metadata.name}"`,
      loading,
      error,
      incidents: value?.incidents || [],
      page,
      onPageChange: setPage,
      pageSize,
      onRowsPerPageChange: setPageSize,
      totalCount: value?.totalCount || 0
    }
  );
};

export { ServiceNowEntityWidget };
//# sourceMappingURL=ServiceNowEntityWidget.esm.js.map
