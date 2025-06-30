import { jsxs, jsx } from 'react/jsx-runtime';
import { Grid } from '@material-ui/core';
import { Page, Header, Content } from '@backstage/core-components';
import { ServiceNowWidget } from './ServiceNowWidget.esm.js';

const ServiceNowPage = () => /* @__PURE__ */ jsxs(Page, { themeId: "tool", children: [
  /* @__PURE__ */ jsx(Header, { title: "ServiceNow Incidents" }),
  /* @__PURE__ */ jsx(Content, { children: /* @__PURE__ */ jsx(Grid, { container: true, spacing: 3, children: /* @__PURE__ */ jsx(Grid, { item: true, xs: 12, children: /* @__PURE__ */ jsx(ServiceNowWidget, {}) }) }) })
] });

export { ServiceNowPage };
//# sourceMappingURL=ServiceNowPage.esm.js.map
