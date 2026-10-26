#!/usr/bin/env bash
# Crea un certificato HTTPS per usare l'app (PWA) dai telefoni in rete locale.
# Genera un'autorità di certificazione locale (certs/ca.pem) e un certificato del server firmato da lei,
# valido per localhost e per gli indirizzi IP attuali del computer.
# Sui telefoni va installato una volta sola certs/ca.pem come certificato attendibile (vedi README).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p certs
cd certs

ips=$(hostname -I 2>/dev/null || true)
san="DNS:localhost,IP:127.0.0.1"
for ip in $ips; do
  [[ "$ip" == *:* ]] && continue # solo IPv4
  san="$san,IP:$ip"
done

if [[ ! -f ca.pem ]]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 -keyout ca-key.pem -out ca.pem \
    -subj "/CN=Tavolo Commander - autorita locale" 2>/dev/null
fi
openssl req -newkey rsa:2048 -nodes -keyout key.pem -out server.csr -subj "/CN=Tavolo Commander" 2>/dev/null
printf "subjectAltName=%s\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n" "$san" > ext.cnf
openssl x509 -req -in server.csr -CA ca.pem -CAkey ca-key.pem -CAcreateserial -days 825 -out cert.pem -extfile ext.cnf 2>/dev/null
rm -f server.csr ext.cnf ca.srl
chmod 600 ca-key.pem key.pem
echo "Certificato creato per: $san"
echo "Da installare sui telefoni come certificato attendibile: $(pwd)/ca.pem"
