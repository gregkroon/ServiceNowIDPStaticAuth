import React, { useState } from 'react'; // FIX: Added import for React and useState
import {
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core';
import {
  Content,
  Header,
  Page,
  InfoCard, // FIX: Added import for InfoCard
} from '@backstage/core-components';
import { ServiceNowWidget } from './ServiceNowWidget';

export const ServiceNowPage = () => {
  // State for the filter values is managed here in the parent page
  const [descriptionFilter, setDescriptionFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('active=true'); // Default filter

  return (
    <Page themeId="tool">
      <Header title="ServiceNow Incident Dashboard" />
      <Content>
        <Grid container spacing={3} direction="column">
          {/* Section for the filter controls */}
          <Grid item>
            <InfoCard title="Filters">
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search Description"
                    variant="outlined"
                    // Use a debounce here in a real scenario to avoid excessive API calls
                    onChange={e => setDescriptionFilter(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel>State</InputLabel>
                    <Select
                      value={stateFilter}
                      onChange={e => setStateFilter(e.target.value as string)}
                      label="State"
                    >
                      <MenuItem value="active=true">Active</MenuItem>
                      <MenuItem value="state=6">Resolved</MenuItem>
                      <MenuItem value="state=7">Closed</MenuItem>
                      <MenuItem value="">All</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </InfoCard>
          </Grid>

          {/* The Widget is now passed the filter state as props */}
          <Grid item>
            <ServiceNowWidget
              stateFilter={stateFilter}
              descriptionFilter={descriptionFilter}
            />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};