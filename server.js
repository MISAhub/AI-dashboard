const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Default seed data
const defaultData = {
  clients: ["Client X", "Client Y", "Client Z"],
  towers: ["Tower 1", "Tower 2", "Tower 3", "Tower 4"],
  assets: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"],
  rows: {
    "Client X::Tower 1": { baseFte: 10, assessment: "Completed", decision: "Approved", initiative: "AI Invoice Automation", pipelineFte: 5, benchmark: 25 },
    "Client X::Tower 2": { baseFte: 20, assessment: "In Progress", decision: "Pending Review", initiative: "Reconciliation AI", pipelineFte: 0, benchmark: 15 },
    "Client X::Tower 3": { baseFte: 5, assessment: "No Scale", decision: "N/A - Assessment Pending", initiative: "None", pipelineFte: 0, benchmark: 20 },
    "Client X::Tower 4": { baseFte: 8, assessment: "Completed", decision: "Approved", initiative: "Variance Explainer AI", pipelineFte: 3, benchmark: 30 },
    "Client Y::Tower 1": { baseFte: 15, assessment: "Completed", decision: "Approved", initiative: "Billing Dispute AI", pipelineFte: 4, benchmark: 25 },
    "Client Y::Tower 2": { baseFte: 30, assessment: "Completed", decision: "Declined", initiative: "None", pipelineFte: 0, benchmark: 15 },
    "Client Z::Tower 1": { baseFte: 40, assessment: "Not Started", decision: "Pending Review", initiative: "None", pipelineFte: 0, benchmark: 25 }
  },
  cellData: {
    "Client X::Tower 1::C": { fte: 5, status: "Deployed" },
    "Client X::Tower 1::F": { fte: 4, status: "In progress" },
    "Client X::Tower 1::H": { fte: 2, status: "Awaiting client approvals" },
    "Client X::Tower 1::J": { fte: 1, status: "Potential but lack CBA" },
    "Client Y::Tower 1::A": { fte: 3, status: "Deployed" },
    "Client Y::Tower 1::D": { fte: 1, status: "In progress" }
  }
};

// GET data
app.get('/api/data', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (fs.existsSync(DATA_FILE)) {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read data file" });
      }
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.json(defaultData);
      }
    });
  } else {
    // Write default data initially
    fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8', (err) => {
      if (err) console.error("Error creating default data.json:", err);
    });
    res.json(defaultData);
  }
});

// POST data
app.post('/api/data', (req, res) => {
  const data = req.body;
  fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8', (err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to write data file" });
    }
    
    // Write date-stamped backup file
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const backupPath = path.join(__dirname, `data_${dateStr}.json`);
      fs.writeFile(backupPath, JSON.stringify(data, null, 2), 'utf8', (err2) => {
        if (err2) console.error("Backup save failed:", err2);
      });
    } catch (e) {
      console.error("Backup save error:", e);
    }

    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
