const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname)); // Aceasta linie va servi fisierul index.html

// Șirul manual cu shard-uri (Ocolește blocajul DNS din rețeaua ta)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://iulianpopa433_db_user:z0x1hJYhOAFOqjWG@cluster0-shard-00-00.t6io4vq.mongodb.net:27017,cluster0-shard-00-01.t6io4vq.mongodb.net:27017,cluster0-shard-00-02.t6io4vq.mongodb.net:27017/brailahub?ssl=true&replicaSet=atlas-t6io4vq-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    tls: true,
    tlsAllowInvalidCertificates: true
})
    .then(() => console.log("Conectat cu succes la MongoDB Atlas pentru Brăila Hub!"))
    .catch((err) => console.error("Eroare de conectare la MongoDB:", err));

// Schema pentru Anunțuri
const anuntSchema = new mongoose.Schema({
    telefon: { type: String, required: true },
    categorie: { type: String, required: true },
    titlu: { type: String, required: true },
    detalii: { type: String, required: true },
    dataCreare: { type: Date, default: Date.now }
});

const Anunt = mongoose.model('Anunt', anuntSchema);

// 1. Ruta pentru a citi toate anunțurile (cele mai recente primele)
app.get('/api/anunturi', async (req, res) => {
    try {
        const anunturi = await Anunt.find().sort({ dataCreare: -1 });
        res.json(anunturi);
    } catch (error) {
        res.status(500).json({ mesaj: "Eroare la preluarea anunțurilor" });
    }
});

// 2. Ruta pentru adăugarea unui anunț nou (cu verificarea limitei de 10)
app.post('/api/anunturi', async (req, res) => {
    try {
        const { telefon, categorie, titlu, detalii } = req.body;

        if (!telefon || !titlu) {
            return res.status(400).json({ mesaj: "Telefonul și titlul sunt obligatorii." });
        }

        // Numărăm câte anunțuri are deja acest număr de telefon
        const numarAnunturiExistente = await Anunt.countDocuments({ telefon });

        if (numarAnunturiExistente >= 10) {
            return res.status(400).json({ 
                mesaj: "Limită atinsă! Ai deja 10 anunțuri active înregistrate pe acest număr de telefon." 
            });
        }

        // Salvăm noul anunț
        const anuntNou = new Anunt({ telefon, categorie, titlu, detalii });
        await anuntNou.save();

        res.status(201).json({ mesaj: "Anunțul a fost publicat cu succes!", anunt: anuntNou });
    } catch (error) {
        res.status(500).json({ mesaj: "Eroare la server privind salvarea anunțului" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});