import React from 'react';
import { Grid, Paper, Typography } from '@mui/material';

const Stats = ({ stats }) => {
  if (!stats) return null;

  return (
    <>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6">Negocios</Typography>
          <Typography variant="h4">{stats.total_negocios}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6">FAQs</Typography>
          <Typography variant="h4">{stats.total_faqs}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6">Usuarios WhatsApp</Typography>
          <Typography variant="h4">{stats.total_usuarios_whatsapp}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6">Usuarios Telegram</Typography>
          <Typography variant="h4">{stats.total_usuarios_telegram}</Typography>
        </Paper>
      </Grid>
    </>
  );
};

export default Stats;