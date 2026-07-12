const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/materials', express.static(path.join(__dirname, 'data')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/interview', require('./routes/interview'));
app.use('/api/dsa', require('./routes/dsa'));
app.use('/api/resume', require('./routes/resume'));

app.get('/api/status', (req, res) => {
  res.json({ message: "Backend and DB are running smoothly!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
