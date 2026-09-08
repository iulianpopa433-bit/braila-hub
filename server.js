const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
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

const anuntSchema = new mongoose.Schema({
    telefon: { type: String, required: true },
    categorie: { type: String, required: true },
    denumire: { type: String, default: '' },
    titlu: { type: String, required: true },
    pret: { type: String, required: true },
    cartier: { type: String, required: true },
    strada: { type: String, required: true },
    numarStrada: { type: String, default: '' },
    detalii: { type: String, required: true },
    dataCreare: { type: Date, default: Date.now, expires: '30d' }
});

const Anunt = mongoose.model('Anunt', anuntSchema);

// Preluare anunțuri (cu filtru de căutare sau cartier)
app.get('/api/anunturi', async (req, res) => {
    try {
        const { cautare, cartier, telefon } = req.query;
        let query = {};

        if (telefon) {
            query.telefon = telefon;
        }
        if (cartier) {
            query.cartier = { $regex: cartier, $options: 'i' };
        }
        if (cautare) {
            query.$or = [
                { titlu: { $regex: cautare, $options: 'i' } },
                { detalii: { $regex: cautare, $options: 'i' } },
                { categorie: { $regex: cautare, $options: 'i' } },
                { denumire: { $regex: cautare, $options: 'i' } }
            ];
        }

        const anunturi = await Anunt.find(query).sort({ dataCreare: -1 });
        res.json(anunturi);
    } catch (error) {
        res.status(500).json({ mesaj: "Eroare la preluarea anunțurilor" });
    }
});

// Adăugare anunț (cu limită de 5 pe lună)
app.post('/api/anunturi', async (req, res) => {
    try {
        const { telefon, categorie, denumire, titlu, pret, cartier, strada, numarStrada, detalii } = req.body;

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

        const anuntNou = new Anunt({ 
            telefon, 
            categorie, 
            denumire: denumire || '', 
            titlu, 
            pret, 
            cartier, 
            strada, 
            numarStrada: numarStrada || '', 
            detalii 
        });
        
        await anuntNou.save();
        res.status(201).json({ mesaj: "Anunțul a fost publicat cu succes!", anunt: anuntNou });
    } catch (error) {
        res.status(500).json({ mesaj: "Eroare la server privind salvarea anunțului" });
    }
});

// Ștergere anunț propriu
app.delete('/api/anunturi/:id', async (req, res) => {
    try {
        await Anunt.findByIdAndDelete(req.params.id);
        res.json({ mesaj: "Anunțul a fost șters cu succes!" });
    } catch (error) {
        res.status(500).json({ mesaj: "Eroare la ștergerea anunțului" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});