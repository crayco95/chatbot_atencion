import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import api from '../../services/api';

const FAQManager = () => {
  const [faqs, setFaqs] = useState([]);
  const [open, setOpen] = useState(false);
  const [currentFAQ, setCurrentFAQ] = useState({ pregunta: '', respuesta: '' });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchFAQs();
  }, []);

  const fetchFAQs = async () => {
    try {
      const response = await api.get('/admin/faqs');
      setFaqs(response.data);
    } catch (error) {
      console.error('Error al cargar FAQs:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      if (isEditing) {
        await api.put(`/admin/faqs/${currentFAQ.id}`, currentFAQ);
      } else {
        await api.post('/admin/faqs', currentFAQ);
      }
      setOpen(false);
      fetchFAQs();
      setCurrentFAQ({ pregunta: '', respuesta: '' });
    } catch (error) {
      console.error('Error al guardar FAQ:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/admin/faqs/${id}`);
      fetchFAQs();
    } catch (error) {
      console.error('Error al eliminar FAQ:', error);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Administrar FAQs
        </Typography>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setIsEditing(false);
            setCurrentFAQ({ pregunta: '', respuesta: '' });
            setOpen(true);
          }}
          sx={{ mb: 3 }}
        >
          Agregar FAQ
        </Button>

        <List>
          {faqs.map((faq) => (
            <ListItem key={faq.id} sx={{ border: '1px solid #eee', mb: 1 }}>
              <ListItemText
                primary={faq.pregunta}
                secondary={faq.respuesta}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => {
                    setIsEditing(true);
                    setCurrentFAQ(faq);
                    setOpen(true);
                  }}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => handleDelete(faq.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>

        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>
            {isEditing ? 'Editar FAQ' : 'Agregar FAQ'}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Pregunta"
              fullWidth
              value={currentFAQ.pregunta}
              onChange={(e) => setCurrentFAQ({ ...currentFAQ, pregunta: e.target.value })}
            />
            <TextField
              margin="dense"
              label="Respuesta"
              fullWidth
              multiline
              rows={4}
              value={currentFAQ.respuesta}
              onChange={(e) => setCurrentFAQ({ ...currentFAQ, respuesta: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} color="primary">
              Guardar
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  );
};

export default FAQManager;