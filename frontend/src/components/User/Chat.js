import React, { useState } from 'react';
import { Container, Paper, TextField, Button, Box, Typography } from '@mui/material';
import { sendMessage } from '../../services/api';

const Chat = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      const data = await sendMessage(message, 1); // ID del negocio hardcodeado por ahora
      setResponse(data.reply);
      setMessage('');
      setError('');
    } catch (err) {
      setError('Error al enviar mensaje');
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Chat
        </Typography>
        
        {response && (
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
            <Typography variant="body1">{response}</Typography>
          </Paper>
        )}

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe tu mensaje aquí..."
            sx={{ mb: 2 }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!message.trim()}
          >
            Enviar
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default Chat;