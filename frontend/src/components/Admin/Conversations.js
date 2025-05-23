import React from 'react';
import { Paper, Typography } from '@mui/material';

const Conversations = ({ conversations }) => {
  return (
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
  );
};

export default Conversations;