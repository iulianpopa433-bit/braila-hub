const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// Servire fișiere statice din folderul curent
app.use(express.static(__dirname));

// --- CONEXIUNE MONGODB ---
// Asigură-te că ai variabila de mediu MONGO_URI configurată în Render sau pune link-ul direct
const MONGO_URI = process.env.MONGO_URI || "LINK_UL_TAU_MONGODB"; 

mongoose.connect(MONGO_URI)
    .then(() => console.log("Conectat la MongoDB cu succes!"))
    .catch(err => console.error("Eroare conectare MongoDB:", err));

// ==========================================
// 1. MODEL ȘI RUTE PENTRU UTILIZATORI (AUTENTIFICARE & VIZITE)
// ==========================================
const userSchema = new mongoose.Schema({
    nume: { type: String, required: true },
    contact: { type: String, required: true, unique: true }, // Email sau Telefon
    parola: { type: String, required: true },
    vizite: { type: Number, default: 1 },
    dataCrearii: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// Înregistrare cont nou
app.post('/api/inregistrare', async (req, res) => {
    try {
        const { nume, contact, parola } = req.body;
        if (!nume || !contact || !parola) {
            return res.status(400).json({ mesaj: "Toate câmpurile sunt obligatorii!" });
        }
        
        let utilizatorExistent = await User.findOne({ contact });
        if (utilizatorExistent) {
            return res.status(400).json({ mesaj: "Acest email sau număr de telefon este deja înregistrat!" });
        }

        const utilizatorNou = new User({ nume, contact, parola, vizite: 1 });
        await utilizatorNou.save();
        res.status(201).json({ mesaj: "Cont creat cu succes!", user: utilizatorNou });
    } catch (err) {
        console.error("Eroare înregistrare:", err);
        res.status(500).json({ mesaj: "Eroare la server la înregistrare." });
    }
});

// Autentificare (Login) și creștere număr vizite
app.post('/api/login', async (req, res) => {
    try {
        const { contact, parola } = req.body;
        const user = await User.findOne({ contact, parola });
        
        if (!user) {
            return res.status(400).json({ mesaj: "Date de autentificare incorecte (Email/Telefon sau Parolă greșită)!" });
        }

        // Incrementăm numărul de vizite la fiecare autentificare reușită
        user.vizite += 1;
        await user.save();

        res.json({ mesaj: "Autentificare reușită!", user });
    } catch (err) {
        console.error("Eroare login:", err);
        res.status(500).json({ mesaj: "Eroare la server la autentificare." });
    }
});


// ==========================================
// 2. MODEL ȘI RUTE PENTRU ANUNȚURI (LIMITĂ 5)
// ==========================================
const anuntSchema = new mongoose.Schema({
    telefon: { type: String, required: true },
    categorie: { type: String, required: true },
    titlu: { type: String, required: true },
    pret: { type: String, required: true },
    cartier: { type: String, required: true },
    strada: { type: String, required: true },
    detalii: { type: String, required: true },
    dataCrearii: { type: Date, default: Date.now }
});
const Anunt = mongoose.model('Anunt', anuntSchema);

// Preluare anunțuri (cu opțiune de căutare)
app.get('/api/anunturi', async (req, res) => {
    try {
        const { cautare } = req.query;
        let query = {};
        if (cautare) {
            query = {
                $or: [
                    { titlu: { $regex: cautare, $options: 'i' } },
                    { categorie: { $regex: cautare, $options: 'i' } },
                    { detali: { $regex: cautare, $options: 'i' } },
                    { cartier: { $regex: cautare, $options: 'i' } }
                ]
            };
        }
        const anunturi = await Anunt.find(query).sort({ dataCrearii: -1 });
        res.json(anunturi);
    } catch (err) {
        res.status(500).json({ mesaj: "Eroare la preluarea anunțurilor." });
    }
});

// Adăugare anunț nou (Verificare max 5 anunțuri per număr de telefon)
app.post('/api/anunturi', async (req, res) => {
    try {
        const { telefon, categorie, titlu, pret, cartier, strada, detalii } = req.body;
        
        if (!telefon || telefon.length < 10) {
            return res.status(400).json({ mesaj: "Te rugăm să introduci un număr de telefon valid (minim 10 cifre)." });
        }

        // Verificăm câte anunțuri active are acest număr de telefon (limita de 5)
        const anunturiExistente = await Anunt.countDocuments({ telefon });
        if (anunturiExistente >= 5) {
            return res.status(400).json({ mesaj: "Ai atins limita maximă de 5 anunțuri active pentru acest număr de telefon." });
        }

        const anuntNou = new Anunt({
            telefon,
            categorie,
            titlu,
            pret,
            cartier,
            strada,
            detalii
        });

        await anuntNou.save();
        res.status(201).json({ mesaj: "Anunț publicat cu succes!" });
    } catch (err) {
        console.error("Eroare salvare anunț:", err);
        res.status(500).json({ mesaj: "Eroare la server privind salvarea anunțului." });
    }
});


// ==========================================
// 3. RUTE PENTRU CHAT (OPȚIONAL / SUPORT)
// ==========================================
const mesajSchema = new mongoose.Schema({
    nume: String,
    text: String,
    data: { type: Date, default: Date.now }
});
const MesajChat = mongoose.model('MesajChat', mesajSchema);

app.get('/api/chat', async (req, res) => {
    try {
        const mesaje = await MesajChat.find().sort({ data: 1 }).limit(50);
        res.json(mesaje);
    } catch(e) {
        res.status(500).json({ mesaj: "Eroare chat" });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { nume, text } = req.body;
        const mesajNou = new MesajChat({ nume, text });
        await mesajNou.save();
        res.status(201).json(mesajNou);
    } catch(e) {
        res.status(500).json({ mesaj: "Eroare trimitere mesaj" });
    }
});


// Pornire server pe portul alocat de Render sau 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});