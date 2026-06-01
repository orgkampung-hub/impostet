const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const screen = ref('login');
        const myId = ref('');
        const myName = ref('');
        const peerIdInput = ref('');
        const kodBilik = ref('');
        
        const maxPlayers = ref(4);
        const isHost = ref(false);
        const senaraiPemain = ref([]); 
        
        const myRole = ref('');
        const kategoriKunci = ref('');
        const kataKunci = ref('');
        const kataKunciImposter = ref('');
        
        const isRevealed = ref(false); 

        const statusGame = ref('perbincangan'); 
        const sudahUndi = ref(false);
        const pilihanSaya = ref('');
        const maklumatTamat = ref('');
        const senaraiUndiDiterima = ref([]); 

        let peer = null;
        let senaraiConn = []; 
        let connToHost = null; 
        let databasePerkataan = []; 

        onMounted(() => {
            const savedName = localStorage.getItem('imp_user_name');
            if (savedName) myName.value = savedName;
        });

        const handleLogin = () => {
            if (!myName.value.trim()) return;
            localStorage.setItem('imp_user_name', myName.value);
            
            myId.value = Math.random().toString(36).substring(2, 6).toUpperCase();
            peer = new Peer(myId.value);
            
            peer.on('open', () => {
                screen.value = 'menu';
            });

            peer.on('error', (err) => {
                alert("Ralat Rangkaian PeerJS: " + err.type);
                window.location.reload();
            });
        };

        const buatBilik = async () => {
            isHost.value = true;
            kodBilik.value = myId.value;
            screen.value = 'lobby';
            
            senaraiPemain.value.push({
                id: myId.value,
                nama: myName.value,
                role: 'Sivil',
                point: 0,
                undian: 0,
                pilihanUndi: ''
            });

            await muatTurunPerkataan();

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
                    isRevealed.value = false; 
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

        const muatTurunPerkataan = async () => {
            try {
                const res = await fetch('words.json');
                databasePerkataan = await res.json();
            } catch (e) {
                databasePerkataan = [{ kategori: "Makanan", sivil: "Nasi Lemak", imposter: "Bersambal" }];
            }
        };

        const mulaPermainan = () => {
            if (senaraiPemain.value.length < 2) return; 

            const indexRawak = Math.floor(Math.random() * senaraiPemain.value.length);
            senaraiPemain.value.forEach((p, idx) => {
                p.role = (idx === indexRawak) ? 'Imposter' : 'Sivil';
                p.undian = 0;
                p.pilihanUndi = '';
            });

            const itemRawak = databasePerkataan[Math.floor(Math.random() * databasePerkataan.length)];
            kategoriKunci.value = itemRawak.kategori;
            kataKunci.value = itemRawak.sivil;
            kataKunciImposter.value = itemRawak.imposter;

            const saya = senaraiPemain.value.find(p => p.id === myId.value);
            myRole.value = saya.role;

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
            isRevealed.value = false; 
            senaraiUndiDiterima.value = [];
            screen.value = 'game';
        };

        const tukarFasaUndian = () => {
            statusGame.value = 'undian';
            senaraiConn.forEach(c => {
                if (c.open) c.send({ type: 'MASUK_FASA_UNDI' });
            });
        };

        // --- KEMASKINI LOGIK UNDI BOLEH CANCEL ---
        const mengundi = (idCalon) => {
            let targetUndi = idCalon;

            // Jika klik nama yang sama buat kali kedua, bermaksud CANCEL undi
            if (pilihanSaya.value === idCalon) {
                targetUndi = ''; // Set undian jadi kosong semula
                pilihanSaya.value = '';
            } else {
                pilihanSaya.value = idCalon; // Set target baharu
            }
            
            if (isHost.value) {
                prosesMekanikUndi(myId.value, targetUndi);
            } else {
                connToHost.send({ type: 'HANTAR_UNDI', pengundi: myId.value, daundi: targetUndi });
            }
        };

        const prosesMekanikUndi = (dariId, keId) => {
            const pengundi = senaraiPemain.value.find(p => p.id === dariId);
            if (pengundi) pengundi.pilihanUndi = keId;

            // Kemaskini senarai tracker id yang sudah sah mengundi (tidak kosong)
            if (keId === '') {
                // Jika player cancel undi, buang dia dari tracker senaraiUndiDiterima
                senaraiUndiDiterima.value = senaraiUndiDiterima.value.filter(id => id !== dariId);
            } else {
                // Jika belum ada dalam tracker, masukkan id dia
                if (!senaraiUndiDiterima.value.includes(dariId)) {
                    senaraiUndiDiterima.value.push(dariId);
                }
            }

            // Game hanya akan kira point jika jumlah pengundi sah menyamai jumlah total pemain
            if (senaraiUndiDiterima.value.length >= senaraiPemain.value.length) {
                kiraKiraanMataRound();
            }
        };

        const kiraKiraanMataRound = () => {
            senaraiPemain.value.forEach(p => p.undian = 0);
            
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
            } else {
                imposter.point += 3;
                ringkasan += `🎭 TERLEPAS! Imposter berjaya memperdayakan ahli meja.\n`;
                if (isSeri) ringkasan += `(Undian tertinggi berakhir dengan keputusan seri!)\n`;
                
                ringkasan += `\n📊 Kutipan Mata Pusingan Ini:\n`;
                senaraiPemain.value.forEach(p => {
                    if (p.role === 'Sivil') ringkasan += `- ${p.nama}: 0 Point\n`;
                });
                ringkasan += `- ${imposter.nama} (Imposter): +3 Point`;
            }

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

        const keluarGame = () => { window.location.reload(); };
        const padamNama = () => { localStorage.clear(); window.location.reload(); };

        const susunPemain = computed(() => {
            return [...senaraiPemain.value].sort((a, b) => b.point - a.point);
        });

        return {
            screen, myId, myName, peerIdInput, kodBilik, maxPlayers, isHost, senaraiPemain,
            myRole, kategoriKunci, kataKunci, kataKunciImposter, isRevealed, statusGame, sudahUndi, pilihanSaya, maklumatTamat,
            handleLogin, buatBilik, sertaiBilik, mulaPermainan, tukarFasaUndian, mengundi, nextRound, keluarGame, padamNama,
            susunPemain
        };
    }
}).mount('#app');
