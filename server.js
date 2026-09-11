require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const rateLimit = require('express-rate-limit');

const app = express();

// Configurare pentru a accepta imagini mari și JSON
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(__dirname)); // Servire fișiere statice (HTML/CSS/JS)

// --- CONFIGURARE CLOUDINARY (GRATUIT PENTRU IMAGINI) ---
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({ storage: multer.memoryStorage() });

// --- PROTECȚIE ANTI-SPAM (RATE LIMITING) ---
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute
    max: 100, // Maxim 100 cereri per IP
    message: { mesaj: "Prea multe cereri! Te rugăm să aștepți puțin." }
});
app.use('/api/', limiter);

// --- CONEXIUNE MONGODB ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Conectat la MongoDB Atlas"))
    .catch(err => console.error("❌ Eroare conectare DB:", err));

// --- MODELE BAZĂ DE DATE ---
const UserSchema = new mongoose.Schema({
    nume: { type: String, required: true },
    contact: { type: String, required: true, unique: true },
    parola: { type: String, required: true },
    vizite: { type: Number, default: 1 },
    dataCrearii: { type: Date, default: Date.now }
});

const AnuntSchema = new mongoose.Schema({
    telefon: { type: String, required: true },
    categorie: { type: String, required: true },
    titlu: { type: String, required: true },
    pret: { type: String, required: true },
    cartier: { type: String, required: true },
    strada: { type: String, required: true },
    detalii: { type: String, required: true },
    imagine: { type: String }, // URL către Cloudinary
    dataCrearii: { type: Date, default: Date.now }
}, { index: true });

const ChatSchema = new mongoose.Schema({
    nume: String,
    text: String,
    data: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Anunt = mongoose.model('Anunt', AnuntSchema);
const MesajChat = mongoose.model('MesajChat', ChatSchema);

// ==========================================
// RUTE AUTENTIFICARE (JWT + BCRYPT)
// ==========================================
app.post('/api/inregistrare', async (req, res) => {
    try {
        const { nume, contact, parola } = req.body;
        if (!nume || !contact || !parola) 
            return res.status(400).json({ mesaj: "Toate câmpurile sunt obligatorii!" });
        
        const existent = await User.findOne({ contact });
        if (existent) 
            return res.status(400).json({ mesaj: "Acest contact este deja înregistrat!" });

        const hash = await bcrypt.hash(parola, 10);
        const user = await new User({ nume, contact, parola: hash }).save();
        
        // Generare Token JWT
        const token = jwt.sign(
            { id: user._id, contact: user.contact }, 
            process.env.JWT_SECRET || 'braila-hub-secret-key-2026'
        );

        res.status(201).json({ 
            mesaj: "Cont creat cu succes!", 
            token, 
            user: { nume: user.nume, contact: user.contact } 
        });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ mesaj: "Eroare la înregistrare" }); 
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { contact, parola } = req.body;
        const user = await User.findOne({ contact });
        
        if (!user || !(await bcrypt.compare(parola, user.parola))) 
            return res.status(400).json({ mesaj: "Date de autentificare incorecte!" });

        user.vizite += 1; 
        await user.save();

        const token = jwt.sign(
            { id: user._id, contact: user.contact }, 
            process.env.JWT_SECRET || 'braila-hub-secret-key-2026'
        );

        res.json({ 
            mesaj: "Autentificare reușită!", 
            token, 
            user: { nume: user.nume, contact: user.contact } 
        });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ mesaj: "Eroare la login" }); 
    }
});

// ==========================================
// RUTE ANUNȚURI (CU UPLOAD IMAGINI)
// ==========================================
app.get('/api/anunturi', async (req, res) => {
    try {
        const { cautare } = req.query;
        let query = {};
        
        if (cautare) {
            query = { $or: [
                { titlu: { $regex: cautare, $options: 'i' } },
                { detalii: { $regex: cautare, $options: 'i' } }, // FIX: Era 'detali'
                { cartier: { $regex: cautare, $options: 'i' } },
                { categorie: { $regex: cautare, $options: 'i' } }
            ]};
        }
        
        const anunturi = await Anunt.find(query).sort({ dataCrearii: -1 }).limit(50);
        res.json(anunturi);
    } catch (err) { 
        res.status(500).json({ mesaj: "Eroare la preluarea anunțurilor" }); 
    }
});

app.post('/api/anunturi', upload.single('imagine'), async (req, res) => {
    try {
        const { telefon, categorie, titlu, pret, cartier, strada, detalii } = req.body;
        
        // Validare telefon
        if (!telefon || !/^\d{10,}$/.test(telefon)) 
            return res.status(400).json({ mesaj: "Introdu un număr de telefon valid (minim 10 cifre)!" });

        // Verificare limită 5 anunțuri
        const count = await Anunt.countDocuments({ telefon });
        if (count >= 5) 
            return res.status(400).json({ mesaj: "Ai atins limita maximă de 5 anunțuri pentru acest telefon!" });

        // Upload imagine pe Cloudinary (dacă există)
        let imgUrl = null;
        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'braila-hub', resource_type: 'image' }, 
                    (error, result) => error ? reject(error) : resolve(result)
                );
                stream.end(req.file.buffer);
            });
            imgUrl = result.secure_url;
        }

        await new Anunt({ 
            telefon, categorie, titlu, pret, cartier, strada, detalii, imagine: imgUrl 
        }).save();

        res.status(201).json({ mesaj: "Anunț publicat cu succes!" });
    } catch (err) { 
        console.error("Eroare salvare anunț:", err);
        res.status(500).json({ mesaj: "Eroare la salvarea anunțului" }); 
    }
});

// ==========================================
// RUTE CHAT
// ==========================================
app.get('/api/chat', async (req, res) => {
    try {
        const mesaje = await MesajChat.find().sort({ data: 1 }).limit(50);
        res.json(mesaje);
    } catch(e) { res.status(500).json({ mesaj: "Eroare chat" }); }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { nume, text } = req.body;
        if (!nume || !text?.trim()) return res.status(400).json({ mesaj: "Mesaj invalid" });
        
        const m = await new MesajChat({ nume, text }).save();
        res.status(201).json(m);
    } catch(e) { res.status(500).json({ mesaj: "Eroare trimitere mesaj" }); }
});

// START SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Braila Hub rulează pe portul ${PORT}`);
});