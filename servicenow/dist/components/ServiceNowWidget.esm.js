import { jsxs, jsx } from 'react/jsx-runtime';
import { InfoCard, Progress, Table } from '@backstage/core-components';
import { useApi, identityApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import { useAsync } from 'react-use';
import { Alert } from '@material-ui/lab';

const SERVICENOW_INSTANCE_URL = "https://ven03172.service-now.com";
const columns = [
  {
    title: "Number",
    field: "number",
    width: "10%",
    render: (rowData) => /* @__PURE__ */ jsx(
      "a",
      {
        href: `${SERVICENOW_INSTANCE_URL}/nav_to.do?uri=incident.do?sys_id=${rowData.sys_id}`,
        target: "_blank",
        rel: "noopener noreferrer",
        children: rowData.number
      }
    )
  },
  { title: "Description", field: "short_description" },
  { title: "State", field: "state", width: "10%" },
  { title: "Priority", field: "priority", width: "10%" },
  { title: "Opened At", field: "opened_at", type: "datetime" }
];
const ServiceNowWidget = () => {
  const identityApi = useApi(identityApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const { value: incidents, loading, error } = useAsync(
    async () => {
      const { token } = await identityApi.getCredentials();
      const proxyBaseUrl = await discoveryApi.getBaseUrl("proxy");
      const query = "active=true";
      const fields = "sys_id,number,short_description,state,priority,opened_at";
      const limit = 10;
      const url = `${proxyBaseUrl}/servicenow/api/now/table/incident?sysparm_query=${query}&sysparm_fields=${fields}&sysparm_limit=${limit}`;
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        }
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Failed to fetch ServiceNow incidents: ${response.status} ${response.statusText} - ${text}`
        );
      }
      const data = await response.json();
      return data.result ?? [];
    },
    [identityApi, discoveryApi]
    // Dependency array
  );
  return (
    // The title prop has been removed from InfoCard.
    // The parent page component will now provide the main title for the card.
    /* @__PURE__ */ jsxs(InfoCard, { children: [
      loading && /* @__PURE__ */ jsx(Progress, {}),
      error && /* @__PURE__ */ jsx(Alert, { severity: "error", children: error.message }),
      !loading && !error && /* @__PURE__ */ jsx(
        Table,
        {
          columns,
          data: incidents || [],
          options: { paging: false, search: false, padding: "dense" }
        }
      )
    ] })
  );
};

export { ServiceNowWidget };
//# sourceMappingURL=ServiceNowWidget.esm.js.map
