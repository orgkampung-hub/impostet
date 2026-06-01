const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        // Skrin Utama Aliran Game: 'login', 'menu', 'lobby', 'game', 'result'
        const screen = ref('login');
        const myId = ref('');
        const myName = ref('');
        const peerIdInput = ref('');
        const kodBilik = ref('');
        
        // Konfigurasi Kumpulan & Bilik
        const maxPlayers = ref(4);
        const isHost = ref(false);
        const senaraiPemain = ref([]); // Unsur: { id, nama, role, point, undian, pilihanUndi }
        
        // Rahsia Pusingan (Round)
        const myRole = ref('');
        const kategoriKunci = ref('');
        const kataKunci = ref('');
        const kataKunciImposter = ref('');
        
        // Fasa Gameplay & Status Undi
        const statusGame = ref('perbincangan'); // 'perbincangan' atau 'undian'
        const sudahUndi = ref(false);
        const pilihanSaya = ref('');
        const maklumatTamat = ref('');
        const senaraiUndiDiterima = ref([]); // Track id pengundi untuk dikira oleh Host

        let peer = null;
        let senaraiConn = []; // Digunakan oleh Host untuk kawal senarai peranti rakan
        let connToHost = null; // Digunakan oleh Player Biasa untuk bercakap dengan Host
        let databasePerkataan = []; // Memegang list dari words.json

        onMounted(() => {
            const savedName = localStorage.getItem('imp_user_name');
            if (savedName) myName.value = savedName;
        });

        // --- SISTEM PENDAFTARAN & LOGIN ---
        const handleLogin = () => {
            if (!myName.value.trim()) return;
            localStorage.setItem('imp_user_name', myName.value);
            
            // Jana 4 Aksara Token sebagai Peer ID Bilik
            myId.value = Math.random().toString(36).substring(2, 6).toUpperCase();
            
            // Mulakan sambungan PeerJS ke Cloud Server Awam
            peer = new Peer(myId.value);
            
            peer.on('open', () => {
                screen.value = 'menu';
            });

            peer.on('error', (err) => {
                alert("Ralat Rangkaian PeerJS: " + err.type);
                window.location.reload();
            });
        };

        // --- PENGURUSAN AKSI HOST ---
        const buatBilik = async () => {
            isHost.value = true;
            kodBilik.value = myId.value;
            screen.value = 'lobby';
            
            // Masukkan diri sendiri selaku pemain pertama
            senaraiPemain.value.push({
                id: myId.value,
                nama: myName.value,
                role: 'Sivil',
                point: 0,
                undian: 0,
                pilihanUndi: ''
            });

            // Ambil data perkataan siap-siap
            await muatTurunPerkataan();

            // Sediakan telinga Host untuk dengar kemasukan rakan-rakan meja makan
            peer.on('connection', (conn) => {
                if (senaraiPemain.value.length >= maxPlayers.value || screen.value !== 'lobby') {
                    setTimeout(() => conn.close(), 500);
                    return;
                }

                senaraiConn.push(conn);

                conn.on('data', (data) => {
                    if (data.type === 'DAFTAR_NAMA') {
                        senaraiPemain.value.push({
                            id: conn.peer,
                            nama: data.nama,
                            role: 'Sivil',
                            point: 0,
                            undian: 0,
                            pilihanUndi: ''
                        });
                        hantarKemaskiniLobby();
                    }

                    if (data.type === 'HANTAR_UNDI') {
                        prosesMekanikUndi(data.pengundi, data.daundi);
                    }
                });

                conn.on('close', () => {
                    senaraiConn = senaraiConn.filter(c => c.peer !== conn.peer);
                    senaraiPemain.value = senaraiPemain.value.filter(p => p.id !== conn.peer);
                    hantarKemaskiniLobby();
                });
            });
        };

        const hantarKemaskiniLobby = () => {
            senaraiConn.forEach(c => {
                if (c.open) {
                    c.send({
                        type: 'KEMASKINI_LOBBY',
                        pemain: senaraiPemain.value,
                        max: maxPlayers.value
                    });
                }
            });
        };

        // --- PENGURUSAN AKSI PEMAIN BIASA ---
        const sertaiBilik = () => {
            if (!peerIdInput.value.trim()) return;
            isHost.value = false;
            kodBilik.value = peerIdInput.value.toUpperCase();
            
            connToHost = peer.connect(kodBilik.value);
            
            connToHost.on('open', () => {
                screen.value = 'lobby';
                connToHost.send({ type: 'DAFTAR_NAMA', nama: myName.value });
            });

            connToHost.on('data', (data) => {
                if (data.type === 'KEMASKINI_LOBBY') {
                    senaraiPemain.value = data.pemain;
                    maxPlayers.value = data.max;
                }
                if (data.type === 'MULA_GAME') {
                    senaraiPemain.value = data.pemain;
                    kategoriKunci.value = data.kategori;
                    kataKunci.value = data.sivil;
                    kataKunciImposter.value = data.imposter;
                    
                    const saya = data.pemain.find(p => p.id === myId.value);
                    myRole.value = saya ? saya.role : 'Sivil';
                    
                    statusGame.value = 'perbincangan';
                    sudahUndi.value = false;
                    pilihanSaya.value = '';
                    screen.value = 'game';
                }
                if (data.type === 'MASUK_FASA_UNDI') {
                    statusGame.value = 'undian';
                }
                if (data.type === 'TAMAT_ROUND') {
                    senaraiPemain.value = data.pemain;
                    maklumatTamat.value = data.mesej;
                    screen.value = 'result';
                }
            });

            connToHost.on('close', () => {
                alert('Talian ke peranti Host terputus!');
                window.location.reload();
            });
        };

        // --- DATABASE & LOGIK PENGURUSAN GAMEPLAY ---
        const muatTurunPerkataan = async () => {
            try {
                const res = await fetch('words.json');
                databasePerkataan = await res.json();
            } catch (e) {
                // Sediakan data sandaran sekiranya fail words.json gagal dibaca
                databasePerkataan = [{ kategori: "Makanan", sivil: "Nasi Lemak", imposter: "Roti Canai" }];
            }
        };

        const mulaPermainan = () => {
            if (senaraiPemain.value.length < 3) return;

            // 1. Pilih Imposter secara Rawak
            const indexRawak = Math.floor(Math.random() * senaraiPemain.value.length);
            senaraiPemain.value.forEach((p, idx) => {
                p.role = (idx === indexRawak) ? 'Imposter' : 'Sivil';
                p.undian = 0;
                p.pilihanUndi = '';
            });

            // 2. Pilih Rahsia Perkataan dari database
            const itemRawak = databasePerkataan[Math.floor(Math.random() * databasePerkataan.length)];
            kategoriKunci.value = itemRawak.kategori;
            kataKunci.value = itemRawak.sivil;
            kataKunciImposter.value = itemRawak.imposter;

            // Tetapkan peranan untuk Host sendiri
            const saya = senaraiPemain.value.find(p => p.id === myId.value);
            myRole.value = saya.role;

            // 3. Edarkan Arahan Mula Game kepada semua peranti
            senaraiConn.forEach(c => {
                if (c.open) {
                    c.send({
                        type: 'MULA_GAME',
                        pemain: senaraiPemain.value,
                        kategori: kategoriKunci.value,
                        sivil: kataKunci.value,
                        imposter: kataKunciImposter.value
                    });
                }
            });

            statusGame.value = 'perbincangan';
            sudahUndi.value = false;
            pilihanSaya.value = '';
            senaraiUndiDiterima.value = [];
            screen.value = 'game';
        };

        const tukarFasaUndian = () => {
            statusGame.value = 'undian';
            senaraiConn.forEach(c => {
                if (c.open) c.send({ type: 'MASUK_FASA_UNDI' });
            });
        };

        const mengundi = (idCalon) => {
            sudahUndi.value = true;
            pilihanSaya.value = idCalon;
            
            if (isHost.value) {
                prosesMekanikUndi(myId.value, idCalon);
            } else {
                connToHost.send({ type: 'HANTAR_UNDI', pengundi: myId.value, daundi: idCalon });
            }
        };

        const prosesMekanikUndi = (dariId, keId) => {
            if (senaraiUndiDiterima.value.includes(dariId)) return;
            senaraiUndiDiterima.value.push(dariId);

            const pengundi = senaraiPemain.value.find(p => p.id === dariId);
            if (pengundi) pengundi.pilihanUndi = keId;

            // Kira jika semua peranti meja makan selesai buat pilihan
            if (senaraiUndiDiterima.value.length >= senaraiPemain.value.length) {
                kiraKiraanMataRound();
            }
        };

        const kiraKiraanMataRound = () => {
            // Reset undian kaunter pusingan ini
            senaraiPemain.value.forEach(p => p.undian = 0);
            
            // Kira taburan undi
            senaraiPemain.value.forEach(p => {
                const sasaran = senaraiPemain.value.find(c => c.id === p.pilihanUndi);
                if (sasaran) sasaran.undian++;
            });

            const imposter = senaraiPemain.value.find(p => p.role === 'Imposter');
            let idTertinggi = '';
            let nilaiMax = -1;
            let isSeri = false;

            senaraiPemain.value.forEach(p => {
                if (p.undian > nilaiMax) {
                    nilaiMax = p.undian;
                    idTertinggi = p.id;
                    isSeri = false;
                } else if (p.undian === nilaiMax && nilaiMax > 0) {
                    isSeri = true;
                }
            });

            let ringkasan = `--- KEPUTUSAN ROUND ---\n\n`;
            ringkasan += `Kategori: ${kategoriKunci.value}\n`;
            ringkasan += `Kata Kunci Sivil: ${kataKunci.value}\n`;
            ringkasan += `Kata Kunci Imposter: ${kataKunciImposter.value}\n`;
            ringkasan += `Identiti Imposter Sebenar: ${imposter.nama}\n\n`;

            // SEMAK SENARIO A: Imposter Terkantoikan (Tepat & Tiada Seri)
            if (!isSeri && idTertinggi === imposter.id) {
                imposter.point -= 1;
                ringkasan += `💥 KANTOI! Meja makan berjaya mengesan Imposter.\n\n📊 Kutipan Mata Pusingan Ini:\n`;
                
                senaraiPemain.value.forEach(p => {
                    if (p.role === 'Sivil') {
                        if (p.pilihanUndi === imposter.id) {
                            p.point += 1;
                            ringkasan += `- ${p.nama}: +1 Point (Teka Tepat)\n`;
                        } else {
                            ringkasan += `- ${p.nama}: 0 Point (Salah Teka)\n`;
                        }
                    }
                });
                ringkasan += `- ${imposter.nama} (Imposter): -1 Point`;
            } 
            // SEMAK SENARIO B: Imposter Selamat Menyamar (Orang lain diundi atau seri)
            else {
                imposter.point += 3;
                ringkasan += `🎭 TERLEPAS! Imposter berjaya memperdayakan ahli meja.\n`;
                if (isSeri) ringkasan += `(Undian tertinggi berakhir dengan keputusan seri!)\n`;
                
                ringkasan += `\n📊 Kutipan Mata Pusingan Ini:\n`;
                senaraiPemain.value.forEach(p => {
                    if (p.role === 'Sivil') ringkasan += `- ${p.nama}: 0 Point\n`;
                });
                ringkasan += `- ${imposter.nama} (Imposter): +3 Point`;
            }

            // Hantar maklumat akhir round ke semua player
            senaraiConn.forEach(c => {
                if (c.open) {
                    c.send({
                        type: 'TAMAT_ROUND',
                        pemain: senaraiPemain.value,
                        mesej: ringkasan
                    });
                }
            });

            maklumatTamat.value = ringkasan;
            screen.value = 'result';
        };

        const nextRound = () => {
            mulaPermainan();
        };

        // --- PEMBERSIHAN DATA ---
        const keluarGame = () => { window.location.reload(); };
        const padamNama = () => { localStorage.clear(); window.location.reload(); };

        // Computed Properties untuk susun kedudukan Leaderboard
        const susunPemain = computed(() => {
            return [...senaraiPemain.value].sort((a, b) => b.point - a.point);
        });

        return {
            screen, myId, myName, peerIdInput, kodBilik, maxPlayers, isHost, senaraiPemain,
            myRole, kategoriKunci, kataKunci, kataKunciImposter, statusGame, sudahUndi, pilihanSaya, maklumatTamat,
            handleLogin, buatBilik, sertaiBilik, mulaPermainan, tukarFasaUndian, mengundi, nextRound, keluarGame, padamNama,
            susunPemain
        };
    }
}).mount('#app');
