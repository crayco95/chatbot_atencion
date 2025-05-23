import React, { useState, useEffect } from 'react';
import { Container, Grid, Paper, Typography } from '@mui/material';
import { getStats, getConversations } from '../../services/api';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, conversationsData] = await Promise.all([
          getStats(),
          getConversations()
        ]);
        setStats(statsData);
        setConversations(conversationsData);
      } catch (error) {
        console.error('Error al cargar datos:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h4" gutterBottom>
            Dashboard
          </Typography>
        </Grid>
        
        {stats && (
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
        )}

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Últimas Conversaciones
            </Typography>
            {conversations.map((conv) => (
              <Paper key={conv.id} sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2">{conv.negocio_nombre}</Typography>
                <Typography variant="body1">P: {conv.pregunta}</Typography>
                <Typography variant="body1">R: {conv.respuesta}</Typography>
                <Typography variant="caption">
                  {new Date(conv.created_at).toLocaleString()}
                </Typography>
              </Paper>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Dashboard;