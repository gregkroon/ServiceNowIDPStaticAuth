# ServiceNowAuth Plugin for Harness IDP (Static)

A plugin for the [Harness Internal Developer Portal (IDP)](https://developer.harness.io/docs/internal-developer-portal/) that integrates with **ServiceNow** to allow developers to view, create, update, resolve, and close Incidents and Change Requests associated with a service entity.

---

## 🚀 Features

- 🔐 More secure static Authentication to ServiceNow (Single account)
- 📋 View Incidents and Changes linked to a service’s CMDB CI
- 🔍 Search and filter by state and short description
- ➕ Create new Incidents or Change Requests
- ✏️ Edit short descriptions
- ✅ Resolve/Close Incidents or Changes
- 🔗 Deep-link to records in ServiceNow


---

## 🧩 Layout Configuration (Harness IDP UI)

To make your plugin visible in the Harness IDP UI:

### Tabs and Pages

| Type                | Name                     | Purpose                                           |
|---------------------|--------------------------|---------------------------------------------------|
| **Tab**             | `EntityServiceNowContent` | Appears under the service entity tab layout       |

> These names must match the exports in your plugin code.

### Export Required in Plugin Code

```ts
export { ServiceNowEntityWidget as EntityServiceNowContent } from './ServiceNowEntityWidget';
````

---

## ⚙️ Plugin Metadata

| Field                 | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| **Plugin Name**       | `ServicenowStaticAuth`                                          |
| **Package Name**      | `@internal/plugin-my-plugin`                              |
| **Description**       | ServiceNow integration for managing Incidents and Changes |
| **Category**          | ITSM / Incident Management                                |
| **Created By**        | All Account Users                                         |
| **Plugin Applies To** | `Service`                                                 |

> Ensure your catalog entity includes the following annotation:

```yaml
metadata:
  annotations:
    servicenow.com/ci-sysid: <your-ci-sys-id>
```

---

## 🔐 Authentication

This plugin uses Static Auth with a single account . Upon login:

* Credentials are sourced from teh secret manager 

---

## 🌐 Proxy and Plugin Configuration

To connect through the Backstage proxy, update your `app-config.yaml`:

```yaml
proxy:
  endpoints:
    /servicenow:
      target: https://your-servicenow.com/
      headers:
        Authorization: Basic ${SNOW_TOKEN}
        Accept: application/json
        Content-Type: application/json
      pathRewrite:
        api/proxy/servicenow/?: /

customPlugins:
  servicenow:
    instanceUrl: https://your-servicenow.com/
```

---

## 🧠 How it Works

* Uses the ServiceNow REST API via the Backstage proxy
* Filters results by `cmdb_ci` sys\_id annotation
* Provides two views:

  * **Incidents** (`/table/incident`)
  * **Changes** (`/table/change_request`)
* Supports actions: **Create, Update, Resolve, Close**

---

## Build notes 

* yarn build
* yarn pack 


---

## 📃 License

MIT – see [LICENSE](./LICENSE)

```
