const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Servim fișierele statice din folderul curent
app.use(express.static(path.join(__dirname)));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://iulianpopa433_db_user:z0x1hJYhOAFOqjWG@cluster0-shard-00-00.t6io4vq.mongodb.net:27017,cluster0-shard-00-01.t6io4vq.mongodb.net:27017,cluster0-shard-00-02.t6io4vq.mongodb.net:27017/brailahub?ssl=true&replicaSet=atlas-t6io4vq-shard-0&authSource=admin&retryWrites=true&w=majority';

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    tls: true,
    tlsAllowInvalidCertificates: true
})
    .then(() => console.log("Conectat cu succes la MongoDB Atlas pentru Brăila Hub!"))
    .catch((err) => console.error("Eroare de conectare la MongoDB:", err));

// Schema pentru Anunțuri (cu preț, cartier separat și ștergere automată la 30 zile)
const anuntSchema = new mongoose.Schema({
    telefon: { type: String, required: true },
    categorie: { type: String, required: true },
    titlu: { type: String, required: true },
    pret: { type: String, required: true },
    cartier: { type: String, required: true },
    strada: { type: String, required: true },
    detalii: { type: String, required: true },
    dataCreare: { type: Date, default: Date.now, expires: '30d' }
});

const Anunt = mongoose.model('Anunt', anuntSchema);

// Ruta pentru preluarea anunțurilor (suportă căutare și filtru după cartier)
app.get('/api/anunturi', async (req, res) => {
    try {
        const { cautare, cartier } = req.query;
        let query = {};

        if (cartier) {
            query.cartier = { $regex: cartier, $options: 'i' };
        }

        if (cautare) {
            query.$or = [
                { titlu: { $regex: cautare, $options: 'i' } },
                { detalii: { $regex: cautare, $options: 'i' } },
                { categorie: { $regex: cautare, $options: 'i' } }
            ];
        }

        const anunturi = await Anunt.find(query).sort({ dataCreare: -1 });
        res.json(anunturi);
    } catch (error) {
        res.status(500).json({ mesaj: "Eroare la preluarea anunțurilor" });
    }
});

// Ruta pentru adăugarea unui anunț nou (limita de 5 pe lună)
app.post('/api/anunturi', async (req, res) => {
    try {
        const { telefon, categorie, titlu, pret, cartier, strada, detalii } = req.body;

        if (!telefon || !titlu || !pret || !cartier) {
            return res.status(400).json({ mesaj: "Telefonul, titlul, prețul și cartierul sunt obligatorii." });
        }

        const oLunaInUrma = new Date();
        oLunaInUrma.setDate(oLunaInUrma.getDate() - 30);

        const numarAnunturiExistente = await Anunt.countDocuments({
            telefon,
            dataCreare: { $gte: oLunaInUrma }
        });

        if (numarAnunturiExistente >= 5) {
            return res.status(400).json({ 
                mesaj: "Limită atinsă! Ai deja 5 anunțuri active înregistrate pe acest număr în ultima lună." 
            });
        }

        const anuntNou = new Anunt({ telefon, categorie, titlu, pret, cartier, strada, detalii });
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