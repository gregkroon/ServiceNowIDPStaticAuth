import React from 'react';
import { Grid } from '@material-ui/core';
import {
  Page,
  Header,
  Content,
} from '@backstage/core-components';
import { ServiceNowWidget } from './ServiceNowWidget';

export const ServiceNowPage = () => (
  <Page themeId="tool">
    {/* This is now the single, main title for the entire page */}
    <Header title="ServiceNow Incidents" />
    <Content>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          {/* The widget is now placed directly inside the content.
            The extra InfoCard wrapper has been removed to eliminate the duplicate title.
          */}
          <ServiceNowWidget />
        </Grid>
      </Grid>
    </Content>
  </Page>
);
